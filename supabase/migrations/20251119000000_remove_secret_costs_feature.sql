/*
  # Remove Secret Costs Feature

  1. Tables Removed
    - `product_costs` - Secret cost tracking table
    - `cost_admin_audit` - Cost admin access audit log
    - `below_cost_pricing_audit` - Below cost pricing audit log

  2. Functions Removed
    - `is_cost_admin()` - Check if user has cost admin permissions
    - `grant_cost_admin()` - Grant cost admin permissions
    - `revoke_cost_admin()` - Revoke cost admin permissions

  3. Column Removed
    - `profiles.is_cost_admin` - Cost admin flag

  4. Indexes Removed
    - All indexes related to secret cost tables
*/

-- Drop policies first
DROP POLICY IF EXISTS "Cost admins can view all product costs" ON public.product_costs;
DROP POLICY IF EXISTS "Cost admins can insert product costs" ON public.product_costs;
DROP POLICY IF EXISTS "Cost admins can update product costs" ON public.product_costs;
DROP POLICY IF EXISTS "Cost admins can delete product costs" ON public.product_costs;
DROP POLICY IF EXISTS "Cost admins can view audit log" ON public.cost_admin_audit;
DROP POLICY IF EXISTS "System can log cost access" ON public.cost_admin_audit;
DROP POLICY IF EXISTS "Admins can view pricing audit" ON public.below_cost_pricing_audit;

-- Drop functions
DROP FUNCTION IF EXISTS is_cost_admin();
DROP FUNCTION IF EXISTS grant_cost_admin(uuid);
DROP FUNCTION IF EXISTS revoke_cost_admin(uuid);

-- Drop indexes
DROP INDEX IF EXISTS idx_below_cost_pricing_audit_pricing_id;
DROP INDEX IF EXISTS idx_product_costs_synced;
DROP INDEX IF EXISTS idx_below_cost_audit_product;
DROP INDEX IF EXISTS idx_below_cost_audit_approver;
DROP INDEX IF EXISTS idx_cost_admin_audit_user;
DROP INDEX IF EXISTS idx_cost_admin_audit_product;

-- Drop tables
DROP TABLE IF EXISTS public.below_cost_pricing_audit;
DROP TABLE IF EXISTS public.cost_admin_audit;
DROP TABLE IF EXISTS public.product_costs;

-- Remove cost admin column from profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_cost_admin'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN is_cost_admin;
  END IF;
END $$;
