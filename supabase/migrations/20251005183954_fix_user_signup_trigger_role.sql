/*
  # Fix User Signup Trigger Role Default

  1. Problem
    - The handle_new_user() trigger is still inserting role='pending'
    - The profiles table constraint only allows 'admin', 'sales_rep', 'customer'
    - This causes "Database error saving new user" during signup

  2. Solution
    - Update handle_new_user() function to use 'customer' as default role
    - This aligns with the updated role constraint

  3. Security
    - Maintains SECURITY DEFINER to allow trigger to bypass RLS
    - New users are created with 'customer' role by default
    - Admins can upgrade users to 'sales_rep' or 'admin' later
*/

-- Update the handle_new_user function to use 'customer' as default role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_approved, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    true,
    'customer',
    now(),
    now()
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();