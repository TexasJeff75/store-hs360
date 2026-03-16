-- RPC function to create an organization.
-- Bypasses PostgREST's `columns` query parameter which causes 400 errors
-- when the Supabase JS client sends quoted column names.
-- If an org with the same code already exists, reactivates and updates it.
CREATE OR REPLACE FUNCTION create_organization(
  p_name text,
  p_code text,
  p_org_type text DEFAULT 'customer',
  p_contact_name text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Check if an org with this code already exists (e.g. soft-deleted via is_active=false)
  SELECT id INTO v_id FROM organizations WHERE code = p_code;

  IF v_id IS NOT NULL THEN
    -- Reactivate and update the existing org
    UPDATE organizations SET
      name = p_name,
      org_type = p_org_type,
      contact_name = p_contact_name,
      contact_email = p_contact_email,
      contact_phone = p_contact_phone,
      address = p_address,
      city = p_city,
      state = p_state,
      zip = p_zip,
      description = p_description,
      is_active = true,
      updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO organizations (name, code, org_type, contact_name, contact_email, contact_phone, address, city, state, zip, description, is_active)
    VALUES (p_name, p_code, p_org_type, p_contact_name, p_contact_email, p_contact_phone, p_address, p_city, p_state, p_zip, p_description, true)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;
