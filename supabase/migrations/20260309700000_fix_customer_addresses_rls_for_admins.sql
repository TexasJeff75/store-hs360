-- Fix RLS on customer_addresses: allow system admins full access,
-- and allow org admins/managers to create addresses with any user_id
-- (needed when creating org addresses on behalf of the organization).

-- 1. Admin full access policies
CREATE POLICY "Admins have full access to customer_addresses"
  ON customer_addresses
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Fix the member insert policy: org admins/managers should be able to
--    create addresses for the organization even if user_id != auth.uid()
--    (e.g. address belongs to the org, user_id is just the creator/owner)
DROP POLICY IF EXISTS "Users can create addresses" ON customer_addresses;

CREATE POLICY "Users can create addresses"
  ON customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Personal addresses: must be own user_id
    (auth.uid() = user_id AND organization_id IS NULL)
    OR
    -- Organization addresses: any org member can create
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_organization_roles
        WHERE user_organization_roles.user_id = auth.uid()
        AND user_organization_roles.organization_id = customer_addresses.organization_id
      )
    )
  );

-- 3. Fix update policy: org members should be able to update org addresses
DROP POLICY IF EXISTS "Users can update own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Admins can update organization addresses" ON customer_addresses;

CREATE POLICY "Users can update own addresses"
  ON customer_addresses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND organization_id IS NULL)
  WITH CHECK (auth.uid() = user_id AND organization_id IS NULL);

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

-- 4. Fix delete policy: org admins/managers can delete org addresses
DROP POLICY IF EXISTS "Users can delete own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Admins can delete organization addresses" ON customer_addresses;

CREATE POLICY "Users can delete own addresses"
  ON customer_addresses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND organization_id IS NULL);

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
