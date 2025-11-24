/*
  # Add Vendor Order Split Support

  1. Changes
    - Add `is_sub_order` boolean flag for vendor sub-orders
    - Add `vendor_brand` column to store the vendor/brand name for sub-orders
    - Update order_type constraint to include 'split_parent' and 'vendor_sub_order'
    - Add indexes for performance on vendor-related lookups

  2. Notes
    - Enables splitting orders by vendor/brand for separate fulfillment
    - Parent orders marked as 'split_parent', sub-orders as 'vendor_sub_order'
    - Each sub-order contains only items from one vendor
*/

-- Add is_sub_order column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'is_sub_order'
  ) THEN
    ALTER TABLE orders ADD COLUMN is_sub_order boolean DEFAULT false;
  END IF;
END $$;

-- Add vendor_brand column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'vendor_brand'
  ) THEN
    ALTER TABLE orders ADD COLUMN vendor_brand text;
  END IF;
END $$;

-- Drop existing order_type constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_type_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_order_type_check;
  END IF;
END $$;

-- Add updated constraint with new order types
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check 
  CHECK (order_type IN ('original', 'backorder', 'split', 'partial', 'split_parent', 'vendor_sub_order'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_vendor_brand ON orders(vendor_brand) WHERE vendor_brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_is_sub_order ON orders(is_sub_order) WHERE is_sub_order = true;

-- Add comments for documentation
COMMENT ON COLUMN orders.is_sub_order IS 'Flag indicating this is a vendor sub-order';
COMMENT ON COLUMN orders.vendor_brand IS 'Vendor/brand name for vendor sub-orders';
