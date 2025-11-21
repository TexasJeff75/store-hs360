/*
  # Create Shopping Carts Table

  1. New Tables
    - `shopping_carts`
      - `id` (uuid, primary key) - Unique cart identifier
      - `user_id` (uuid, foreign key) - User who owns the cart
      - `organization_id` (uuid, nullable, foreign key) - Organization context for the cart
      - `cart_items` (jsonb) - Array of cart items with product details
      - `created_at` (timestamptz) - When the cart was created
      - `updated_at` (timestamptz) - When the cart was last modified
      - `expires_at` (timestamptz, nullable) - Optional expiration timestamp

  2. Security
    - Enable RLS on `shopping_carts` table
    - Add policy for users to manage their own carts
    - Add policy for sales reps to view carts for their organizations
    - Add policy for admins to view all carts

  3. Indexes
    - Index on user_id for fast user cart lookups
    - Index on organization_id for organization-specific queries
    - Composite index on (user_id, organization_id) for unique cart per user per org

  4. Notes
    - Users can have multiple carts (one per organization context)
    - Cart items stored as JSONB for flexibility
    - Automatic timestamp management via triggers
*/

-- Create shopping_carts table
CREATE TABLE IF NOT EXISTS shopping_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shopping_carts_user_id ON shopping_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_organization_id ON shopping_carts(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_carts_user_org 
  ON shopping_carts(user_id, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Enable RLS
ALTER TABLE shopping_carts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own carts
CREATE POLICY "Users can manage own carts"
  ON shopping_carts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Sales reps can view carts for their organizations
CREATE POLICY "Sales reps can view organization carts"
  ON shopping_carts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.role = 'sales_rep'
      AND user_organization_roles.organization_id = shopping_carts.organization_id
    )
  );

-- Policy: Admins can view all carts
CREATE POLICY "Admins can view all carts"
  ON shopping_carts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shopping_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_shopping_carts_updated_at ON shopping_carts;

CREATE TRIGGER set_shopping_carts_updated_at
  BEFORE UPDATE ON shopping_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_shopping_carts_updated_at();