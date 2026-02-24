/*
  # Fix Security Definer Views and Functions

  ## Summary
  Addresses security issues with SECURITY DEFINER views and functions
  that can bypass Row Level Security (RLS) policies.

  ## Changes
  1. Drop problematic SECURITY DEFINER views
  2. Fix is_cost_admin to remove SECURITY DEFINER
  3. Add secure alternative functions with explicit auth checks
  4. Update existing SECURITY DEFINER functions with auth validation

  ## Security Improvements
  - Queries now respect RLS policies
  - No privilege escalation through views
  - Functions have explicit authorization checks
  - Defensive search_path settings
*/

-- Drop problematic views
DROP VIEW IF EXISTS public.order_profit_analysis CASCADE;
DROP VIEW IF EXISTS public.product_vendor_details CASCADE;

-- Fix is_cost_admin function (remove SECURITY DEFINER)
DROP FUNCTION IF EXISTS public.is_cost_admin();

CREATE OR REPLACE FUNCTION public.is_cost_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND can_view_secret_cost = true
    LIMIT 1
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_cost_admin() TO authenticated;

-- Create secure profit analysis function
CREATE OR REPLACE FUNCTION public.get_order_profit_analysis(
  p_order_id uuid DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  order_id uuid,
  organization_id uuid,
  order_total numeric,
  total_cost numeric,
  profit_margin numeric,
  profit_percentage numeric,
  order_date timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only admins with cost viewing permission can access
  IF NOT (
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND can_view_secret_cost = true
      LIMIT 1
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: Only cost admins can view profit analysis';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.organization_id,
    o.total_amount,
    COALESCE(
      (
        SELECT SUM(psc.secret_cost * oi.quantity)
        FROM jsonb_to_recordset(o.line_items) AS oi(product_id int, quantity int)
        LEFT JOIN public.product_secret_costs psc ON psc.product_id = oi.product_id
      ),
      0
    ),
    o.total_amount - COALESCE(
      (
        SELECT SUM(psc.secret_cost * oi.quantity)
        FROM jsonb_to_recordset(o.line_items) AS oi(product_id int, quantity int)
        LEFT JOIN public.product_secret_costs psc ON psc.product_id = oi.product_id
      ),
      0
    ),
    CASE
      WHEN o.total_amount > 0 THEN
        ((o.total_amount - COALESCE(
          (
            SELECT SUM(psc.secret_cost * oi.quantity)
            FROM jsonb_to_recordset(o.line_items) AS oi(product_id int, quantity int)
            LEFT JOIN public.product_secret_costs psc ON psc.product_id = oi.product_id
          ),
          0
        )) / o.total_amount) * 100
      ELSE 0
    END,
    o.created_at
  FROM public.orders o
  WHERE
    (p_order_id IS NULL OR o.id = p_order_id)
    AND (p_organization_id IS NULL OR o.organization_id = p_organization_id)
    AND (p_date_from IS NULL OR o.created_at >= p_date_from)
    AND (p_date_to IS NULL OR o.created_at <= p_date_to)
    AND o.status = 'completed'
  ORDER BY o.created_at DESC
  LIMIT 1000;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_order_profit_analysis(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_profit_analysis(uuid, uuid, timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_order_profit_analysis IS 'Secure profit analysis for cost admins only. Has explicit auth checks and query limits.';

-- Create secure vendor details function
CREATE OR REPLACE FUNCTION public.get_product_vendor_details(
  p_product_id integer
)
RETURNS TABLE (
  product_id integer,
  vendor_name text,
  cost_per_unit numeric,
  is_preferred boolean,
  lead_time_days integer,
  minimum_order_quantity integer,
  last_price_update timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only admins can view vendor details
  IF NOT (
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
      LIMIT 1
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: Only admins can view vendor details';
  END IF;

  RETURN QUERY
  SELECT
    pv.product_id,
    pv.vendor_name,
    pv.cost_per_unit,
    pv.is_preferred,
    pv.lead_time_days,
    pv.minimum_order_quantity,
    pv.last_price_update
  FROM public.product_vendors pv
  WHERE pv.product_id = p_product_id
    AND pv.active = true
  ORDER BY pv.is_preferred DESC, pv.last_price_update DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_product_vendor_details(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_vendor_details(integer) TO authenticated;

COMMENT ON FUNCTION public.get_product_vendor_details IS 'Secure vendor details for admins only. Validates access before returning data.';

-- Update get_preferred_vendor_cost with auth check
CREATE OR REPLACE FUNCTION public.get_preferred_vendor_cost(p_product_id integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cost numeric;
BEGIN
  -- Only admins and sales reps can get vendor costs
  IF NOT (
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'sales_rep')
      LIMIT 1
    )
  ) THEN
    RETURN NULL;
  END IF;

  SELECT cost_per_unit INTO v_cost
  FROM public.product_vendors
  WHERE product_id = p_product_id
    AND is_preferred = true
    AND active = true
  ORDER BY last_price_update DESC
  LIMIT 1;

  RETURN v_cost;
END;
$$;

-- Update set_preferred_vendor with auth check
CREATE OR REPLACE FUNCTION public.set_preferred_vendor(
  p_vendor_id uuid,
  p_product_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only admins can set preferred vendors
  IF NOT (
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
      LIMIT 1
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: Only admins can set preferred vendors';
  END IF;

  -- Unset current preferred vendor
  UPDATE public.product_vendors
  SET is_preferred = false
  WHERE product_id = p_product_id
    AND is_preferred = true;

  -- Set new preferred vendor
  UPDATE public.product_vendors
  SET is_preferred = true
  WHERE id = p_vendor_id
    AND product_id = p_product_id;
END;
$$;
