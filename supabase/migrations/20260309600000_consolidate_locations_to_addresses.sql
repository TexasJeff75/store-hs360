-- Migration: Consolidate locations into customer_addresses
-- Locations were being used as shipping addresses but had pricing logic attached.
-- This simplifies the model: all addresses live in customer_addresses.

-- 1. Migrate existing location addresses into customer_addresses
-- For each active location with an address, create a shipping address entry
INSERT INTO customer_addresses (
  user_id,
  organization_id,
  address_type,
  label,
  first_name,
  last_name,
  company,
  address1,
  address2,
  city,
  state_or_province,
  postal_code,
  country_code,
  phone,
  is_default,
  is_active
)
SELECT
  -- Use the first admin/manager user in the org, or any user
  COALESCE(
    (SELECT uor.user_id FROM user_organization_roles uor
     WHERE uor.organization_id = l.organization_id
     ORDER BY uor.is_primary DESC, uor.created_at ASC
     LIMIT 1),
    '00000000-0000-0000-0000-000000000000'
  ) as user_id,
  l.organization_id,
  'shipping',
  l.name,
  COALESCE(l.address->>'firstName', l.address->>'first_name', ''),
  COALESCE(l.address->>'lastName', l.address->>'last_name', ''),
  COALESCE(l.address->>'company', l.name, ''),
  COALESCE(l.address->>'address1', l.address->>'street', ''),
  COALESCE(l.address->>'address2', ''),
  COALESCE(l.address->>'city', ''),
  COALESCE(l.address->>'state', l.address->>'state_or_province', ''),
  COALESCE(l.address->>'postalCode', l.address->>'postal_code', l.address->>'zip', ''),
  COALESCE(l.address->>'country', l.address->>'country_code', 'US'),
  COALESCE(l.address->>'phone', l.contact_phone, ''),
  false,
  l.is_active
FROM locations l
WHERE l.address IS NOT NULL
  AND l.address->>'address1' IS NOT NULL
  AND l.address->>'address1' != '';

-- 2. Migrate organization billing_address into customer_addresses as billing type
INSERT INTO customer_addresses (
  user_id,
  organization_id,
  address_type,
  label,
  first_name,
  last_name,
  company,
  address1,
  address2,
  city,
  state_or_province,
  postal_code,
  country_code,
  phone,
  is_default,
  is_active
)
SELECT
  COALESCE(
    (SELECT uor.user_id FROM user_organization_roles uor
     WHERE uor.organization_id = o.id
     ORDER BY uor.is_primary DESC, uor.created_at ASC
     LIMIT 1),
    '00000000-0000-0000-0000-000000000000'
  ) as user_id,
  o.id,
  'billing',
  o.name || ' - Main',
  COALESCE(o.billing_address->>'firstName', o.billing_address->>'first_name', ''),
  COALESCE(o.billing_address->>'lastName', o.billing_address->>'last_name', ''),
  COALESCE(o.billing_address->>'company', o.name, ''),
  COALESCE(o.billing_address->>'address1', o.billing_address->>'street', ''),
  COALESCE(o.billing_address->>'address2', ''),
  COALESCE(o.billing_address->>'city', ''),
  COALESCE(o.billing_address->>'state', o.billing_address->>'state_or_province', ''),
  COALESCE(o.billing_address->>'postalCode', o.billing_address->>'postal_code', o.billing_address->>'zip', ''),
  COALESCE(o.billing_address->>'country', o.billing_address->>'country_code', 'US'),
  COALESCE(o.billing_address->>'phone', o.contact_phone, ''),
  true,
  o.is_active
FROM organizations o
WHERE o.billing_address IS NOT NULL
  AND (o.billing_address->>'address1' IS NOT NULL AND o.billing_address->>'address1' != '')
     OR (o.billing_address->>'street' IS NOT NULL AND o.billing_address->>'street' != '');

-- 3. Drop location_id column from customer_addresses (no longer needed)
ALTER TABLE customer_addresses DROP COLUMN IF EXISTS location_id;

-- 4. Drop location_id from user_organization_roles
ALTER TABLE user_organization_roles DROP CONSTRAINT IF EXISTS user_organization_roles_user_id_organization_id_location_id_key;
ALTER TABLE user_organization_roles DROP COLUMN IF EXISTS location_id;
-- Re-add unique constraint without location_id
ALTER TABLE user_organization_roles ADD CONSTRAINT user_organization_roles_user_id_organization_id_key
  UNIQUE (user_id, organization_id);

-- 5. Drop location_pricing table
DROP TABLE IF EXISTS location_pricing CASCADE;

-- 6. Remove location pricing type entries from contract_pricing
DELETE FROM contract_pricing WHERE pricing_type = 'location';

-- 7. Drop the locations table
DROP TABLE IF EXISTS locations CASCADE;

-- 8. Clean up indexes that referenced locations
DROP INDEX IF EXISTS idx_locations_org_id;
DROP INDEX IF EXISTS idx_locations_active;
DROP INDEX IF EXISTS idx_location_pricing_location_id;
DROP INDEX IF EXISTS idx_location_pricing_product_id;
DROP INDEX IF EXISTS idx_customer_addresses_location_id;
