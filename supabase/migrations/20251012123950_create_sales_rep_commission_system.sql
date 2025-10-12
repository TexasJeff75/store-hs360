/*
  # Sales Rep Commission System

  1. New Tables
    - `organization_sales_reps`
      - Links sales reps to organizations they manage
      - Tracks commission rate per organization
      - Supports multiple sales reps per organization
    
    - `commissions`
      - Tracks commission earned on each order
      - Records commission amount, status, and payment details
      - Links to orders, sales reps, and organizations

  2. Changes to Existing Tables
    - `orders` table
      - Add `sales_rep_id` column to track which sales rep handled the order
      - Add `commission_id` column to link to commission record

  3. Security
    - Enable RLS on all new tables
    - Sales reps can view their own commissions
    - Admins can view and manage all commissions
    - Restrict commission modifications to admins only

  4. Commission Rules
    - Commission calculated as percentage of order total
    - Default commission rate is configurable per organization
    - Commission status: pending, approved, paid, cancelled
    - Commissions only apply to completed orders
*/

-- Create organization_sales_reps table
CREATE TABLE IF NOT EXISTS organization_sales_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sales_rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commission_rate numeric(5,2) NOT NULL DEFAULT 5.00,
  is_active boolean DEFAULT true,
  assigned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, sales_rep_id)
);

CREATE INDEX IF NOT EXISTS idx_org_sales_reps_organization ON organization_sales_reps(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_sales_reps_sales_rep ON organization_sales_reps(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_org_sales_reps_active ON organization_sales_reps(is_active) WHERE is_active = true;

-- Create commissions table
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sales_rep_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  order_total numeric(10,2) NOT NULL,
  commission_rate numeric(5,2) NOT NULL,
  commission_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  CONSTRAINT valid_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 100),
  CONSTRAINT valid_commission_amount CHECK (commission_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_commissions_order ON commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_sales_rep ON commissions(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_commissions_organization ON commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created ON commissions(created_at DESC);

-- Add sales_rep_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'sales_rep_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN sales_rep_id uuid REFERENCES profiles(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_sales_rep ON orders(sales_rep_id);

-- Add commission_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'commission_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN commission_id uuid REFERENCES commissions(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_commission ON orders(commission_id);

-- Enable RLS on organization_sales_reps
ALTER TABLE organization_sales_reps ENABLE ROW LEVEL SECURITY;

-- Sales reps can view organizations they're assigned to
CREATE POLICY "Sales reps can view their assignments"
  ON organization_sales_reps FOR SELECT
  TO authenticated
  USING (
    sales_rep_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales_manager')
    )
  );

-- Only admins can manage sales rep assignments
CREATE POLICY "Admins can manage sales rep assignments"
  ON organization_sales_reps FOR ALL
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

-- Enable RLS on commissions
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Sales reps can view their own commissions
CREATE POLICY "Sales reps can view their commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    sales_rep_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'sales_manager')
    )
  );

-- Only admins can create commissions
CREATE POLICY "Admins can create commissions"
  ON commissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update commissions
CREATE POLICY "Admins can update commissions"
  ON commissions FOR UPDATE
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

-- Function to automatically calculate commission when order is completed
CREATE OR REPLACE FUNCTION calculate_commission_for_order()
RETURNS TRIGGER AS $$
DECLARE
  v_sales_rep_id uuid;
  v_commission_rate numeric(5,2);
  v_commission_amount numeric(10,2);
  v_commission_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NEW.organization_id IS NOT NULL AND NEW.sales_rep_id IS NOT NULL THEN
      SELECT commission_rate INTO v_commission_rate
      FROM organization_sales_reps
      WHERE organization_id = NEW.organization_id
        AND sales_rep_id = NEW.sales_rep_id
        AND is_active = true;

      IF v_commission_rate IS NOT NULL THEN
        v_commission_amount := NEW.total * (v_commission_rate / 100);

        INSERT INTO commissions (
          order_id,
          sales_rep_id,
          organization_id,
          order_total,
          commission_rate,
          commission_amount,
          status
        ) VALUES (
          NEW.id,
          NEW.sales_rep_id,
          NEW.organization_id,
          NEW.total,
          v_commission_rate,
          v_commission_amount,
          'pending'
        ) RETURNING id INTO v_commission_id;

        NEW.commission_id := v_commission_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic commission calculation
DROP TRIGGER IF EXISTS trigger_calculate_commission ON orders;
CREATE TRIGGER trigger_calculate_commission
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_for_order();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_commission_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_commission_timestamp ON commissions;
CREATE TRIGGER trigger_update_commission_timestamp
  BEFORE UPDATE ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_timestamp();

DROP TRIGGER IF EXISTS trigger_update_org_sales_rep_timestamp ON organization_sales_reps;
CREATE TRIGGER trigger_update_org_sales_rep_timestamp
  BEFORE UPDATE ON organization_sales_reps
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_timestamp();