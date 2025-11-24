/*
  # Fix Customer Addresses RLS Policy for Organization Members

  1. Changes
    - Drop the restrictive "Users can create own addresses" policy
    - Create new policy allowing organization members to create addresses
    - This fixes the checkout error when customers in organizations try to save addresses

  2. Security
    - Users can still create personal addresses (organization_id IS NULL)
    - Organization members can create addresses for their organization
    - Proper validation through user_organization_roles table
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can create own addresses" ON customer_addresses;

-- Create new policy that allows both personal and organization addresses for members
CREATE POLICY "Users can create addresses"
  ON customer_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow creating personal addresses (no organization)
    (auth.uid() = user_id AND organization_id IS NULL)
    OR
    -- Allow creating organization addresses if user is a member
    (
      auth.uid() = user_id
      AND organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_organization_roles
        WHERE user_organization_roles.user_id = auth.uid()
        AND user_organization_roles.organization_id = customer_addresses.organization_id
      )
    )
  );

-- Update the organization admin policy to avoid conflicts
DROP POLICY IF EXISTS "Admins can create organization addresses" ON customer_addresses;

-- No need to recreate it since the above policy now covers organization members
