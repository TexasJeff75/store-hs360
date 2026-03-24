/*
  # Fix: Allow customers to place orders when sales rep is auto-assigned

  The validate_order_sales_rep trigger was blocking customer orders when:
  - The organization has a default_sales_rep_id or organization_sales_reps record
  - The order service auto-assigns that sales_rep_id to the order
  - But the trigger checks organization_sales_reps and rejects if the record
    is missing/inactive

  The trigger's intent is to prevent unauthorized sales reps from creating
  orders for organizations they aren't assigned to. It should NOT block
  customers placing their own orders.

  Fix: Skip the validation when the authenticated user is NOT the sales rep
  on the order (i.e., a customer whose order has an auto-assigned rep).
*/

CREATE OR REPLACE FUNCTION validate_order_sales_rep()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_assigned boolean;
BEGIN
  -- Admins can always create/update orders
  SELECT is_admin() INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Only validate when the logged-in user IS the sales rep on the order.
  -- When a customer places an order the system auto-assigns a sales_rep_id;
  -- we must not block the customer in that case.
  IF NEW.sales_rep_id IS NOT NULL AND NEW.sales_rep_id = auth.uid() THEN
    SELECT EXISTS(
      SELECT 1
      FROM organization_sales_reps
      WHERE sales_rep_id = NEW.sales_rep_id
        AND organization_id = NEW.organization_id
        AND is_active = true
    ) INTO v_is_assigned;

    IF NOT v_is_assigned THEN
      RAISE EXCEPTION 'Sales rep is not assigned to this organization'
        USING HINT = 'Only assigned sales reps can create orders for this organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_order_sales_rep IS 'Ensures sales reps can only create orders for organizations they are assigned to. Customers with auto-assigned reps are not blocked.';
