-- Payment transactions table: tracks the full lifecycle of payment events
-- (authorization, capture, void, refund) with queryable structured data.

CREATE TABLE payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  transaction_type text NOT NULL,
  payment_method text,
  gateway_transaction_id text,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text NOT NULL,
  last_four text,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('authorization', 'capture', 'void', 'refund')),
  CONSTRAINT valid_transaction_status CHECK (status IN ('success', 'failed', 'pending', 'declined'))
);

CREATE INDEX idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_type ON payment_transactions(transaction_type);
CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all payment transactions"
  ON payment_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view own order transactions"
  ON payment_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));
