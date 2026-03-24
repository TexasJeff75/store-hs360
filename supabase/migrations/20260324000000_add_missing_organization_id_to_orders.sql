-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: Add organization_id column to orders table if missing
--
-- Problem: The orders table may be missing the organization_id column,
-- which causes the commission trigger to fail with:
--   "column organization_id does not exist"
-- when updating sales_rep_id on an order.
--
-- The column was defined in the original CREATE TABLE migration but may not
-- exist in the live database if the table was created before that migration.
-- ══════════════════════════════════════════════════════════════════════════════

-- Add the column if it doesn't already exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- Recreate the index (idempotent)
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);
