/*
  # Allow Organization Members to Manage Payment Methods

  1. Changes
    - Update RLS policies to allow all organization members to manage payment methods
    - Previously only organization admins could manage payment methods
    - Now any member of the organization can add, update, and delete payment methods
    - Maintains security by ensuring users can only manage their organization's payment methods

  2. Security
    - Users must be authenticated and member of the organization
    - All operations check organization membership via user_organization_roles
    - System admins retain full access to all payment methods
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Organization admins can insert payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Organization admins can update payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Organization admins can delete payment methods" ON payment_methods;

-- Allow organization members to insert payment methods
CREATE POLICY "Organization members can insert payment methods"
  ON payment_methods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow organization members to update payment methods
CREATE POLICY "Organization members can update payment methods"
  ON payment_methods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow organization members to delete payment methods
CREATE POLICY "Organization members can delete payment methods"
  ON payment_methods FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_roles
      WHERE user_organization_roles.user_id = auth.uid()
      AND user_organization_roles.organization_id = payment_methods.organization_id
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
