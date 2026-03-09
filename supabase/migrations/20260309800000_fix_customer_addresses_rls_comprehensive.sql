-- Comprehensive fix: drop ALL customer_addresses RLS policies and recreate them cleanly.
-- This ensures admins can see all addresses regardless of user_id,
-- and org members can see all addresses for their organization.

-- Drop all existing policies on customer_addresses
DROP POLICY IF EXISTS "Users can view own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Members can view organization addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Users can create own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Users can create addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Admins can create organization addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Admins can update organization addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Org members can update organization addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Admins can delete organization addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Org admins can delete organization addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Admins have full access to customer_addresses" ON customer_addresses;

-- 1. System admins: full access to everything
CREATE POLICY "Admins have full access to customer_addresses"
  ON customer_addresses
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. SELECT: users can view their own personal addresses
CREATE POLICY "Users can view own addresses"
  ON customer_addresses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND organization_id IS NULL);

-- 3. SELECT: org members can view ALL addresses for their organization
CREATE POLICY "Members can view organization addresses"
  ON customer_addresses
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
    )
  );

-- 4. INSERT: users can create personal addresses
--    OR org members can create org addresses
CREATE POLICY "Users can create addresses"
  ON customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id AND organization_id IS NULL)
    OR
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_organization_roles
        WHERE user_organization_roles.user_id = auth.uid()
        AND user_organization_roles.organization_id = customer_addresses.organization_id
      )
    )
  );

-- 5. UPDATE: users can update their own personal addresses
CREATE POLICY "Users can update own addresses"
  ON customer_addresses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND organization_id IS NULL)
  WITH CHECK (auth.uid() = user_id AND organization_id IS NULL);

-- 6. UPDATE: org members can update org addresses
CREATE POLICY "Org members can update organization addresses"
  ON customer_addresses
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
    )
  );

-- 7. DELETE: users can delete their own personal addresses
CREATE POLICY "Users can delete own addresses"
  ON customer_addresses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND organization_id IS NULL);

-- 8. DELETE: org admins/managers can delete org addresses
CREATE POLICY "Org admins can delete organization addresses"
  ON customer_addresses
  FOR DELETE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = customer_addresses.organization_id
      AND user_organization_roles.role IN ('admin', 'manager')
    )
  );
