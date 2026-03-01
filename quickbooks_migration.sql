/*
  # QuickBooks Online Integration Tables

  1. New Tables
    - `quickbooks_credentials`
      - Stores OAuth tokens and connection information
      - One active connection per system
      - Handles token refresh automatically

    - `quickbooks_sync_log`
      - Tracks all sync operations with QuickBooks
      - Records successes and failures for auditing
      - Helps troubleshoot sync issues

  2. Table Modifications
    - `organizations` - Add QuickBooks customer ID and sync timestamp
    - `orders` - Add QuickBooks invoice ID and sync status

  3. Security
    - Enable RLS on all tables
    - Admin-only access to credentials
    - Appropriate policies for sync logs

  4. Indexes
    - Performance indexes for frequent queries
*/

-- QuickBooks Credentials Table
CREATE TABLE IF NOT EXISTS quickbooks_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  realm_id text NOT NULL,
  token_type text DEFAULT 'bearer',
  expires_at timestamptz NOT NULL,
  refresh_token_expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true,
  CONSTRAINT single_active_connection UNIQUE (is_active) WHERE is_active = true
);

-- QuickBooks Sync Log Table
CREATE TABLE IF NOT EXISTS quickbooks_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  operation text NOT NULL,
  status text NOT NULL,
  quickbooks_id text,
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add QuickBooks fields to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'quickbooks_customer_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN quickbooks_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE organizations ADD COLUMN last_synced_at timestamptz;
  END IF;
END $$;

-- Add QuickBooks fields to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'quickbooks_invoice_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN quickbooks_invoice_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'sync_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN sync_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN last_synced_at timestamptz;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE quickbooks_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quickbooks_credentials
CREATE POLICY "Admins can view QuickBooks credentials"
  ON quickbooks_credentials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert QuickBooks credentials"
  ON quickbooks_credentials FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update QuickBooks credentials"
  ON quickbooks_credentials FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete QuickBooks credentials"
  ON quickbooks_credentials FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for quickbooks_sync_log
CREATE POLICY "Admins can view sync logs"
  ON quickbooks_sync_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert sync logs"
  ON quickbooks_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qb_credentials_active ON quickbooks_credentials(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_qb_credentials_expires_at ON quickbooks_credentials(expires_at);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_entity ON quickbooks_sync_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_created_at ON quickbooks_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organizations_qb_customer_id ON organizations(quickbooks_customer_id) WHERE quickbooks_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_qb_invoice_id ON orders(quickbooks_invoice_id) WHERE quickbooks_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quickbooks_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_quickbooks_credentials_updated_at ON quickbooks_credentials;
CREATE TRIGGER trigger_update_quickbooks_credentials_updated_at
  BEFORE UPDATE ON quickbooks_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_quickbooks_credentials_updated_at();
