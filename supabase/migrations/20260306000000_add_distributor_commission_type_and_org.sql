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

-- organization_id removed: replaced by distributor_customers junction table
-- (see 20260306200003_distributor_multi_customer.sql)
-- The distributor_overview view is also created in that migration.

COMMENT ON COLUMN distributors.commission_type IS
  'percent_gross_sales | percent_margin | percent_net_sales | flat_per_order | flat_per_unit';
