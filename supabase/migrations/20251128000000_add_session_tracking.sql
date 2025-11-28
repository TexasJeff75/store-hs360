/*
  # Add Session Tracking and Logout Monitoring

  1. Changes to login_audit table
    - Add `logout_timestamp` (timestamptz, when user logged out)
    - Add `session_duration` (integer, duration in seconds)
    - Add `session_ended` (boolean, whether session properly ended)
    - Add `session_id` (text, unique session identifier)

  2. Indexes
    - Index on session_ended for finding active sessions
    - Index on logout_timestamp for time-based queries

  3. Security
    - Add policy for users to update their own logout records

  4. Notes
    - session_duration will be calculated when logout_timestamp is set
    - session_ended tracks if user explicitly logged out vs browser close
    - Helps identify security risks from orphaned sessions
*/

-- Add new columns to login_audit table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'login_audit' AND column_name = 'logout_timestamp'
  ) THEN
    ALTER TABLE login_audit ADD COLUMN logout_timestamp timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'login_audit' AND column_name = 'session_duration'
  ) THEN
    ALTER TABLE login_audit ADD COLUMN session_duration integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'login_audit' AND column_name = 'session_ended'
  ) THEN
    ALTER TABLE login_audit ADD COLUMN session_ended boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'login_audit' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE login_audit ADD COLUMN session_id text;
  END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_login_audit_session_ended
  ON login_audit(session_ended)
  WHERE session_ended = false;

CREATE INDEX IF NOT EXISTS idx_login_audit_logout_timestamp
  ON login_audit(logout_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_login_audit_session_id
  ON login_audit(session_id);

-- Allow users to update their own logout records
DROP POLICY IF EXISTS "Users can update their own login audit logs" ON login_audit;

CREATE POLICY "Users can update their own login audit logs"
  ON login_audit
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically calculate session duration when logout_timestamp is set
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS trigger AS $$
BEGIN
  IF NEW.logout_timestamp IS NOT NULL AND OLD.logout_timestamp IS NULL THEN
    NEW.session_duration := EXTRACT(EPOCH FROM (NEW.logout_timestamp - NEW.login_timestamp))::integer;
    NEW.session_ended := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate session duration
DROP TRIGGER IF EXISTS trigger_calculate_session_duration ON login_audit;

CREATE TRIGGER trigger_calculate_session_duration
  BEFORE UPDATE ON login_audit
  FOR EACH ROW
  EXECUTE FUNCTION calculate_session_duration();

-- Function to find and auto-expire orphaned sessions (older than 24 hours)
CREATE OR REPLACE FUNCTION expire_orphaned_sessions()
RETURNS void AS $$
BEGIN
  UPDATE login_audit
  SET
    logout_timestamp = login_timestamp + interval '24 hours',
    session_duration = 86400,
    session_ended = false
  WHERE
    session_ended = false
    AND logout_timestamp IS NULL
    AND login_timestamp < NOW() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
