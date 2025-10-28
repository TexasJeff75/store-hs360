/*
  # Update Commission Calculation for Distributor Hierarchy

  ## Changes
  Updates the commission calculation function to support distributor hierarchy:

  1. Calculates separate commissions for sales rep and distributor
  2. Supports two commission split types:
     - percentage_of_distributor: Sales rep gets % of distributor's commission
     - fixed_with_override: Sales rep gets fixed rate, distributor gets override
  3. Records both sales rep and distributor commissions
  4. Maintains backward compatibility for non-distributor sales reps

  ## Commission Calculation Examples

  ### Scenario 1: Percentage Split (50% of 45%)
  - Margin: $100
  - Distributor base rate: 45%
  - Sales rep gets: 50% of distributor commission
  - Distributor commission: $45
  - Sales rep receives: $22.50
  - Distributor receives: $22.50

  ### Scenario 2: Fixed with Override (40% + 5%)
  - Margin: $100
  - Sales rep rate: 40%
  - Distributor override: 5%
  - Sales rep receives: $40
  - Distributor receives: $5
  - Total: $45
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_calculate_commission ON orders;
DROP FUNCTION IF EXISTS calculate_commission_for_order();

-- Create updated commission calculation function with distributor hierarchy support
CREATE OR REPLACE FUNCTION calculate_commission_for_order()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate numeric(5,2);
  v_total_margin numeric(10,2) := 0;
  v_commission_amount numeric(10,2) := 0;
  v_sales_rep_commission numeric(10,2) := 0;
  v_distributor_commission numeric(10,2) := 0;
  v_commission_id uuid;
  v_base_commission numeric(10,2);
  v_markup_commission numeric(10,2);
  v_total_item_commission numeric(10,2);
  v_item jsonb;
  v_item_cost numeric(10,2);
  v_item_price numeric(10,2);
  v_item_markup numeric(10,2);
  v_item_quantity integer;
  v_base_margin numeric(10,2);
  v_markup_amount numeric(10,2);
  v_distributor_id uuid;
  v_commission_split_type text;
  v_sales_rep_rate numeric(5,2);
  v_distributor_rate numeric(5,2);
  v_distributor_override_rate numeric(5,2);
  v_base_distributor_rate numeric(5,2);
BEGIN
  -- Only calculate commission for completed orders with a sales rep
  IF NEW.status = 'completed' AND NEW.sales_rep_id IS NOT NULL THEN
    -- Get commission structure (distributor hierarchy aware)
    SELECT
      osr.commission_rate,
      osr.distributor_id,
      COALESCE(dsr.commission_split_type, 'none'),
      COALESCE(dsr.sales_rep_rate, 100),
      COALESCE(dsr.distributor_override_rate, 0),
      COALESCE(d.commission_rate, osr.commission_rate)
    INTO
      v_commission_rate,
      v_distributor_id,
      v_commission_split_type,
      v_sales_rep_rate,
      v_distributor_override_rate,
      v_base_distributor_rate
    FROM organization_sales_reps osr
    LEFT JOIN distributors d ON d.id = osr.distributor_id AND d.is_active = true
    LEFT JOIN distributor_sales_reps dsr ON dsr.distributor_id = osr.distributor_id
      AND dsr.sales_rep_id = osr.sales_rep_id
      AND dsr.is_active = true
    WHERE osr.organization_id = NEW.organization_id
      AND osr.sales_rep_id = NEW.sales_rep_id
      AND osr.is_active = true
    LIMIT 1;

    IF v_commission_rate IS NOT NULL THEN
      -- Calculate commission from items
      IF NEW.items IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
          v_item_cost := COALESCE((v_item->>'cost')::numeric, 0);
          v_item_price := COALESCE((v_item->>'price')::numeric, 0);
          v_item_markup := COALESCE((v_item->>'markup')::numeric, 0);
          v_item_quantity := COALESCE((v_item->>'quantity')::integer, 1);

          -- Calculate base margin (retail price - cost) per item
          v_base_margin := (v_item_price - v_item_cost) * v_item_quantity;

          IF v_base_margin > 0 THEN
            -- Use base distributor rate if distributor exists, otherwise use commission_rate
            IF v_distributor_id IS NOT NULL THEN
              v_base_commission := v_base_margin * (v_base_distributor_rate / 100);
            ELSE
              v_base_commission := v_base_margin * (v_commission_rate / 100);
            END IF;

            -- Calculate markup commission if markup exists
            IF v_item_markup > 0 THEN
              v_markup_amount := v_item_markup * v_item_quantity;
              v_markup_commission := v_markup_amount;
              v_total_item_commission := v_base_commission + v_markup_commission;
            ELSE
              v_markup_commission := 0;
              v_total_item_commission := v_base_commission;
            END IF;

            -- Accumulate total margin and commission
            v_total_margin := v_total_margin + v_base_margin;
            v_commission_amount := v_commission_amount + v_total_item_commission;

            RAISE NOTICE 'Item: %, Qty: %, Cost: %, Price: %, Markup: %, Base Margin: %, Commission Details: %',
              v_item->>'name',
              v_item_quantity,
              v_item_cost,
              v_item_price,
              v_item_markup,
              v_base_margin,
              jsonb_build_object(
                'baseCommission', v_base_commission,
                'markupCommission', v_markup_commission,
                'totalItemCommission', v_total_item_commission
              );
          END IF;
        END LOOP;
      END IF;

      -- Calculate split between sales rep and distributor
      IF v_distributor_id IS NOT NULL THEN
        IF v_commission_split_type = 'percentage_of_distributor' THEN
          -- Sales rep gets percentage of total commission
          v_sales_rep_commission := v_commission_amount * (v_sales_rep_rate / 100);
          v_distributor_commission := v_commission_amount - v_sales_rep_commission;
        ELSIF v_commission_split_type = 'fixed_with_override' THEN
          -- Recalculate: sales rep gets fixed rate, distributor gets override
          v_sales_rep_commission := v_total_margin * (v_sales_rep_rate / 100);
          v_distributor_commission := v_total_margin * (v_distributor_override_rate / 100);
          -- Add markup commission to sales rep
          IF NEW.items IS NOT NULL THEN
            FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
            LOOP
              v_item_markup := COALESCE((v_item->>'markup')::numeric, 0);
              v_item_quantity := COALESCE((v_item->>'quantity')::integer, 1);
              IF v_item_markup > 0 THEN
                v_sales_rep_commission := v_sales_rep_commission + (v_item_markup * v_item_quantity);
              END IF;
            END LOOP;
          END IF;
          -- Update total commission amount
          v_commission_amount := v_sales_rep_commission + v_distributor_commission;
        ELSE
          -- No distributor split, sales rep gets everything
          v_sales_rep_commission := v_commission_amount;
          v_distributor_commission := 0;
        END IF;
      ELSE
        -- No distributor, sales rep gets everything
        v_sales_rep_commission := v_commission_amount;
        v_distributor_commission := 0;
      END IF;

      -- Create or update commission record
      INSERT INTO commissions (
        order_id,
        sales_rep_id,
        organization_id,
        distributor_id,
        order_total,
        commission_rate,
        commission_amount,
        sales_rep_commission,
        distributor_commission,
        commission_split_type,
        status
      ) VALUES (
        NEW.id,
        NEW.sales_rep_id,
        NEW.organization_id,
        v_distributor_id,
        NEW.total,
        v_commission_rate,
        v_commission_amount,
        v_sales_rep_commission,
        v_distributor_commission,
        v_commission_split_type,
        'pending'
      )
      ON CONFLICT (order_id) DO UPDATE
      SET
        commission_rate = EXCLUDED.commission_rate,
        commission_amount = EXCLUDED.commission_amount,
        sales_rep_commission = EXCLUDED.sales_rep_commission,
        distributor_commission = EXCLUDED.distributor_commission,
        commission_split_type = EXCLUDED.commission_split_type,
        distributor_id = EXCLUDED.distributor_id,
        updated_at = now()
      RETURNING id INTO v_commission_id;

      RAISE NOTICE 'Commission calculated - Total: %, Sales Rep: %, Distributor: %, Split Type: %',
        v_commission_amount,
        v_sales_rep_commission,
        v_distributor_commission,
        v_commission_split_type;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_calculate_commission
  AFTER INSERT OR UPDATE OF status, sales_rep_id, items, total
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_for_order();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_commissions_order_unique ON commissions(order_id);

COMMENT ON FUNCTION calculate_commission_for_order() IS 'Calculates commission for orders with distributor hierarchy support. Handles percentage splits and fixed rates with overrides.';
