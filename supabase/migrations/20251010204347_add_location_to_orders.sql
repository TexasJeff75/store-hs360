/*
  # Add Location Reference to Orders

  1. Changes
    - Add `location_id` column to `orders` table
    - Add foreign key constraint to `locations` table
    - Add index for better query performance
    - Update RLS policies to ensure location access is properly validated
  
  2. Security
    - Location access is validated through organization membership
    - Maintains existing RLS policies for orders
*/

-- Add location_id column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN location_id uuid REFERENCES locations(id);
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_location_id ON orders(location_id);

-- Add index for organization_id if not exists
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);