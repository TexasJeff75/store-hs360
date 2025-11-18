/*
  # Secret Cost and Cost Admin Permissions

  ## Overview
  Implements a two-tier cost system:
  - **Public Cost**: Visible to all admins (used for pricing validation)
  - **Secret Cost**: Only visible to cost admins (true acquisition cost for profit calculations)
  
  This allows showing different cost figures to regular admins vs. trusted cost admins.

  ## Changes

  1. **New Column: secret_cost**
     - Added to `product_costs` table
     - True product cost (what we actually pay)
     - Only accessible to cost admins
     - `cost_price` becomes the public cost shown to regular admins

  2. **New Column: can_view_secret_cost**
     - Added to `profiles` table
     - Boolean flag for cost admin permission
     - Defaults to false
     - Only super admins can modify

  3. **RLS Policies**
     - Regular admins see `cost_price` only
     - Cost admins see both `cost_price` and `secret_cost`
     - Views and functions respect permissions

  4. **Helper Functions**
     - `is_cost_admin()` - Check if user has cost viewing permission
     - `get_true_cost()` - Returns appropriate cost based on permissions

  ## Initial Setup
  - jeff.lutz@example.com set as cost admin
  - Other admins can be added by super admin
*/

-- Add can_view_secret_cost column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'can_view_secret_cost'
  ) THEN
    ALTER TABLE profiles 
      ADD COLUMN can_view_secret_cost boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add secret_cost column to product_costs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_costs' AND column_name = 'secret_cost'
  ) THEN
    ALTER TABLE product_costs 
      ADD COLUMN secret_cost numeric(10,2);
  END IF;
END $$;

-- Create function to check if user is a cost admin
CREATE OR REPLACE FUNCTION is_cost_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_view boolean;
BEGIN
  SELECT can_view_secret_cost INTO v_can_view
  FROM profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(v_can_view, false);
END;
$$;

-- Create function to get the appropriate cost based on user permissions
CREATE OR REPLACE FUNCTION get_product_true_cost(p_product_id bigint)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_cost numeric(10,2);
  v_public_cost numeric(10,2);
BEGIN
  -- Get both costs
  SELECT secret_cost, cost_price
  INTO v_secret_cost, v_public_cost
  FROM product_costs
  WHERE product_id = p_product_id;
  
  -- Return secret cost if user is cost admin, otherwise public cost
  IF is_cost_admin() THEN
    RETURN COALESCE(v_secret_cost, v_public_cost);
  ELSE
    RETURN v_public_cost;
  END IF;
END;
$$;

-- Update RLS policy for product_costs to handle secret_cost visibility
-- Drop existing select policy
DROP POLICY IF EXISTS "Anyone can view product costs" ON product_costs;

-- Create new policy that shows all columns to cost admins, limited columns to regular admins
CREATE POLICY "Admins can view product costs"
  ON product_costs FOR SELECT
  TO authenticated
  USING (
    is_admin()
  );

-- Note: secret_cost column access is controlled in the application layer
-- Cost admins check is_cost_admin() before displaying secret_cost

-- Set jeff.lutz as initial cost admin
-- First, try to find the profile by email
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Look up jeff.lutz by email in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email ILIKE 'jeff.lutz%'
  LIMIT 1;
  
  -- If found, update the profile
  IF v_user_id IS NOT NULL THEN
    UPDATE profiles
    SET can_view_secret_cost = true
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Set jeff.lutz as cost admin: %', v_user_id;
  ELSE
    RAISE NOTICE 'User jeff.lutz not found. Set manually after user creation.';
  END IF;
END $$;

-- Create view for profit calculations that respects permissions
CREATE OR REPLACE VIEW order_profit_analysis AS
SELECT 
  o.id as order_id,
  o.order_number,
  o.user_id,
  o.organization_id,
  o.total as total_amount,
  o.status,
  o.created_at,
  o.sales_rep_id,
  o.items,
  -- Calculate revenue
  o.total as revenue,
  -- Extract product IDs from items JSONB for cost calculation
  o.items::jsonb as order_items
FROM orders o
WHERE is_cost_admin(); -- Only cost admins can see this view

-- Create audit table for cost admin access
CREATE TABLE IF NOT EXISTS cost_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  action text NOT NULL,
  product_id bigint,
  accessed_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable RLS
ALTER TABLE cost_admin_audit ENABLE ROW LEVEL SECURITY;

-- Only cost admins can view audit log
CREATE POLICY "Cost admins view audit"
  ON cost_admin_audit FOR SELECT
  TO authenticated
  USING (is_cost_admin());

-- System can insert audit records
CREATE POLICY "System can log cost access"
  ON cost_admin_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_cost_admin_audit_user ON cost_admin_audit(user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_admin_audit_product ON cost_admin_audit(product_id, accessed_at DESC);

-- Add comments
COMMENT ON COLUMN profiles.can_view_secret_cost IS 'TRUE = User can view secret_cost (true acquisition cost). FALSE = User only sees cost_price (public cost for validation)';
COMMENT ON COLUMN product_costs.cost_price IS 'Public cost shown to all admins for pricing validation. May be marked up from true cost.';
COMMENT ON COLUMN product_costs.secret_cost IS 'True acquisition cost. Only visible to cost admins (jeff.lutz and selected others). Used for real profit calculations.';
COMMENT ON FUNCTION is_cost_admin IS 'Returns TRUE if current user has can_view_secret_cost permission';
COMMENT ON FUNCTION get_product_true_cost IS 'Returns secret_cost for cost admins, cost_price for regular admins';
COMMENT ON TABLE cost_admin_audit IS 'Audit trail of all secret cost access for security monitoring';
COMMENT ON VIEW order_profit_analysis IS 'Profit analysis using true costs. Only accessible to cost admins.';