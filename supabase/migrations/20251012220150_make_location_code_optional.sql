/*
  # Make Location Code Optional

  1. Changes
    - Change `code` column in `locations` table from NOT NULL to nullable
    - This allows creating locations without requiring a code
    - Code can still be used for internal reference but is not mandatory

  2. Notes
    - Existing locations with codes are unaffected
    - New locations can be created without specifying a code
*/

-- Make code column nullable
ALTER TABLE locations 
  ALTER COLUMN code DROP NOT NULL;
