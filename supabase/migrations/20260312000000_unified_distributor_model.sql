-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Unified Distributor Model
-- ═══════════════════════════════════════════════════════════════════════════
-- Every sales rep now has a distributor entity:
--   - class='independent' — solo rep, same profile acts as both rep and distributor
--   - class='company'     — true distributor managing multiple reps
-- Both classes require W-9/1099 registration.
-- Organizations are typed as 'customer' or 'distributor'.
-- Customer orgs can be marked as house accounts (no sales rep required).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- 1. Add distributor_class to distributors
-- ═══════════════════════════════════════
ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS distributor_class text NOT NULL DEFAULT 'company';

-- Add CHECK constraint separately (safe for existing data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_distributor_class'
  ) THEN
    ALTER TABLE distributors
      ADD CONSTRAINT chk_distributor_class
      CHECK (distributor_class IN ('independent', 'company'));
  END IF;
END $$;

-- ═══════════════════════════════════════
-- 2. Add W-9/1099 fields to distributors
-- ═══════════════════════════════════════
ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS tax_id_type text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS tax_classification text,
  ADD COLUMN IF NOT EXISTS w9_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS w9_consent_date timestamptz,
  ADD COLUMN IF NOT EXISTS w9_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tax_id_type'
  ) THEN
    ALTER TABLE distributors
      ADD CONSTRAINT chk_tax_id_type
      CHECK (tax_id_type IS NULL OR tax_id_type IN ('ein', 'ssn'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tax_classification'
  ) THEN
    ALTER TABLE distributors
      ADD CONSTRAINT chk_tax_classification
      CHECK (tax_classification IS NULL OR tax_classification IN (
        'individual', 'sole_proprietor', 'llc_single', 'llc_partnership',
        'llc_corp', 'c_corp', 's_corp', 'partnership', 'trust', 'other'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_w9_status'
  ) THEN
    ALTER TABLE distributors
      ADD CONSTRAINT chk_w9_status
      CHECK (w9_status IN ('pending', 'received', 'verified'));
  END IF;
END $$;

-- ═══════════════════════════════════════
-- 3. Add org_type to organizations
-- ═══════════════════════════════════════
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS org_type text NOT NULL DEFAULT 'customer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_type'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT chk_org_type
      CHECK (org_type IN ('customer', 'distributor'));
  END IF;
END $$;

-- ═══════════════════════════════════════
-- 4. Add is_house_account to organizations
-- ═══════════════════════════════════════
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_house_account boolean NOT NULL DEFAULT false;

-- ═══════════════════════════════════════
-- 5. Add created_by to organizations
-- ═══════════════════════════════════════
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);

-- ═══════════════════════════════════════
-- 6. Backfill existing distributors
-- ═══════════════════════════════════════
-- All existing distributors are Company class
UPDATE distributors
SET distributor_class = 'company'
WHERE distributor_class IS NULL OR distributor_class = 'company';

-- ═══════════════════════════════════════
-- 7. Backfill org_type for distributor orgs
-- ═══════════════════════════════════════
UPDATE organizations SET org_type = 'distributor'
WHERE id IN (
  SELECT DISTINCT organization_id FROM distributor_customers
  WHERE organization_id IS NOT NULL
);

-- ═══════════════════════════════════════
-- 8. Index on org_type for filtering
-- ═══════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_organizations_org_type ON organizations(org_type);
CREATE INDEX IF NOT EXISTS idx_distributors_class ON distributors(distributor_class);
CREATE INDEX IF NOT EXISTS idx_distributors_w9_status ON distributors(w9_status);

-- ═══════════════════════════════════════
-- 9. Comment for documentation
-- ═══════════════════════════════════════
COMMENT ON COLUMN distributors.distributor_class IS 'independent = solo sales rep acting as own distributor; company = true distributor with multiple reps';
COMMENT ON COLUMN distributors.tax_id IS 'EIN or SSN for 1099 reporting (stored as text, should be encrypted at rest)';
COMMENT ON COLUMN distributors.tax_id_type IS 'ein or ssn';
COMMENT ON COLUMN distributors.legal_name IS 'Legal name as it appears on W-9';
COMMENT ON COLUMN distributors.business_name IS 'DBA / business name (optional)';
COMMENT ON COLUMN distributors.tax_classification IS 'IRS tax classification from W-9';
COMMENT ON COLUMN distributors.w9_consent IS 'Whether the distributor has certified their W-9 info';
COMMENT ON COLUMN distributors.w9_consent_date IS 'When consent was given';
COMMENT ON COLUMN distributors.w9_status IS 'pending = not yet collected, received = submitted, verified = admin verified';
COMMENT ON COLUMN organizations.org_type IS 'customer = buying org, distributor = sells/distributes';
COMMENT ON COLUMN organizations.is_house_account IS 'True if admin-managed with no sales rep assignment';
COMMENT ON COLUMN organizations.created_by IS 'Profile ID of user who created this org';
