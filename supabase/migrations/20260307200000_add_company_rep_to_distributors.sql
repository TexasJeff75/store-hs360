/*
  # Add Company Rep to Distributors

  Adds the ability to assign one of YOUR sales reps to oversee a distributor.
  This is separate from the distributor's own sales reps.

  The company rep earns a percentage of YOUR margin on every order that flows
  through the distributor:
  - For wholesale distributors: % of (wholesale_price − product_cost)
  - For margin_split distributors: % of (your share of the margin)

  ## Columns
  - company_rep_id: the profile ID of your sales person overseeing this distributor
  - company_rep_rate: the percentage of your margin they earn (e.g., 40 = 40%)
*/

-- ── Add company_rep_id and company_rep_rate to distributors ────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributors' AND column_name = 'company_rep_id'
  ) THEN
    ALTER TABLE distributors
      ADD COLUMN company_rep_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
      ADD COLUMN company_rep_rate numeric(5,2) NOT NULL DEFAULT 0;
    ALTER TABLE distributors
      ADD CONSTRAINT chk_company_rep_rate CHECK (company_rep_rate >= 0 AND company_rep_rate <= 100);
  END IF;
END $$;

COMMENT ON COLUMN distributors.company_rep_id IS
  'Your sales person who oversees this distributor. Earns company_rep_rate% of your margin.';
COMMENT ON COLUMN distributors.company_rep_rate IS
  'Percentage of YOUR margin (wholesale_price − product_cost) paid to the company rep.';

-- ── Update commission trigger to include company rep payout ────────────────
DROP TRIGGER IF EXISTS trigger_calculate_commission ON orders;
DROP FUNCTION IF EXISTS calculate_commission_for_order();

