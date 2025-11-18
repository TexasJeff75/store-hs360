/*
  # Fix Performance and Security Issues

  1. Add Indexes for Foreign Keys
    - Add indexes on all unindexed foreign key columns
    - Improves join performance and query optimization

  2. Fix RLS Performance Issues
    - Optimize auth function calls in RLS policies
    - Use subquery pattern for better performance

  3. Remove Unused Indexes
    - Drop indexes that are not being used
    - Reduces storage and maintenance overhead
*/

-- Add indexes for unindexed foreign keys
CREATE INDEX IF NOT EXISTS idx_below_cost_pricing_audit_pricing_id ON public.below_cost_pricing_audit(pricing_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_organization_id ON public.checkout_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user_id ON public.checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_approved_by ON public.commissions(approved_by);
CREATE INDEX IF NOT EXISTS idx_commissions_distributor_id ON public.commissions(distributor_id);
CREATE INDEX IF NOT EXISTS idx_commissions_organization_id ON public.commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_commissions_sales_rep_id ON public.commissions(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_contract_pricing_created_by ON public.contract_pricing(created_by);
CREATE INDEX IF NOT EXISTS idx_distributor_sales_reps_sales_rep_id ON public.distributor_sales_reps(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_distributors_profile_id ON public.distributors(profile_id);
CREATE INDEX IF NOT EXISTS idx_distributors_user_id ON public.distributors(user_id);
CREATE INDEX IF NOT EXISTS idx_location_pricing_created_by ON public.location_pricing(created_by);
CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON public.login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_commission_id ON public.orders(commission_id);
CREATE INDEX IF NOT EXISTS idx_orders_location_id ON public.orders(location_id);
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON public.orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_pricing_created_by ON public.organization_pricing(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_sales_reps_distributor_id ON public.organization_sales_reps(distributor_id);
CREATE INDEX IF NOT EXISTS idx_organizations_default_sales_rep_id ON public.organizations(default_sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_location_id ON public.payment_methods(location_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_order_history_recurring_order_id ON public.recurring_order_history(recurring_order_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_location_id ON public.recurring_orders(location_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_organization_id ON public.recurring_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_payment_method_id ON public.recurring_orders(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_shipping_address_id ON public.recurring_orders(shipping_address_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_user_id ON public.recurring_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organization_roles_location_id ON public.user_organization_roles(location_id);

-- Drop unused indexes to reduce maintenance overhead
DROP INDEX IF EXISTS idx_product_costs_synced;
DROP INDEX IF EXISTS idx_below_cost_audit_product;
DROP INDEX IF EXISTS idx_below_cost_audit_approver;
DROP INDEX IF EXISTS idx_cost_admin_audit_user;
DROP INDEX IF EXISTS idx_cost_admin_audit_product;
DROP INDEX IF EXISTS idx_org_audit_user_time;
DROP INDEX IF EXISTS idx_org_audit_org_time;
DROP INDEX IF EXISTS idx_org_audit_failed;

-- Fix RLS performance issue in cost_admin_audit table
DROP POLICY IF EXISTS "System can log cost access" ON public.cost_admin_audit;

CREATE POLICY "System can log cost access"
  ON public.cost_admin_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
  );
