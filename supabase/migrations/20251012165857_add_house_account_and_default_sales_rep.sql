/*
  # Add House Account Support

  1. Changes to Organizations Table
    - Add `is_house_account` boolean flag to mark organizations without specific sales reps
    - Add `default_sales_rep_id` to specify primary sales rep for the organization
    - When `is_house_account` is true, orders get 0% commission

  2. Purpose
    - Allow organizations to be marked as house accounts (no commission)
    - Simplify sales rep assignment by having a default rep per organization
    - Maintain flexibility with organization_sales_reps for multiple reps

  3. Notes
    - House accounts bypass commission calculation
    - Default sales rep is used when creating orders if not specified
    - Can still have multiple sales reps via organization_sales_reps table
*/

-- Add house account flag and default sales rep to organizations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'is_house_account'
  ) THEN
    ALTER TABLE organizations ADD COLUMN is_house_account boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'default_sales_rep_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN default_sales_rep_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_organizations_default_sales_rep ON organizations(default_sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_organizations_house_account ON organizations(is_house_account) WHERE is_house_account = true;

-- Add comment for clarity
COMMENT ON COLUMN organizations.is_house_account IS 'When true, this organization is a house account with no sales commission';
COMMENT ON COLUMN organizations.default_sales_rep_id IS 'Default sales rep for this organization, used when creating orders';