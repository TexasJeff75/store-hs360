/*
  # Fix Contract Pricing RLS Policies

  1. Changes
    - Drop old policies that cause infinite recursion
    - Create new policies using the is_admin() helper function
    - Update read policy to support all pricing types (individual, organization, location)

  2. Security
    - Users can read their own individual pricing
    - Users can read pricing for organizations/locations they belong to
    - Admins can manage all pricing entries
*/

-- Drop old policies
DROP POLICY IF EXISTS "Users can read contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can manage contract pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Users can read own individual pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Users can read organization pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Users can read location pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can read all pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can insert pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can update pricing" ON contract_pricing;
DROP POLICY IF EXISTS "Admins can delete pricing" ON contract_pricing;

-- Users can read their own individual pricing
CREATE POLICY "Users can read own individual pricing"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'individual' 
    AND entity_id = auth.uid()
  );

-- Users can read organization pricing for their organizations
CREATE POLICY "Users can read organization pricing"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'organization'
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = contract_pricing.entity_id
    )
  );

-- Users can read location pricing for their locations
CREATE POLICY "Users can read location pricing"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (
    pricing_type = 'location'
    AND EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.location_id = contract_pricing.entity_id
    )
  );

-- Admins can read all pricing
CREATE POLICY "Admins can read all pricing"
  ON contract_pricing
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can insert pricing
CREATE POLICY "Admins can insert pricing"
  ON contract_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admins can update pricing
CREATE POLICY "Admins can update pricing"
  ON contract_pricing
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Admins can delete pricing
CREATE POLICY "Admins can delete pricing"
  ON contract_pricing
  FOR DELETE
  TO authenticated
  USING (is_admin());
