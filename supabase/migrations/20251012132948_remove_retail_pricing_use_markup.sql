/*
  # Remove Retail Pricing and Update Contract Pricing for Markup

  1. Changes
    - Drop retail_pricing table (incorrect approach)
    - Update contract_pricing to support markup above normal retail price
    - Add markup_price column to contract_pricing
    
  2. Pricing Model (Correct)
    - BigCommerce price = Normal retail price
    - Cost = From custom field "cost" in BigCommerce
    - Markup price = Optional higher price set by sales rep
    - Commission = 40% of (retail - cost) + 100% of (markup - retail)

  3. Notes
    - If markup_price is NULL, use normal BigCommerce retail price
    - If markup_price is set, that's what customer pays
    - Sales rep keeps 100% of the markup amount
*/

-- Drop retail pricing table and related objects
DROP FUNCTION IF EXISTS get_effective_retail_price(bigint, uuid, uuid);
DROP TRIGGER IF EXISTS set_retail_pricing_updated_at ON retail_pricing;
DROP FUNCTION IF EXISTS update_retail_pricing_updated_at();
DROP TABLE IF EXISTS retail_pricing CASCADE;

-- Add markup_price to contract_pricing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'markup_price'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN markup_price decimal(10,2);
  END IF;
END $$;

-- Add comment to clarify the pricing model
COMMENT ON COLUMN contract_pricing.contract_price IS 'Legacy: Original contract price (kept for backwards compatibility)';
COMMENT ON COLUMN contract_pricing.markup_price IS 'Optional markup above normal retail price. Sales rep gets 100% of (markup_price - normal_retail_price)';

-- Create function to get effective price (with markup)
CREATE OR REPLACE FUNCTION get_effective_price_with_markup(
  p_product_id bigint,
  p_normal_retail_price decimal,
  p_user_id uuid DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (
  effective_price decimal,
  has_markup boolean,
  markup_amount decimal
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_markup_price decimal;
BEGIN
  -- Priority: location > organization > individual
  
  -- Try location-specific pricing first
  IF p_location_id IS NOT NULL THEN
    SELECT markup_price INTO v_markup_price
    FROM contract_pricing
    WHERE product_id = p_product_id
      AND pricing_type = 'location'
      AND entity_id = p_location_id
      AND is_active = true
      AND markup_price IS NOT NULL
    LIMIT 1;
    
    IF v_markup_price IS NOT NULL THEN
      RETURN QUERY SELECT v_markup_price, true, (v_markup_price - p_normal_retail_price);
      RETURN;
    END IF;
  END IF;
  
  -- Try organization-specific pricing
  IF p_organization_id IS NOT NULL THEN
    SELECT markup_price INTO v_markup_price
    FROM contract_pricing
    WHERE product_id = p_product_id
      AND pricing_type = 'organization'
      AND entity_id = p_organization_id
      AND is_active = true
      AND markup_price IS NOT NULL
    LIMIT 1;
    
    IF v_markup_price IS NOT NULL THEN
      RETURN QUERY SELECT v_markup_price, true, (v_markup_price - p_normal_retail_price);
      RETURN;
    END IF;
  END IF;
  
  -- Try individual pricing
  IF p_user_id IS NOT NULL THEN
    SELECT markup_price INTO v_markup_price
    FROM contract_pricing
    WHERE product_id = p_product_id
      AND pricing_type = 'individual'
      AND entity_id = p_user_id
      AND is_active = true
      AND markup_price IS NOT NULL
    LIMIT 1;
    
    IF v_markup_price IS NOT NULL THEN
      RETURN QUERY SELECT v_markup_price, true, (v_markup_price - p_normal_retail_price);
      RETURN;
    END IF;
  END IF;
  
  -- No markup found, return normal retail price
  RETURN QUERY SELECT p_normal_retail_price, false, 0::decimal;
END;
$$;
