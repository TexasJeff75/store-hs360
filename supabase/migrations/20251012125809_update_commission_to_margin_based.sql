/*
  # Update Commission System to Margin-Based Calculation

  1. Changes to Commissions Table
    - Add `product_margin` column to store total profit margin (sum of all product margins)
    - Add `margin_details` JSONB column to store detailed per-product margin calculations
    - Keep `order_total` for reference but commission is now calculated on margin

  2. Changes to Commission Calculation
    - Commission is now calculated as: commission_rate × total_product_margin
    - Each product's margin = (sale_price - cost) × quantity
    - Store detailed breakdown in margin_details for transparency

  3. Orders Table Enhancement
    - Add ability to store cost information in items JSONB array
    - Expected format: [{"productId": 123, "name": "X", "price": 100, "cost": 60, "quantity": 2, "margin": 80}]

  4. Notes
    - Existing commissions remain unchanged
    - New commission calculation will use margin-based approach
    - Product cost should be retrieved from BigCommerce or stored separately
*/

-- Add margin tracking columns to commissions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commissions' AND column_name = 'product_margin'
  ) THEN
    ALTER TABLE commissions ADD COLUMN product_margin numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commissions' AND column_name = 'margin_details'
  ) THEN
    ALTER TABLE commissions ADD COLUMN margin_details jsonb;
  END IF;
END $$;

-- Add comment to clarify new calculation method
COMMENT ON COLUMN commissions.product_margin IS 'Total profit margin from all products in the order (sum of (sale_price - cost) × quantity)';
COMMENT ON COLUMN commissions.margin_details IS 'Detailed breakdown of margin calculation per product';
COMMENT ON COLUMN commissions.commission_amount IS 'Commission calculated as commission_rate × product_margin';

-- Drop and recreate the commission calculation trigger with margin-based logic
DROP TRIGGER IF EXISTS trigger_calculate_commission ON orders;
DROP FUNCTION IF EXISTS calculate_commission_for_order();

CREATE OR REPLACE FUNCTION calculate_commission_for_order()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate numeric(5,2);
  v_commission_amount numeric(10,2);
  v_commission_id uuid;
  v_product_margin numeric(10,2) := 0;
  v_margin_details jsonb := '[]'::jsonb;
  v_item jsonb;
  v_item_margin numeric(10,2);
  v_item_cost numeric(10,2);
  v_item_price numeric(10,2);
  v_item_quantity integer;
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
        -- Calculate product margin from items
        -- Items format: [{"productId": 123, "name": "X", "price": 100, "cost": 60, "quantity": 2}]
        IF NEW.items IS NOT NULL THEN
          FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.items)
          LOOP
            v_item_price := COALESCE((v_item->>'price')::numeric, 0);
            v_item_cost := COALESCE((v_item->>'cost')::numeric, 0);
            v_item_quantity := COALESCE((v_item->>'quantity')::integer, 1);
            
            -- Calculate margin for this item: (price - cost) × quantity
            v_item_margin := (v_item_price - v_item_cost) * v_item_quantity;
            v_product_margin := v_product_margin + v_item_margin;
            
            -- Store details for transparency
            v_margin_details := v_margin_details || jsonb_build_object(
              'productId', v_item->>'productId',
              'name', v_item->>'name',
              'price', v_item_price,
              'cost', v_item_cost,
              'quantity', v_item_quantity,
              'margin', v_item_margin
            );
          END LOOP;
        END IF;

        -- Calculate commission: commission_rate × product_margin
        v_commission_amount := v_product_margin * (v_commission_rate / 100);

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

CREATE TRIGGER trigger_calculate_commission
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commission_for_order();

-- Add index for faster margin queries
CREATE INDEX IF NOT EXISTS idx_commissions_product_margin ON commissions(product_margin) WHERE product_margin > 0;