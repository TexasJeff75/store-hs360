/*
  # Add missing columns to distributors table

  The DistributorManagement component references commission_type, organization_id,
  and user_id columns that don't exist in the original migration.

  - commission_type: Controls how commissions are calculated (percent_margin, flat_per_order, etc.)
  - organization_id: Links a distributor to an organization
  - user_id: References the auth user (same as profile_id, needed for RLS policies)
*/

-- Add commission_type column
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'percent_margin';

-- Add organization_id column with FK to organizations
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add user_id column (mirrors profile_id, used by RLS policies and commission queries)
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Backfill user_id from profile_id where missing
UPDATE distributors SET user_id = profile_id WHERE user_id IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_distributors_organization ON distributors(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_distributors_user_id ON distributors(user_id);
