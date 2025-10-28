/*
  # Fix Commission Calculation - Avoid Double Counting Markup

  ## Issue
  When an item has a markup, the price field already includes the markup amount.
  The previous logic was adding both base_margin (price - cost) and markup separately,
  which double-counted the markup.

  ## Example
  ProxiGene: cost $199, price $249 (which is retail $199 + $50 markup)
  - Base margin: $249 - $199 = $50 (this already IS the markup)
  - We were then adding markup ($50) again = $100 total (wrong!)
  
  ## Correct Logic
  When item has markup > 0:
  - The "price" is the final selling price (retail + markup)
  - Base margin = price - cost = full margin already
  - Give 100% of base margin (don't add markup separately)
  - The markup field is just for display/tracking, not calculation
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_calculate_commission ON orders;
DROP FUNCTION IF EXISTS calculate_commission_for_order();

-- Create corrected commission calculation function
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

          -- Calculate margin (price - cost) per item
          -- Note: When markup exists, price already includes the markup
          v_base_margin := (v_item_price - v_item_cost) * v_item_quantity;

          IF v_base_margin > 0 THEN
            -- If item has markup, it gets 100% of the margin (no commission rate applied)
            -- If no markup, apply the commission rate
            IF v_item_markup > 0 THEN
              -- Markup products: 100% commission on full margin
              v_total_item_commission := v_base_margin;
            ELSE
              -- Regular products: apply commission rate
              IF v_distributor_id IS NOT NULL THEN
                v_total_item_commission := v_base_margin * (v_base_distributor_rate / 100);
              ELSE
                v_total_item_commission := v_base_margin * (v_commission_rate / 100);
              END IF;
            END IF;

            -- Accumulate total margin and commission
            v_total_margin := v_total_margin + v_base_margin;
            v_commission_amount := v_commission_amount + v_total_item_commission;

            RAISE NOTICE 'Item: %, Qty: %, Cost: %, Price: %, Markup: %, Margin: %, Commission: %',
              v_item->>'name',
              v_item_quantity,
              v_item_cost,
              v_item_price,
              v_item_markup,
              v_base_margin,
              v_total_item_commission;
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
          -- For fixed_with_override, need to recalculate per item
          v_sales_rep_commission := 0;
          v_distributor_commission := 0;
          
          FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
          LOOP
            v_item_cost := COALESCE((v_item->>'cost')::numeric, 0);
            v_item_price := COALESCE((v_item->>'price')::numeric, 0);
            v_item_markup := COALESCE((v_item->>'markup')::numeric, 0);
            v_item_quantity := COALESCE((v_item->>'quantity')::integer, 1);
            v_base_margin := (v_item_price - v_item_cost) * v_item_quantity;
            
            IF v_base_margin > 0 THEN
              IF v_item_markup > 0 THEN
                -- Markup items: 100% to sales rep
                v_sales_rep_commission := v_sales_rep_commission + v_base_margin;
              ELSE
                -- Regular items: split between rep and distributor
                v_sales_rep_commission := v_sales_rep_commission + (v_base_margin * (v_sales_rep_rate / 100));
                v_distributor_commission := v_distributor_commission + (v_base_margin * (v_distributor_override_rate / 100));
              END IF;
            END IF;
          END LOOP;
          
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
        commission_rate,
        order_total,
        product_margin,
        commission_amount,
        sales_rep_commission,
        distributor_id,
        distributor_commission,
        commission_split_type,
        status
      ) VALUES (
        NEW.id,
        NEW.sales_rep_id,
        NEW.organization_id,
        v_commission_rate,
        NEW.total,
        v_total_margin,
        v_commission_amount,
        v_sales_rep_commission,
        v_distributor_id,
        CASE WHEN v_distributor_id IS NOT NULL THEN v_distributor_commission ELSE NULL END,
        CASE WHEN v_distributor_id IS NOT NULL THEN v_commission_split_type ELSE NULL END,
        'pending'
      )
      ON CONFLICT (order_id) DO UPDATE SET
        commission_rate = EXCLUDED.commission_rate,
        order_total = EXCLUDED.order_total,
        product_margin = EXCLUDED.product_margin,
        commission_amount = EXCLUDED.commission_amount,
        sales_rep_commission = EXCLUDED.sales_rep_commission,
        distributor_id = EXCLUDED.distributor_id,
        distributor_commission = EXCLUDED.distributor_commission,
        commission_split_type = EXCLUDED.commission_split_type,
        updated_at = now();

      RAISE NOTICE 'Commission calculated - Total: %, Sales Rep: %, Distributor: %',
        v_commission_amount, v_sales_rep_commission, v_distributor_commission;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_calculate_commission
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_for_order();