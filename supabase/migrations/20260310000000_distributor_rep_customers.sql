/*
  # Distributor Rep-Customer Assignments

  Links specific sales reps to specific customer organizations within a
  distributor.  A rep can be assigned to many customers; a customer can
  have many reps.

  Tables:
    distributor_rep_customers
      - distributor_id  (FK → distributors)
      - sales_rep_id    (FK → profiles, the rep user)
      - organization_id (FK → organizations, the customer)
*/

-- ── 1. Junction table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS distributor_rep_customers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id  UUID NOT NULL REFERENCES distributors(id)    ON DELETE CASCADE,
  sales_rep_id    UUID NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id)   ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(distributor_id, sales_rep_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_drc_distributor  ON distributor_rep_customers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_drc_sales_rep    ON distributor_rep_customers(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_drc_organization ON distributor_rep_customers(organization_id);

-- ── 2. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE distributor_rep_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to distributor_rep_customers"
  ON distributor_rep_customers FOR ALL
  TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin'));

CREATE POLICY "Distributors can view their own rep-customer links"
  ON distributor_rep_customers FOR SELECT
  TO authenticated
  USING (
    distributor_id IN (SELECT id FROM distributors WHERE profile_id = (select auth.uid()))
  );

CREATE POLICY "Sales reps can view their own customer assignments"
  ON distributor_rep_customers FOR SELECT
  TO authenticated
  USING (sales_rep_id = (select auth.uid()));

CREATE POLICY "Distributor delegates can view rep-customer links"
  ON distributor_rep_customers FOR SELECT
  TO authenticated
  USING (
    distributor_id IN (
      SELECT distributor_id FROM distributor_delegates
      WHERE user_id = (select auth.uid()) AND is_active = true
    )
  );
