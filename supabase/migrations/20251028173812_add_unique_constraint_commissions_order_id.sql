/*
  # Add Unique Constraint on Commissions Order ID

  ## Change
  Adds a unique constraint on the order_id column in the commissions table.
  This allows the trigger function to use ON CONFLICT (order_id) for upsert operations.

  ## Why
  The commission calculation trigger needs to update existing commission records
  when orders are recalculated, ensuring one commission per order.
*/

-- Add unique constraint on order_id
ALTER TABLE commissions 
ADD CONSTRAINT commissions_order_id_unique UNIQUE (order_id);