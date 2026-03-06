/*
  # Fix Distributor Section

  ## Changes
  1. Backfill user_id for distributors created after the initial migration
  2. Fix the orders RLS policy so distributors can see their sales reps' orders
     (the old policy only checked sales_rep_id = auth.uid() which is wrong —
     distributors need to see orders from their subordinate sales reps)
*/

-- 1. Backfill user_id from profile_id for any distributors missing it
UPDATE distributors
SET user_id = profile_id
WHERE user_id IS NULL;

-- 2. Fix the orders RLS policy for distributors
-- The old policy checked sales_rep_id = auth.uid(), but distributors are not
-- the sales_rep on orders — their subordinate sales reps are.
DROP POLICY IF EXISTS "Distributors can view assigned orders" ON orders;

CREATE POLICY "Distributors can view assigned orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'distributor'
    )
    AND (
      -- Distributor's own orders (if any)
      sales_rep_id = (select auth.uid())
      OR
      -- Orders from the distributor's subordinate sales reps
      sales_rep_id IN (
        SELECT dsr.sales_rep_id
        FROM distributor_sales_reps dsr
        JOIN distributors d ON d.id = dsr.distributor_id
        WHERE (d.user_id = (select auth.uid()) OR d.profile_id = (select auth.uid()))
          AND dsr.is_active = true
          AND d.is_active = true
      )
    )
  );
