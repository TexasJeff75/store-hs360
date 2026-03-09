/*
  # Fix RLS policies that broke admin access

  The previous migration (20260309000000) created a policy on `profiles` that
  referenced `profiles` in its own USING clause, causing infinite recursion
  in PostgreSQL RLS evaluation — the exact same bug fixed in earlier migrations.

  This also affected policies on `organizations` and `orders` that used subqueries
  referencing `profiles` (which triggered the recursive check).

  Fix: Drop all problematic policies and recreate them using the existing
  `is_admin()` SECURITY DEFINER function and `is_distributor()` helper
  to avoid recursion.
*/

-- ── 0. Create is_distributor() helper (SECURITY DEFINER bypasses RLS) ────────
CREATE OR REPLACE FUNCTION public.is_distributor()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'distributor'
  );
END;
$$;

-- Also create helper to get current user's distributor ID
CREATE OR REPLACE FUNCTION public.my_distributor_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.distributors
  WHERE profile_id = auth.uid()
    AND is_active = true
  LIMIT 1;
  RETURN v_id;
END;
$$;

-- ── 1. Drop ALL policies created in the previous migration ──────────────────
DROP POLICY IF EXISTS "Distributors can view own record" ON distributors;
DROP POLICY IF EXISTS "Distributors can manage own customers" ON distributor_customers;
DROP POLICY IF EXISTS "Distributors can view own sales reps" ON distributor_sales_reps;
DROP POLICY IF EXISTS "Distributors can manage own sales reps" ON distributor_sales_reps;
DROP POLICY IF EXISTS "Distributors can view organizations" ON organizations;
DROP POLICY IF EXISTS "Distributors can view sales rep profiles" ON profiles;
DROP POLICY IF EXISTS "Distributors can view customer orders" ON orders;

-- ── 2. Recreate policies using SECURITY DEFINER helpers ─────────────────────

-- Distributors can view their own distributor record
CREATE POLICY "Distributors can view own record"
  ON distributors FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Distributors can manage their own customers
CREATE POLICY "Distributors can manage own customers"
  ON distributor_customers FOR ALL TO authenticated
  USING (distributor_id = my_distributor_id())
  WITH CHECK (distributor_id = my_distributor_id());

-- Distributors can view their own sales reps
CREATE POLICY "Distributors can view own sales reps"
  ON distributor_sales_reps FOR SELECT TO authenticated
  USING (distributor_id = my_distributor_id());

-- Distributors can insert/update/delete their own sales reps
CREATE POLICY "Distributors can manage own sales reps"
  ON distributor_sales_reps FOR ALL TO authenticated
  USING (distributor_id = my_distributor_id())
  WITH CHECK (distributor_id = my_distributor_id());

-- Distributors can view organizations (for customer assignment dropdowns)
CREATE POLICY "Distributors can view organizations"
  ON organizations FOR SELECT TO authenticated
  USING (is_distributor());

-- Distributors can view sales_rep profiles (for assignment dropdowns)
-- Uses is_distributor() to avoid infinite recursion on profiles table
CREATE POLICY "Distributors can view sales rep profiles"
  ON profiles FOR SELECT TO authenticated
  USING (is_distributor() AND role IN ('sales_rep', 'distributor'));

-- Distributors can view orders for their customer organizations
CREATE POLICY "Distributors can view customer orders"
  ON orders FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT dc.organization_id
      FROM distributor_customers dc
      WHERE dc.distributor_id = my_distributor_id()
        AND dc.is_active = true
    )
  );
