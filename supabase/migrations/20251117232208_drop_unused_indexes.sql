/*
  # Drop Unused Database Indexes

  ## Problem
  Multiple indexes exist that are not being used, wasting storage and slowing down writes.

  ## Solution
  Drop all unused indexes identified by Supabase analysis.

  ## Impact
  - Improved write performance
  - Reduced storage usage
  - Indexes can be recreated if needed in the future
*/

-- Checkout sessions indexes
DROP INDEX IF EXISTS idx_checkout_sessions_status;
DROP INDEX IF EXISTS idx_checkout_sessions_idempotency;
DROP INDEX IF EXISTS idx_checkout_sessions_expires_at;
DROP INDEX IF EXISTS idx_checkout_sessions_org_id;
DROP INDEX IF EXISTS idx_checkout_sessions_user_id;

-- Customer addresses indexes
DROP INDEX IF EXISTS idx_customer_addresses_user_id;

-- Login audit indexes
DROP INDEX IF EXISTS idx_login_audit_user_id;
DROP INDEX IF EXISTS idx_login_audit_email;

-- Organization sales reps indexes
DROP INDEX IF EXISTS idx_org_sales_reps_distributor;

-- Favorites indexes
DROP INDEX IF EXISTS idx_favorites_product_id;

-- Organizations indexes
DROP INDEX IF EXISTS idx_organizations_code;
DROP INDEX IF EXISTS idx_organizations_default_sales_rep;
DROP INDEX IF EXISTS idx_organizations_house_account;

-- User organization roles indexes
DROP INDEX IF EXISTS idx_user_org_roles_location_id;

-- Organization pricing indexes
DROP INDEX IF EXISTS idx_organization_pricing_created_by;

-- Location pricing indexes
DROP INDEX IF EXISTS idx_location_pricing_location_id;
DROP INDEX IF EXISTS idx_location_pricing_created_by;

-- Orders indexes
DROP INDEX IF EXISTS idx_orders_user_id;
DROP INDEX IF EXISTS idx_orders_bigcommerce_order_id;
DROP INDEX IF EXISTS idx_orders_organization_id;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_location_id;
DROP INDEX IF EXISTS idx_orders_commission;

-- Recurring orders indexes
DROP INDEX IF EXISTS idx_recurring_orders_user_id;
DROP INDEX IF EXISTS idx_recurring_orders_organization_id;
DROP INDEX IF EXISTS idx_recurring_orders_next_order_date;
DROP INDEX IF EXISTS idx_recurring_orders_status;
DROP INDEX IF EXISTS idx_recurring_orders_shipping_address_id;
DROP INDEX IF EXISTS idx_recurring_orders_location_id;
DROP INDEX IF EXISTS idx_recurring_orders_payment_method_id;

-- Recurring order history indexes
DROP INDEX IF EXISTS idx_recurring_order_history_recurring_order_id;
DROP INDEX IF EXISTS idx_recurring_order_history_status;
DROP INDEX IF EXISTS idx_recurring_order_history_scheduled_date;

-- Contract pricing indexes
DROP INDEX IF EXISTS idx_contract_pricing_user_id;
DROP INDEX IF EXISTS idx_contract_pricing_expiry_date;
DROP INDEX IF EXISTS idx_contract_pricing_created_by;

-- Payment methods indexes
DROP INDEX IF EXISTS idx_payment_methods_location;
DROP INDEX IF EXISTS idx_payment_methods_user_id;

-- Commissions indexes
DROP INDEX IF EXISTS idx_commissions_distributor;
DROP INDEX IF EXISTS idx_commissions_sales_rep;
DROP INDEX IF EXISTS idx_commissions_organization;
DROP INDEX IF EXISTS idx_commissions_status;
DROP INDEX IF EXISTS idx_commissions_product_margin;
DROP INDEX IF EXISTS idx_commissions_order_unique;
DROP INDEX IF EXISTS idx_commissions_approved_by;

-- Distributor sales reps indexes
DROP INDEX IF EXISTS idx_dist_sales_reps_distributor;
DROP INDEX IF EXISTS idx_dist_sales_reps_sales_rep;
DROP INDEX IF EXISTS idx_dist_sales_reps_active;

-- Distributors indexes
DROP INDEX IF EXISTS idx_distributors_profile;
DROP INDEX IF EXISTS idx_distributors_code;
DROP INDEX IF EXISTS idx_distributors_active;
DROP INDEX IF EXISTS idx_distributors_user_id;