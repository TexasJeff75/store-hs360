-- Fix quickbooks_sync_log RLS policies
-- The previous INSERT policy only allowed admin users to insert sync logs,
-- causing 400 errors when non-admin code paths (e.g. payment processing) triggered sync logging.
-- Sync logs are an audit trail and should accept inserts from any authenticated user.
-- SELECT remains admin-only so non-admins cannot read audit data.

-- Fix INSERT: allow any authenticated user (was admin-only)
DROP POLICY IF EXISTS "Admins can insert sync logs" ON quickbooks_sync_log;

CREATE POLICY "Authenticated users can insert sync logs"
  ON quickbooks_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure SELECT policy exists for admins (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quickbooks_sync_log' AND policyname = 'Admins can view sync logs'
  ) THEN
    CREATE POLICY "Admins can view sync logs"
      ON quickbooks_sync_log FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;
