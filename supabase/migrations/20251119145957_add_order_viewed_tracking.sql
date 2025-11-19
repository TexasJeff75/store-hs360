/*
  # Add Order Viewed Tracking

  1. Changes
    - Add `viewed_by_admin` column to orders table to track if order has been viewed by admin/staff
    - Add `viewed_at` timestamp to track when order was first viewed
    - Add index for fast querying of unviewed orders
    - Update RLS policies to allow admins/sales_reps/distributors to update viewed status

  2. Purpose
    - Enable "new order" badge functionality in menu
    - Track which orders need admin attention
    - Provide audit trail of when orders were first reviewed
*/

-- Add viewed tracking columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS viewed_by_admin boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

-- Add index for fast querying of unviewed orders
CREATE INDEX IF NOT EXISTS idx_orders_viewed_by_admin ON orders(viewed_by_admin) WHERE viewed_by_admin = false;

-- Add policy for admins/sales_reps/distributors to mark orders as viewed
CREATE POLICY "Admin staff can mark orders as viewed"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales_rep', 'distributor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales_rep', 'distributor')
    )
  );

-- Create function to automatically set viewed_at timestamp
CREATE OR REPLACE FUNCTION set_order_viewed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.viewed_by_admin = true AND OLD.viewed_by_admin = false AND NEW.viewed_at IS NULL THEN
    NEW.viewed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to set viewed_at timestamp
DROP TRIGGER IF EXISTS trigger_set_order_viewed_at ON orders;
CREATE TRIGGER trigger_set_order_viewed_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_viewed_at();
