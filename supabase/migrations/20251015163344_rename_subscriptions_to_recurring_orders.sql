/*
  # Rename Subscriptions to Recurring Orders

  1. Changes
    - Rename `subscriptions` table to `recurring_orders`
    - Rename `subscription_orders` table to `recurring_order_history`
    - Update all foreign key references
    - Update all indexes and constraints
    - Update all RLS policies
    - Update functions and triggers

  2. Notes
    - All data is preserved during the rename
    - All relationships remain intact
    - All security policies remain in place
*/

-- Rename the main tables
ALTER TABLE IF EXISTS subscriptions RENAME TO recurring_orders;
ALTER TABLE IF EXISTS subscription_orders RENAME TO recurring_order_history;

-- Rename the foreign key column in recurring_order_history
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recurring_order_history' 
    AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE recurring_order_history RENAME COLUMN subscription_id TO recurring_order_id;
  END IF;
END $$;

-- Update indexes
ALTER INDEX IF EXISTS idx_subscriptions_user_id RENAME TO idx_recurring_orders_user_id;
ALTER INDEX IF EXISTS idx_subscriptions_organization_id RENAME TO idx_recurring_orders_organization_id;
ALTER INDEX IF EXISTS idx_subscriptions_next_order_date RENAME TO idx_recurring_orders_next_order_date;
ALTER INDEX IF EXISTS idx_subscriptions_status RENAME TO idx_recurring_orders_status;
ALTER INDEX IF EXISTS idx_subscription_orders_subscription_id RENAME TO idx_recurring_order_history_recurring_order_id;
ALTER INDEX IF EXISTS idx_subscription_orders_status RENAME TO idx_recurring_order_history_status;
ALTER INDEX IF EXISTS idx_subscription_orders_scheduled_date RENAME TO idx_recurring_order_history_scheduled_date;

-- Drop and recreate the foreign key constraint with new names
ALTER TABLE IF EXISTS recurring_order_history 
  DROP CONSTRAINT IF EXISTS subscription_orders_subscription_id_fkey;

ALTER TABLE IF EXISTS recurring_order_history
  ADD CONSTRAINT recurring_order_history_recurring_order_id_fkey 
  FOREIGN KEY (recurring_order_id) 
  REFERENCES recurring_orders(id) 
  ON DELETE CASCADE;

-- Update RLS policies for recurring_orders
DROP POLICY IF EXISTS "Users can view own subscriptions" ON recurring_orders;
DROP POLICY IF EXISTS "Users can create own subscriptions" ON recurring_orders;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON recurring_orders;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON recurring_orders;
DROP POLICY IF EXISTS "Org members can view org subscriptions" ON recurring_orders;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON recurring_orders;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON recurring_orders;
DROP POLICY IF EXISTS "Sales reps can view assigned org subscriptions" ON recurring_orders;

CREATE POLICY "Users can view own recurring orders"
  ON recurring_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recurring orders"
  ON recurring_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring orders"
  ON recurring_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring orders"
  ON recurring_orders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Org members can view org recurring orders"
  ON recurring_orders FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = recurring_orders.organization_id
      AND user_organization_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all recurring orders"
  ON recurring_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all recurring orders"
  ON recurring_orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Sales reps can view assigned org recurring orders"
  ON recurring_orders FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON o.default_sales_rep_id = p.id
      WHERE p.id = auth.uid()
      AND p.role = 'sales_rep'
      AND o.id = recurring_orders.organization_id
    )
  );

-- Update RLS policies for recurring_order_history
DROP POLICY IF EXISTS "Users can view own subscription orders" ON recurring_order_history;
DROP POLICY IF EXISTS "Admins can view all subscription orders" ON recurring_order_history;
DROP POLICY IF EXISTS "System can manage subscription orders" ON recurring_order_history;

CREATE POLICY "Users can view own recurring order history"
  ON recurring_order_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recurring_orders
      WHERE recurring_orders.id = recurring_order_history.recurring_order_id
      AND recurring_orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all recurring order history"
  ON recurring_order_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can manage recurring order history"
  ON recurring_order_history FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Rename function and update trigger
DO $$ 
BEGIN
  -- Drop the trigger first
  DROP TRIGGER IF EXISTS update_subscriptions_updated_at_trigger ON recurring_orders;
  DROP TRIGGER IF EXISTS update_recurring_orders_updated_at_trigger ON recurring_orders;
  
  -- Rename the function
  ALTER FUNCTION update_subscriptions_updated_at() RENAME TO update_recurring_orders_updated_at;
EXCEPTION
  WHEN undefined_function THEN NULL;
END $$;

-- Recreate trigger with new function name
CREATE TRIGGER update_recurring_orders_updated_at_trigger
  BEFORE UPDATE ON recurring_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_orders_updated_at();

-- Add comments for clarity
COMMENT ON TABLE recurring_orders IS 'Stores recurring order configurations for automated repeat purchases';
COMMENT ON TABLE recurring_order_history IS 'Stores the history of orders created from recurring order schedules';
COMMENT ON FUNCTION calculate_next_order_date IS 'Calculates the next order date based on frequency and interval';
COMMENT ON FUNCTION update_recurring_orders_updated_at IS 'Automatically updates the updated_at timestamp';
