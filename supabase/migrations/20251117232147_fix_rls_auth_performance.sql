/*
  # Fix RLS Auth Performance Issues

  ## Problem
  Several RLS policies re-evaluate auth.uid() for each row, causing poor performance at scale.

  ## Solution
  Replace `auth.uid()` with `(select auth.uid())` in all policies to cache the value.

  ## Changes
  1. favorites table - Users can manage own favorites
  2. user_organization_roles table - Multiple policies
*/

-- Fix favorites policy
DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;

CREATE POLICY "Users can manage own favorites"
  ON favorites FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Fix user_organization_roles policies
DROP POLICY IF EXISTS "Sales reps can remove customer users from their organizations" ON user_organization_roles;
DROP POLICY IF EXISTS "Sales reps can update customer users in their organizations" ON user_organization_roles;
DROP POLICY IF EXISTS "Users can view own organization roles" ON user_organization_roles;

CREATE POLICY "Sales reps can remove customer users from their organizations"
  ON user_organization_roles FOR DELETE
  TO authenticated
  USING (
    is_admin() OR (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = (select auth.uid()) 
        AND profiles.role = 'sales_rep'
        LIMIT 1
      )
      AND organization_id IN (
        SELECT organization_sales_reps.organization_id
        FROM organization_sales_reps
        WHERE organization_sales_reps.sales_rep_id = (select auth.uid())
        AND organization_sales_reps.is_active = true
      )
    )
  );

CREATE POLICY "Sales reps can update customer users in their organizations"
  ON user_organization_roles FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = (select auth.uid()) 
        AND profiles.role = 'sales_rep'
        LIMIT 1
      )
      AND organization_id IN (
        SELECT organization_sales_reps.organization_id
        FROM organization_sales_reps
        WHERE organization_sales_reps.sales_rep_id = (select auth.uid())
        AND organization_sales_reps.is_active = true
      )
    )
  )
  WITH CHECK (
    is_admin() OR (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = (select auth.uid()) 
        AND profiles.role = 'sales_rep'
        LIMIT 1
      )
      AND organization_id IN (
        SELECT organization_sales_reps.organization_id
        FROM organization_sales_reps
        WHERE organization_sales_reps.sales_rep_id = (select auth.uid())
        AND organization_sales_reps.is_active = true
      )
    )
  );

CREATE POLICY "Users can view own organization roles"
  ON user_organization_roles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));