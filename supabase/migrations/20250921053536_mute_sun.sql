/*
  # Add is_admin helper function

  1. New Functions
    - `is_admin()` - Helper function to check if current user is admin
    - Returns boolean indicating if authenticated user has admin role

  2. Security
    - Function is security definer to access profiles table
    - Only checks current authenticated user's role
*/

-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;