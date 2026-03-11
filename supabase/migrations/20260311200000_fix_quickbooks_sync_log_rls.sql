-- Fix quickbooks_sync_log RLS INSERT policy
-- The previous policy only allowed admin users to insert sync logs,
-- causing 400 errors when non-admin code paths triggered sync logging.
-- Sync logs are an audit trail and should accept inserts from any authenticated user.

DROP POLICY IF EXISTS "Admins can insert sync logs" ON quickbooks_sync_log;

CREATE POLICY "Authenticated users can insert sync logs"
  ON quickbooks_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
