/*
  # Add helper function for distributor user creation

  Distributors need to create sales_rep and delegate users from their portal,
  but the create-admin-user edge function only allows admin callers.

  Solution: Create a SECURITY DEFINER database function that:
  1. Validates the caller is a distributor
  2. Updates the newly-created profile role from 'customer' to the requested role
  3. Sets full_name and phone on the profile

  Flow: The portal calls supabase.auth.signUp (creates user with 'customer' role
  via trigger), then calls this function to fix the role and set profile fields.
*/

-- Function to update a newly-created user's profile for distributor use
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
DECLARE
  v_caller_distributor_id uuid;
BEGIN
  -- Verify caller is a distributor
  IF NOT is_distributor() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only distributors can call this function');
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
  'Called by distributors after signUp to set the new user''s role, name, and phone. '
  'Only works on users with role=customer (freshly created via signUp trigger).';
