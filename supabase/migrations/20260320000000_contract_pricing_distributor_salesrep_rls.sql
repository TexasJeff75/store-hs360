/*
  # Contract Pricing RLS for Distributors and Sales Reps

  ## Problem
  Distributors and sales reps cannot read (or manage) contract_pricing rows
  for organizations assigned to them. Only admins and the customer users
  themselves had access.

  ## Changes
  - SELECT: distributors can read pricing for their customer orgs
  - SELECT: sales reps can read pricing for their assigned orgs
  - INSERT/UPDATE/DELETE: distributors can manage pricing for their customer orgs
*/

-- Distributors: read contract pricing for their customer orgs
CREATE POLICY "Distributors can read customer org pricing"
  ON contract_pricing FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'organization'
    AND entity_id::text IN (
      SELECT dc.organization_id::text
      FROM distributor_customers dc
      JOIN distributors d ON d.id = dc.distributor_id
      WHERE d.profile_id = (SELECT auth.uid())
        AND dc.is_active = true
        AND d.is_active = true
    )
  );

-- Sales reps: read contract pricing for their assigned orgs
CREATE POLICY "Sales reps can read assigned org pricing"
  ON contract_pricing FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'organization'
    AND entity_id::text IN (
      SELECT osr.organization_id::text
      FROM organization_sales_reps osr
      WHERE osr.sales_rep_id = (SELECT auth.uid())
        AND osr.is_active = true
    )
  );

-- Distributors: insert contract pricing for their customer orgs
CREATE POLICY "Distributors can insert customer org pricing"
  ON contract_pricing FOR INSERT
  TO authenticated
  WITH CHECK (
    pricing_type = 'organization'
    AND entity_id::text IN (
      SELECT dc.organization_id::text
      FROM distributor_customers dc
      JOIN distributors d ON d.id = dc.distributor_id
      WHERE d.profile_id = (SELECT auth.uid())
        AND dc.is_active = true
        AND d.is_active = true
    )
  );

-- Distributors: update contract pricing for their customer orgs
CREATE POLICY "Distributors can update customer org pricing"
  ON contract_pricing FOR UPDATE
  TO authenticated
  USING (
    pricing_type = 'organization'
    AND entity_id::text IN (
      SELECT dc.organization_id::text
      FROM distributor_customers dc
      JOIN distributors d ON d.id = dc.distributor_id
      WHERE d.profile_id = (SELECT auth.uid())
        AND dc.is_active = true
        AND d.is_active = true
    )
  );

-- Distributors: delete contract pricing for their customer orgs
CREATE POLICY "Distributors can delete customer org pricing"
  ON contract_pricing FOR DELETE
  TO authenticated
  USING (
    pricing_type = 'organization'
    AND entity_id::text IN (
      SELECT dc.organization_id::text
      FROM distributor_customers dc
      JOIN distributors d ON d.id = dc.distributor_id
      WHERE d.profile_id = (SELECT auth.uid())
        AND dc.is_active = true
        AND d.is_active = true
    )
  );
