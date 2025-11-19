/*
  # Add User Approval Status

  1. Changes
    - Add `approval_status` enum column to profiles table with values: 'pending', 'approved', 'denied'
    - Default status is 'pending' for new users
    - Migrate existing data: approved=true → 'approved', approved=false → 'pending'
    - Keep `approved` column for backward compatibility during transition
    - Add index for efficient filtering by approval_status

  2. Notes
    - This allows better tracking of user approval workflow
    - Denied users can be identified separately from pending users
    - Maintains backward compatibility with existing code
*/

-- Create enum type for approval status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'denied');
  END IF;
END $$;

-- Add approval_status column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN approval_status approval_status DEFAULT 'pending';
  END IF;
END $$;

-- Migrate existing data
UPDATE profiles 
SET approval_status = CASE 
  WHEN approved = true THEN 'approved'::approval_status
  ELSE 'pending'::approval_status
END
WHERE approval_status = 'pending';

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status 
ON profiles(approval_status);

-- Update the approved column trigger to sync with approval_status
CREATE OR REPLACE FUNCTION sync_approval_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When approval_status changes, update approved column
  IF NEW.approval_status = 'approved' THEN
    NEW.approved := true;
  ELSE
    NEW.approved := false;
  END IF;
  
  -- When approved column changes, update approval_status
  IF TG_OP = 'UPDATE' AND OLD.approved IS DISTINCT FROM NEW.approved THEN
    IF NEW.approved = true THEN
      NEW.approval_status := 'approved';
    ELSIF OLD.approval_status = 'approved' AND NEW.approved = false THEN
      NEW.approval_status := 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS sync_approval_status_trigger ON profiles;
CREATE TRIGGER sync_approval_status_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_approval_status();