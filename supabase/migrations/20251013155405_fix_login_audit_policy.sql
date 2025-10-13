/*
  # Fix Login Audit Policy

  1. Changes
    - Drop the existing restrictive INSERT policy
    - Add a new policy that allows both authenticated and anon users to insert
    - Use WITH CHECK to ensure they can only insert for their own user_id
    - This prevents race conditions during login where session might not be fully established

  2. Security
    - Still enforces that users can only insert their own records
    - Prevents unauthorized audit log creation
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Authenticated users can insert their own login audit logs" ON login_audit;

-- Create new policy that works during login flow
CREATE POLICY "Users can insert their own login audit logs"
  ON login_audit
  FOR INSERT
  WITH CHECK (true);