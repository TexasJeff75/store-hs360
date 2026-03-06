/*
  Fix missing can_view_secret_cost column on profiles and
  recreate cost_admin_audit table (previously dropped then
  referenced by CostAdminManagement and ProfitReport).
*/

-- ── Add missing column to profiles ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'can_view_secret_cost'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN can_view_secret_cost boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── Recreate cost_admin_audit table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cost_admin_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  product_id  integer,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_admin_audit_user
  ON public.cost_admin_audit(user_id);

ALTER TABLE public.cost_admin_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view audit log
CREATE POLICY IF NOT EXISTS "Cost admins can view audit log"
  ON public.cost_admin_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND can_view_secret_cost = true)
  );

-- Allow inserts for authenticated users (audit logging)
CREATE POLICY IF NOT EXISTS "Authenticated users can insert audit log"
  ON public.cost_admin_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);
