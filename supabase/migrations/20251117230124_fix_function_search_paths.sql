/*
  # Fix Function Search Paths

  ## Changes
  Sets search_path for functions to prevent security issues
  
  ## Security
  Using role mutable search_path can allow attackers to change function behavior
  by manipulating the search path. Setting explicit search_path prevents this.
*/

-- Update all functions to have secure search_path
ALTER FUNCTION update_customer_addresses_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_payment_method_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_recurring_orders_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION is_user_approved(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION calculate_next_order_date(date, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION update_commission_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION get_organization_commission_structure(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION get_effective_price_with_markup(bigint, numeric, uuid, uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION check_pricing_conflict() SET search_path = public, pg_temp;
ALTER FUNCTION calculate_commission_for_order() SET search_path = public, pg_temp;
ALTER FUNCTION update_product_settings_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION validate_contract_pricing_markup() SET search_path = public, pg_temp;
ALTER FUNCTION sync_distributor_role() SET search_path = public, pg_temp;
ALTER FUNCTION handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION is_admin(uuid) SET search_path = public, pg_temp;