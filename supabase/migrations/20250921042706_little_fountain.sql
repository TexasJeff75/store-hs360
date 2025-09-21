/*
  # Fix user signup trigger

  1. Issues Fixed
    - Ensure handle_new_user trigger properly inserts user ID from auth.users
    - Add proper error handling for profile creation
    - Ensure RLS policies allow profile creation during signup

  2. Changes
    - Recreate handle_new_user function with proper error handling
    - Ensure profiles.id gets the auth user ID
    - Add policy to allow authenticated users to insert their own profile
*/

-- Recreate the handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_approved, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    false,
    'pending',
    now(),
    now()
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error and re-raise it
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Add RLS policy to allow users to insert their own profile during signup
CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);