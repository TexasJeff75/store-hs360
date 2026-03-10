/*
  Fix commission trigger to resolve sales rep from organization relationship.

  Previously, the trigger required sales_rep_id to be set directly on the order.
  Now it will look up the sales rep through organization_sales_reps when
  sales_rep_id is not on the order, since the org→rep relationship already exists.

  Chain: order.organization_id → organization_sales_reps → sales_rep_id
*/

DROP TRIGGER IF EXISTS trigger_calculate_commission ON orders;
DROP FUNCTION IF EXISTS calculate_commission_for_order();

CREATE OR REPLACE FUNCTION calculate_commission_for_order()
RETURNS TRIGGER AS $$
DECLARE
  v_resolved_sales_rep_id uuid;
  v_commission_rate       numeric(10,2);
  v_total_margin          numeric(10,2) := 0;
  v_commission_amount     numeric(10,2) := 0;
  v_sales_rep_commission  numeric(10,2) := 0;
  v_distributor_commission numeric(10,2) := 0;
  v_commission_id         uuid;
  v_item                  jsonb;
  v_item_cost             numeric(10,2);
  v_item_price            numeric(10,2);
  v_item_retail_price     numeric(10,2);
  v_item_markup           numeric(10,2);
  v_item_quantity         integer;
  v_item_product_id       integer;
  v_item_category_id      uuid;
  v_base_margin           numeric(10,2);
  v_item_commission       numeric(10,2);
  v_distributor_id        uuid;
  v_commission_split_type text;
  v_sales_rep_rate        numeric(5,2);
  v_distributor_override_rate numeric(5,2);
  v_base_distributor_rate numeric(5,2);
  v_base_dist_type        text;
  v_use_customer_price    boolean;
  -- per-item rule overrides
  v_rule_type             text;
  v_rule_rate             numeric(10,2);
  v_rule_use_cust_price   boolean;
  v_effective_price       numeric(10,2);
  v_total_units           integer := 0;
