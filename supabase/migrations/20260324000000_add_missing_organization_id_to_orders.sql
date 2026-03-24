-- ══════════════════════════════════════════════════════════════════════════════
-- Fix: Ensure all columns exist on tables referenced by the commission trigger
--
-- Problem: Tables created before migrations ran may be missing columns that
-- were part of CREATE TABLE IF NOT EXISTS statements (which got skipped).
-- The commission trigger then fails with "column X does not exist".
--
-- This migration idempotently adds every column the trigger needs.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── orders ────────────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_rep_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_authorization_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_captured_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_last_four text;
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);

-- ── distributors ──────────────────────────────────────────────────────────────
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percent_margin';
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS use_customer_price boolean NOT NULL DEFAULT false;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'margin_split';
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS company_rep_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS company_rep_rate numeric(5,2) NOT NULL DEFAULT 0;

-- ── organization_sales_reps ───────────────────────────────────────────────────
ALTER TABLE organization_sales_reps ADD COLUMN IF NOT EXISTS distributor_id uuid REFERENCES distributors(id) ON DELETE SET NULL;

-- ── distributor_commission_rules ──────────────────────────────────────────────
-- Table might exist without organization_id if created before the migration
ALTER TABLE distributor_commission_rules ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_dcr_org ON distributor_commission_rules(organization_id) WHERE organization_id IS NOT NULL;

-- ── commissions ───────────────────────────────────────────────────────────────
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS distributor_id uuid REFERENCES distributors(id) ON DELETE SET NULL;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS sales_rep_commission numeric(10,2);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS distributor_commission numeric(10,2);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_split_type text;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS product_margin numeric(10,2) DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS margin_details jsonb;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS company_rep_commission numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS company_rep_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- ── distributor_rep_customers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS distributor_rep_customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id  uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  sales_rep_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(distributor_id, sales_rep_id, organization_id)
);

-- ── distributor_product_pricing ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS distributor_product_pricing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id  uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  product_id      integer NOT NULL,
  wholesale_price numeric(10,2) NOT NULL CHECK (wholesale_price >= 0),
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, product_id)
);

-- ── commission_line_items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_line_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id     uuid NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        integer,
  product_name      text,
  category_id       uuid,
  quantity          integer NOT NULL DEFAULT 1,
  unit_price        numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost         numeric(10,2) NOT NULL DEFAULT 0,
  retail_price      numeric(10,2),
  markup            numeric(10,2) DEFAULT 0,
  base_margin       numeric(10,2) NOT NULL DEFAULT 0,
  item_commission   numeric(10,2) NOT NULL DEFAULT 0,
  rule_source       text NOT NULL DEFAULT 'default',
  rule_id           uuid,
  commission_type   text NOT NULL DEFAULT 'percent_margin',
  commission_rate   numeric(10,2) NOT NULL DEFAULT 0,
  use_customer_price boolean NOT NULL DEFAULT false,
  effective_price   numeric(10,2),
  wholesale_price   numeric(10,2),
  spread            numeric(10,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cli_commission_id ON commission_line_items(commission_id);
CREATE INDEX IF NOT EXISTS idx_cli_order_id ON commission_line_items(order_id);

-- ── commission_audit_log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  commission_id uuid REFERENCES commissions(id) ON DELETE SET NULL,
  event         text NOT NULL,
  details       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cal_order_id ON commission_audit_log(order_id);

-- ── payment_transactions ──────────────────────────────────────────────────────
-- Ensure the table exists (may have been skipped by CREATE TABLE IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  transaction_type text NOT NULL,
  payment_method text,
  gateway_transaction_id text,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text NOT NULL,
  last_four text,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('authorization', 'capture', 'void', 'refund')),
  CONSTRAINT valid_transaction_status CHECK (status IN ('success', 'failed', 'pending', 'declined'))
);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);

-- Allow customers to INSERT authorization records for their own orders during checkout
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_transactions'
      AND policyname = 'Users can log transactions for own orders'
  ) THEN
    CREATE POLICY "Users can log transactions for own orders"
      ON payment_transactions FOR INSERT
      WITH CHECK (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid())
      );
  END IF;
END $$;
