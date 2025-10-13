/*
  # Create Login Audit Table

  1. New Tables
    - `login_audit`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text, user's email)
      - `age_verified` (boolean, whether user confirmed age verification)
      - `ip_address` (text, optional IP address)
      - `user_agent` (text, optional browser/device info)
      - `login_timestamp` (timestamptz, when login occurred)
      - `created_at` (timestamptz, record creation time)
  
  2. Security
    - Enable RLS on `login_audit` table
    - Add policy for admins to view all audit logs
    - Add policy for users to view their own audit logs
    - Add policy for authenticated users to insert their own audit logs

  3. Indexes
    - Index on user_id for fast lookups
    - Index on login_timestamp for time-based queries
    - Index on email for searching by email
*/

CREATE TABLE IF NOT EXISTS login_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  age_verified boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  login_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_timestamp ON login_audit(login_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_email ON login_audit(email);

CREATE POLICY "Admins can view all login audit logs"
  ON login_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own login audit logs"
  ON login_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert their own login audit logs"
  ON login_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);