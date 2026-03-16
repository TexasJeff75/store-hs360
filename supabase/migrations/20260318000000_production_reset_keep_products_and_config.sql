-- ═══════════════════════════════════════════════════════════════
-- PRODUCTION DATA RESET
-- Date: 2026-03-18
-- Purpose: Clear all transactional and user data while keeping
--          products, site config, email config, and admin accounts.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. TRANSACTIONAL DATA (order-dependent for FK safety) ───

-- Commission audit + line items (depend on commissions & orders)
TRUNCATE TABLE commission_audit_log CASCADE;
TRUNCATE TABLE commission_line_items CASCADE;
TRUNCATE TABLE commissions CASCADE;

-- Orders + related
TRUNCATE TABLE payment_transactions CASCADE;
TRUNCATE TABLE checkout_sessions CASCADE;
TRUNCATE TABLE orders CASCADE;

-- Recurring orders
TRUNCATE TABLE recurring_order_history CASCADE;
TRUNCATE TABLE recurring_orders CASCADE;

-- Shopping & favorites
TRUNCATE TABLE shopping_carts CASCADE;
TRUNCATE TABLE favorites CASCADE;

-- Support
TRUNCATE TABLE support_ticket_messages CASCADE;
TRUNCATE TABLE support_tickets CASCADE;

-- ─── 2. DISTRIBUTOR & SALES REP HIERARCHY ───

-- Commission rules and customer links first (depend on distributors)
TRUNCATE TABLE distributor_commission_rules CASCADE;
TRUNCATE TABLE distributor_product_pricing CASCADE;
TRUNCATE TABLE distributor_rep_customers CASCADE;
TRUNCATE TABLE distributor_customers CASCADE;
TRUNCATE TABLE distributor_delegates CASCADE;
TRUNCATE TABLE distributor_sales_reps CASCADE;

-- Organization-sales-rep links
TRUNCATE TABLE organization_sales_reps CASCADE;

-- Distributors themselves
TRUNCATE TABLE distributors CASCADE;

-- ─── 3. PRICING OVERRIDES ───

TRUNCATE TABLE contract_pricing CASCADE;
TRUNCATE TABLE organization_pricing CASCADE;
TRUNCATE TABLE location_pricing CASCADE;

-- ─── 4. ORGANIZATION DATA ───

-- Customer addresses & payment methods (depend on orgs/users)
TRUNCATE TABLE customer_addresses CASCADE;
TRUNCATE TABLE payment_methods CASCADE;

-- User-org links, then locations, then orgs
TRUNCATE TABLE user_organization_roles CASCADE;
TRUNCATE TABLE locations CASCADE;
TRUNCATE TABLE organizations CASCADE;

-- ─── 5. AUDIT LOGS ───

TRUNCATE TABLE login_audit CASCADE;
TRUNCATE TABLE user_activity_log CASCADE;
TRUNCATE TABLE cost_admin_audit CASCADE;
TRUNCATE TABLE organization_access_audit CASCADE;
TRUNCATE TABLE email_notifications CASCADE;

-- ─── 6. NON-ADMIN USER PROFILES ───
-- Delete non-admin profiles (keeps admin accounts intact)
-- This also cascades to any remaining FK references to profiles

DELETE FROM profiles WHERE role != 'admin';

-- Delete corresponding Supabase auth users for non-admin profiles
-- NOTE: This cannot be done via SQL — auth.users is managed by Supabase Auth.
-- Non-admin auth users must be removed via the Supabase Admin API or dashboard.
-- The profiles deletion above is sufficient for the app to function correctly,
-- as the app checks profiles.role for all access control.

-- ─── 7. CLEAN UP: Reset sequences if any ───
-- (Most tables use UUIDs, so no sequences to reset)

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- PRESERVED TABLES (not touched):
--   products              — BigCommerce product catalog
--   product_settings      — Product configuration
--   product_secret_costs  — Hidden cost data
--   site_settings         — Site configuration (shipping, etc.)
--   email_templates       — Email template definitions
--   email_settings        — Email configuration
--   profiles (admin only) — Admin user accounts kept
--
-- POST-MIGRATION MANUAL STEPS:
--   1. Remove non-admin auth users via Supabase Dashboard > Auth
--      (or via admin API: supabase.auth.admin.deleteUser(id))
--   2. Verify admin accounts can still log in
--   3. Re-deploy Edge Functions if needed
-- ═══════════════════════════════════════════════════════════════
