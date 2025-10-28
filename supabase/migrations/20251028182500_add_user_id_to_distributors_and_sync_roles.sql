/*
  # Add user_id to Distributors and Sync Roles

  ## Changes
  1. Adds user_id column to distributors table (references auth.users)
  2. Populates user_id from profile_id for existing distributors
  3. Creates trigger to automatically set profile role to 'distributor' when added
  4. Updates RLS policies for distributor access

  ## Why
  - Distributors need a user_id to match against auth.uid()
  - Profile role should automatically become 'distributor' when user is added as distributor
  - Distributors should be able to view their own distributor record
*/

-- Add user_id column to distributors
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Populate user_id from profile_id for existing distributors
UPDATE distributors d
SET user_id = p.id
FROM profiles p
WHERE d.profile_id = p.id AND d.user_id IS NULL;

-- Create function to sync distributor profile role
CREATE OR REPLACE FUNCTION sync_distributor_role()
RETURNS TRIGGER AS $$
BEGIN
  -- When a distributor is created or reactivated, set their profile role to 'distributor'
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_active = true AND OLD.is_active = false)) THEN
    UPDATE profiles
    SET role = 'distributor'
    WHERE id = NEW.profile_id OR id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for syncing distributor role
DROP TRIGGER IF EXISTS trigger_sync_distributor_role ON distributors;
CREATE TRIGGER trigger_sync_distributor_role
  AFTER INSERT OR UPDATE ON distributors
  FOR EACH ROW
  EXECUTE FUNCTION sync_distributor_role();

-- Drop and recreate RLS policy for distributors to view their own record
DROP POLICY IF EXISTS "Distributors can view own record" ON distributors;
CREATE POLICY "Distributors can view own record"
  ON distributors FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    profile_id IN (SELECT id FROM profiles WHERE id = auth.uid())
  );

-- Drop and recreate policy for distributors to view their sales reps
DROP POLICY IF EXISTS "Distributors can view their sales reps" ON distributor_sales_reps;
CREATE POLICY "Distributors can view their sales reps"
  ON distributor_sales_reps FOR SELECT
  TO authenticated
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE user_id = auth.uid() OR profile_id = auth.uid()
    )
  );