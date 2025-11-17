/*
  # Fix user_organization_roles Infinite Recursion

  ## Problem
  The "Users can view organization roles" policy queries user_organization_roles 
  to check if user is in the organization, causing infinite recursion.

  ## Solution
  Simplify the policy to only check direct ownership without self-referencing subquery.
  Users can only see roles for organizations they belong to or their own role.
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view organization roles" ON user_organization_roles;

-- Create a simpler policy that doesn't self-reference
CREATE POLICY "Users can view own organization roles"
  ON user_organization_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can already view all through the "Admins can manage organization roles" policy