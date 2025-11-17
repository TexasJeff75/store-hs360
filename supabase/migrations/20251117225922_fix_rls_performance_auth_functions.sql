/*
  # Fix RLS Performance - Auth Function Optimization

  ## Changes
  Optimizes RLS policies by wrapping auth functions in SELECT statements.
  This prevents re-evaluation of auth functions for each row, significantly
  improving query performance at scale.
  
  ## Pattern
  Before: auth.uid() = user_id
  After: (select auth.uid()) = user_id
  
  ## Tables Updated
  - profiles
  - favorites
  - customer_addresses
  - payment_methods
  - login_audit
  - distributors
  - distributor_sales_reps
  - commissions
  - contract_pricing
  - organizations
  - organization_sales_reps
  - user_organization_roles
  - recurring_orders
  - recurring_order_history
  - product_settings
*/

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- Favorites  
DROP POLICY IF EXISTS "Approved users can manage their own favorites" ON favorites;
CREATE POLICY "Approved users can manage their own favorites"
  ON favorites FOR ALL
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (select auth.uid())
      AND approved = true 
      AND role IS NOT NULL
    )
  );

-- Customer Addresses
DROP POLICY IF EXISTS "Users can view own addresses" ON customer_addresses;
CREATE POLICY "Users can view own addresses"
  ON customer_addresses FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own addresses" ON customer_addresses;
CREATE POLICY "Users can create own addresses"
  ON customer_addresses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own addresses" ON customer_addresses;
CREATE POLICY "Users can update own addresses"
  ON customer_addresses FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own addresses" ON customer_addresses;
CREATE POLICY "Users can delete own addresses"
  ON customer_addresses FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Members can view organization addresses" ON customer_addresses;
CREATE POLICY "Members can view organization addresses"
  ON customer_addresses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can create organization addresses" ON customer_addresses;
CREATE POLICY "Admins can create organization addresses"
  ON customer_addresses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update organization addresses" ON customer_addresses;
CREATE POLICY "Admins can update organization addresses"
  ON customer_addresses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete organization addresses" ON customer_addresses;
CREATE POLICY "Admins can delete organization addresses"
  ON customer_addresses FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- Payment Methods
DROP POLICY IF EXISTS "Users can view payment methods for their organizations" ON payment_methods;
CREATE POLICY "Users can view payment methods for their organizations"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = (select auth.uid())
    )
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Organization members can insert payment methods" ON payment_methods;
CREATE POLICY "Organization members can insert payment methods"
  ON payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Organization members can update payment methods" ON payment_methods;
CREATE POLICY "Organization members can update payment methods"
  ON payment_methods FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Organization members can delete payment methods" ON payment_methods;
CREATE POLICY "Organization members can delete payment methods"
  ON payment_methods FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );