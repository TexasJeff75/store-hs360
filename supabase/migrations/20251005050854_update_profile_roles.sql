/*
  # Update Profile Roles

  1. Changes
    - Update profiles.role constraint to use proper role values: 'admin', 'sales_rep', 'customer'
    - Remove old role values ('pending', 'approved')
    - Set default role to 'customer'
  
  2. Notes
    - Existing 'admin' role remains the same
    - 'approved' and 'pending' are replaced with 'customer' and 'sales_rep'
*/

DO $$
BEGIN
  -- First, update any existing 'approved' or 'pending' roles to 'customer'
  UPDATE profiles 
  SET role = 'customer' 
  WHERE role IN ('approved', 'pending');

  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  -- Add new constraint with correct roles
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role = ANY (ARRAY['admin'::text, 'sales_rep'::text, 'customer'::text]));

  -- Update default value
  ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'customer'::text;
END $$;
