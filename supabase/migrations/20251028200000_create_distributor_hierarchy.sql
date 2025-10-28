/*
  # Distributor Hierarchy Commission System

  ## Overview
  Creates a hierarchical commission structure where distributors can have multiple sales reps,
  with flexible commission splits between distributor and sales rep levels.

  ## New Tables

  ### `distributors`
  Represents distributor entities that manage multiple sales reps
  - `id` - Unique identifier
  - `profile_id` - Links to profiles table (the distributor user)
  - `name` - Distributor business name
  - `code` - Unique distributor code
  - `commission_rate` - Default commission rate for this distributor
  - `is_active` - Whether distributor is active

  ### `distributor_sales_reps`
  Links sales reps to their parent distributor with commission split rules
  - `id` - Unique identifier
  - `distributor_id` - Parent distributor
  - `sales_rep_id` - Sales rep profile
  - `commission_split_type` - How commission is split ('percentage_of_distributor' or 'fixed_with_override')
  - `sales_rep_rate` - Sales rep's commission rate/percentage
  - `distributor_override_rate` - Distributor's override rate (for fixed_with_override type)

  ### Updates to `organization_sales_reps`
  - Add `distributor_id` column to associate organizations with distributors
  - This allows tracking which distributor/sales rep combo manages each organization

  ## Commission Split Examples

  ### Example 1: Percentage Split
  - Distributor base rate: 45%
  - Sales rep gets: 50% of the distributor's commission
  - On $100 margin: Distributor gets $45 commission
    - Sales rep receives: $22.50 (50% of $45)
    - Distributor keeps: $22.50 (remaining 50%)

  ### Example 2: Fixed with Override
  - Sales rep rate: 40%
  - Distributor override: 5%
  - On $100 margin:
    - Sales rep receives: $40
    - Distributor receives: $5
    - Total commission: $45

  ## Security
  - Enable RLS on all new tables
  - Distributors can view their own data and their sales reps
  - Sales reps can view their distributor relationship
  - Admins have full access
*/

-- Create distributors table
CREATE TABLE IF NOT EXISTS distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  commission_rate numeric(5,2) NOT NULL DEFAULT 45.00,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 100)
);

CREATE INDEX IF NOT EXISTS idx_distributors_profile ON distributors(profile_id);
CREATE INDEX IF NOT EXISTS idx_distributors_code ON distributors(code);
CREATE INDEX IF NOT EXISTS idx_distributors_active ON distributors(is_active) WHERE is_active = true;

-- Create distributor_sales_reps table
CREATE TABLE IF NOT EXISTS distributor_sales_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  sales_rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commission_split_type text NOT NULL DEFAULT 'percentage_of_distributor',
  sales_rep_rate numeric(5,2) NOT NULL DEFAULT 50.00,
  distributor_override_rate numeric(5,2),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(distributor_id, sales_rep_id),
  CONSTRAINT valid_split_type CHECK (commission_split_type IN ('percentage_of_distributor', 'fixed_with_override')),
  CONSTRAINT valid_sales_rep_rate CHECK (sales_rep_rate >= 0 AND sales_rep_rate <= 100),
  CONSTRAINT valid_override_rate CHECK (distributor_override_rate IS NULL OR (distributor_override_rate >= 0 AND distributor_override_rate <= 100))
);

CREATE INDEX IF NOT EXISTS idx_dist_sales_reps_distributor ON distributor_sales_reps(distributor_id);
CREATE INDEX IF NOT EXISTS idx_dist_sales_reps_sales_rep ON distributor_sales_reps(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_dist_sales_reps_active ON distributor_sales_reps(is_active) WHERE is_active = true;

-- Add distributor_id to organization_sales_reps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_sales_reps' AND column_name = 'distributor_id'
  ) THEN
    ALTER TABLE organization_sales_reps ADD COLUMN distributor_id uuid REFERENCES distributors(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_org_sales_reps_distributor ON organization_sales_reps(distributor_id);
  END IF;
END $$;

-- Add distributor_id to commissions table for tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commissions' AND column_name = 'distributor_id'
  ) THEN
    ALTER TABLE commissions ADD COLUMN distributor_id uuid REFERENCES distributors(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_commissions_distributor ON commissions(distributor_id);
  END IF;
END $$;

-- Add commission split details to commissions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commissions' AND column_name = 'sales_rep_commission'
  ) THEN
    ALTER TABLE commissions ADD COLUMN sales_rep_commission numeric(10,2);
    ALTER TABLE commissions ADD COLUMN distributor_commission numeric(10,2);
    ALTER TABLE commissions ADD COLUMN commission_split_type text;
  END IF;
