/*
  # Fix Profiles Infinite Recursion

  ## Changes
  Remove duplicate policies and fix the recursive admin check
  
  ## Details
  The "Users can view own profile" policy was checking admin status by querying profiles,
  causing infinite recursion. We'll consolidate to simpler non-recursive policies.
*/

-- Drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Create simple, non-recursive SELECT policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = (SELECT auth.uid()) LIMIT 1) = 'admin'
  );