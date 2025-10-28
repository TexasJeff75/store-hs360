/*
  # Add Distributor Role to Profiles

  ## Changes
  Updates the role constraint on the profiles table to include 'distributor' as a valid role.

  ## Roles
  - admin: Full system access
  - distributor: Manages sales reps and sees their commissions
  - sales_rep: Creates orders, earns commissions
  - customer: Regular customer access

  ## Why
  Distributors need their own role to:
  1. View all commissions for their sales reps
  2. Manage their sales rep assignments
  3. Have distinct permissions from regular sales reps
*/

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint including 'distributor'
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'distributor'::text, 'sales_rep'::text, 'customer'::text]));