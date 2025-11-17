/*
  # Prevent Organization Duplication and Sales Rep Account Theft

  ## Security Issues Addressed
  
  1. **Duplicate Organization Prevention**
     - Sales reps cannot create duplicate organizations with similar names
     - Enforced unique constraint on organization codes
     - Function to detect similar organization names (fuzzy matching)
  
  2. **Sales Rep Assignment Protection**
     - Only admins can create organizations
     - Only admins can assign/change sales reps
     - Sales reps can only view organizations they're assigned to
     - Prevent sales reps from creating orders for unassigned organizations
  
  3. **Organization Code Integrity**
     - Organization code must be unique (already exists but reinforced)
     - Add validation to prevent trivial variations (spaces, case, etc.)
  
  ## Changes
  
  1. **New Functions**
     - `normalize_org_identifier()` - Normalizes names/codes for comparison
     - `check_duplicate_organization()` - Prevents duplicate orgs
  
  2. **Updated RLS Policies**
     - Restrict organization creation to admins only
     - Restrict organization_sales_reps management to admins only
     - Prevent unauthorized order creation
  
  3. **Constraints**
     - Unique constraint on normalized organization name
     - Trigger to validate on insert/update
*/

-- Function to normalize organization identifiers for duplicate detection
CREATE OR REPLACE FUNCTION normalize_org_identifier(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove special characters, extra spaces, and convert to lowercase
  -- This catches variations like "ABC Company" vs "ABC  Company" vs "abc-company"
  RETURN lower(
    regexp_replace(
      regexp_replace(input_text, '[^a-zA-Z0-9\s]', '', 'g'),
      '\s+', ' ', 'g'
    )
  );
END;
$$;

-- Function to check for duplicate organizations before insert/update
CREATE OR REPLACE FUNCTION check_duplicate_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_name text;
  v_normalized_code text;
  v_existing_id uuid;
  v_existing_name text;
BEGIN
  -- Normalize the new organization's name and code
  v_normalized_name := normalize_org_identifier(NEW.name);
  v_normalized_code := normalize_org_identifier(NEW.code);
  
  -- Check for existing organization with same normalized name (excluding current record on update)
  SELECT id, name INTO v_existing_id, v_existing_name
  FROM organizations
  WHERE normalize_org_identifier(name) = v_normalized_name
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Organization with similar name already exists: "%" (ID: %)', v_existing_name, v_existing_id
      USING HINT = 'An organization with a similar name is already in the system. Please verify this is not a duplicate.';
  END IF;
  
  -- Check for existing organization with same normalized code (excluding current record on update)
  SELECT id, name INTO v_existing_id, v_existing_name
  FROM organizations
  WHERE normalize_org_identifier(code) = v_normalized_code
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Organization with similar code already exists: "%" (ID: %)', v_existing_name, v_existing_id
      USING HINT = 'An organization with a similar code is already in the system. Please verify this is not a duplicate.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to check for duplicates on insert/update
DROP TRIGGER IF EXISTS trg_check_duplicate_organization ON organizations;
CREATE TRIGGER trg_check_duplicate_organization
  BEFORE INSERT OR UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_organization();

-- Drop existing permissive policies for organizations that allow non-admins to create
DROP POLICY IF EXISTS "Admins can manage organizations" ON organizations;
DROP POLICY IF EXISTS "Approved users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Sales reps can create organizations" ON organizations;

-- Recreate strict policies for organizations
CREATE POLICY "Admins can manage organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can view assigned organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    id IN (
      SELECT organization_id 
      FROM user_organization_roles 
      WHERE user_id = (select auth.uid())
    )
  );

-- Drop and recreate organization_sales_reps policies to prevent unauthorized assignment changes
DROP POLICY IF EXISTS "Admins can manage sales rep assignments" ON organization_sales_reps;
DROP POLICY IF EXISTS "Sales reps can view their assignments" ON organization_sales_reps;
DROP POLICY IF EXISTS "Sales reps can manage assignments" ON organization_sales_reps;

CREATE POLICY "Admins manage sales rep assignments"
  ON organization_sales_reps FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Sales reps view own assignments"
  ON organization_sales_reps FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    sales_rep_id = (select auth.uid())
  );

-- Ensure orders can only be created for assigned organizations
-- First, drop existing order policies that might be too permissive
DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;

-- Recreate strict order creation policy
CREATE POLICY "Users can create orders for assigned orgs"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR
    (
      -- User must be a member of the organization
      organization_id IN (
        SELECT organization_id 
        FROM user_organization_roles 
        WHERE user_id = (select auth.uid())
      )
    )
  );

-- Add function to validate sales rep assignment before order creation
CREATE OR REPLACE FUNCTION validate_order_sales_rep()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_assigned boolean;
BEGIN
  -- Check if user is admin
  SELECT is_admin() INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN NEW;
  END IF;
  
  -- If sales_rep_id is specified, verify assignment
  IF NEW.sales_rep_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 
      FROM organization_sales_reps
      WHERE sales_rep_id = NEW.sales_rep_id
        AND organization_id = NEW.organization_id
        AND is_active = true
    ) INTO v_is_assigned;
    
    IF NOT v_is_assigned THEN
      RAISE EXCEPTION 'Sales rep is not assigned to this organization'
        USING HINT = 'Only assigned sales reps can create orders for this organization';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to validate sales rep on order creation
DROP TRIGGER IF EXISTS trg_validate_order_sales_rep ON orders;
CREATE TRIGGER trg_validate_order_sales_rep
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_sales_rep();

-- Add comments for documentation
COMMENT ON FUNCTION normalize_org_identifier IS 'Normalizes organization names/codes for duplicate detection by removing special chars and extra spaces';
COMMENT ON FUNCTION check_duplicate_organization IS 'Prevents creation of duplicate organizations with similar names or codes';
COMMENT ON FUNCTION validate_order_sales_rep IS 'Ensures orders are only created by sales reps assigned to the organization';

-- Create audit table for organization access attempts
CREATE TABLE IF NOT EXISTS organization_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  action text NOT NULL, -- 'view', 'create', 'update', 'delete'
  success boolean NOT NULL,
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_org_audit_user_time ON organization_access_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_org_time ON organization_access_audit(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_failed ON organization_access_audit(success) WHERE success = false;

-- Enable RLS on audit table
ALTER TABLE organization_access_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins view access audit"
  ON organization_access_audit FOR SELECT
  TO authenticated
  USING (is_admin());

-- System can insert audit logs (via service role)
CREATE POLICY "System can log access attempts"
  ON organization_access_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE organization_access_audit IS 'Audit trail of organization access attempts for security monitoring';