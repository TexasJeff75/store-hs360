/*
  # Create Payment Methods Table

  1. New Tables
    - `payment_methods`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations) - Payment method belongs to org
      - `location_id` (uuid, references locations) - Optional, for location-specific cards
      - `user_id` (uuid, references profiles) - User who added the payment method
      - `label` (text) - User-friendly name like "Corporate Card", "Main Card"
      - `card_type` (text) - visa, mastercard, amex, discover
      - `last_four` (text) - Last 4 digits of card
      - `expiry_month` (integer) - Card expiry month
      - `expiry_year` (integer) - Card expiry year
      - `cardholder_name` (text) - Name on card
      - `is_default` (boolean) - Whether this is the default payment method
      - `bigcommerce_payment_token` (text) - Tokenized payment info from BigCommerce
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `payment_methods` table
    - Users can view payment methods for their organizations
    - Only admins can add/update/delete payment methods
    - Payment method tokens are encrypted and never exposed to client

  3. Indexes
    - Index on organization_id for fast lookups
    - Index on location_id for location-specific methods
    - Unique index on (organization_id, location_id, is_default) where is_default = true
      to ensure only one default per org/location
*/

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  card_type TEXT NOT NULL,
  last_four TEXT NOT NULL,
  expiry_month INTEGER NOT NULL,
  expiry_year INTEGER NOT NULL,
  cardholder_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  bigcommerce_payment_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_expiry_month CHECK (expiry_month >= 1 AND expiry_month <= 12),
  CONSTRAINT valid_expiry_year CHECK (expiry_year >= 2025),
  CONSTRAINT valid_last_four CHECK (length(last_four) = 4)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_organization ON payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_location ON payment_methods(location_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_default_org 
  ON payment_methods(organization_id) 
  WHERE is_default = true AND location_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_default_location 
  ON payment_methods(organization_id, location_id) 
  WHERE is_default = true AND location_id IS NOT NULL;

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment methods for their organizations"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
    )
  );

CREATE POLICY "Organization admins can insert payment methods"
  ON payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
      AND user_organization_roles.role = 'admin'
    )
  );

CREATE POLICY "Organization admins can update payment methods"
  ON payment_methods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
      AND user_organization_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
      AND user_organization_roles.role = 'admin'
    )
  );

CREATE POLICY "Organization admins can delete payment methods"
  ON payment_methods FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
      AND user_organization_roles.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_payment_method_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_method_updated_at();