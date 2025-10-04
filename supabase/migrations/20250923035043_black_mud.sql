/*
  # Consolidate all pricing into a unified contract_pricing table

  1. Schema Changes
    - Expand `contract_pricing` table to handle all pricing types (individual, organization, location)
    - Add `pricing_type` enum to distinguish between different pricing levels
    - Add `entity_id` to reference user, organization, or location
    - Add quantity tiers and date ranges for advanced pricing
    - Drop separate `organization_pricing` and `location_pricing` tables

  2. Data Migration
    - Migrate existing organization pricing to contract_pricing
    - Migrate existing location pricing to contract_pricing
    - Preserve all existing individual contract pricing

  3. Security
    - Update RLS policies for the consolidated table
    - Ensure proper access control for different pricing types
*/

-- Create enum for pricing types
DO $$ BEGIN
    CREATE TYPE pricing_type AS ENUM ('individual', 'organization', 'location');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Backup existing data before migration
CREATE TABLE IF NOT EXISTS contract_pricing_backup AS 
SELECT * FROM contract_pricing;

CREATE TABLE IF NOT EXISTS organization_pricing_backup AS 
SELECT * FROM organization_pricing;

CREATE TABLE IF NOT EXISTS location_pricing_backup AS 
SELECT * FROM location_pricing;

-- Expand contract_pricing table to handle all pricing types
DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'pricing_type'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN pricing_type pricing_type DEFAULT 'individual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN entity_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'min_quantity'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN min_quantity integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'max_quantity'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN max_quantity integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'effective_date'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN effective_date timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN expiry_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_pricing' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE contract_pricing ADD COLUMN created_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Update existing individual pricing records
UPDATE contract_pricing 
SET 
  pricing_type = 'individual',
  entity_id = user_id,
  min_quantity = 1
WHERE pricing_type IS NULL OR pricing_type = 'individual';

-- Migrate organization pricing data
INSERT INTO contract_pricing (
  pricing_type,
  entity_id,
  product_id,
  contract_price,
  min_quantity,
  max_quantity,
  effective_date,
  expiry_date,
  created_by,
  created_at,
  updated_at
)
SELECT 
  'organization'::pricing_type,
  organization_id,
  product_id,
  contract_price,
  COALESCE(min_quantity, 1),
  max_quantity,
  COALESCE(effective_date, now()),
  expiry_date,
  created_by,
  created_at,
  updated_at
FROM organization_pricing
WHERE NOT EXISTS (
  SELECT 1 FROM contract_pricing cp 
  WHERE cp.pricing_type = 'organization' 
    AND cp.entity_id = organization_pricing.organization_id 
    AND cp.product_id = organization_pricing.product_id
    AND cp.effective_date = COALESCE(organization_pricing.effective_date, now())
);

-- Migrate location pricing data
INSERT INTO contract_pricing (
  pricing_type,
  entity_id,
  product_id,
  contract_price,
  min_quantity,
  max_quantity,
  effective_date,
  expiry_date,
  created_by,
  created_at,
  updated_at
)
SELECT 
  'location'::pricing_type,
  location_id,
  product_id,
  contract_price,
  COALESCE(min_quantity, 1),
  max_quantity,
  COALESCE(effective_date, now()),
  expiry_date,
  created_by,
  created_at,
  updated_at
FROM location_pricing
WHERE NOT EXISTS (
  SELECT 1 FROM contract_pricing cp 
  WHERE cp.pricing_type = 'location' 
    AND cp.entity_id = location_pricing.location_id 
    AND cp.product_id = location_pricing.product_id
    AND cp.effective_date = COALESCE(location_pricing.effective_date, now())
);

-- Update constraints and indexes
DROP INDEX IF EXISTS contract_pricing_user_id_product_id_key;

-- Create new unique constraint that handles all pricing types
CREATE UNIQUE INDEX IF NOT EXISTS contract_pricing_unique_idx 
ON contract_pricing (pricing_type, entity_id, product_id, effective_date);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contract_pricing_type ON contract_pricing (pricing_type);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_entity ON contract_pricing (entity_id);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_product ON contract_pricing (product_id);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_dates ON contract_pricing (effective_date, expiry_date);

-- Update RLS policies
DROP POLICY IF EXISTS "Admins can delete contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can insert contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can read all contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can update contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Users can read own contract pricing" ON contract_pricing;

-- Create comprehensive RLS policies for the consolidated table
CREATE POLICY "Admins can manage all contract pricing"
  ON contract_pricing
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read their individual pricing"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'individual' AND entity_id = auth.uid()
  );

CREATE POLICY "Users can read organization pricing for their orgs"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'organization' AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = contract_pricing.entity_id
        AND user_organization_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read location pricing for their locations"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'location' AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.location_id = contract_pricing.entity_id
        AND user_organization_roles.user_id = auth.uid()
    )
  );

-- Drop the old tables (commented out for safety - uncomment after verifying migration)
-- DROP TABLE IF EXISTS organization_pricing;
-- DROP TABLE IF EXISTS location_pricing;

-- Add helpful comments
COMMENT ON TABLE contract_pricing IS 'Unified pricing table for individual users, organizations, and locations';
COMMENT ON COLUMN contract_pricing.pricing_type IS 'Type of pricing: individual, organization, or location';
COMMENT ON COLUMN contract_pricing.entity_id IS 'ID of the entity (user_id, organization_id, or location_id)';
COMMENT ON COLUMN contract_pricing.user_id IS 'Legacy column - use entity_id with pricing_type instead';