-- ═══════════════════════════════════════════════════════════════
-- FIX FOREIGN KEY CASCADE POLICIES
-- Date: 2026-03-18
-- Purpose: Ensure user deletion (soft or hard) doesn't cause
--          FK violations or silently orphan important records.
--
-- Strategy:
--   - Support tickets/messages: SET NULL on user delete
--     (preserve ticket history, clear user reference)
--   - Email notifications: SET NULL on user delete
--     (preserve notification log, clear user reference)
--   - Audit columns (deleted_by, approved_by, assigned_to):
--     SET NULL on delete (preserve audit trail, clear actor)
--   - commissions.sales_rep_id: keep RESTRICT
--     (intentional — use soft-delete, never hard-delete reps with commissions)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. SUPPORT TICKETS ───────────────────────────────────────
-- Change user_id from implicit RESTRICT → SET NULL
-- so users with tickets can be hard-deleted if needed.

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Allow user_id to be nullable (was NOT NULL)
ALTER TABLE support_tickets
  ALTER COLUMN user_id DROP NOT NULL;

-- assigned_to: already nullable, change to SET NULL
ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_assigned_to_fkey;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── 2. SUPPORT TICKET MESSAGES ──────────────────────────────
ALTER TABLE support_ticket_messages
  DROP CONSTRAINT IF EXISTS support_ticket_messages_user_id_fkey;
ALTER TABLE support_ticket_messages
  ADD CONSTRAINT support_ticket_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Allow user_id to be nullable
ALTER TABLE support_ticket_messages
  ALTER COLUMN user_id DROP NOT NULL;

-- ─── 3. EMAIL NOTIFICATIONS ─────────────────────────────────
-- Already nullable, just fix cascade policy
ALTER TABLE email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_user_id_fkey;
ALTER TABLE email_notifications
  ADD CONSTRAINT email_notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 4. AUDIT COLUMNS (deleted_by, approved_by) ─────────────
-- These are already nullable. Ensure they use SET NULL.

-- orders.deleted_by
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_deleted_by_fkey;
    ALTER TABLE orders
      ADD CONSTRAINT orders_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- profiles.deleted_by
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_deleted_by_fkey;
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- distributors.deleted_by
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributors' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE distributors DROP CONSTRAINT IF EXISTS distributors_deleted_by_fkey;
    ALTER TABLE distributors
      ADD CONSTRAINT distributors_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- commissions.deleted_by
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commissions' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_deleted_by_fkey;
    ALTER TABLE commissions
      ADD CONSTRAINT commissions_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- commissions.approved_by
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commissions' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_approved_by_fkey;
    ALTER TABLE commissions
      ADD CONSTRAINT commissions_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- organizations.deleted_by
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_deleted_by_fkey;
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- payment_transactions.created_by
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_transactions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_created_by_fkey;
    ALTER TABLE payment_transactions
      ADD CONSTRAINT payment_transactions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- orders.sales_rep_id (no cascade — just SET NULL so orders aren't lost)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'sales_rep_id'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_sales_rep_id_fkey;
    ALTER TABLE orders
      ADD CONSTRAINT orders_sales_rep_id_fkey
      FOREIGN KEY (sales_rep_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- NOTES:
--   commissions.sales_rep_id remains ON DELETE RESTRICT.
--   This is intentional: commission records must preserve
--   their sales rep link for financial reporting.
--   Use soft-delete (set deleted_at) instead of hard-delete
--   for sales reps who have commission history.
-- ═══════════════════════════════════════════════════════════════
