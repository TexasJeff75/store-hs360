/*
  # Add Back-Order and Payment Capture Support

  1. Changes to Orders Table
    - Add `parent_order_id` (uuid, nullable) - Links split orders to original order
    - Add `order_type` (text) - 'original', 'backorder', 'split'
    - Add `payment_status` (text) - 'authorized', 'captured', 'refunded', 'failed'
    - Add `payment_authorization_id` (text) - Store payment auth for later capture
    - Add `payment_captured_at` (timestamptz) - When payment was captured
    - Add `shipped_at` (timestamptz) - When order was marked as shipped

  2. Item-Level Back-Order Tracking
    - Update items JSONB to support back-order status per item
    - Add `backorder_reason` to track why items are backordered

  3. Indexes
    - Index on parent_order_id for linked order lookups
    - Index on payment_status for payment processing queries
    - Index on order_type for filtering

  4. Notes
    - Payment is authorized at checkout but only captured when shipped
    - Back-ordered items can be split into separate orders
    - Original order maintains reference to all split orders
*/

-- Add new columns to orders table
DO $$
BEGIN
  -- Add parent_order_id for split orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'parent_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN parent_order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
  END IF;

  -- Add order_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_type text DEFAULT 'original' NOT NULL;
  END IF;

  -- Add payment_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'pending' NOT NULL;
  END IF;

  -- Add payment_authorization_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_authorization_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_authorization_id text;
  END IF;

  -- Add payment_captured_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_captured_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_captured_at timestamptz;
  END IF;

  -- Add shipped_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipped_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipped_at timestamptz;
  END IF;

  -- Add backorder_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'backorder_reason'
  ) THEN
    ALTER TABLE orders ADD COLUMN backorder_reason text;
  END IF;

  -- Add split_from_order_id for better tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'split_from_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN split_from_order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_split_from_order_id ON orders(split_from_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- Add constraint for valid order types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_type_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_order_type_check 
      CHECK (order_type IN ('original', 'backorder', 'split', 'partial'));
  END IF;
END $$;

-- Add constraint for valid payment statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IN ('pending', 'authorized', 'captured', 'refunded', 'failed', 'cancelled'));
  END IF;
END $$;

-- Function to automatically update shipped_at when status changes to shipped
CREATE OR REPLACE FUNCTION update_order_shipped_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'shipped' AND OLD.status != 'shipped' AND NEW.shipped_at IS NULL THEN
    NEW.shipped_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for shipped_at
DROP TRIGGER IF EXISTS set_order_shipped_at ON orders;
CREATE TRIGGER set_order_shipped_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_shipped_at();

-- Add comment for documentation
COMMENT ON COLUMN orders.parent_order_id IS 'Links split orders back to the original parent order';
COMMENT ON COLUMN orders.split_from_order_id IS 'Direct reference to the order this was split from';
COMMENT ON COLUMN orders.order_type IS 'Type of order: original, backorder, split, or partial';
COMMENT ON COLUMN orders.payment_status IS 'Payment state: pending, authorized (held), captured (charged), refunded, failed, cancelled';
COMMENT ON COLUMN orders.payment_authorization_id IS 'Payment gateway authorization ID for later capture';
COMMENT ON COLUMN orders.payment_captured_at IS 'Timestamp when payment was actually charged';
COMMENT ON COLUMN orders.shipped_at IS 'Timestamp when order was marked as shipped';
COMMENT ON COLUMN orders.backorder_reason IS 'Reason for back-order (e.g., out of stock, discontinued)';