BEGIN
  -- Only calculate commission for completed orders
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Resolve sales rep: use order's sales_rep_id if set,
  -- otherwise look up from organization_sales_reps via organization_id
  v_resolved_sales_rep_id := NEW.sales_rep_id;

  IF v_resolved_sales_rep_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    SELECT osr.sales_rep_id
    INTO v_resolved_sales_rep_id
    FROM organization_sales_reps osr
    WHERE osr.organization_id = NEW.organization_id
      AND osr.is_active = true
    ORDER BY osr.created_at ASC
    LIMIT 1;
  END IF;

  -- If still no sales rep found, nothing to calculate
  IF v_resolved_sales_rep_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get commission structure (distributor hierarchy aware)
  SELECT
    osr.commission_rate,
    osr.distributor_id,
    COALESCE(dsr.commission_split_type, 'none'),
    COALESCE(dsr.sales_rep_rate, 100),
    COALESCE(dsr.distributor_override_rate, 0),
    COALESCE(d.commission_rate, osr.commission_rate),
    COALESCE(d.commission_type, 'percent_margin'),
    COALESCE(d.use_customer_price, false)
  INTO
    v_commission_rate,
    v_distributor_id,
    v_commission_split_type,
    v_sales_rep_rate,
    v_distributor_override_rate,
    v_base_distributor_rate,
    v_base_dist_type,
    v_use_customer_price
  FROM organization_sales_reps osr
  LEFT JOIN distributors d ON d.id = osr.distributor_id AND d.is_active = true
  LEFT JOIN distributor_sales_reps dsr ON dsr.distributor_id = osr.distributor_id
    AND dsr.sales_rep_id = osr.sales_rep_id
    AND dsr.is_active = true
  WHERE osr.organization_id = NEW.organization_id
    AND osr.sales_rep_id = v_resolved_sales_rep_id
    AND osr.is_active = true
  LIMIT 1;

  IF v_commission_rate IS NOT NULL AND NEW.items IS NOT NULL THEN

    -- Iterate over each line-item in the order
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      v_item_cost       := COALESCE((v_item->>'cost')::numeric, 0);
      v_item_price      := COALESCE((v_item->>'price')::numeric, 0);
      v_item_retail_price := COALESCE((v_item->>'retailPrice')::numeric, v_item_price);
      v_item_markup     := COALESCE((v_item->>'markup')::numeric, 0);
      v_item_quantity   := COALESCE((v_item->>'quantity')::integer, 1);
      v_item_product_id := (v_item->>'productId')::integer;
      v_total_units     := v_total_units + v_item_quantity;

      -- Look up the product's category (needed for category-level rules)
      SELECT category_id INTO v_item_category_id
        FROM products WHERE id = v_item_product_id;

      -- Determine effective commission rule for this item.
      -- Priority: customer+product > customer+category > product > category > default
      v_rule_type           := NULL;
      v_rule_rate           := NULL;
      v_rule_use_cust_price := NULL;

      IF v_distributor_id IS NOT NULL THEN

        -- 1. Customer + Product rule
        SELECT commission_type, commission_rate, use_customer_price
          INTO v_rule_type, v_rule_rate, v_rule_use_cust_price
          FROM distributor_commission_rules
         WHERE distributor_id = v_distributor_id
           AND organization_id = NEW.organization_id
           AND scope = 'product'
           AND product_id = v_item_product_id
           AND is_active = true
         LIMIT 1;

        -- 2. Customer + Category rule
        IF v_rule_type IS NULL AND v_item_category_id IS NOT NULL THEN
          SELECT commission_type, commission_rate, use_customer_price
            INTO v_rule_type, v_rule_rate, v_rule_use_cust_price
            FROM distributor_commission_rules
           WHERE distributor_id = v_distributor_id
             AND organization_id = NEW.organization_id
             AND scope = 'category'
             AND category_id = v_item_category_id
             AND is_active = true
           LIMIT 1;
        END IF;

        -- 3. Product-only rule (any customer)
        IF v_rule_type IS NULL THEN
          SELECT commission_type, commission_rate, use_customer_price
            INTO v_rule_type, v_rule_rate, v_rule_use_cust_price
            FROM distributor_commission_rules
           WHERE distributor_id = v_distributor_id
             AND organization_id IS NULL
             AND scope = 'product'
             AND product_id = v_item_product_id
             AND is_active = true
           LIMIT 1;
        END IF;

        -- 4. Category-only rule (any customer)
        IF v_rule_type IS NULL AND v_item_category_id IS NOT NULL THEN
          SELECT commission_type, commission_rate, use_customer_price
            INTO v_rule_type, v_rule_rate, v_rule_use_cust_price
            FROM distributor_commission_rules
           WHERE distributor_id = v_distributor_id
             AND organization_id IS NULL
             AND scope = 'category'
             AND category_id = v_item_category_id
             AND is_active = true
           LIMIT 1;
        END IF;

      END IF;

      -- 5. Fall back to distributor / org default
      IF v_rule_type IS NULL THEN
        IF v_distributor_id IS NOT NULL THEN
          v_rule_type           := v_base_dist_type;
          v_rule_rate           := v_base_distributor_rate;
          v_rule_use_cust_price := v_use_customer_price;
        ELSE
          v_rule_type           := 'percent_margin';
          v_rule_rate           := v_commission_rate;
          v_rule_use_cust_price := false;
        END IF;
      END IF;

      -- Decide which price to use for margin
      IF v_rule_use_cust_price THEN
        v_effective_price := v_item_price;
      ELSE
        v_effective_price := v_item_retail_price;
      END IF;

      v_base_margin := (v_effective_price - v_item_cost) * v_item_quantity;
      IF v_base_margin < 0 THEN
        v_base_margin := 0;
      END IF;
      v_total_margin := v_total_margin + v_base_margin;

      -- Calculate commission for this item based on the effective rule
      CASE v_rule_type
        WHEN 'percent_margin' THEN
          v_item_commission := v_base_margin * (v_rule_rate / 100);
        WHEN 'percent_gross_sales' THEN
          v_item_commission := (v_item_price * v_item_quantity) * (v_rule_rate / 100);
        WHEN 'percent_net_sales' THEN
          v_item_commission := (v_item_price * v_item_quantity) * (v_rule_rate / 100);
        WHEN 'flat_per_order' THEN
          v_item_commission := 0;
        WHEN 'flat_per_unit' THEN
          v_item_commission := v_rule_rate * v_item_quantity;
        ELSE
          v_item_commission := 0;
      END CASE;

      -- Add markup commission (100% of markup always goes into pool)
      IF v_item_markup > 0 THEN
        v_item_commission := v_item_commission + (v_item_markup * v_item_quantity);
      END IF;

      v_commission_amount := v_commission_amount + v_item_commission;
    END LOOP;

    -- Handle flat_per_order
    IF v_base_dist_type = 'flat_per_order' AND v_distributor_id IS NOT NULL THEN
      IF v_commission_amount = 0 THEN
        v_commission_amount := v_base_distributor_rate;
      END IF;
    ELSIF v_rule_type = 'flat_per_order' AND v_distributor_id IS NULL THEN
      v_commission_amount := v_commission_rate;
    END IF;

    -- Calculate split between sales rep and distributor
    IF v_distributor_id IS NOT NULL THEN
      IF v_commission_split_type = 'percentage_of_distributor' THEN
        v_sales_rep_commission  := v_commission_amount * (v_sales_rep_rate / 100);
        v_distributor_commission := v_commission_amount - v_sales_rep_commission;
      ELSIF v_commission_split_type = 'fixed_with_override' THEN
        v_sales_rep_commission   := v_total_margin * (v_sales_rep_rate / 100);
        v_distributor_commission := v_total_margin * (v_distributor_override_rate / 100);
        -- Add markup commission to sales rep
        IF NEW.items IS NOT NULL THEN
          FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
          LOOP
            v_item_markup   := COALESCE((v_item->>'markup')::numeric, 0);
            v_item_quantity := COALESCE((v_item->>'quantity')::integer, 1);
            IF v_item_markup > 0 THEN
              v_sales_rep_commission := v_sales_rep_commission + (v_item_markup * v_item_quantity);
            END IF;
          END LOOP;
        END IF;
        v_commission_amount := v_sales_rep_commission + v_distributor_commission;
      ELSE
        v_sales_rep_commission  := v_commission_amount;
        v_distributor_commission := 0;
      END IF;
    ELSE
      v_sales_rep_commission  := v_commission_amount;
      v_distributor_commission := 0;
    END IF;

    -- Create or update commission record using the resolved sales rep
    INSERT INTO commissions (
      order_id, sales_rep_id, organization_id, distributor_id,
      order_total, product_margin, commission_rate,
      commission_amount, sales_rep_commission, distributor_commission,
      commission_split_type, status
    ) VALUES (
      NEW.id, v_resolved_sales_rep_id, NEW.organization_id, v_distributor_id,
      NEW.total, v_total_margin, v_commission_rate,
      v_commission_amount, v_sales_rep_commission, v_distributor_commission,
      v_commission_split_type, 'pending'
    )
    ON CONFLICT (order_id) DO UPDATE
    SET
      sales_rep_id           = EXCLUDED.sales_rep_id,
      commission_rate        = EXCLUDED.commission_rate,
      commission_amount      = EXCLUDED.commission_amount,
      product_margin         = EXCLUDED.product_margin,
      sales_rep_commission   = EXCLUDED.sales_rep_commission,
      distributor_commission = EXCLUDED.distributor_commission,
      commission_split_type  = EXCLUDED.commission_split_type,
      distributor_id         = EXCLUDED.distributor_id,
      updated_at             = now();

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_calculate_commission
  AFTER INSERT OR UPDATE OF status, sales_rep_id, items, total
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_for_order();

COMMENT ON FUNCTION calculate_commission_for_order() IS
  'Calculates commission for completed orders. Resolves sales rep from '
  'organization_sales_reps when not directly set on the order. Supports '
  'per-product, per-category, and per-customer commission rules. '
  'Priority: customer+product > customer+category > product > category > default.';
