/*
  Allow distributors to manage their own rep-customer assignments.

  Previously only admins could INSERT/DELETE on distributor_rep_customers.
  Distributors need self-service access so they can assign their sales reps
  to their customer organizations from the Distributor Portal.

  The INSERT policy validates:
    - distributor_id belongs to the authenticated user
    - sales_rep_id is one of their active reps (distributor_sales_reps)
    - organization_id is one of their active customers (distributor_customers)

  The DELETE policy validates:
    - distributor_id belongs to the authenticated user
*/

-- Distributors can assign their own reps to their own customers
CREATE POLICY "Distributors can insert their own rep-customer links"
  ON distributor_rep_customers FOR INSERT
  TO authenticated
  WITH CHECK (
    distributor_id IN (
      SELECT id FROM distributors WHERE profile_id = (SELECT auth.uid())
    )
    AND sales_rep_id IN (
      SELECT dsr.sales_rep_id FROM distributor_sales_reps dsr
      WHERE dsr.distributor_id = distributor_rep_customers.distributor_id
        AND dsr.is_active = true
    )
    AND organization_id IN (
      SELECT dc.organization_id FROM distributor_customers dc
      WHERE dc.distributor_id = distributor_rep_customers.distributor_id
        AND dc.is_active = true
    )
  );

-- Distributors can remove their own rep-customer links
CREATE POLICY "Distributors can delete their own rep-customer links"
  ON distributor_rep_customers FOR DELETE
  TO authenticated
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE profile_id = (SELECT auth.uid())
    )
  );
