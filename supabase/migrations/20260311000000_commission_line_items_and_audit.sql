-- ══════════════════════════════════════════════════════════════════════════════
-- Commission Line Items, Audit Visibility & Remove Default Rates
--
-- Changes:
--   1. Create commission_line_items table — one record per product per order
--   2. Remove DEFAULT 5.00 from organization_sales_reps.commission_rate
--   3. Rewrite trigger to insert per-line-item commission records with full
--      audit trail (which rule matched, effective rate, pricing model used)
--   4. Migrate existing commission margin_details into commission_line_items
--   5. Add commission_audit_log for trigger-level debug visibility
-- ══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- 1. Create commission_line_items table
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS commission_line_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id   uuid NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      integer,
  product_name    text,
  category_id     uuid,
  quantity        integer NOT NULL DEFAULT 1,
  unit_price      numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost       numeric(10,2) NOT NULL DEFAULT 0,
  retail_price    numeric(10,2),
  markup          numeric(10,2) DEFAULT 0,
  -- margin & commission
  base_margin     numeric(10,2) NOT NULL DEFAULT 0,
  item_commission numeric(10,2) NOT NULL DEFAULT 0,
  -- audit: which rule was applied
  rule_source     text NOT NULL DEFAULT 'default',
    -- Values: 'customer_product', 'customer_category', 'product', 'category',
    --         'distributor_default', 'org_default', 'wholesale'
  rule_id         uuid,  -- FK to distributor_commission_rules if applicable
  commission_type text NOT NULL DEFAULT 'percent_margin',
  commission_rate numeric(10,2) NOT NULL DEFAULT 0,
  use_customer_price boolean NOT NULL DEFAULT false,
  effective_price numeric(10,2),  -- the price used for margin calculation
  -- wholesale-specific
  wholesale_price numeric(10,2),
  spread          numeric(10,2),  -- customer_price - wholesale_price
  -- timestamps
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_line_items_commission ON commission_line_items(commission_id);
CREATE INDEX idx_commission_line_items_order ON commission_line_items(order_id);
CREATE INDEX idx_commission_line_items_product ON commission_line_items(product_id);

-- ═══════════════════════════════════════
-- 2. Remove DEFAULT from commission_rate
-- ═══════════════════════════════════════
ALTER TABLE organization_sales_reps
  ALTER COLUMN commission_rate DROP DEFAULT;

-- ═══════════════════════════════════════
-- 3. Commission audit log table
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS commission_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  commission_id   uuid REFERENCES commissions(id) ON DELETE SET NULL,
  event           text NOT NULL,  -- 'calculated', 'skipped', 'error', 'fallback_used'
  details         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_audit_log_order ON commission_audit_log(order_id);
CREATE INDEX idx_commission_audit_log_commission ON commission_audit_log(commission_id);

-- ═══════════════════════════════════════
-- 4. Migrate existing margin_details data
--    into commission_line_items
-- ═══════════════════════════════════════
INSERT INTO commission_line_items (
  commission_id, order_id, product_id, product_name, quantity,
  unit_price, unit_cost, base_margin, item_commission,
  rule_source, commission_type, commission_rate, use_customer_price,
  effective_price, wholesale_price, spread
)
SELECT
  c.id,
  c.order_id,
  (item->>'productId')::integer,
  item->>'name',
  COALESCE((item->>'quantity')::integer, 1),
  COALESCE((item->>'price')::numeric, 0),
  COALESCE((item->>'cost')::numeric, 0),
  COALESCE((item->>'margin')::numeric, 0),
  COALESCE(
    (item->>'totalCommission')::numeric,
    (item->>'commission')::numeric,
    0
  ),
  -- rule_source: infer from available data
  CASE
    WHEN item->>'wholesalePrice' IS NOT NULL THEN 'wholesale'
    WHEN item->>'ruleType' IS NOT NULL THEN 'migrated_' || (item->>'ruleType')
    ELSE 'migrated_unknown'
  END,
  COALESCE(item->>'ruleType', 'percent_margin'),
  COALESCE((item->>'ruleRate')::numeric, c.commission_rate),
  false,
  COALESCE((item->>'price')::numeric, 0),
  (item->>'wholesalePrice')::numeric,
  (item->>'spread')::numeric
FROM commissions c,
     jsonb_array_elements(c.margin_details) AS item
