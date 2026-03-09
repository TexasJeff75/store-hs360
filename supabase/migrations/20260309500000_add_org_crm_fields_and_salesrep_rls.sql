-- Add CRM fields to organizations table
-- Matches the pattern used on distributors (contact_name, address, city, state, zip)

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS zip TEXT;

-- Allow sales reps to create organizations (needed for "Add Customer" feature)
CREATE POLICY "sales_reps_can_insert_organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales_rep'
    )
  );

-- Allow sales reps to update organizations they are assigned to
CREATE POLICY "sales_reps_can_update_assigned_organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_sales_reps osr
      JOIN profiles p ON p.id = auth.uid()
      WHERE osr.organization_id = organizations.id
        AND osr.sales_rep_id = auth.uid()
        AND osr.is_active = true
        AND p.role = 'sales_rep'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_sales_reps osr
      JOIN profiles p ON p.id = auth.uid()
      WHERE osr.organization_id = organizations.id
        AND osr.sales_rep_id = auth.uid()
        AND osr.is_active = true
        AND p.role = 'sales_rep'
    )
  );

-- Allow sales reps to insert into organization_sales_reps (to link their newly created orgs)
CREATE POLICY "sales_reps_can_link_own_organizations"
  ON organization_sales_reps FOR INSERT
  TO authenticated
  WITH CHECK (
    sales_rep_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales_rep'
    )
  );
