/*
  # Add Contract Pricing Conflict Validation

  1. Problem
    - Multiple pricing tiers can have overlapping quantity ranges
    - Example: Two tiers both starting at qty 1 creates ambiguity
    
  2. Solution
    - Add database function to check for conflicts
    - Add constraint trigger to prevent overlapping ranges
    - Validates that quantity ranges don't overlap for same product/entity
    
  3. Rules
    - Same product + entity + pricing_type cannot have overlapping quantity ranges
    - Range [min1, max1] overlaps [min2, max2] if: min1 <= max2 AND max1 >= min2
    - NULL max_quantity means infinity (999999999)
*/

-- Create function to check for pricing conflicts
CREATE OR REPLACE FUNCTION check_pricing_conflict()
RETURNS TRIGGER AS $$
DECLARE
  v_conflict_count integer;
  v_new_min integer;
  v_new_max integer;
BEGIN
  -- Get effective min/max (treat NULL max as infinity)
  v_new_min := NEW.min_quantity;
  v_new_max := COALESCE(NEW.max_quantity, 999999999);
  
  -- Check for overlapping ranges with existing entries
  SELECT COUNT(*) INTO v_conflict_count
  FROM contract_pricing
  WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND product_id = NEW.product_id
    AND entity_id = NEW.entity_id
    AND pricing_type = NEW.pricing_type
    AND (
      -- Check if ranges overlap: [new_min, new_max] overlaps [existing_min, existing_max]
      v_new_min <= COALESCE(max_quantity, 999999999)
      AND v_new_max >= min_quantity
    );
  
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Pricing conflict: Quantity range overlaps with existing pricing tier for this product and entity. Please adjust min/max quantities.'
      USING HINT = 'Each pricing tier must have a unique, non-overlapping quantity range.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate on insert/update
DROP TRIGGER IF EXISTS trigger_check_pricing_conflict ON contract_pricing;
CREATE TRIGGER trigger_check_pricing_conflict
  BEFORE INSERT OR UPDATE ON contract_pricing
  FOR EACH ROW
  EXECUTE FUNCTION check_pricing_conflict();

-- Add helpful comment
COMMENT ON FUNCTION check_pricing_conflict IS 'Prevents overlapping quantity ranges for the same product/entity/pricing_type combination';
