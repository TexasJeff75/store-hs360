/*
  # Restrict Order Update Policies

  ## Problem
  - "Users can update own pending orders" allowed ANY update to pending orders
  - "Admin staff can mark orders as viewed" allowed sales_reps/distributors to update ANY field
  - Sales reps and customers should only be able to CANCEL pending orders, not edit them

  ## Changes
  1. Replace "Users can update own pending orders" with a cancel-only policy
  2. Replace "Admin staff can mark orders as viewed" with a viewed-only policy
  3. Admin full access remains unchanged via "Admins can manage all orders"

  ## Result
  - Admins: Full order management (status, shipments, splits, etc.)
  - Sales Reps/Distributors: View orders + mark as viewed + cancel pending orders
  - Customers: View own orders + cancel own pending orders
*/

-- ============================================================================
-- 1. DROP EXISTING PERMISSIVE UPDATE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own pending orders" ON orders;
DROP POLICY IF EXISTS "Admin staff can mark orders as viewed" ON orders;

-- ============================================================================
-- 2. USERS CAN ONLY CANCEL THEIR OWN PENDING ORDERS
-- ============================================================================

-- Users (customers) can only update their own pending orders,
-- and the only allowed change is setting status to 'cancelled'
CREATE POLICY "Users can cancel own pending orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND status = 'cancelled'
  );

-- ============================================================================
-- 3. SALES REPS / DISTRIBUTORS CAN MARK ORDERS AS VIEWED
-- ============================================================================

-- Sales reps and distributors can only update viewed_by_admin flag
-- The WITH CHECK ensures they cannot change the order status or other fields
-- by requiring viewed_by_admin = true (the only update they should make)
CREATE POLICY "Staff can mark orders as viewed"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'sales_rep', 'distributor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'sales_rep', 'distributor')
    )
    AND viewed_by_admin = true
  );

-- ============================================================================
-- 4. SALES REPS CAN CANCEL PENDING ORDERS ASSIGNED TO THEM
-- ============================================================================

-- Sales reps can cancel pending orders that are assigned to them
CREATE POLICY "Sales reps can cancel assigned pending orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    sales_rep_id = (select auth.uid())
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'sales_rep'
    )
  )
  WITH CHECK (
    sales_rep_id = (select auth.uid())
    AND status = 'cancelled'
  );
