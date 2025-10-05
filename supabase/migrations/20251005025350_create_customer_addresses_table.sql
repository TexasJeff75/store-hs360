/*
  # Create Customer Addresses Table

  1. New Tables
    - `customer_addresses`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid) - Reference to profiles table
      - `organization_id` (uuid, nullable) - For organization-level addresses
      - `location_id` (uuid, nullable) - For location-specific addresses
      - `address_type` (text) - Type: 'shipping' or 'billing'
      - `label` (text) - Friendly name (e.g., "Main Office", "Warehouse", "Home")
      - `first_name` (text) - Recipient first name
      - `last_name` (text) - Recipient last name
      - `company` (text, nullable) - Company name
      - `address1` (text) - Street address line 1
      - `address2` (text, nullable) - Street address line 2
      - `city` (text) - City
      - `state_or_province` (text) - State or province
      - `postal_code` (text) - Postal/ZIP code
      - `country_code` (text) - ISO country code
      - `phone` (text, nullable) - Contact phone
      - `email` (text, nullable) - Contact email
      - `is_default` (boolean) - Default address for this type
      - `is_active` (boolean) - Whether address is active
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `customer_addresses` table
    - Add policy for users to manage their own addresses
    - Add policy for admins/managers to manage organization addresses
    - Add policy for viewing addresses based on organization membership

  3. Indexes
    - Index on user_id for fast user address lookups
    - Index on organization_id for organization addresses
    - Index on location_id for location addresses
    - Composite index on (user_id, is_default, address_type) for default lookups
*/

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  address_type text NOT NULL CHECK (address_type IN ('shipping', 'billing')),
  label text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  company text,
  address1 text NOT NULL,
  address2 text,
  city text NOT NULL,
  state_or_province text NOT NULL,
  postal_code text NOT NULL,
  country_code text NOT NULL DEFAULT 'US',
  phone text,
  email text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user_id 
  ON customer_addresses(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_organization_id 
  ON customer_addresses(organization_id);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_location_id 
  ON customer_addresses(location_id);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_default_lookup 
  ON customer_addresses(user_id, is_default, address_type);

-- Enable RLS
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own addresses
CREATE POLICY "Users can view own addresses"
  ON customer_addresses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can view organization addresses if they're members
CREATE POLICY "Members can view organization addresses"
  ON customer_addresses
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
    )
  );

-- Policy: Users can insert their own addresses
CREATE POLICY "Users can create own addresses"
  ON customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND organization_id IS NULL);

-- Policy: Admins/managers can insert organization addresses
CREATE POLICY "Admins can create organization addresses"
  ON customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
      AND user_organization_roles.role IN ('admin', 'manager')
    )
  );

-- Policy: Users can update their own addresses
CREATE POLICY "Users can update own addresses"
  ON customer_addresses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND organization_id IS NULL)
  WITH CHECK (auth.uid() = user_id AND organization_id IS NULL);

-- Policy: Admins/managers can update organization addresses
CREATE POLICY "Admins can update organization addresses"
  ON customer_addresses
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
      AND user_organization_roles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
      AND user_organization_roles.role IN ('admin', 'manager')
    )
  );

-- Policy: Users can delete their own addresses
CREATE POLICY "Users can delete own addresses"
  ON customer_addresses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND organization_id IS NULL);

-- Policy: Admins/managers can delete organization addresses
CREATE POLICY "Admins can delete organization addresses"
  ON customer_addresses
  FOR DELETE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
      AND user_organization_roles.role IN ('admin', 'manager')
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_addresses_updated_at();