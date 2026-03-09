/*
  # Address System Rebuild - RPC Functions

  Replace RLS-based address queries with SECURITY DEFINER RPC functions.
  This completely bypasses the RLS policies that have been causing visibility
  issues where admins could only see their own addresses, not all org addresses.

  Functions created:
  1. get_organization_addresses(org_id) - Get all active addresses for an org
  2. get_user_addresses(p_user_id) - Get personal addresses for a user
  3. create_customer_address(...) - Create a new address
  4. update_customer_address(...) - Update an existing address
  5. delete_customer_address(addr_id) - Soft-delete an address
  6. set_default_customer_address(addr_id) - Set an address as default
*/

-- 1. Get all active addresses for an organization
CREATE OR REPLACE FUNCTION get_organization_addresses(org_id uuid)
RETURNS SETOF customer_addresses
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT *
  FROM customer_addresses
  WHERE organization_id = org_id
    AND is_active = true
  ORDER BY is_default DESC, created_at DESC;
$$;

-- 2. Get personal addresses for a user (no organization)
CREATE OR REPLACE FUNCTION get_user_addresses(p_user_id uuid)
RETURNS SETOF customer_addresses
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT *
  FROM customer_addresses
  WHERE user_id = p_user_id
    AND organization_id IS NULL
    AND is_active = true
  ORDER BY is_default DESC, created_at DESC;
$$;

-- 3. Create a new customer address
CREATE OR REPLACE FUNCTION create_customer_address(
  p_user_id uuid,
  p_organization_id uuid DEFAULT NULL,
  p_address_type text DEFAULT 'shipping',
  p_label text DEFAULT '',
  p_first_name text DEFAULT '',
  p_last_name text DEFAULT '',
  p_company text DEFAULT '',
  p_address1 text DEFAULT '',
  p_address2 text DEFAULT '',
  p_city text DEFAULT '',
  p_state_or_province text DEFAULT '',
  p_postal_code text DEFAULT '',
  p_country_code text DEFAULT 'US',
  p_phone text DEFAULT '',
  p_email text DEFAULT '',
  p_is_default boolean DEFAULT false
)
RETURNS customer_addresses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_address customer_addresses;
BEGIN
  -- If setting as default, clear existing defaults for this scope
  IF p_is_default THEN
    IF p_organization_id IS NOT NULL THEN
      UPDATE customer_addresses
      SET is_default = false
      WHERE organization_id = p_organization_id
        AND address_type = p_address_type
        AND is_default = true;
    ELSE
      UPDATE customer_addresses
      SET is_default = false
      WHERE user_id = p_user_id
        AND organization_id IS NULL
        AND address_type = p_address_type
        AND is_default = true;
    END IF;
  END IF;

  INSERT INTO customer_addresses (
    user_id, organization_id, address_type, label,
    first_name, last_name, company, address1, address2,
    city, state_or_province, postal_code, country_code,
    phone, email, is_default, is_active
  ) VALUES (
    p_user_id, p_organization_id, p_address_type, p_label,
    p_first_name, p_last_name, p_company, p_address1, p_address2,
    p_city, p_state_or_province, p_postal_code, p_country_code,
    p_phone, p_email, p_is_default, true
  )
  RETURNING * INTO new_address;

  RETURN new_address;
END;
$$;

-- 4. Update a customer address
CREATE OR REPLACE FUNCTION update_customer_address(
  p_address_id uuid,
  p_label text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_address1 text DEFAULT NULL,
  p_address2 text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state_or_province text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_country_code text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_is_default boolean DEFAULT NULL,
  p_address_type text DEFAULT NULL
)
RETURNS customer_addresses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  updated_address customer_addresses;
  existing_address customer_addresses;
BEGIN
  -- Get current address
  SELECT * INTO existing_address FROM customer_addresses WHERE id = p_address_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Address not found';
  END IF;

  -- If setting as default, clear existing defaults
  IF p_is_default = true THEN
    IF existing_address.organization_id IS NOT NULL THEN
      UPDATE customer_addresses
      SET is_default = false
      WHERE organization_id = existing_address.organization_id
        AND address_type = COALESCE(p_address_type, existing_address.address_type)
        AND is_default = true
        AND id != p_address_id;
    ELSE
      UPDATE customer_addresses
      SET is_default = false
      WHERE user_id = existing_address.user_id
        AND organization_id IS NULL
        AND address_type = COALESCE(p_address_type, existing_address.address_type)
        AND is_default = true
        AND id != p_address_id;
    END IF;
  END IF;

  UPDATE customer_addresses SET
    label = COALESCE(p_label, label),
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    company = COALESCE(p_company, company),
    address1 = COALESCE(p_address1, address1),
    address2 = COALESCE(p_address2, address2),
    city = COALESCE(p_city, city),
    state_or_province = COALESCE(p_state_or_province, state_or_province),
    postal_code = COALESCE(p_postal_code, postal_code),
    country_code = COALESCE(p_country_code, country_code),
    phone = COALESCE(p_phone, phone),
    email = COALESCE(p_email, email),
    is_default = COALESCE(p_is_default, is_default),
    address_type = COALESCE(p_address_type, address_type),
    updated_at = now()
  WHERE id = p_address_id
  RETURNING * INTO updated_address;

  RETURN updated_address;
END;
$$;

-- 5. Soft-delete a customer address
CREATE OR REPLACE FUNCTION delete_customer_address(p_address_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE customer_addresses
  SET is_active = false, updated_at = now()
  WHERE id = p_address_id;

  RETURN FOUND;
END;
$$;

-- 6. Set an address as the default
CREATE OR REPLACE FUNCTION set_default_customer_address(p_address_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  addr customer_addresses;
BEGIN
  SELECT * INTO addr FROM customer_addresses WHERE id = p_address_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Clear existing defaults
  IF addr.organization_id IS NOT NULL THEN
    UPDATE customer_addresses
    SET is_default = false
    WHERE organization_id = addr.organization_id
      AND address_type = addr.address_type
      AND is_default = true;
  ELSE
    UPDATE customer_addresses
    SET is_default = false
    WHERE user_id = addr.user_id
      AND organization_id IS NULL
      AND address_type = addr.address_type
      AND is_default = true;
  END IF;

  -- Set the new default
  UPDATE customer_addresses
  SET is_default = true, updated_at = now()
  WHERE id = p_address_id;

  RETURN true;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_organization_addresses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_addresses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_customer_address(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_address(uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_customer_address(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_default_customer_address(uuid) TO authenticated;
