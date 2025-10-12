/*
  # Update Commission Calculation for Markup Pricing

  1. Commission Model
    - Base commission: commission_rate% of (retail_price - cost)
    - Markup commission: 100% of (markup_price - retail_price)
    - Total commission = base_commission + markup_commission

  2. Order Items Format
    - Each item should include:
      - price: The price customer pays (could be markup_price or retail_price)
      - retail_price: Normal retail price from BigCommerce
      - cost: Product cost
      - has_markup: Boolean indicating if markup was applied
      - markup_amount: (price - retail_price) if has_markup

  3. Commission Calculation
    - For items without markup: commission_rate% × (retail_price - cost) × quantity
    - For items with markup: [commission_rate% × (retail_price - cost) × quantity] + [markup_amount × quantity]
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_calculate_commission ON orders;
DROP FUNCTION IF EXISTS calculate_commission_for_order();

-- Create updated commission calculation function
CREATE OR REPLACE FUNCTION calculate_commission_for_order()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate numeric(5,2);
  v_commission_amount numeric(10,2) := 0;
  v_commission_id uuid;
  v_product_margin numeric(10,2) := 0;
  v_margin_details jsonb := '[]'::jsonb;
  v_item jsonb;
  v_item_margin numeric(10,2);
  v_item_cost numeric(10,2);
  v_item_price numeric(10,2);
  v_item_retail_price numeric(10,2);
  v_item_quantity integer;
  v_has_markup boolean;
  v_markup_amount numeric(10,2);
  v_base_margin numeric(10,2);
  v_base_commission numeric(10,2);
  v_markup_commission numeric(10,2);
  v_total_item_commission numeric(10,2);
BEGIN
  -- Only process when order is marked as completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Must have both organization and sales rep
    IF NEW.organization_id IS NOT NULL AND NEW.sales_rep_id IS NOT NULL THEN
      
      -- Get commission rate for this sales rep and organization
      SELECT commission_rate INTO v_commission_rate
      FROM organization_sales_reps
      WHERE organization_id = NEW.organization_id
        AND sales_rep_id = NEW.sales_rep_id
        AND is_active = true;

      IF v_commission_rate IS NOT NULL THEN
        -- Calculate commission from items
        -- Items format: [{"productId": 123, "name": "X", "price": 150, "retailPrice": 100, "cost": 60, "quantity": 2, "hasMarkup": true}]
        IF NEW.items IS NOT NULL THEN
          FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
          LOOP
            v_item_price := COALESCE((v_item->>'price')::numeric, 0);
            v_item_retail_price := COALESCE((v_item->>'retailPrice')::numeric, v_item_price);
            v_item_cost := COALESCE((v_item->>'cost')::numeric, 0);
            v_item_quantity := COALESCE((v_item->>'quantity')::integer, 1);
            v_has_markup := COALESCE((v_item->>'hasMarkup')::boolean, false);
            
            -- Calculate base margin: (retail_price - cost) × quantity
            v_base_margin := (v_item_retail_price - v_item_cost) * v_item_quantity;
            
            -- Calculate base commission: commission_rate% of base margin
            v_base_commission := v_base_margin * (v_commission_rate / 100);
            
            IF v_has_markup THEN
              -- Calculate markup amount per unit
              v_markup_amount := (v_item_price - v_item_retail_price) * v_item_quantity;
              
              -- Sales rep gets 100% of markup
              v_markup_commission := v_markup_amount;
              
              -- Total commission for this item
              v_total_item_commission := v_base_commission + v_markup_commission;
            ELSE
              v_markup_amount := 0;
              v_markup_commission := 0;
              v_total_item_commission := v_base_commission;
            END IF;
            
            -- Accumulate total margin and commission
            v_item_margin := v_base_margin + COALESCE(v_markup_amount, 0);
            v_product_margin := v_product_margin + v_item_margin;
            v_commission_amount := v_commission_amount + v_total_item_commission;
            
            -- Store details for transparency
            v_margin_details := v_margin_details || jsonb_build_object(
              'productId', v_item->>'productId',
              'name', v_item->>'name',
              'price', v_item_price,
              'retailPrice', v_item_retail_price,
              'cost', v_item_cost,
              'quantity', v_item_quantity,
              'hasMarkup', v_has_markup,
              'baseMargin', v_base_margin,
              'markupAmount', v_markup_amount,
              'baseCommission', v_base_commission,
              'markupCommission', v_markup_commission,
              'totalCommission', v_total_item_commission,
              'margin', v_item_margin
            );
          END LOOP;
        END IF;

        -- Create commission record
        INSERT INTO commissions (
          order_id,
          sales_rep_id,
          organization_id,
          order_total,
          product_margin,
          margin_details,
          commission_rate,
          commission_amount,
          status
        ) VALUES (
          NEW.id,
          NEW.sales_rep_id,
          NEW.organization_id,
          NEW.total,
          v_product_margin,
          v_margin_details,
          v_commission_rate,
          v_commission_amount,
          'pending'
        ) RETURNING id INTO v_commission_id;

        NEW.commission_id := v_commission_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_calculate_commission
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_for_order();

-- Add helpful comment
COMMENT ON FUNCTION calculate_commission_for_order IS 'Calculates commission with two components: base commission (rate% of retail-cost margin) + markup commission (100% of markup above retail)';
