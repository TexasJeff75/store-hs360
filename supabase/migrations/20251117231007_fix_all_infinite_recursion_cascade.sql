/*
  # Fix All Infinite Recursion Issues (with CASCADE)

  ## Problem
  Multiple tables have policies that query the profiles table to check roles,
  causing infinite recursion when those checks happen during profile queries.

  ## Solution
  Use security definer functions that are marked as STABLE to break the recursion chain.
  These functions use proper search paths and limits to prevent infinite loops.

  ## Changes
  1. Drop all dependent policies first
  2. Recreate is_admin and is_approved functions
  3. Recreate all policies using these functions
*/

-- Drop all policies that depend on is_admin
DROP POLICY IF EXISTS "Admins can insert pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can update pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can delete pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage organization roles" ON user_organization_roles;

-- Now drop and recreate the functions
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_approved() CASCADE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND approved = true
    AND role IS NOT NULL
    LIMIT 1
  );
$$;

-- Recreate profiles policies
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- Recreate contract_pricing policies
CREATE POLICY "Admins can insert pricing"
  ON contract_pricing FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update pricing"
  ON contract_pricing FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete pricing"
  ON contract_pricing FOR DELETE
  TO authenticated
  USING (is_admin());

-- Fix favorites table policies
DROP POLICY IF EXISTS "Approved users can manage their own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can add own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can remove own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;

CREATE POLICY "Users can manage own favorites"
  ON favorites FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix contract_pricing duplicate policies  
DROP POLICY IF EXISTS "Approved users can view contract pricing for their organization" ON contract_pricing;

-- Fix user_organization_roles policies
DROP POLICY IF EXISTS "Sales reps can remove customer users from their organizations" ON user_organization_roles;
DROP POLICY IF EXISTS "Sales reps can update customer users in their organizations" ON user_organization_roles;

CREATE POLICY "Admins can manage organization roles"
  ON user_organization_roles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Sales reps can remove customer users from their organizations"
  ON user_organization_roles FOR DELETE
  TO authenticated
  USING (
    is_admin() OR 
    (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'sales_rep'
        LIMIT 1
      ) 
      AND organization_id IN (
        SELECT organization_id 
        FROM organization_sales_reps 
        WHERE sales_rep_id = auth.uid() 
        AND is_active = true
      )
    )
  );

CREATE POLICY "Sales reps can update customer users in their organizations"
  ON user_organization_roles FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'sales_rep'
        LIMIT 1
      ) 
      AND organization_id IN (
        SELECT organization_id 
        FROM organization_sales_reps 
        WHERE sales_rep_id = auth.uid() 
        AND is_active = true
      )
    )
  )
  WITH CHECK (
    is_admin() OR 
    (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'sales_rep'
        LIMIT 1
      ) 
      AND organization_id IN (
        SELECT organization_id 
        FROM organization_sales_reps 
        WHERE sales_rep_id = auth.uid() 
        AND is_active = true
      )
    )
  );