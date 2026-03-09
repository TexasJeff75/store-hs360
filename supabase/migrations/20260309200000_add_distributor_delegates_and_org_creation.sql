/*
  # Add distributor delegates table and org creation for distributors

  1. Create `distributor_delegates` table — users who can manage a distributorship
  2. RLS for distributor_delegates (owner + delegates can read; owner manages)
  3. Allow distributors to insert organizations (for creating their own customers)
*/

-- ── 1. Create distributor_delegates table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS distributor_delegates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id  uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dist_delegates_distributor ON distributor_delegates(distributor_id);
CREATE INDEX IF NOT EXISTS idx_dist_delegates_user ON distributor_delegates(user_id);

ALTER TABLE distributor_delegates ENABLE ROW LEVEL SECURITY;

-- Admins can manage all delegates
CREATE POLICY "Admins can manage distributor delegates"
  ON distributor_delegates FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Distributors can manage delegates for their own distributorship
CREATE POLICY "Distributors can manage own delegates"
  ON distributor_delegates FOR ALL TO authenticated
  USING (distributor_id = my_distributor_id())
  WITH CHECK (distributor_id = my_distributor_id());

-- Delegates can view their own delegate record
CREATE POLICY "Delegates can view own record"
  ON distributor_delegates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 2. Allow distributors to create organizations ────────────────────────────
-- (They create orgs as their own customers, then link via distributor_customers)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations'
      AND policyname = 'Distributors can create organizations'
  ) THEN
    CREATE POLICY "Distributors can create organizations"
      ON organizations FOR INSERT TO authenticated
      WITH CHECK (is_distributor());
  END IF;
END $$;
