-- Add is_test_order flag to orders table for admin test mode
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test_order boolean DEFAULT false;
