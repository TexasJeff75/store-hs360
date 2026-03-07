-- Clear database tables: orders, customers, commissions, recurring orders, and pricing
-- This migration truncates data while preserving table structures and policies

-- Use TRUNCATE with CASCADE to handle foreign key dependencies
-- Order matters: child tables first, then parent tables

BEGIN;

-- 1. Recurring order history (depends on recurring_orders and orders)
TRUNCATE TABLE recurring_order_history CASCADE;

-- 2. Recurring orders
TRUNCATE TABLE recurring_orders CASCADE;

-- 3. Commissions (depends on orders, sales reps, distributors)
TRUNCATE TABLE commissions CASCADE;

-- 4. Distributor commission rules
TRUNCATE TABLE distributor_commission_rules CASCADE;

-- 5. Distributor sales reps
TRUNCATE TABLE distributor_sales_reps CASCADE;

-- 6. Organization sales reps
TRUNCATE TABLE organization_sales_reps CASCADE;

-- 7. Distributors
TRUNCATE TABLE distributors CASCADE;

-- 8. Orders (depends on users, organizations, locations)
TRUNCATE TABLE orders CASCADE;

-- 9. Checkout sessions
TRUNCATE TABLE checkout_sessions CASCADE;

-- 10. Shopping carts
TRUNCATE TABLE shopping_carts CASCADE;

-- 11. Payment methods
TRUNCATE TABLE payment_methods CASCADE;

-- 12. Pricing tables
TRUNCATE TABLE contract_pricing CASCADE;
TRUNCATE TABLE organization_pricing CASCADE;
TRUNCATE TABLE location_pricing CASCADE;

-- 13. Customer addresses
TRUNCATE TABLE customer_addresses CASCADE;

-- 14. Favorites
TRUNCATE TABLE favorites CASCADE;

-- 15. User-organization roles (linking table)
TRUNCATE TABLE user_organization_roles CASCADE;

-- 16. Locations (depends on organizations)
TRUNCATE TABLE locations CASCADE;

-- 17. Organizations
TRUNCATE TABLE organizations CASCADE;

COMMIT;
