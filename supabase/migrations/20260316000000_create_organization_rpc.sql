-- RPC function to create an organization.
-- Bypasses PostgREST's `columns` query parameter which causes 400 errors
-- when the Supabase JS client sends quoted column names.
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
  new_id uuid;
BEGIN
  INSERT INTO organizations (name, code, org_type, contact_name, contact_email, contact_phone, address, city, state, zip, description, is_active)
  VALUES (p_name, p_code, p_org_type, p_contact_name, p_contact_email, p_contact_phone, p_address, p_city, p_state, p_zip, p_description, true)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
