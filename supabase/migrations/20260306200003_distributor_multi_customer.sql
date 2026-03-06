/*
  # Distributor Multi-Customer Support

  Replaces the single distributors.organization_id FK with a many-to-many
  junction table `distributor_customers`. Each distributor can serve multiple
  customer organizations, with typically one sales rep per customer.

  Steps:
  1. Create distributor_customers junction table
  2. Migrate any existing data from distributors.organization_id
  3. Drop the organization_id column from distributors
  4. Recreate distributor_overview view without organization_id
  5. Add RLS policies
*/

-- ── 1. Create junction table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS distributor_customers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id  UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(distributor_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_distributor_customers_distributor
  ON distributor_customers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_customers_organization
  ON distributor_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_distributor_customers_active
  ON distributor_customers(is_active) WHERE is_active = true;

-- ── 2. Migrate existing data ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributors' AND column_name = 'organization_id'
  ) THEN
    INSERT INTO distributor_customers (distributor_id, organization_id)
    SELECT id, organization_id
    FROM distributors
    WHERE organization_id IS NOT NULL
    ON CONFLICT (distributor_id, organization_id) DO NOTHING;
  END IF;
END $$;

-- ── 3. Drop the old column ──────────────────────────────────────────────────
-- Must drop the view first since it references organization_id
DROP VIEW IF EXISTS distributor_overview;

ALTER TABLE distributors DROP COLUMN IF EXISTS organization_id;

-- ── 4. Recreate view without organization_id ────────────────────────────────
CREATE OR REPLACE VIEW distributor_overview AS
SELECT
  d.id,
  d.name,
  d.code,
  d.commission_type,
  d.commission_rate,
  d.is_active,
  d.notes,
  d.profile_id,
  p.email                         AS profile_email,
  COUNT(DISTINCT dc.organization_id) FILTER (WHERE dc.is_active) AS customer_count,
  COUNT(dsr.id) FILTER (WHERE dsr.is_active) AS active_sales_rep_count
FROM distributors d
LEFT JOIN profiles              p   ON p.id  = d.profile_id
LEFT JOIN distributor_customers dc  ON dc.distributor_id = d.id
LEFT JOIN distributor_sales_reps dsr ON dsr.distributor_id = d.id
GROUP BY d.id, p.email;

COMMENT ON VIEW distributor_overview IS
  'Convenience view: distributor + customer count + rep count';

-- ── 5. RLS policies ─────────────────────────────────────────────────────────
ALTER TABLE distributor_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to distributor_customers"
  ON distributor_customers FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

CREATE POLICY "Distributors can view their own customer relationships"
  ON distributor_customers FOR SELECT
  TO authenticated
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE profile_id = (select auth.uid())
    )
  );
