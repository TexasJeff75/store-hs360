/*
  # Create Checkout Sessions Table

  1. New Tables
    - `checkout_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `organization_id` (uuid, references organizations, optional)
      - `cart_id` (text) - BigCommerce cart ID
      - `checkout_id` (text) - BigCommerce checkout ID
      - `status` (text) - pending, processing, completed, failed, abandoned
      - `step` (text) - cart_creation, address_entry, payment, confirmation
      - `cart_items` (jsonb) - Array of cart items
      - `shipping_address` (jsonb) - Shipping address data
      - `billing_address` (jsonb) - Billing address data
      - `payment_method` (text) - online, offline
      - `subtotal` (decimal)
      - `tax` (decimal)
      - `shipping` (decimal)
      - `total` (decimal)
      - `currency` (text, default USD)
      - `error_log` (jsonb) - Array of errors encountered
      - `retry_count` (integer, default 0)
      - `last_error` (text)
      - `idempotency_key` (text, unique)
      - `metadata` (jsonb) - Additional metadata
      - `completed_at` (timestamptz)
      - `abandoned_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `checkout_sessions` table
    - Add policy for users to read their own checkout sessions
    - Add policy for users to create their own checkout sessions
    - Add policy for users to update their own checkout sessions
    - Add policy for admin to read all checkout sessions

  3. Indexes
    - Index on user_id for fast lookups
    - Index on status for filtering
    - Index on idempotency_key for duplicate prevention
    - Index on expires_at for cleanup queries
*/

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  cart_id text,
  checkout_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'abandoned')),
  step text NOT NULL DEFAULT 'cart_creation' CHECK (step IN ('cart_creation', 'address_entry', 'payment', 'confirmation')),
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping_address jsonb,
  billing_address jsonb,
  payment_method text CHECK (payment_method IN ('online', 'offline')),
  subtotal decimal(10,2) DEFAULT 0,
  tax decimal(10,2) DEFAULT 0,
  shipping decimal(10,2) DEFAULT 0,
  total decimal(10,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  error_log jsonb DEFAULT '[]'::jsonb,
  retry_count integer DEFAULT 0,
  last_error text,
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  abandoned_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own checkout sessions
CREATE POLICY "Users can read own checkout sessions"
  ON checkout_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create their own checkout sessions
CREATE POLICY "Users can create own checkout sessions"
  ON checkout_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own checkout sessions
CREATE POLICY "Users can update own checkout sessions"
  ON checkout_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can read all checkout sessions
CREATE POLICY "Admins can read all checkout sessions"
  ON checkout_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user_id ON checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_idempotency ON checkout_sessions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_expires_at ON checkout_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_org_id ON checkout_sessions(organization_id);

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_checkout_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_checkout_sessions_updated_at
  BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_checkout_session_updated_at();