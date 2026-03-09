/*
  # Add contact name/address fields to distributors and profiles

  Distributors and sales reps need normal name and address fields.
  - Distributors: contact_name, address, city, state, zip, phone
  - Profiles: full_name already exists, add phone, address, city, state, zip

  Also add RLS policies so distributors can manage their own customers and sales reps.
*/

-- ── 1. Add address fields to distributors ────────────────────────────────────
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE distributors ADD COLUMN IF NOT EXISTS phone TEXT;

-- ── 2. Add address fields to profiles (for sales reps and other users) ──────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip TEXT;

-- ── 3. RLS: Distributors can read their own distributor record ───────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'distributors'
      AND policyname = 'Distributors can view own record'
  ) THEN
    CREATE POLICY "Distributors can view own record"
      ON distributors FOR SELECT TO authenticated
      USING (profile_id = auth.uid());
  END IF;
END $$;

-- ── 4. RLS: Distributors can manage their own customers ─────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'distributor_customers'
      AND policyname = 'Distributors can manage own customers'
  ) THEN
    CREATE POLICY "Distributors can manage own customers"
      ON distributor_customers FOR ALL TO authenticated
      USING (
        distributor_id IN (SELECT id FROM distributors WHERE profile_id = auth.uid())
      )
      WITH CHECK (
        distributor_id IN (SELECT id FROM distributors WHERE profile_id = auth.uid())
      );
  END IF;
END $$;

-- ── 5. RLS: Distributors can view their own sales reps ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'distributor_sales_reps'
      AND policyname = 'Distributors can view own sales reps'
  ) THEN
    CREATE POLICY "Distributors can view own sales reps"
      ON distributor_sales_reps FOR SELECT TO authenticated
      USING (
        distributor_id IN (SELECT id FROM distributors WHERE profile_id = auth.uid())
      );
  END IF;
END $$;

-- ── 6. RLS: Distributors can manage their own sales reps ────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'distributor_sales_reps'
      AND policyname = 'Distributors can manage own sales reps'
  ) THEN
    CREATE POLICY "Distributors can manage own sales reps"
      ON distributor_sales_reps FOR ALL TO authenticated
      USING (
        distributor_id IN (SELECT id FROM distributors WHERE profile_id = auth.uid())
      )
      WITH CHECK (
        distributor_id IN (SELECT id FROM distributors WHERE profile_id = auth.uid())
      );
  END IF;
END $$;

-- ── 7. RLS: Distributors can read organizations (for customer assignment) ───
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations'
      AND policyname = 'Distributors can view organizations'
  ) THEN
    CREATE POLICY "Distributors can view organizations"
      ON organizations FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'distributor')
      );
  END IF;
END $$;

-- ── 8. RLS: Distributors can read profiles (for sales rep assignment) ───────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND policyname = 'Distributors can view sales rep profiles'
  ) THEN
    CREATE POLICY "Distributors can view sales rep profiles"
      ON profiles FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'distributor')
        AND role IN ('sales_rep', 'distributor')
      );
  END IF;
END $$;

-- ── 9. RLS: Distributors can view orders for their customers ────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
      AND policyname = 'Distributors can view customer orders'
  ) THEN
    CREATE POLICY "Distributors can view customer orders"
      ON orders FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT dc.organization_id
          FROM distributor_customers dc
          JOIN distributors d ON d.id = dc.distributor_id
          WHERE d.profile_id = auth.uid()
            AND dc.is_active = true
        )
      );
  END IF;
END $$;
