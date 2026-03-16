-- ============================================================================
-- Soft-Delete & Orphan Tracking
-- Adds deleted_at/deleted_by to parent entities and is_orphaned/orphaned_reason
-- to child entities. Creates a trigger to cascade orphan marking.
-- ============================================================================

-- 1. Add soft-delete columns to parent entities
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

-- 2. Add orphan indicator columns to child entities
-- ============================================================================

ALTER TABLE organization_sales_reps
  ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphaned_reason text;

ALTER TABLE distributor_sales_reps
  ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphaned_reason text;

ALTER TABLE distributor_commission_rules
  ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphaned_reason text;

ALTER TABLE distributor_product_pricing
  ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphaned_reason text;

ALTER TABLE commission_line_items
  ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphaned_reason text;

ALTER TABLE contract_pricing
  ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphaned_reason text;

ALTER TABLE organization_pricing
  ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphaned_reason text;

ALTER TABLE location_pricing
  ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphaned_reason text;

-- 3. Partial indexes for query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_not_deleted ON orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_not_deleted ON profiles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_distributors_not_deleted ON distributors(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_not_deleted ON commissions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_not_deleted ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- 4. Soft-delete cascade trigger
-- ============================================================================
-- When a parent entity's deleted_at transitions from NULL to non-NULL,
-- mark child records as orphaned and cascade soft-delete to dependent parents.

CREATE OR REPLACE FUNCTION handle_soft_delete_cascade()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when deleted_at transitions from NULL to non-NULL
  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    -- Orphan sales rep assignments
    UPDATE organization_sales_reps
      SET is_orphaned = true, orphaned_reason = 'sales_rep_deleted'
      WHERE sales_rep_id = NEW.id AND NOT is_orphaned;
    UPDATE distributor_sales_reps
      SET is_orphaned = true, orphaned_reason = 'sales_rep_deleted'
      WHERE sales_rep_id = NEW.id AND NOT is_orphaned;
    -- Orphan contract pricing
    UPDATE contract_pricing
      SET is_orphaned = true, orphaned_reason = 'user_deleted'
      WHERE user_id = NEW.id AND NOT is_orphaned;
    -- Cascade soft-delete to orders
    UPDATE orders
      SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
      WHERE user_id = NEW.id AND deleted_at IS NULL;
    -- Cascade soft-delete to commissions where this user is the sales rep
    UPDATE commissions
      SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
      WHERE sales_rep_id = NEW.id AND deleted_at IS NULL;

  ELSIF TG_TABLE_NAME = 'distributors' THEN
    UPDATE distributor_sales_reps
      SET is_orphaned = true, orphaned_reason = 'distributor_deleted'
      WHERE distributor_id = NEW.id AND NOT is_orphaned;
    UPDATE distributor_commission_rules
      SET is_orphaned = true, orphaned_reason = 'distributor_deleted'
      WHERE distributor_id = NEW.id AND NOT is_orphaned;
    UPDATE distributor_product_pricing
      SET is_orphaned = true, orphaned_reason = 'distributor_deleted'
      WHERE distributor_id = NEW.id AND NOT is_orphaned;

  ELSIF TG_TABLE_NAME = 'orders' THEN
    -- Cascade soft-delete to commissions
    UPDATE commissions
      SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
      WHERE order_id = NEW.id AND deleted_at IS NULL;
    -- Orphan commission line items
    UPDATE commission_line_items
      SET is_orphaned = true, orphaned_reason = 'order_deleted'
      WHERE order_id = NEW.id AND NOT is_orphaned;

  ELSIF TG_TABLE_NAME = 'organizations' THEN
    UPDATE organization_pricing
      SET is_orphaned = true, orphaned_reason = 'organization_deleted'
      WHERE organization_id = NEW.id AND NOT is_orphaned;
    UPDATE organization_sales_reps
      SET is_orphaned = true, orphaned_reason = 'organization_deleted'
      WHERE organization_id = NEW.id AND NOT is_orphaned;

  ELSIF TG_TABLE_NAME = 'commissions' THEN
    UPDATE commission_line_items
      SET is_orphaned = true, orphaned_reason = 'commission_deleted'
      WHERE commission_id = NEW.id AND NOT is_orphaned;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to parent tables
DROP TRIGGER IF EXISTS trg_soft_delete_profiles ON profiles;
CREATE TRIGGER trg_soft_delete_profiles
  AFTER UPDATE OF deleted_at ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_soft_delete_cascade();

DROP TRIGGER IF EXISTS trg_soft_delete_distributors ON distributors;
CREATE TRIGGER trg_soft_delete_distributors
  AFTER UPDATE OF deleted_at ON distributors
  FOR EACH ROW EXECUTE FUNCTION handle_soft_delete_cascade();

DROP TRIGGER IF EXISTS trg_soft_delete_orders ON orders;
CREATE TRIGGER trg_soft_delete_orders
  AFTER UPDATE OF deleted_at ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_soft_delete_cascade();

DROP TRIGGER IF EXISTS trg_soft_delete_organizations ON organizations;
CREATE TRIGGER trg_soft_delete_organizations
  AFTER UPDATE OF deleted_at ON organizations
  FOR EACH ROW EXECUTE FUNCTION handle_soft_delete_cascade();

DROP TRIGGER IF EXISTS trg_soft_delete_commissions ON commissions;
CREATE TRIGGER trg_soft_delete_commissions
  AFTER UPDATE OF deleted_at ON commissions
  FOR EACH ROW EXECUTE FUNCTION handle_soft_delete_cascade();
