/*
  # Add Wholesale Pricing Model for Distributors

  ## Overview
  Adds a wholesale/buy-sell spread pricing model alongside the existing margin-split
  commission model. Wholesale distributors buy products at a set wholesale price,
  set their own customer prices, and keep the spread.

  ## Two Pricing Models
  - `margin_split` (default): Distributor earns X% of (customer_price − product_cost).
    This is the existing percentage-based commission model.
  - `wholesale`: Distributor buys at a per-product wholesale price and sells at their
    own customer price. Earnings = customer_price − wholesale_price.
    Your revenue = wholesale_price − product_cost.

  ## Changes
  1. Add `pricing_model` column to `distributors`
  2. Create `distributor_product_pricing` table for per-distributor wholesale prices
  3. Update `calculate_commission_for_order()` trigger to handle wholesale model
*/

-- ── 1. Add pricing_model to distributors ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributors' AND column_name = 'pricing_model'
  ) THEN
    ALTER TABLE distributors
      ADD COLUMN pricing_model text NOT NULL DEFAULT 'margin_split';
    ALTER TABLE distributors
      ADD CONSTRAINT chk_pricing_model CHECK (pricing_model IN ('margin_split', 'wholesale'));
  END IF;
END $$;

COMMENT ON COLUMN distributors.pricing_model IS
  'margin_split: distributor earns % of margin (existing model) | wholesale: distributor buys at wholesale price, earns the spread';

-- ── 2. Create distributor_product_pricing table ───────────────────────────────
CREATE TABLE IF NOT EXISTS distributor_product_pricing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id  uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  product_id      integer NOT NULL,
  wholesale_price numeric(10,2) NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, product_id),
  CONSTRAINT chk_wholesale_price_positive CHECK (wholesale_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_dpp_distributor ON distributor_product_pricing(distributor_id);
CREATE INDEX IF NOT EXISTS idx_dpp_product ON distributor_product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_dpp_active ON distributor_product_pricing(is_active) WHERE is_active = true;

-- ── RLS for distributor_product_pricing ───────────────────────────────────────
ALTER TABLE distributor_product_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage distributor product pricing"
  ON distributor_product_pricing FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Distributors can view own product pricing"
  ON distributor_product_pricing FOR SELECT
  TO authenticated
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE profile_id = auth.uid()
    )
  );

COMMENT ON TABLE distributor_product_pricing IS
  'Per-distributor wholesale prices. Used when distributor.pricing_model = wholesale.';

-- ── 3. Update commission calculation trigger ──────────────────────────────────
-- Replaces the existing function to add wholesale pricing model support.
-- For wholesale distributors, commission = customer_price − wholesale_price per item.
-- For margin_split distributors, existing behavior is preserved.

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
      COALESCE(d.pricing_model, 'margin_split')
    INTO
      v_commission_rate,
      v_distributor_id,
      v_commission_split_type,
      v_sales_rep_rate,
      v_distributor_override_rate,
      v_base_distributor_rate,
      v_base_dist_type,
      v_use_customer_price,
      v_pricing_model
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
            -- Track total margin (wholesale_price − product_cost) for reporting
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
      -- (same logic for both pricing models)
      -- ════════════════════════════════════════════════════════════════════════
      IF v_distributor_id IS NOT NULL THEN
        IF v_commission_split_type = 'percentage_of_distributor' THEN
          v_sales_rep_commission  := v_commission_amount * (v_sales_rep_rate / 100);
          v_distributor_commission := v_commission_amount - v_sales_rep_commission;
        ELSIF v_commission_split_type = 'fixed_with_override' THEN
          -- For wholesale model, fixed_with_override uses commission amount as base
          IF v_pricing_model = 'wholesale' THEN
            v_sales_rep_commission  := v_commission_amount * (v_sales_rep_rate / 100);
            v_distributor_commission := v_commission_amount * (v_distributor_override_rate / 100);
          ELSE
            v_sales_rep_commission   := v_total_margin * (v_sales_rep_rate / 100);
            v_distributor_commission := v_total_margin * (v_distributor_override_rate / 100);
          END IF;
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

      -- Create or update commission record
      INSERT INTO commissions (
        order_id, sales_rep_id, organization_id, distributor_id,
        order_total, product_margin, commission_rate,
        commission_amount, sales_rep_commission, distributor_commission,
        commission_split_type, status
      ) VALUES (
        NEW.id, NEW.sales_rep_id, NEW.organization_id, v_distributor_id,
        NEW.total, v_total_margin, v_commission_rate,
        v_commission_amount, v_sales_rep_commission, v_distributor_commission,
        v_commission_split_type, 'pending'
      )
      ON CONFLICT (order_id) DO UPDATE
      SET
        commission_rate        = EXCLUDED.commission_rate,
        commission_amount      = EXCLUDED.commission_amount,
        product_margin         = EXCLUDED.product_margin,
        sales_rep_commission   = EXCLUDED.sales_rep_commission,
        distributor_commission = EXCLUDED.distributor_commission,
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

COMMENT ON FUNCTION calculate_commission_for_order() IS
  'Calculates commission for completed orders. Supports two pricing models: '
  'margin_split (rate% of margin with per-product/category rules) and '
  'wholesale (earnings = customer_price − wholesale_price). '
  'Both models split commission between distributor and sales rep.';
