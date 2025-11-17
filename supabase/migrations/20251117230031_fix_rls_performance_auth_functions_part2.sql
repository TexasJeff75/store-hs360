/*
  # Fix RLS Performance - Auth Function Optimization Part 2

  ## Changes
  Continues optimization of RLS policies for remaining tables
*/

-- Login Audit
DROP POLICY IF EXISTS "Users can view their own login audit logs" ON login_audit;
CREATE POLICY "Users can view their own login audit logs"
  ON login_audit FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all login audit logs" ON login_audit;
CREATE POLICY "Admins can view all login audit logs"
  ON login_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- Distributors
DROP POLICY IF EXISTS "Distributors can view own record" ON distributors;
CREATE POLICY "Distributors can view own record"
  ON distributors FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Admins have full access to distributors" ON distributors;
CREATE POLICY "Admins have full access to distributors"
  ON distributors FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- Distributor Sales Reps
DROP POLICY IF EXISTS "Distributors can view their sales reps" ON distributor_sales_reps;
CREATE POLICY "Distributors can view their sales reps"
  ON distributor_sales_reps FOR SELECT
  TO authenticated
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE user_id = (select auth.uid()) OR profile_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Sales reps can view their distributor" ON distributor_sales_reps;
CREATE POLICY "Sales reps can view their distributor"
  ON distributor_sales_reps FOR SELECT
  TO authenticated
  USING (sales_rep_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to distributor sales reps" ON distributor_sales_reps;
CREATE POLICY "Admins have full access to distributor sales reps"
  ON distributor_sales_reps FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- Commissions
DROP POLICY IF EXISTS "Approved sales reps can view their own commissions" ON commissions;
CREATE POLICY "Approved sales reps can view their own commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid())
      AND approved = true 
      AND role IN ('sales_rep', 'distributor', 'admin')
    ) AND (
      sales_rep_id = (select auth.uid())
      OR distributor_id IN (
        SELECT id FROM distributors WHERE user_id = (select auth.uid()) OR profile_id = (select auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can create commissions" ON commissions;
CREATE POLICY "Admins can create commissions"
  ON commissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update commissions" ON commissions;
CREATE POLICY "Admins can update commissions"
  ON commissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- Contract Pricing (uses entity_id with pricing_type to reference org or location)
DROP POLICY IF EXISTS "Approved users can view contract pricing for their organizations" ON contract_pricing;
CREATE POLICY "Approved users can view contract pricing for their organizations"
  ON contract_pricing FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid())
      AND approved = true 
      AND role IS NOT NULL
    ) AND (
      (pricing_type = 'organization' AND entity_id::text IN (
        SELECT organization_id::text FROM user_organization_roles
        WHERE user_id = (select auth.uid())
      ))
      OR user_id = (select auth.uid())
      OR EXISTS (
        SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin'
      )
    )
  );

-- Organizations
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Approved users can view organizations they belong to" ON organizations;
CREATE POLICY "Approved users can view organizations they belong to"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid())
      AND approved = true 
      AND role IS NOT NULL
    ) AND (
      id IN (
        SELECT organization_id FROM user_organization_roles
        WHERE user_id = (select auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
    )
  );

-- Organization Sales Reps
DROP POLICY IF EXISTS "Sales reps can view their assignments" ON organization_sales_reps;
CREATE POLICY "Sales reps can view their assignments"
  ON organization_sales_reps FOR SELECT
  TO authenticated
  USING (sales_rep_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can manage sales rep assignments" ON organization_sales_reps;
CREATE POLICY "Admins can manage sales rep assignments"
  ON organization_sales_reps FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- User Organization Roles
DROP POLICY IF EXISTS "Users can view organization roles" ON user_organization_roles;
CREATE POLICY "Users can view organization roles"
  ON user_organization_roles FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR organization_id IN (
      SELECT organization_id FROM user_organization_roles WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Sales reps can add customer users to their organizations" ON user_organization_roles;
CREATE POLICY "Sales reps can add customer users to their organizations"
  ON user_organization_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'sales_rep')
      AND organization_id IN (
        SELECT organization_id FROM organization_sales_reps WHERE sales_rep_id = (select auth.uid()) AND is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Sales reps can update customer users in their organizations" ON user_organization_roles;
CREATE POLICY "Sales reps can update customer users in their organizations"
  ON user_organization_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'sales_rep')
      AND organization_id IN (
        SELECT organization_id FROM organization_sales_reps WHERE sales_rep_id = (select auth.uid()) AND is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Sales reps can remove customer users from their organizations" ON user_organization_roles;
CREATE POLICY "Sales reps can remove customer users from their organizations"
  ON user_organization_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'sales_rep')
      AND organization_id IN (
        SELECT organization_id FROM organization_sales_reps WHERE sales_rep_id = (select auth.uid()) AND is_active = true
      )
    )
  );