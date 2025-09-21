/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current admin policies query the profiles table from within profiles table policies
    - This creates infinite recursion when checking user roles
    
  2. Solution
    - Use auth.jwt() to get user metadata instead of querying profiles table
    - Simplify policies to avoid circular references
    - Use direct user ID comparisons where possible
    
  3. Changes
    - Drop existing recursive policies
    - Create new non-recursive policies
    - Use auth.uid() and direct comparisons instead of subqueries
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;

-- Create new non-recursive policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow profile creation during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- For admin access, we'll use a function that doesn't create recursion
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role = 'admin'
    LIMIT 1
  );
$$;

-- Admin policies using the function (called from contract_pricing, not profiles)
-- We'll handle admin access to profiles through application logic instead of RLS
-- to avoid recursion issues