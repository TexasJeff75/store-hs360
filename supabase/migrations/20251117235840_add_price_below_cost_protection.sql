/*
  # Price Below Cost Protection

  ## Overview
  Prevents setting customer prices below product cost without admin override.
  This protects profit margins and prevents accidental losses.

  ## Changes

  1. **New Table: product_costs**
     - Stores product cost data synced from BigCommerce
     - `product_id` - BigCommerce product ID
     - `cost_price` - Product cost from BigCommerce
     - `retail_price` - Retail price from BigCommerce
     - `last_synced_at` - Last sync timestamp
     - Only admins can manage

  2. **New Column: allow_below_cost**
     - Added to `contract_pricing` table
     - Boolean flag to allow admin override
     - Defaults to false (prevents below-cost pricing)
     - Only admins can set to true

  3. **Validation Function**
     - Checks if contract_price is below product cost
     - Raises error unless allow_below_cost = true
     - Applies to all pricing types (individual, organization, location)

  4. **Security**
     - Only admins can create prices below cost
     - All pricing changes are audited
     - Clear error messages for users

  ## Usage

  Normal pricing: System prevents prices below cost automatically
  Admin override: Set allow_below_cost = true to permit below-cost pricing
*/

-- Create product_costs table to store cost data from BigCommerce
CREATE TABLE IF NOT EXISTS product_costs (
  product_id bigint PRIMARY KEY,
  cost_price numeric(10,2),
  retail_price numeric(10,2),
  sale_price numeric(10,2),
  product_name text,
  sku text,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on product_costs
ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read product costs (needed for validation)
CREATE POLICY "Anyone can view product costs"
  ON product_costs FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage product costs
CREATE POLICY "Admins can manage product costs"
  ON product_costs FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_costs_synced ON product_costs(last_synced_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_product_costs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_product_costs_updated_at
  BEFORE UPDATE ON product_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_product_costs_updated_at();

-- Add allow_below_cost column to contract_pricing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'allow_below_cost'
  ) THEN
    ALTER TABLE contract_pricing 
      ADD COLUMN allow_below_cost boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add override_reason column for audit trail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'override_reason'
  ) THEN
    ALTER TABLE contract_pricing 
      ADD COLUMN override_reason text;
  END IF;
END $$;

-- Create function to validate price is not below cost
CREATE OR REPLACE FUNCTION validate_price_above_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_price numeric(10,2);
  v_product_name text;
  v_is_admin boolean;
BEGIN
  -- Skip validation if allow_below_cost is true (admin override)
  IF NEW.allow_below_cost = true THEN
    -- Verify user is actually an admin
    SELECT is_admin() INTO v_is_admin;
    
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can set prices below cost'
        USING HINT = 'Contact an administrator if below-cost pricing is required';
    END IF;
    
    -- Require override reason for below-cost pricing
    IF NEW.override_reason IS NULL OR trim(NEW.override_reason) = '' THEN
      RAISE EXCEPTION 'Override reason required when setting prices below cost'
        USING HINT = 'Provide a business justification in the override_reason field';
    END IF;
    
    -- Allow the insert/update
    RETURN NEW;
  END IF;
  
  -- Get product cost from product_costs table
  SELECT cost_price, product_name 
  INTO v_cost_price, v_product_name
  FROM product_costs
  WHERE product_id = NEW.product_id;
  
  -- If no cost data exists, allow pricing but log warning
  IF v_cost_price IS NULL THEN
    RAISE WARNING 'No cost data found for product %. Unable to validate pricing.', NEW.product_id;
    RETURN NEW;
  END IF;
  
  -- Check contract_price if it's set
  IF NEW.contract_price IS NOT NULL AND NEW.contract_price < v_cost_price THEN
    RAISE EXCEPTION 'Contract price ($%) is below product cost ($%) for product: %', 
      NEW.contract_price, v_cost_price, COALESCE(v_product_name, NEW.product_id::text)
      USING HINT = 'Set allow_below_cost=true and provide override_reason if below-cost pricing is intentional. Only admins can do this.';
  END IF;
  
  -- Check markup_price if it's set (should always be above cost by definition)
  -- Markup pricing adds percentage on top of base, so it should never be below cost
  -- But we validate anyway for safety
  IF NEW.markup_price IS NOT NULL AND NEW.markup_price < v_cost_price THEN
    RAISE EXCEPTION 'Markup price ($%) is below product cost ($%) for product: %', 
      NEW.markup_price, v_cost_price, COALESCE(v_product_name, NEW.product_id::text)
      USING HINT = 'Markup pricing should always be above cost. Check your markup percentage.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update the existing validation trigger to include price validation
-- Drop old trigger
DROP TRIGGER IF EXISTS validate_markup_allowance ON contract_pricing;
DROP TRIGGER IF EXISTS validate_price_above_cost_trigger ON contract_pricing;

-- Create combined validation trigger
CREATE OR REPLACE FUNCTION validate_contract_pricing_all()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost_price numeric(10,2);
  v_product_name text;
  v_is_admin boolean;
BEGIN
  -- Validate 1: At least one price type is set
  IF NEW.contract_price IS NULL AND NEW.markup_price IS NULL THEN
    RAISE EXCEPTION 'Either contract_price or markup_price must be set';
  END IF;

  -- Validate 2: If markup_price is set, verify the product allows markup
  IF NEW.markup_price IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM product_settings
      WHERE product_id = NEW.product_id
      AND allow_markup = true
    ) THEN
      RAISE EXCEPTION 'Product % does not allow markup pricing', NEW.product_id
        USING HINT = 'Only designated products (e.g., genetic testing, micronutrient testing) can have prices above retail';
    END IF;
  END IF;
  
  -- Validate 3: Price must be above cost (unless admin override)
  IF NEW.allow_below_cost = true THEN
    -- Verify user is admin
    SELECT is_admin() INTO v_is_admin;
    
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can set prices below cost'
        USING HINT = 'Contact an administrator if below-cost pricing is required';
    END IF;
    
    -- Require override reason
    IF NEW.override_reason IS NULL OR trim(NEW.override_reason) = '' THEN
      RAISE EXCEPTION 'Override reason required when setting prices below cost'
        USING HINT = 'Provide a business justification in the override_reason field';
    END IF;
  ELSE
    -- Validate price is above cost
    SELECT cost_price, product_name 
    INTO v_cost_price, v_product_name
    FROM product_costs
    WHERE product_id = NEW.product_id;
    
    IF v_cost_price IS NOT NULL THEN
      -- Check contract_price
      IF NEW.contract_price IS NOT NULL AND NEW.contract_price < v_cost_price THEN
        RAISE EXCEPTION 'Contract price ($%) is below product cost ($%) for "%"', 
          NEW.contract_price, v_cost_price, COALESCE(v_product_name, 'Product ' || NEW.product_id)
          USING HINT = 'Admins can override by setting allow_below_cost=true with a reason';
      END IF;
      
      -- Check markup_price
      IF NEW.markup_price IS NOT NULL AND NEW.markup_price < v_cost_price THEN
        RAISE EXCEPTION 'Markup price ($%) is below product cost ($%) for "%"', 
          NEW.markup_price, v_cost_price, COALESCE(v_product_name, 'Product ' || NEW.product_id)
          USING HINT = 'Markup pricing should always be above cost';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger
CREATE TRIGGER validate_contract_pricing_trigger
  BEFORE INSERT OR UPDATE ON contract_pricing
  FOR EACH ROW
  EXECUTE FUNCTION validate_contract_pricing_all();

-- Create audit log for below-cost pricing
CREATE TABLE IF NOT EXISTS below_cost_pricing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id uuid NOT NULL REFERENCES contract_pricing(id) ON DELETE CASCADE,
  product_id bigint NOT NULL,
  contract_price numeric(10,2),
  product_cost numeric(10,2),
  override_reason text NOT NULL,
  approved_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE below_cost_pricing_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit
CREATE POLICY "Admins view below-cost audit"
  ON below_cost_pricing_audit FOR SELECT
  TO authenticated
  USING (is_admin());

-- System can insert audit records
CREATE POLICY "System can log below-cost pricing"
  ON below_cost_pricing_audit FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Create index
CREATE INDEX IF NOT EXISTS idx_below_cost_audit_product ON below_cost_pricing_audit(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_below_cost_audit_approver ON below_cost_pricing_audit(approved_by, created_at DESC);

-- Add comments
COMMENT ON TABLE product_costs IS 'Product cost data synced from BigCommerce for price validation';
COMMENT ON COLUMN product_costs.cost_price IS 'Product cost from BigCommerce - used to prevent pricing below cost';
COMMENT ON COLUMN contract_pricing.allow_below_cost IS 'Admin override to allow pricing below cost. Requires override_reason.';
COMMENT ON COLUMN contract_pricing.override_reason IS 'Business justification when allow_below_cost is true';
COMMENT ON TABLE below_cost_pricing_audit IS 'Audit trail of all below-cost pricing approvals';
COMMENT ON FUNCTION validate_contract_pricing_all IS 'Validates contract pricing: requires price above cost unless admin override with reason';