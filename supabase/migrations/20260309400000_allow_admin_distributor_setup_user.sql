/*
  # Allow admins to call distributor_setup_user()

  When impersonating a distributor, auth.uid() is still the admin user.
  The is_distributor() check fails because impersonation is client-side only.
  Fix: Allow both distributors AND admins to call this function.
*/

CREATE OR REPLACE FUNCTION public.distributor_setup_user(
  p_user_id uuid,
  p_role text,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is a distributor OR an admin (admins impersonate distributors)
  IF NOT (is_distributor() OR is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only distributors or admins can call this function');
  END IF;

  -- Only allow creating sales_rep or distributor roles
  IF p_role NOT IN ('sales_rep', 'distributor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role: must be sales_rep or distributor');
  END IF;

  -- Verify the target user exists and is a new user (customer role = just signed up)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'customer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found or already has a non-customer role');
  END IF;

  -- Update the profile
  UPDATE profiles
  SET
    role = p_role,
    is_approved = true,
    approval_status = 'approved',
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.distributor_setup_user IS
  'Called by distributors (or admins impersonating them) after signUp to set the new user''s role, name, and phone. '
  'Only works on users with role=customer (freshly created via signUp trigger).';
