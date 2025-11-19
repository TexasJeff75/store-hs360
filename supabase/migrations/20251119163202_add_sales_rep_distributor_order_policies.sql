/*
  # Add RLS policies for sales reps and distributors to view orders

  1. Changes
    - Add policy for sales_reps to view orders assigned to them
    - Add policy for distributors to view orders assigned to them
    - These policies enable sales_reps and distributors to see orders where they are the assigned rep

  2. Security
    - Sales reps can only see orders where orders.sales_rep_id matches their user ID
    - Distributors can only see orders where orders.sales_rep_id matches their user ID
    - This maintains data security while allowing proper order management
*/

-- Policy for sales reps to view their assigned orders
CREATE POLICY "Sales reps can view assigned orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    sales_rep_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'sales_rep'
    )
  );

-- Policy for distributors to view their assigned orders
CREATE POLICY "Distributors can view assigned orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    sales_rep_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'distributor'
    )
  );