END $$;

-- Enable RLS on distributors table
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;

-- Distributors: Admins can do everything
CREATE POLICY "Admins have full access to distributors"
  ON distributors
  FOR ALL
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

-- Distributors: Users can view their own distributor record
CREATE POLICY "Users can view own distributor record"
  ON distributors
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- Enable RLS on distributor_sales_reps table
ALTER TABLE distributor_sales_reps ENABLE ROW LEVEL SECURITY;

-- Distributor Sales Reps: Admins can do everything
CREATE POLICY "Admins have full access to distributor sales reps"
  ON distributor_sales_reps
  FOR ALL
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

-- Distributor Sales Reps: Distributors can view their sales reps
CREATE POLICY "Distributors can view their sales reps"
  ON distributor_sales_reps
  FOR SELECT
  TO authenticated
  USING (
    distributor_id IN (
      SELECT id FROM distributors
      WHERE profile_id = auth.uid()
    )
  );

-- Distributor Sales Reps: Sales reps can view their distributor relationship
CREATE POLICY "Sales reps can view their distributor"
  ON distributor_sales_reps
  FOR SELECT
  TO authenticated
  USING (sales_rep_id = auth.uid());

-- Create function to get effective commission rates for an organization
CREATE OR REPLACE FUNCTION get_organization_commission_structure(org_id uuid, sales_rep_user_id uuid)
RETURNS TABLE (
  sales_rep_id uuid,
  distributor_id uuid,
  base_commission_rate numeric,
  sales_rep_commission_rate numeric,
  distributor_commission_rate numeric,
  split_type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    osr.sales_rep_id,
    osr.distributor_id,
    osr.commission_rate as base_commission_rate,
    CASE
      -- If no distributor, sales rep gets full commission
      WHEN osr.distributor_id IS NULL THEN osr.commission_rate
      -- If percentage_of_distributor split
      WHEN dsr.commission_split_type = 'percentage_of_distributor' THEN
        (d.commission_rate * dsr.sales_rep_rate / 100)
      -- If fixed_with_override split
      WHEN dsr.commission_split_type = 'fixed_with_override' THEN
        dsr.sales_rep_rate
      ELSE osr.commission_rate
    END as sales_rep_commission_rate,
    CASE
      -- If no distributor, no distributor commission
      WHEN osr.distributor_id IS NULL THEN 0::numeric
      -- If percentage_of_distributor split
      WHEN dsr.commission_split_type = 'percentage_of_distributor' THEN
        (d.commission_rate * (100 - dsr.sales_rep_rate) / 100)
      -- If fixed_with_override split
      WHEN dsr.commission_split_type = 'fixed_with_override' THEN
        COALESCE(dsr.distributor_override_rate, 0::numeric)
      ELSE 0::numeric
    END as distributor_commission_rate,
    COALESCE(dsr.commission_split_type, 'none') as split_type
  FROM organization_sales_reps osr
  LEFT JOIN distributors d ON d.id = osr.distributor_id
  LEFT JOIN distributor_sales_reps dsr ON dsr.distributor_id = osr.distributor_id
    AND dsr.sales_rep_id = osr.sales_rep_id
  WHERE osr.organization_id = org_id
    AND osr.sales_rep_id = sales_rep_user_id
    AND osr.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the commission structure
COMMENT ON TABLE distributors IS 'Distributor entities that manage sales representatives with hierarchical commission splits';
COMMENT ON TABLE distributor_sales_reps IS 'Links sales reps to distributors with configurable commission split rules';
COMMENT ON COLUMN distributor_sales_reps.commission_split_type IS 'percentage_of_distributor: sales rep gets % of distributor commission | fixed_with_override: sales rep gets fixed rate, distributor gets override';
COMMENT ON COLUMN distributor_sales_reps.sales_rep_rate IS 'For percentage_of_distributor: percentage of distributor commission (0-100) | For fixed_with_override: fixed commission rate';
COMMENT ON COLUMN distributor_sales_reps.distributor_override_rate IS 'Only used for fixed_with_override: additional commission rate for distributor';
