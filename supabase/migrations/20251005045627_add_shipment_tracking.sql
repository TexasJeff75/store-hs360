/*
  # Add Shipment Tracking to Orders

  1. Changes
    - Add `shipments` jsonb column to orders table to store tracking information
    - Each shipment contains: carrier, tracking_number, shipped_date, estimated_delivery, status, notes
    - Multiple tracking numbers can be stored as an array of shipment objects
  
  2. Security
    - No RLS changes needed as orders table already has RLS enabled
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipments'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipments jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN orders.shipments IS 'Array of shipment tracking objects with carrier, tracking_number, shipped_date, estimated_delivery, status, and notes';
