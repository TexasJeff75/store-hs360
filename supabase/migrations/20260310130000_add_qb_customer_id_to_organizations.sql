/*
  Add QuickBooks Customer ID to organizations for payment vaulting.

  QB's card-on-file API requires a QB Customer ID to store reusable
  payment tokens. This column links organizations to their QB customer.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'qb_customer_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN qb_customer_id text;
    CREATE INDEX idx_organizations_qb_customer_id ON organizations(qb_customer_id) WHERE qb_customer_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN organizations.qb_customer_id IS
  'QuickBooks Customer ID used for vaulting payment methods (card-on-file, bank-on-file).';
