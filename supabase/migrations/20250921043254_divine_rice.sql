/*
  # Create Admin User

  1. Updates
    - Set jeff.lutz@hs360.co as admin user
    - Mark as approved
    - Ensure profile exists

  2. Security
    - Admin gets full access to all features
    - Can manage contract pricing
    - Can approve other users
*/

-- Update the user profile to admin status
UPDATE profiles 
SET 
  role = 'admin',
  is_approved = true,
  updated_at = now()
WHERE email = 'jeff.lutz@hs360.co';

-- If the profile doesn't exist for some reason, create it
-- (This should not be needed if the trigger worked, but just in case)
INSERT INTO profiles (id, email, role, is_approved, created_at, updated_at)
SELECT 
  au.id,
  'jeff.lutz@hs360.co',
  'admin',
  true,
  now(),
  now()
FROM auth.users au
WHERE au.email = 'jeff.lutz@hs360.co'
AND NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.email = 'jeff.lutz@hs360.co'
);