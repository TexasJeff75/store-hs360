/*
  # Fix Performance Issues - Part 1: Indexes

  ## Changes
  1. Add missing indexes for foreign keys
  2. Remove duplicate indexes
  
  ## Performance Impact
  - Improves query performance for foreign key lookups
  - Reduces index maintenance overhead by removing duplicates
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_commissions_approved_by ON commissions(approved_by);
CREATE INDEX IF NOT EXISTS idx_distributors_user_id ON distributors(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_location_id ON recurring_orders(location_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_payment_method_id ON recurring_orders(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_recurring_orders_shipping_address_id ON recurring_orders(shipping_address_id);

-- Remove duplicate index (keep idx_commissions_order_unique which has unique constraint)
DROP INDEX IF EXISTS idx_commissions_order;