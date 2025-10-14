/*
  # Create Subscriptions and Recurring Orders System

  ## Overview
  This migration creates a comprehensive subscription and auto-reorder system for recurring product purchases.

  ## New Tables
  
  ### `subscriptions`
  - `id` (uuid, primary key) - Unique subscription identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `organization_id` (uuid, foreign key, nullable) - References organizations for org subscriptions
  - `product_id` (integer, not null) - BigCommerce product ID
  - `quantity` (integer, not null) - Quantity per order
  - `frequency` (text, not null) - Delivery frequency: 'weekly', 'biweekly', 'monthly', 'quarterly'
  - `frequency_interval` (integer, not null) - Number of periods (e.g., 2 for every 2 weeks)
  - `status` (text, not null) - Subscription status: 'active', 'paused', 'cancelled', 'expired'
  - `next_order_date` (date, not null) - Date of next scheduled order
  - `start_date` (date, not null) - Subscription start date
  - `end_date` (date, nullable) - Optional subscription end date
  - `payment_method_id` (uuid, nullable) - References payment_methods
  - `shipping_address_id` (uuid, nullable) - References customer_addresses
  - `location_id` (uuid, nullable) - References locations for org orders
  - `discount_percentage` (numeric, default 0) - Optional subscription discount
  - `last_order_date` (date, nullable) - Date of last processed order
  - `total_orders` (integer, default 0) - Count of orders placed
  - `notes` (text, nullable) - Customer notes
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `subscription_orders`
  - `id` (uuid, primary key) - Unique order identifier
  - `subscription_id` (uuid, foreign key) - References subscriptions
  - `order_id` (text, nullable) - BigCommerce order ID once placed
  - `status` (text, not null) - Order status: 'pending', 'processing', 'completed', 'failed', 'skipped'
  - `scheduled_date` (date, not null) - When order was scheduled to be placed
  - `processed_date` (timestamptz, nullable) - When order was actually processed
  - `amount` (numeric, not null) - Order amount
  - `error_message` (text, nullable) - Error details if failed
  - `retry_count` (integer, default 0) - Number of retry attempts
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only manage their own subscriptions
  - Organization members can view org subscriptions
  - Admins and sales reps have full access
  - Service role needed for automated order processing

  ## Indexes
  - Index on user_id for fast user subscription lookup
  - Index on next_order_date for scheduled order processing
  - Index on status for filtering active subscriptions
  - Index on subscription_id for order history lookup
*/

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  frequency_interval integer NOT NULL DEFAULT 1 CHECK (frequency_interval > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  next_order_date date NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  shipping_address_id uuid REFERENCES customer_addresses(id) ON DELETE SET NULL,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  last_order_date date,
  total_orders integer DEFAULT 0 CHECK (total_orders >= 0),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscription_orders table
CREATE TABLE IF NOT EXISTS subscription_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  order_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  scheduled_date date NOT NULL,
  processed_date timestamptz,
  amount numeric NOT NULL CHECK (amount >= 0),
  error_message text,
  retry_count integer DEFAULT 0 CHECK (retry_count >= 0),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_order_date ON subscriptions(next_order_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_subscription_id ON subscription_orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON subscription_orders(status);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_scheduled_date ON subscription_orders(scheduled_date);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can create own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can delete own subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Org members can view org subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Sales reps can view assigned org subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Users can view own subscription orders" ON subscription_orders;
  DROP POLICY IF EXISTS "Admins can view all subscription orders" ON subscription_orders;
  DROP POLICY IF EXISTS "System can manage subscription orders" ON subscription_orders;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Subscriptions policies for users
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Organization members can view org subscriptions
CREATE POLICY "Org members can view org subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = subscriptions.organization_id
      AND user_organization_roles.user_id = auth.uid()
    )
  );

-- Admin policies
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all subscriptions"
  ON subscriptions FOR ALL
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

-- Sales rep policies
CREATE POLICY "Sales reps can view assigned org subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN organizations o ON o.default_sales_rep_id = p.id
      WHERE p.id = auth.uid()
      AND p.role = 'sales_rep'
      AND o.id = subscriptions.organization_id
    )
  );

-- Subscription orders policies
CREATE POLICY "Users can view own subscription orders"
  ON subscription_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_orders.subscription_id
      AND subscriptions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all subscription orders"
  ON subscription_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can manage subscription orders"
  ON subscription_orders FOR ALL
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at_trigger ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at_trigger
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- Function to calculate next order date
CREATE OR REPLACE FUNCTION calculate_next_order_date(
  p_current_date date,
  p_frequency text,
  p_frequency_interval integer
)
RETURNS date AS $$
BEGIN
  RETURN CASE p_frequency
    WHEN 'weekly' THEN p_current_date + (p_frequency_interval * 7 * INTERVAL '1 day')
    WHEN 'biweekly' THEN p_current_date + (p_frequency_interval * 14 * INTERVAL '1 day')
    WHEN 'monthly' THEN p_current_date + (p_frequency_interval * INTERVAL '1 month')
    WHEN 'quarterly' THEN p_current_date + (p_frequency_interval * 3 * INTERVAL '1 month')
    WHEN 'yearly' THEN p_current_date + (p_frequency_interval * INTERVAL '1 year')
    ELSE p_current_date + (p_frequency_interval * 30 * INTERVAL '1 day')
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
