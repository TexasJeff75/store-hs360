/*
  # Fix Contract Pricing Policies

  ## Changes
  Simplify contract_pricing policies to prevent recursion and improve performance
  
  ## Details
  The policies were too complex and causing performance issues. 
  Simplified to use direct lookups without complex subqueries.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own individual pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Users can read organization pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Users can read location pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can read all pricing" ON contract_pricing;

-- Create simpler, more efficient policies
CREATE POLICY "Users can read own individual pricing"
  ON contract_pricing FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'individual' 
    AND user_id = (SELECT auth.uid())
  );

CREATE POLICY "Users can read organization pricing"
  ON contract_pricing FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'organization'
    AND entity_id::text IN (
      SELECT organization_id::text 
      FROM user_organization_roles
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can read location pricing"
  ON contract_pricing FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'location'
    AND entity_id::text IN (
      SELECT location_id::text 
      FROM user_organization_roles
      WHERE user_id = (SELECT auth.uid()) 
      AND location_id IS NOT NULL
    )
  );

CREATE POLICY "Admins can read all pricing"
  ON contract_pricing FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = (SELECT auth.uid()) LIMIT 1) = 'admin'
  );