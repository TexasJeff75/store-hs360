/*
  # Add missing columns to distributors table

  The DistributorManagement component references commission_type and user_id
  columns that don't exist in the original migration.

  - commission_type: Controls how commissions are calculated (percent_margin, flat_per_order, etc.)
  - user_id: References the auth user (same as profile_id, needed for RLS policies)
  - organization_id was moved to distributor_customers junction table (see 20260306200003)
*/

-- Add commission_type column
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS commission_type TEXT NOT NULL DEFAULT 'percent_margin';

-- organization_id removed: replaced by distributor_customers junction table
-- (see 20260306200003_distributor_multi_customer.sql)

-- Add user_id column (mirrors profile_id, used by RLS policies and commission queries)
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Backfill user_id from profile_id where missing
UPDATE distributors SET user_id = profile_id WHERE user_id IS NULL;

-- Add indexes
-- Note: organization_id was removed from distributors (see 20260306200003)
-- so the index on organization_id is no longer needed.
CREATE INDEX IF NOT EXISTS idx_distributors_user_id ON distributors(user_id);
