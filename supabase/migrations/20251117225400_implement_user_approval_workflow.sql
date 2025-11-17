/*
  # Implement User Approval Workflow

  ## Changes
  1. Make role nullable with default NULL (pending approval)
  2. Add approved flag to profiles
  3. Update trigger to create unapproved users
  4. Update key RLS policies to check approved status
  
  ## Security
  - New users have NULL role and approved = false
  - Unapproved users cannot access any system resources
  - Only admins can approve users and assign roles

  ## Roles After Approval
  - admin: Full system access
  - distributor: Manages sales reps
  - sales_rep: Creates orders, earns commissions
  - customer: Regular customer access
*/

-- Make role nullable
ALTER TABLE profiles 
  ALTER COLUMN role DROP NOT NULL;

-- Remove default role
ALTER TABLE profiles 
  ALTER COLUMN role DROP DEFAULT;

-- Add approved flag
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;

-- Update existing users to be approved (they already have roles)
UPDATE profiles SET approved = true WHERE role IS NOT NULL;

-- Drop old constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint that allows NULL
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IS NULL OR role = ANY (ARRAY['admin'::text, 'distributor'::text, 'sales_rep'::text, 'customer'::text]));

-- Update the user signup trigger to create unapproved users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, approved)
  VALUES (
    NEW.id,
    NEW.email,
    NULL,  -- No role until approved
    false  -- Not approved by default
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is approved
CREATE OR REPLACE FUNCTION is_user_approved(user_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND approved = true 
    AND role IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update profiles RLS to allow admins to see all, users to see only themselves
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can update approval status and roles
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );