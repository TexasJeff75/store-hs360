/*
  # Update RLS Policies for Sales Rep Organization Access

  1. Changes to Organizations Table
    - Allow sales reps to view organizations they're assigned to
    - Sales reps can see organization details for their accounts

  2. Changes to User Organization Roles Table
    - Allow sales reps to view customer users in their assigned organizations
    - Allow sales reps to add/manage customer users in their assigned organizations
    - These are CUSTOMER users who belong to organizations, not sales reps

  3. Purpose
    - Sales reps can manage their assigned customer accounts
    - Sales reps can view and add customer users to their organizations
    - Maintains proper separation between sales reps and customer users
*/

-- Drop existing policy and recreate with sales rep access
DROP POLICY IF EXISTS "Users can read organizations" ON organizations;

CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Customer users can see their organizations
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = organizations.id
      AND user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.role IN ('admin', 'member')
    )
    OR
    -- Sales reps can see organizations they're assigned to
    EXISTS (
      SELECT 1 FROM organization_sales_reps
      WHERE organization_sales_reps.organization_id = organizations.id
      AND organization_sales_reps.sales_rep_id = auth.uid()
      AND organization_sales_reps.is_active = true
    )
  );

-- Update user_organization_roles policies for sales rep access
DROP POLICY IF EXISTS "Users can read organization roles" ON user_organization_roles;

CREATE POLICY "Users can view organization roles"
  ON user_organization_roles FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Users can see their own roles
    user_id = auth.uid()
    OR
    -- Sales reps can see customer users in their assigned organizations
    EXISTS (
      SELECT 1 FROM organization_sales_reps
      WHERE organization_sales_reps.organization_id = user_organization_roles.organization_id
      AND organization_sales_reps.sales_rep_id = auth.uid()
      AND organization_sales_reps.is_active = true
    )
  );

-- Allow sales reps to add customer users to their assigned organizations
CREATE POLICY "Sales reps can add customer users to their organizations"
  ON user_organization_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can add anyone
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Sales reps can add customer users to organizations they manage
    EXISTS (
      SELECT 1 FROM organization_sales_reps
      WHERE organization_sales_reps.organization_id = user_organization_roles.organization_id
      AND organization_sales_reps.sales_rep_id = auth.uid()
      AND organization_sales_reps.is_active = true
    )
  );

-- Allow sales reps to update customer users in their assigned organizations
CREATE POLICY "Sales reps can update customer users in their organizations"
  ON user_organization_roles FOR UPDATE
  TO authenticated
  USING (
    -- Admins can update anyone
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Sales reps can update customer users in organizations they manage
    EXISTS (
      SELECT 1 FROM organization_sales_reps
      WHERE organization_sales_reps.organization_id = user_organization_roles.organization_id
      AND organization_sales_reps.sales_rep_id = auth.uid()
      AND organization_sales_reps.is_active = true
    )
  )
  WITH CHECK (
    -- Admins can update anyone
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Sales reps can update customer users in organizations they manage
    EXISTS (
      SELECT 1 FROM organization_sales_reps
      WHERE organization_sales_reps.organization_id = user_organization_roles.organization_id
      AND organization_sales_reps.sales_rep_id = auth.uid()
      AND organization_sales_reps.is_active = true
    )
  );

-- Allow sales reps to remove customer users from their assigned organizations
CREATE POLICY "Sales reps can remove customer users from their organizations"
  ON user_organization_roles FOR DELETE
  TO authenticated
  USING (
    -- Admins can delete anyone
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Sales reps can remove customer users from organizations they manage
    EXISTS (
      SELECT 1 FROM organization_sales_reps
      WHERE organization_sales_reps.organization_id = user_organization_roles.organization_id
      AND organization_sales_reps.sales_rep_id = auth.uid()
      AND organization_sales_reps.is_active = true
    )
  );

-- Add helpful comments
COMMENT ON POLICY "Users can view their organizations" ON organizations IS 'Admins, customer users, and assigned sales reps can view organizations';
COMMENT ON POLICY "Users can view organization roles" ON user_organization_roles IS 'Admins, users themselves, and assigned sales reps can view customer user roles';
COMMENT ON POLICY "Sales reps can add customer users to their organizations" ON user_organization_roles IS 'Sales reps can add customer users to organizations they manage';
COMMENT ON POLICY "Sales reps can update customer users in their organizations" ON user_organization_roles IS 'Sales reps can update customer users in organizations they manage';
COMMENT ON POLICY "Sales reps can remove customer users from their organizations" ON user_organization_roles IS 'Sales reps can remove customer users from organizations they manage';