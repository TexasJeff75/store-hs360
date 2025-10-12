/*
  # Add Product Markup Allowance Settings

  1. New Table: product_settings
    - `product_id` (bigint, primary key) - BigCommerce product ID
    - `allow_markup` (boolean, default false) - Whether this product can be marked up above retail
    - `product_name` (text) - Cached product name for admin reference
    - `created_at` (timestamptz) - When setting was created
    - `updated_at` (timestamptz) - When setting was last modified

  2. Security
    - Enable RLS on product_settings table
    - Only admins can manage product settings
    - All authenticated users can read settings to validate pricing

  3. Initial Data
    - Mark genetic testing and micronutrient testing as markup-allowed products
    - Product 113 = Pharmaneek (example, may need to identify actual test products)

  4. Validation
    - Add constraint to prevent markup_price when product doesn't allow markup
    - Update contract_pricing validation
*/

-- Create product_settings table
CREATE TABLE IF NOT EXISTS product_settings (
  product_id bigint PRIMARY KEY,
  allow_markup boolean DEFAULT false NOT NULL,
  product_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE product_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone authenticated can read, only admins can write
CREATE POLICY "Anyone can view product settings"
  ON product_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert product settings"
  ON product_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update product settings"
  ON product_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete product settings"
  ON product_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_product_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_product_settings_updated_at
  BEFORE UPDATE ON product_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_product_settings_updated_at();

-- Create validation function to check if markup is allowed
CREATE OR REPLACE FUNCTION validate_contract_pricing_markup()
RETURNS TRIGGER AS $$
BEGIN
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

-- Add trigger to validate markup on insert/update
DROP TRIGGER IF EXISTS validate_markup_allowance ON contract_pricing;
CREATE TRIGGER validate_markup_allowance
  BEFORE INSERT OR UPDATE ON contract_pricing
  FOR EACH ROW
  EXECUTE FUNCTION validate_contract_pricing_markup();

-- Add comment
COMMENT ON TABLE product_settings IS 'Controls which products can be marked up above retail price. Most products can only be discounted, but special products like genetic testing and micronutrient testing can be marked up.';
COMMENT ON COLUMN product_settings.allow_markup IS 'TRUE = Product can be marked up above retail (e.g., genetic testing). FALSE = Product can only be discounted below retail.';
