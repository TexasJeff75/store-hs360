/*
  # Create Orders Table

  1. New Tables
    - `orders`
      - `id` (uuid, primary key) - Internal order ID
      - `user_id` (uuid, foreign key) - References auth.users
      - `bigcommerce_order_id` (text) - BigCommerce order ID
      - `bigcommerce_cart_id` (text) - BigCommerce cart ID
      - `order_number` (text) - Human-readable order number
      - `status` (text) - Order status (pending, processing, completed, cancelled, refunded)
      - `subtotal` (numeric) - Order subtotal
      - `tax` (numeric) - Tax amount
      - `shipping` (numeric) - Shipping cost
      - `total` (numeric) - Total order amount
      - `currency` (text) - Currency code (default USD)
      - `items` (jsonb) - Order items as JSON
      - `shipping_address` (jsonb) - Shipping address
      - `billing_address` (jsonb) - Billing address
      - `customer_email` (text) - Customer email
      - `organization_id` (uuid, nullable) - For B2B orders
      - `notes` (text, nullable) - Order notes
      - `created_at` (timestamptz) - Order creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `completed_at` (timestamptz, nullable) - Order completion timestamp

  2. Security
    - Enable RLS on `orders` table
    - Add policy for users to read their own orders
    - Add policy for users to create orders
    - Add policy for admin users to read all orders
    - Add policy for organization members to view organization orders

  3. Indexes
    - Index on user_id for fast user order lookups
    - Index on bigcommerce_order_id for syncing
    - Index on organization_id for B2B order queries
    - Index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bigcommerce_order_id text,
  bigcommerce_cart_id text,
  order_number text,
  status text DEFAULT 'pending' NOT NULL,
  subtotal numeric(10, 2) DEFAULT 0 NOT NULL,
  tax numeric(10, 2) DEFAULT 0 NOT NULL,
  shipping numeric(10, 2) DEFAULT 0 NOT NULL,
  total numeric(10, 2) DEFAULT 0 NOT NULL,
  currency text DEFAULT 'USD' NOT NULL,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  shipping_address jsonb,
  billing_address jsonb,
  customer_email text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Organization members can view organization orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = orders.organization_id
      AND user_organization_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_bigcommerce_order_id ON orders(bigcommerce_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);