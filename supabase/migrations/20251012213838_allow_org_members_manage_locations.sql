/*
  # Allow Organization Members to Manage Locations

  1. Changes
    - Add policies to allow organization members to create, update, and delete locations for their organizations
    - Maintains admin full access
    - Ensures users can only manage locations within their assigned organizations

  2. Security
    - Users must be authenticated and member of the organization
    - All operations check organization membership via user_organization_roles
    - Admin users retain full access to all locations
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage locations" ON locations;

-- Allow organization members to create locations for their organizations
CREATE POLICY "Organization members can create locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = locations.organization_id
      AND user_organization_roles.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Allow organization members to update locations for their organizations
CREATE POLICY "Organization members can update locations"
  ON locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = locations.organization_id
      AND user_organization_roles.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = locations.organization_id
      AND user_organization_roles.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Allow organization members to delete locations for their organizations
CREATE POLICY "Organization members can delete locations"
  ON locations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.organization_id = locations.organization_id
      AND user_organization_roles.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );
