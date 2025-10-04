/*
  # Create contract pricing table

  1. New Tables
    - `contract_pricing`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles.id)
      - `product_id` (integer, BigCommerce product ID)
      - `contract_price` (decimal, custom price for this user/product)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `contract_pricing` table
    - Add policies for users to read their own pricing
    - Add policies for admins to manage all pricing

  3. Indexes
    - Index on user_id and product_id for fast lookups
*/

-- Create contract_pricing table
CREATE TABLE IF NOT EXISTS contract_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  contract_price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE contract_pricing ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own contract pricing"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all contract pricing"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert contract pricing"
  ON contract_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update contract pricing"
  ON contract_pricing
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete contract pricing"
  ON contract_pricing
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_pricing_user_id ON contract_pricing(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_product_id ON contract_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_user_product ON contract_pricing(user_id, product_id);

-- Trigger to update updated_at on contract pricing changes
CREATE TRIGGER update_contract_pricing_updated_at
  BEFORE UPDATE ON contract_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();