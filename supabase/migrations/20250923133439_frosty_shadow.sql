/*
  # Add missing columns to contract_pricing table

  1. New Columns
    - `pricing_type` (text) - Type of pricing: individual, organization, location
    - `entity_id` (uuid) - ID of the entity (user, organization, or location)
    - `min_quantity` (integer) - Minimum quantity for this price tier
    - `max_quantity` (integer) - Maximum quantity for this price tier
    - `effective_date` (timestamp) - When this pricing becomes effective
    - `expiry_date` (timestamp) - When this pricing expires
    - `created_by` (uuid) - Who created this pricing record

  2. Security
    - Update existing RLS policies to work with new structure

  3. Data Migration
    - Set default values for existing records
*/

-- Add missing columns to contract_pricing table
DO $$
BEGIN
  -- Add pricing_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'pricing_type'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN pricing_type text DEFAULT 'individual';
  END IF;

  -- Add entity_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN entity_id uuid;
  END IF;

  -- Add min_quantity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'min_quantity'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN min_quantity integer DEFAULT 1;
  END IF;

  -- Add max_quantity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'max_quantity'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN max_quantity integer;
  END IF;

  -- Add effective_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'effective_date'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN effective_date timestamptz DEFAULT now();
  END IF;

  -- Add expiry_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN expiry_date timestamptz;
  END IF;

  -- Add created_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN created_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Update existing records to have proper entity_id (set to user_id for individual pricing)
UPDATE contract_pricing 
SET entity_id = user_id, pricing_type = 'individual' 
WHERE entity_id IS NULL;

-- Create pricing type constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'contract_pricing' AND constraint_name = 'contract_pricing_pricing_type_check'
  ) THEN
    ALTER TABLE contract_pricing 
    ADD CONSTRAINT contract_pricing_pricing_type_check 
    CHECK (pricing_type IN ('individual', 'organization', 'location'));
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contract_pricing_pricing_type ON contract_pricing(pricing_type);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_entity_id ON contract_pricing(entity_id);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_effective_date ON contract_pricing(effective_date);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_expiry_date ON contract_pricing(expiry_date);

-- Update RLS policies to work with new structure
DROP POLICY IF EXISTS "Users can read own contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can read all contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can insert contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can update contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can delete contract pricing" ON contract_pricing;

-- Create new RLS policies
CREATE POLICY "Users can read own individual pricing"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (
    (pricing_type = 'individual' AND entity_id = auth.uid()) OR
    (pricing_type = 'organization' AND EXISTS (
      SELECT 1 FROM user_organization_roles 
      WHERE user_id = auth.uid() AND organization_id = entity_id
    )) OR
    (pricing_type = 'location' AND EXISTS (
      SELECT 1 FROM user_organization_roles 
      WHERE user_id = auth.uid() AND location_id = entity_id
    )) OR
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  );

CREATE POLICY "Admins can manage all contract pricing"
  ON contract_pricing
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));