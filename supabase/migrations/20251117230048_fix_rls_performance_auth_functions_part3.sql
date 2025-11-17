/*
  # Fix RLS Performance - Auth Function Optimization Part 3

  ## Changes
  Optimizes remaining RLS policies for recurring orders, product settings, etc.
*/

-- Recurring Orders
DROP POLICY IF EXISTS "Users can view own recurring orders" ON recurring_orders;
CREATE POLICY "Users can view own recurring orders"
  ON recurring_orders FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own recurring orders" ON recurring_orders;
CREATE POLICY "Users can create own recurring orders"
  ON recurring_orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own recurring orders" ON recurring_orders;
CREATE POLICY "Users can update own recurring orders"
  ON recurring_orders FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own recurring orders" ON recurring_orders;
CREATE POLICY "Users can delete own recurring orders"
  ON recurring_orders FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Org members can view org recurring orders" ON recurring_orders;
CREATE POLICY "Org members can view org recurring orders"
  ON recurring_orders FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Sales reps can view assigned org recurring orders" ON recurring_orders;
CREATE POLICY "Sales reps can view assigned org recurring orders"
  ON recurring_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'sales_rep')
    AND organization_id IN (
      SELECT organization_id FROM organization_sales_reps 
      WHERE sales_rep_id = (select auth.uid()) AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can view all recurring orders" ON recurring_orders;
DROP POLICY IF EXISTS "Admins can manage all recurring orders" ON recurring_orders;
CREATE POLICY "Admins can manage all recurring orders"
  ON recurring_orders FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- Recurring Order History
DROP POLICY IF EXISTS "Users can view own recurring order history" ON recurring_order_history;
CREATE POLICY "Users can view own recurring order history"
  ON recurring_order_history FOR SELECT
  TO authenticated
  USING (
    recurring_order_id IN (
      SELECT id FROM recurring_orders WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can view all recurring order history" ON recurring_order_history;
CREATE POLICY "Admins can view all recurring order history"
  ON recurring_order_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "System can manage recurring order history" ON recurring_order_history;
CREATE POLICY "System can manage recurring order history"
  ON recurring_order_history FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- Product Settings
DROP POLICY IF EXISTS "Admins can insert product settings" ON product_settings;
CREATE POLICY "Admins can insert product settings"
  ON product_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update product settings" ON product_settings;
CREATE POLICY "Admins can update product settings"
  ON product_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete product settings" ON product_settings;
CREATE POLICY "Admins can delete product settings"
  ON product_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );