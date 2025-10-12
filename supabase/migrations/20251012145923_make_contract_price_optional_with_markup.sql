/*
  # Make contract_price optional when markup_price is set

  1. Changes
    - Allow contract_price to be NULL when markup_price is NOT NULL
    - Add constraint: Either contract_price OR markup_price must be set (but not neither)
    - Update validation to ensure at least one price type exists

  2. Validation Logic
    - If markup_price is set, contract_price can be NULL (markup overrides)
    - If markup_price is NULL, contract_price must be set (standard discount)
    - Both cannot be NULL at the same time
*/

-- Drop existing NOT NULL constraint on contract_price
ALTER TABLE contract_pricing 
  ALTER COLUMN contract_price DROP NOT NULL;

-- Add check constraint to ensure at least one price is set
ALTER TABLE contract_pricing
  DROP CONSTRAINT IF EXISTS contract_pricing_price_check;

ALTER TABLE contract_pricing
  ADD CONSTRAINT contract_pricing_price_check 
  CHECK (
    contract_price IS NOT NULL OR markup_price IS NOT NULL
  );

-- Update the validation function to handle optional contract_price
CREATE OR REPLACE FUNCTION validate_contract_pricing_markup()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure at least one price type is set
  IF NEW.contract_price IS NULL AND NEW.markup_price IS NULL THEN
    RAISE EXCEPTION 'Either contract_price or markup_price must be set';
  END IF;

  -- If markup_price is set, verify the product allows markup
  IF NEW.markup_price IS NOT NULL THEN
    -- Check if product allows markup
    IF NOT EXISTS (
      SELECT 1 FROM product_settings
      WHERE product_id = NEW.product_id
      AND allow_markup = true
    ) THEN
      RAISE EXCEPTION 'Product % does not allow markup pricing. Only designated products (e.g., genetic testing, micronutrient testing) can have prices above retail.', NEW.product_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN contract_pricing.contract_price IS 'Discounted price below retail. Optional if markup_price is set (markup overrides).';
COMMENT ON COLUMN contract_pricing.markup_price IS 'Price above retail for special products. Optional. When set, overrides contract_price.';
