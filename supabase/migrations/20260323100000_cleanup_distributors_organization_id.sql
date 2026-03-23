-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: Clean up stale distributors.organization_id references
--
-- Problem: "column organization_id does not exist" (error 42703) when updating
-- orders.sales_rep_id. The column was supposed to be dropped from distributors
-- in migration 20260306200003, but the DROP may have failed due to dependencies
-- (no CASCADE was used). This migration forces the cleanup.
--
-- Also drops stale index on distributors(organization_id) from 20260306200002.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Drop the stale index if it still exists
DROP INDEX IF EXISTS idx_distributors_organization;

-- 2. Drop the view that may reference the old column (will be recreated)
DROP VIEW IF EXISTS distributor_overview;

-- 3. Force-drop organization_id from distributors with CASCADE
--    This ensures any remaining policies, views, or constraints that
--    reference this column are also dropped.
ALTER TABLE distributors DROP COLUMN IF EXISTS organization_id CASCADE;

-- 4. Recreate the distributor_overview view (same as 20260306200003)
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
