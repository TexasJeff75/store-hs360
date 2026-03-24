-- Add payment_method and payment_last_four columns to orders table.
-- These fields were previously only stored in payment_transactions,
-- but the order itself should carry the payment method used at checkout
-- so that it is available immediately without a join.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_last_four text;

COMMENT ON COLUMN orders.payment_method IS 'Payment method type used at checkout: credit_card, ach, saved_card, saved_ach, test';
COMMENT ON COLUMN orders.payment_last_four IS 'Last 4 digits of the card or bank account used for payment';
