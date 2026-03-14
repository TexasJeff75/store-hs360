/*
  # QuickBooks Online Integration

  1. New Tables
    - `quickbooks_credentials`
      - `id` (uuid, primary key)
      - `access_token` (text) - OAuth access token
      - `refresh_token` (text) - OAuth refresh token
      - `realm_id` (text) - QuickBooks company ID
      - `token_type` (text, default 'bearer')
      - `expires_at` (timestamptz) - Access token expiration
      - `refresh_token_expires_at` (timestamptz) - Refresh token expiration
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, FK to profiles)
      - `is_active` (boolean) - Only one active connection allowed

    - `quickbooks_sync_log`
      - `id` (uuid, primary key)
      - `entity_type` (text) - Type of entity synced (customer, invoice, etc.)
      - `entity_id` (text) - Local entity ID
      - `sync_type` (text) - Operation type (create, update, delete, read)
      - `status` (text) - Sync status (pending, success, failed, retry)
      - `quickbooks_id` (text) - QuickBooks entity ID
      - `error_message` (text) - Error details if failed
      - `request_data` (jsonb) - Request payload sent to QB
      - `response_data` (jsonb) - Response from QB
      - `synced_at` (timestamptz) - Timestamp of successful sync
      - `created_at` (timestamptz)
      - `created_by` (uuid, FK to profiles)

  2. Table Modifications
    - `organizations` - Add quickbooks_customer_id and last_synced_at columns
    - `locations` - Add quickbooks_customer_id and last_synced_at columns
    - `orders` - Add quickbooks_invoice_id, sync_status, and last_synced_at columns

  3. Security
    - RLS enabled on both new tables
    - Admin-only access to credentials (SELECT, INSERT, UPDATE, DELETE)
    - Admin-only access to sync logs (SELECT, INSERT)

  4. Performance
    - Unique partial index enforcing single active QB connection
    - Indexes on frequently queried columns
*/

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
  created_by uuid REFERENCES profiles(id),
  is_active boolean DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_qb_connection
  ON quickbooks_credentials(is_active)
  WHERE is_active = true;

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
  created_by uuid REFERENCES profiles(id)
);

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'quickbooks_customer_id'
  ) THEN
    ALTER TABLE locations ADD COLUMN quickbooks_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE locations ADD COLUMN last_synced_at timestamptz;
  END IF;
END $$;

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

ALTER TABLE quickbooks_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view QuickBooks credentials'
  ) THEN
    CREATE POLICY "Admins can view QuickBooks credentials"
      ON quickbooks_credentials FOR SELECT
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert QuickBooks credentials'
  ) THEN
    CREATE POLICY "Admins can insert QuickBooks credentials"
      ON quickbooks_credentials FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update QuickBooks credentials'
  ) THEN
    CREATE POLICY "Admins can update QuickBooks credentials"
      ON quickbooks_credentials FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete QuickBooks credentials'
  ) THEN
    CREATE POLICY "Admins can delete QuickBooks credentials"
      ON quickbooks_credentials FOR DELETE
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view sync logs'
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert sync logs'
  ) THEN
    CREATE POLICY "Admins can insert sync logs"
      ON quickbooks_sync_log FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qb_credentials_active ON quickbooks_credentials(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_qb_credentials_expires_at ON quickbooks_credentials(expires_at);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_entity ON quickbooks_sync_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_created_at ON quickbooks_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qb_sync_log_sync_type ON quickbooks_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_organizations_qb_customer_id ON organizations(quickbooks_customer_id) WHERE quickbooks_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_qb_customer_id ON locations(quickbooks_customer_id) WHERE quickbooks_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_qb_invoice_id ON orders(quickbooks_invoice_id) WHERE quickbooks_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);

CREATE OR REPLACE FUNCTION update_quickbooks_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_quickbooks_credentials_updated_at ON quickbooks_credentials;
CREATE TRIGGER trigger_update_quickbooks_credentials_updated_at
  BEFORE UPDATE ON quickbooks_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_quickbooks_credentials_updated_at();