WHERE c.margin_details IS NOT NULL
  AND jsonb_array_length(c.margin_details) > 0;

-- ═══════════════════════════════════════
-- 5. Rewrite the commission trigger
-- ═══════════════════════════════════════
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
  v_rule_id               uuid;
  v_rule_source           text;
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
  -- per-item details
  v_margin_details        jsonb := '[]'::jsonb;
  -- fallback distributor lookup
  v_fallback_distributor_id uuid;
  v_fallback_dist_rate    numeric(5,2);
  -- audit
  v_audit_details         jsonb;
BEGIN
  -- Only calculate commission for completed orders
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- RESOLVE SALES REP
  -- ══════════════════════════════════════════════════════════════════════════
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

  -- If no sales rep found, log and skip
  IF v_resolved_sales_rep_id IS NULL THEN
    INSERT INTO commission_audit_log (order_id, event, details)
    VALUES (NEW.id, 'skipped', jsonb_build_object(
      'reason', 'no_sales_rep_found',
      'organization_id', NEW.organization_id
    ));
    RETURN NEW;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- GET COMMISSION STRUCTURE
  -- ══════════════════════════════════════════════════════════════════════════
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
    AND osr.sales_rep_id = v_resolved_sales_rep_id
    AND osr.is_active = true
  LIMIT 1;

  -- ══════════════════════════════════════════════════════════════════════════
  -- FALLBACK: No organization_sales_reps record found.
  -- Check distributor_rep_customers chain. If nothing, log and skip
  -- (NO MORE hidden 5% default).
  -- ══════════════════════════════════════════════════════════════════════════
  IF v_commission_rate IS NULL AND NEW.organization_id IS NOT NULL THEN

    SELECT drc.distributor_id, COALESCE(d.commission_rate, 0)
    INTO v_fallback_distributor_id, v_fallback_dist_rate
    FROM distributor_rep_customers drc
    JOIN distributors d ON d.id = drc.distributor_id AND d.is_active = true
    WHERE drc.organization_id = NEW.organization_id
      AND drc.sales_rep_id = v_resolved_sales_rep_id
      AND drc.is_active = true
    LIMIT 1;

    IF v_fallback_distributor_id IS NOT NULL THEN
      -- Create the missing org-rep record with proper distributor link
      INSERT INTO organization_sales_reps (
        organization_id, sales_rep_id, distributor_id, commission_rate, is_active
      ) VALUES (
        NEW.organization_id, v_resolved_sales_rep_id,
        v_fallback_distributor_id, v_fallback_dist_rate, true
      )
      ON CONFLICT (organization_id, sales_rep_id) DO UPDATE
      SET
        distributor_id = v_fallback_distributor_id,
        commission_rate = v_fallback_dist_rate,
        is_active = true,
        updated_at = now();

      -- Re-run the full structure lookup
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
        AND osr.sales_rep_id = v_resolved_sales_rep_id
        AND osr.is_active = true
      LIMIT 1;

      -- Audit: fallback was used
      INSERT INTO commission_audit_log (order_id, event, details)
      VALUES (NEW.id, 'fallback_used', jsonb_build_object(
        'source', 'distributor_rep_customers',
        'distributor_id', v_fallback_distributor_id,
        'rate', v_fallback_dist_rate
      ));

    ELSE
      -- No commission config found at all — DO NOT default to 5%
      -- Log and skip commission creation
      INSERT INTO commission_audit_log (order_id, event, details)
      VALUES (NEW.id, 'skipped', jsonb_build_object(
        'reason', 'no_commission_config',
        'sales_rep_id', v_resolved_sales_rep_id,
        'organization_id', NEW.organization_id
      ));
      RETURN NEW;
    END IF;
  END IF;

  -- If still no rate after all lookups, skip
  IF v_commission_rate IS NULL THEN
    INSERT INTO commission_audit_log (order_id, event, details)
    VALUES (NEW.id, 'skipped', jsonb_build_object(
      'reason', 'commission_rate_null_after_lookup',
      'sales_rep_id', v_resolved_sales_rep_id
    ));
    RETURN NEW;
  END IF;

  IF NEW.items IS NOT NULL THEN

    -- ════════════════════════════════════════════════════════════════════════
    -- WHOLESALE PRICING MODEL
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

        SELECT dpp.wholesale_price INTO v_wholesale_price
          FROM distributor_product_pricing dpp
         WHERE dpp.distributor_id = v_distributor_id
           AND dpp.product_id = v_item_product_id
           AND dpp.is_active = true;

        IF v_wholesale_price IS NOT NULL THEN
          v_item_commission := (v_item_price - v_wholesale_price) * v_item_quantity;
          IF v_item_commission < 0 THEN
            v_item_commission := 0;
          END IF;
          v_base_margin := (v_wholesale_price - v_item_cost) * v_item_quantity;
        ELSE
          v_item_commission := 0;
          v_base_margin := 0;
        END IF;

        IF v_item_markup > 0 THEN
          v_item_commission := v_item_commission + (v_item_markup * v_item_quantity);
        END IF;

        IF v_base_margin < 0 THEN
          v_base_margin := 0;
        END IF;
        v_total_margin := v_total_margin + v_base_margin;
        v_commission_amount := v_commission_amount + v_item_commission;

        v_margin_details := v_margin_details || jsonb_build_object(
          'productId', v_item->>'productId',
          'name', v_item->>'name',
          'price', v_item_price,
          'cost', v_item_cost,
          'quantity', v_item_quantity,
          'margin', v_base_margin,
          'wholesalePrice', COALESCE(v_wholesale_price, 0),
          'spread', v_item_commission,
          'totalCommission', v_item_commission,
          'ruleSource', 'wholesale',
          'commissionType', 'wholesale',
          'commissionRate', 0,
          'markup', v_item_markup
        );
      END LOOP;

    -- ════════════════════════════════════════════════════════════════════════
    -- MARGIN SPLIT PRICING MODEL
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

        SELECT category_id INTO v_item_category_id
          FROM products WHERE id = v_item_product_id;

        -- Determine effective commission rule for this item
        v_rule_type           := NULL;
        v_rule_rate           := NULL;
        v_rule_use_cust_price := NULL;
        v_rule_id             := NULL;
        v_rule_source         := 'default';

        IF v_distributor_id IS NOT NULL THEN

          -- 1. Customer + Product rule
          SELECT id, commission_type, commission_rate, use_customer_price
            INTO v_rule_id, v_rule_type, v_rule_rate, v_rule_use_cust_price
            FROM distributor_commission_rules
           WHERE distributor_id = v_distributor_id
             AND organization_id = NEW.organization_id
             AND scope = 'product'
             AND product_id = v_item_product_id
             AND is_active = true
           LIMIT 1;

          IF v_rule_type IS NOT NULL THEN
            v_rule_source := 'customer_product';
          END IF;

          -- 2. Customer + Category rule
          IF v_rule_type IS NULL AND v_item_category_id IS NOT NULL THEN
            SELECT id, commission_type, commission_rate, use_customer_price
              INTO v_rule_id, v_rule_type, v_rule_rate, v_rule_use_cust_price
              FROM distributor_commission_rules
             WHERE distributor_id = v_distributor_id
               AND organization_id = NEW.organization_id
               AND scope = 'category'
               AND category_id = v_item_category_id
               AND is_active = true
             LIMIT 1;

            IF v_rule_type IS NOT NULL THEN
              v_rule_source := 'customer_category';
            END IF;
          END IF;

          -- 3. Product-only rule
          IF v_rule_type IS NULL THEN
            SELECT id, commission_type, commission_rate, use_customer_price
              INTO v_rule_id, v_rule_type, v_rule_rate, v_rule_use_cust_price
              FROM distributor_commission_rules
             WHERE distributor_id = v_distributor_id
               AND organization_id IS NULL
               AND scope = 'product'
               AND product_id = v_item_product_id
               AND is_active = true
             LIMIT 1;

            IF v_rule_type IS NOT NULL THEN
              v_rule_source := 'product';
            END IF;
          END IF;

          -- 4. Category-only rule
          IF v_rule_type IS NULL AND v_item_category_id IS NOT NULL THEN
            SELECT id, commission_type, commission_rate, use_customer_price
              INTO v_rule_id, v_rule_type, v_rule_rate, v_rule_use_cust_price
              FROM distributor_commission_rules
             WHERE distributor_id = v_distributor_id
               AND organization_id IS NULL
               AND scope = 'category'
               AND category_id = v_item_category_id
               AND is_active = true
             LIMIT 1;

            IF v_rule_type IS NOT NULL THEN
              v_rule_source := 'category';
            END IF;
          END IF;

        END IF;

        -- 5. Fall back to distributor / org default
        IF v_rule_type IS NULL THEN
          IF v_distributor_id IS NOT NULL THEN
            v_rule_type           := v_base_dist_type;
            v_rule_rate           := v_base_distributor_rate;
            v_rule_use_cust_price := v_use_customer_price;
            v_rule_source         := 'distributor_default';
          ELSE
            v_rule_type           := 'percent_margin';
            v_rule_rate           := v_commission_rate;
            v_rule_use_cust_price := false;
            v_rule_source         := 'org_default';
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

        IF v_item_markup > 0 THEN
          v_item_commission := v_item_commission + (v_item_markup * v_item_quantity);
        END IF;

        v_commission_amount := v_commission_amount + v_item_commission;

        v_margin_details := v_margin_details || jsonb_build_object(
          'productId', v_item->>'productId',
          'name', v_item->>'name',
          'price', v_item_price,
          'cost', v_item_cost,
          'quantity', v_item_quantity,
          'margin', v_base_margin,
          'ruleType', v_rule_type,
          'ruleRate', v_rule_rate,
          'ruleSource', v_rule_source,
          'ruleId', v_rule_id,
          'commission', v_item_commission,
          'totalCommission', v_item_commission,
          'effectivePrice', v_effective_price,
          'useCustomerPrice', COALESCE(v_rule_use_cust_price, false),
          'markup', v_item_markup
        );
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
    IF v_distributor_id IS NOT NULL THEN
      IF v_pricing_model = 'wholesale' THEN
        v_sales_rep_commission   := v_commission_amount * (v_sales_rep_rate / 100);
        v_distributor_commission := v_commission_amount - v_sales_rep_commission;
      ELSIF v_commission_split_type = 'percentage_of_distributor' THEN
        v_sales_rep_commission  := v_commission_amount * (v_sales_rep_rate / 100);
        v_distributor_commission := v_commission_amount - v_sales_rep_commission;
      ELSIF v_commission_split_type = 'fixed_with_override' THEN
        v_sales_rep_commission   := v_total_margin * (v_sales_rep_rate / 100);
        v_distributor_commission := v_total_margin * (v_distributor_override_rate / 100);
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
    -- Company Rep payout
    -- ════════════════════════════════════════════════════════════════════════
    IF v_company_rep_id IS NOT NULL AND v_company_rep_rate > 0 THEN
      IF v_pricing_model = 'wholesale' THEN
        v_company_rep_commission := v_total_margin * (v_company_rep_rate / 100);
      ELSE
        v_your_margin := v_total_margin - v_distributor_commission;
        IF v_your_margin < 0 THEN
          v_your_margin := 0;
        END IF;
        v_company_rep_commission := v_your_margin * (v_company_rep_rate / 100);
      END IF;
    END IF;

    -- ════════════════════════════════════════════════════════════════════════
    -- Upsert commission record
    -- ════════════════════════════════════════════════════════════════════════
    INSERT INTO commissions (
      order_id, sales_rep_id, organization_id, distributor_id,
      order_total, product_margin, margin_details, commission_rate,
      commission_amount, sales_rep_commission, distributor_commission,
      company_rep_commission, company_rep_id,
      commission_split_type, status
    ) VALUES (
      NEW.id, v_resolved_sales_rep_id, NEW.organization_id, v_distributor_id,
      NEW.total, v_total_margin, v_margin_details, v_commission_rate,
      v_commission_amount, v_sales_rep_commission, v_distributor_commission,
      v_company_rep_commission, v_company_rep_id,
      v_commission_split_type, 'pending'
    )
    ON CONFLICT (order_id) DO UPDATE
    SET
      sales_rep_id           = EXCLUDED.sales_rep_id,
      commission_rate        = EXCLUDED.commission_rate,
      commission_amount      = EXCLUDED.commission_amount,
      product_margin         = EXCLUDED.product_margin,
      margin_details         = EXCLUDED.margin_details,
      sales_rep_commission   = EXCLUDED.sales_rep_commission,
      distributor_commission = EXCLUDED.distributor_commission,
      company_rep_commission = EXCLUDED.company_rep_commission,
      company_rep_id         = EXCLUDED.company_rep_id,
      commission_split_type  = EXCLUDED.commission_split_type,
      distributor_id         = EXCLUDED.distributor_id,
      updated_at             = now()
    RETURNING id INTO v_commission_id;

    -- ════════════════════════════════════════════════════════════════════════
    -- Insert per-line-item commission records
    -- ════════════════════════════════════════════════════════════════════════
    -- Delete old line items for this commission (recalculation case)
    DELETE FROM commission_line_items WHERE commission_id = v_commission_id;

    -- Insert new line items from margin_details
    INSERT INTO commission_line_items (
      commission_id, order_id, product_id, product_name, category_id,
      quantity, unit_price, unit_cost, retail_price, markup,
      base_margin, item_commission,
      rule_source, rule_id, commission_type, commission_rate,
      use_customer_price, effective_price, wholesale_price, spread
    )
    SELECT
      v_commission_id,
      NEW.id,
      (item->>'productId')::integer,
      item->>'name',
      (SELECT category_id FROM products WHERE id = (item->>'productId')::integer),
      COALESCE((item->>'quantity')::integer, 1),
      COALESCE((item->>'price')::numeric, 0),
      COALESCE((item->>'cost')::numeric, 0),
      (item->>'retailPrice')::numeric,
      COALESCE((item->>'markup')::numeric, 0),
      COALESCE((item->>'margin')::numeric, 0),
      COALESCE((item->>'totalCommission')::numeric, 0),
      COALESCE(item->>'ruleSource', 'default'),
      (item->>'ruleId')::uuid,
      COALESCE(item->>'ruleType', item->>'commissionType', 'percent_margin'),
      COALESCE((item->>'ruleRate')::numeric, (item->>'commissionRate')::numeric, 0),
      COALESCE((item->>'useCustomerPrice')::boolean, false),
      (item->>'effectivePrice')::numeric,
      (item->>'wholesalePrice')::numeric,
      (item->>'spread')::numeric
    FROM jsonb_array_elements(v_margin_details) AS item;

    -- ════════════════════════════════════════════════════════════════════════
    -- Audit log
    -- ════════════════════════════════════════════════════════════════════════
    v_audit_details := jsonb_build_object(
      'sales_rep_id', v_resolved_sales_rep_id,
      'distributor_id', v_distributor_id,
      'pricing_model', v_pricing_model,
      'commission_rate', v_commission_rate,
      'commission_split_type', v_commission_split_type,
      'sales_rep_rate', v_sales_rep_rate,
      'distributor_override_rate', v_distributor_override_rate,
      'total_margin', v_total_margin,
      'commission_amount', v_commission_amount,
      'sales_rep_commission', v_sales_rep_commission,
      'distributor_commission', v_distributor_commission,
      'company_rep_commission', v_company_rep_commission,
      'company_rep_id', v_company_rep_id,
      'line_item_count', jsonb_array_length(v_margin_details)
    );

    INSERT INTO commission_audit_log (order_id, commission_id, event, details)
    VALUES (NEW.id, v_commission_id, 'calculated', v_audit_details);

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
  'Calculates commission when an order is completed. Creates per-line-item '
  'commission records in commission_line_items. Resolves sales rep from order '
  'or organization_sales_reps. Falls back through distributor_rep_customers '
  'chain. Does NOT default to 5% — requires explicit commission configuration. '
  'Logs all decisions to commission_audit_log for transparency.';

-- ═══════════════════════════════════════
-- 6. RLS policies for new tables
-- ═══════════════════════════════════════
ALTER TABLE commission_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_audit_log ENABLE ROW LEVEL SECURITY;

-- commission_line_items: same access as commissions
CREATE POLICY "Admins can manage commission line items"
  ON commission_line_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Sales reps can view own commission line items"
  ON commission_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM commissions c
      WHERE c.id = commission_line_items.commission_id
        AND c.sales_rep_id = auth.uid()
    )
  );

CREATE POLICY "Distributors can view own commission line items"
  ON commission_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM commissions c
      JOIN distributors d ON d.id = c.distributor_id
      WHERE c.id = commission_line_items.commission_id
        AND d.profile_id = auth.uid()
    )
  );

-- commission_audit_log: admin only
CREATE POLICY "Admins can view commission audit log"
  ON commission_audit_log FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
