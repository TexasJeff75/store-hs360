/*
  # Enhance Payment Methods for PCI Compliance
  
  This migration enhances the payment_methods table to support both credit cards
  and bank accounts while maintaining PCI DSS compliance.

  ## PCI Compliance Strategy
  
  We NEVER store sensitive payment data. Instead:
  - Credit card numbers → Store only last 4 digits + payment processor token
  - CVV codes → NEVER stored (PCI violation)
  - Bank account numbers → Store only last 4 digits + payment processor token
  - Routing numbers → Can be stored (public information)
  
  All actual payment data is tokenized by the payment processor (BigCommerce, Stripe, etc.)
  and we only store the secure token reference.

  ## Changes
  
  1. Modified Columns
    - Rename `card_type` to `payment_type` (credit_card, debit_card, bank_account, ach)
    - Rename `cardholder_name` to `account_holder_name` (works for both cards and bank)
    - Add `bank_name` (text, optional) - Name of the bank for bank accounts
    - Add `account_type` (text, optional) - checking or savings
    - Make `expiry_month` and `expiry_year` optional (not applicable for bank accounts)
    - Rename `bigcommerce_payment_token` to `payment_token` (processor-agnostic)
    - Add `payment_processor` (text) - Which processor issued the token (bigcommerce, stripe, etc.)

  2. Security Enhancements
    - Add check constraint to ensure payment_type is valid
    - Add check constraint to ensure account_type is valid (if provided)
    - Update constraints to make expiry optional for bank accounts
    - Add constraint to ensure expiry is required for cards
    
  3. Important Security Notes
    - The payment_token column contains ONLY the tokenized reference
    - NEVER pass raw card numbers or account numbers through this system
    - All tokenization must happen client-side or via secure payment processor APIs
    - Row Level Security ensures users only see payment methods for their organizations
*/

-- Add new columns
ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS payment_type TEXT,
  ADD COLUMN IF NOT EXISTS account_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT,
  ADD COLUMN IF NOT EXISTS payment_processor TEXT DEFAULT 'bigcommerce';

-- Migrate existing data
UPDATE payment_methods
SET payment_type = card_type,
    account_holder_name = cardholder_name,
    payment_processor = 'bigcommerce'
WHERE payment_type IS NULL;

-- Make payment_type NOT NULL after migration
ALTER TABLE payment_methods
  ALTER COLUMN payment_type SET NOT NULL;

-- Make account_holder_name NOT NULL after migration  
ALTER TABLE payment_methods
  ALTER COLUMN account_holder_name SET NOT NULL;

-- Drop old constraints
ALTER TABLE payment_methods
  DROP CONSTRAINT IF EXISTS valid_expiry_month,
  DROP CONSTRAINT IF EXISTS valid_expiry_year;

-- Make expiry fields optional (not needed for bank accounts)
ALTER TABLE payment_methods
  ALTER COLUMN expiry_month DROP NOT NULL,
  ALTER COLUMN expiry_year DROP NOT NULL;

-- Add new constraints
ALTER TABLE payment_methods
  ADD CONSTRAINT valid_payment_type 
    CHECK (payment_type IN ('credit_card', 'debit_card', 'bank_account', 'ach')),
  ADD CONSTRAINT valid_account_type 
    CHECK (account_type IS NULL OR account_type IN ('checking', 'savings')),
  ADD CONSTRAINT valid_expiry_month 
    CHECK (expiry_month IS NULL OR (expiry_month >= 1 AND expiry_month <= 12)),
  ADD CONSTRAINT valid_expiry_year 
    CHECK (expiry_year IS NULL OR expiry_year >= 2025),
  -- Ensure cards have expiry dates
  ADD CONSTRAINT cards_require_expiry
    CHECK (
      (payment_type IN ('credit_card', 'debit_card') AND expiry_month IS NOT NULL AND expiry_year IS NOT NULL)
      OR (payment_type IN ('bank_account', 'ach'))
    ),
  -- Ensure bank accounts have account_type
  ADD CONSTRAINT bank_accounts_require_type
    CHECK (
      (payment_type IN ('bank_account', 'ach') AND account_type IS NOT NULL)
      OR (payment_type IN ('credit_card', 'debit_card'))
    );

-- Rename the token column to be processor-agnostic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'payment_token'
  ) THEN
    ALTER TABLE payment_methods RENAME COLUMN bigcommerce_payment_token TO payment_token;
  END IF;
END $$;

-- Add comment explaining PCI compliance
COMMENT ON TABLE payment_methods IS 
  'PCI-compliant payment methods storage. NEVER stores raw card numbers, CVV, or full account numbers. Only stores payment processor tokens and last 4 digits.';

COMMENT ON COLUMN payment_methods.payment_token IS 
  'Tokenized payment reference from payment processor. This is NOT the actual card/account number.';

COMMENT ON COLUMN payment_methods.last_four IS 
  'Last 4 digits only. Storing this is PCI compliant. NEVER store full card/account numbers.';

-- Drop the old columns if they still exist (safe to do after migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'card_type'
  ) THEN
    ALTER TABLE payment_methods DROP COLUMN card_type;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'cardholder_name'
  ) THEN
    ALTER TABLE payment_methods DROP COLUMN cardholder_name;
  END IF;
END $$;