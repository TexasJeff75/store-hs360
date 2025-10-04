/*
  # Create initial admin user

  1. Purpose
    - Creates an initial admin user for managing the system
    - This should be run after the first user signs up through the application

  2. Instructions
    - Replace 'your-admin-email@example.com' with your actual admin email
    - Run this migration after you've signed up with your admin account
    - This will promote your account to admin status
*/

-- Update the first user (replace with your actual admin email) to be an admin
-- You'll need to run this after signing up with your admin account
UPDATE profiles 
SET 
  is_approved = true,
  role = 'admin',
  updated_at = now()
WHERE email = 'your-admin-email@example.com';

-- If you want to create a specific admin user, uncomment and modify this:
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
-- VALUES (
--   gen_random_uuid(),
--   'admin@healthspan360.com',
--   crypt('your-secure-password', gen_salt('bf')),
--   now(),
--   now(),
--   now()
-- );

-- Then create the corresponding profile:
-- INSERT INTO profiles (id, email, is_approved, role)
-- SELECT id, email, true, 'admin'
-- FROM auth.users
-- WHERE email = 'admin@healthspan360.com';