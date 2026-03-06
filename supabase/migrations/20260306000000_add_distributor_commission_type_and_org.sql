/*
  # Distributor: Commission Type & Organization Link

  ## Changes

  ### `distributors` table
  - `commission_type` — what the commission rate is applied against:
      percent_gross_sales  → % of the order's gross total
      percent_margin       → % of (contracted price − product cost)
      percent_net_sales    → % of net sales (after discounts)
      flat_per_order       → flat $ amount per order
      flat_per_unit        → flat $ amount per unit sold
  - `organization_id`     — the primary customer organization this distributor serves

  ## Notes
  - Existing rows default to `percent_margin` (matches previous behaviour).
  - organization_id is nullable; a distributor may not yet be linked to an org.
  - commission_rate continues to represent the numeric value; for flat types it is
    a dollar amount, for percent types it is a percentage.
*/

-- ── commission_type ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributors' AND column_name = 'commission_type'
  ) THEN
    ALTER TABLE distributors
      ADD COLUMN commission_type text NOT NULL DEFAULT 'percent_margin';
  END IF;
END $$;

-- Add constraint only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_commission_type' AND conrelid = 'distributors'::regclass
  ) THEN
    ALTER TABLE distributors
      ADD CONSTRAINT valid_commission_type
        CHECK (commission_type IN (
          'percent_gross_sales',
          'percent_margin',
          'percent_net_sales',
          'flat_per_order',
          'flat_per_unit'
        ));
  END IF;
END $$;

-- ── organization_id ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributors' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE distributors
      ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_distributors_organization
      ON distributors(organization_id);
  END IF;
END $$;

-- ── helpful view ─────────────────────────────────────────────────────────────
-- Shows each distributor with their org, commission config, and sales rep count.
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
  d.organization_id,
  o.name                          AS organization_name,
  COUNT(dsr.id) FILTER (WHERE dsr.is_active) AS active_sales_rep_count
FROM distributors d
LEFT JOIN profiles      p   ON p.id  = d.profile_id
LEFT JOIN organizations o   ON o.id  = d.organization_id
LEFT JOIN distributor_sales_reps dsr ON dsr.distributor_id = d.id
GROUP BY d.id, p.email, o.name;

COMMENT ON VIEW distributor_overview IS
  'Convenience view: distributor + linked org + rep count';

COMMENT ON COLUMN distributors.commission_type IS
  'percent_gross_sales | percent_margin | percent_net_sales | flat_per_order | flat_per_unit';
COMMENT ON COLUMN distributors.organization_id IS
  'Primary customer organization this distributor is responsible for';