CREATE OR REPLACE FUNCTION calculate_commission_for_order()
RETURNS TRIGGER AS $$
DECLARE
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
  -- wholesale pricing
  v_pricing_model         text;
  v_wholesale_price       numeric(10,2);
  -- company rep
  v_company_rep_id        uuid;
  v_company_rep_rate      numeric(5,2);
  v_company_rep_commission numeric(10,2) := 0;
  v_your_margin           numeric(10,2) := 0;
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
      COALESCE(d.commission_rate, osr.commission_rate),
      COALESCE(d.commission_type, 'percent_margin'),
      COALESCE(d.use_customer_price, false),
      COALESCE(d.pricing_model, 'margin_split'),
      d.company_rep_id,
      COALESCE(d.company_rep_rate, 0)
    INTO
      v_commission_rate,
      v_distributor_id,
      v_commission_split_type,
      v_sales_rep_rate,
      v_distributor_override_rate,
      v_base_distributor_rate,
      v_base_dist_type,
      v_use_customer_price,
      v_pricing_model,
      v_company_rep_id,
      v_company_rep_rate
    FROM organization_sales_reps osr
    LEFT JOIN distributors d ON d.id = osr.distributor_id AND d.is_active = true
    LEFT JOIN distributor_sales_reps dsr ON dsr.distributor_id = osr.distributor_id
      AND dsr.sales_rep_id = osr.sales_rep_id
      AND dsr.is_active = true
    WHERE osr.organization_id = NEW.organization_id
      AND osr.sales_rep_id = NEW.sales_rep_id
      AND osr.is_active = true
    LIMIT 1;

    IF v_commission_rate IS NOT NULL AND NEW.items IS NOT NULL THEN

      -- ════════════════════════════════════════════════════════════════════════
      -- WHOLESALE PRICING MODEL
      -- Commission = customer_price − wholesale_price per item
      -- ════════════════════════════════════════════════════════════════════════
      IF v_pricing_model = 'wholesale' AND v_distributor_id IS NOT NULL THEN

        FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
          v_item_price      := COALESCE((v_item->>'price')::numeric, 0);
          v_item_cost       := COALESCE((v_item->>'cost')::numeric, 0);
          v_item_quantity   := COALESCE((v_item->>'quantity')::integer, 1);
          v_item_product_id := (v_item->>'productId')::integer;
          v_item_markup     := COALESCE((v_item->>'markup')::numeric, 0);
          v_total_units     := v_total_units + v_item_quantity;

          -- Look up wholesale price for this product
          SELECT dpp.wholesale_price INTO v_wholesale_price
            FROM distributor_product_pricing dpp
           WHERE dpp.distributor_id = v_distributor_id
             AND dpp.product_id = v_item_product_id
             AND dpp.is_active = true;

          IF v_wholesale_price IS NOT NULL THEN
            -- Distributor earnings = customer price − wholesale price
            v_item_commission := (v_item_price - v_wholesale_price) * v_item_quantity;
            IF v_item_commission < 0 THEN
              v_item_commission := 0;
            END IF;
            -- YOUR margin = wholesale_price − product_cost
            v_base_margin := (v_wholesale_price - v_item_cost) * v_item_quantity;
          ELSE
            -- No wholesale price set for this product — no commission
            v_item_commission := 0;
            v_base_margin := 0;
          END IF;

          -- Add markup commission (100% of markup always goes into pool)
          IF v_item_markup > 0 THEN
            v_item_commission := v_item_commission + (v_item_markup * v_item_quantity);
          END IF;

          IF v_base_margin < 0 THEN
            v_base_margin := 0;
          END IF;
          v_total_margin := v_total_margin + v_base_margin;
          v_commission_amount := v_commission_amount + v_item_commission;
        END LOOP;

      -- ════════════════════════════════════════════════════════════════════════
      -- MARGIN SPLIT PRICING MODEL (existing behavior)
      -- Commission = rate% × margin per item, with per-product/category rules
      -- ════════════════════════════════════════════════════════════════════════
      ELSE

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

      END IF; -- end pricing model branch

      -- ════════════════════════════════════════════════════════════════════════
      -- Split commission between sales rep and distributor
      -- ════════════════════════════════════════════════════════════════════════
      -- For WHOLESALE distributors:
      --   v_commission_amount = distributor's spread (customer_price − wholesale_price)
      --   v_total_margin      = YOUR margin (wholesale_price − product_cost)
      --   The distributor keeps their full spread (v_commission_amount).
      --   The sales person earns a % of YOUR margin (v_total_margin).
      --   These are independent — sales person commission does NOT reduce distributor spread.
      --
      -- For MARGIN_SPLIT distributors:
      --   Existing split logic applies (percentage_of_distributor or fixed_with_override).
      -- ════════════════════════════════════════════════════════════════════════
      IF v_distributor_id IS NOT NULL THEN
        IF v_pricing_model = 'wholesale' THEN
          -- Wholesale: distributor keeps full spread, sales person gets % of YOUR margin
          v_distributor_commission := v_commission_amount;  -- full spread
          v_sales_rep_commission   := v_total_margin * (v_sales_rep_rate / 100);
          -- Total tracked commission = distributor spread + sales rep share of your margin
          v_commission_amount      := v_distributor_commission + v_sales_rep_commission;
        ELSIF v_commission_split_type = 'percentage_of_distributor' THEN
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

      -- ════════════════════════════════════════════════════════════════════════
      -- Company Rep payout (your sales person who oversees the distributor)
      -- Earns company_rep_rate% of YOUR margin. This is independent of the
      -- distributor's commission and the distributor's sales reps.
      -- ════════════════════════════════════════════════════════════════════════
      IF v_company_rep_id IS NOT NULL AND v_company_rep_rate > 0 THEN
        IF v_pricing_model = 'wholesale' THEN
          -- For wholesale: your margin = wholesale_price − product_cost = v_total_margin
          v_company_rep_commission := v_total_margin * (v_company_rep_rate / 100);
        ELSE
          -- For margin_split: your share = total_margin − distributor_commission
          v_your_margin := v_total_margin - v_distributor_commission;
          IF v_your_margin < 0 THEN
            v_your_margin := 0;
          END IF;
          v_company_rep_commission := v_your_margin * (v_company_rep_rate / 100);
        END IF;
      END IF;

      -- Create or update commission record
      INSERT INTO commissions (
        order_id, sales_rep_id, organization_id, distributor_id,
        order_total, product_margin, commission_rate,
        commission_amount, sales_rep_commission, distributor_commission,
        company_rep_commission, company_rep_id,
        commission_split_type, status
      ) VALUES (
        NEW.id, NEW.sales_rep_id, NEW.organization_id, v_distributor_id,
        NEW.total, v_total_margin, v_commission_rate,
        v_commission_amount, v_sales_rep_commission, v_distributor_commission,
        v_company_rep_commission, v_company_rep_id,
        v_commission_split_type, 'pending'
      )
      ON CONFLICT (order_id) DO UPDATE
      SET
        commission_rate        = EXCLUDED.commission_rate,
        commission_amount      = EXCLUDED.commission_amount,
        product_margin         = EXCLUDED.product_margin,
        sales_rep_commission   = EXCLUDED.sales_rep_commission,
        distributor_commission = EXCLUDED.distributor_commission,
        company_rep_commission = EXCLUDED.company_rep_commission,
        company_rep_id         = EXCLUDED.company_rep_id,
        commission_split_type  = EXCLUDED.commission_split_type,
        distributor_id         = EXCLUDED.distributor_id,
        updated_at             = now();

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_calculate_commission
  AFTER INSERT OR UPDATE OF status, sales_rep_id, items, total
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_for_order();

-- ── Add company_rep columns to commissions table ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commissions' AND column_name = 'company_rep_commission'
  ) THEN
    ALTER TABLE commissions
      ADD COLUMN company_rep_commission numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN company_rep_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN commissions.company_rep_commission IS
  'Amount earned by the company rep who oversees this distributor. % of your margin.';
COMMENT ON COLUMN commissions.company_rep_id IS
  'The company rep who earned company_rep_commission on this order.';
