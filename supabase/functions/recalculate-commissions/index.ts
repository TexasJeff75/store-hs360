import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BC_STORE_HASH = Deno.env.get("BC_STORE_HASH");
const BC_ACCESS_TOKEN = Deno.env.get("BC_ACCESS_TOKEN");

async function getProductCost(productId: number): Promise<number> {
  try {
    console.log(`Fetching cost for product ${productId}`);
    const response = await fetch(
      `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3/catalog/products/${productId}?include=variants`,
      {
        method: "GET",
        headers: {
          "X-Auth-Token": BC_ACCESS_TOKEN!,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );

    console.log(`Response status for product ${productId}: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      const product = result.data;

      let costPrice = product.cost_price;
      console.log(`Product ${productId} base cost_price: ${costPrice}`);

      if (product.variants && product.variants.length > 0) {
        const variant = product.variants[0];
        console.log(`Product ${productId} has ${product.variants.length} variants`);
        if (variant.cost_price !== undefined && variant.cost_price !== null) {
          costPrice = variant.cost_price;
          console.log(`Using variant cost_price: ${costPrice}`);
        }
      }

      const finalCost = costPrice !== undefined && costPrice !== null ? costPrice : 0;
      console.log(`Final cost for product ${productId}: ${finalCost}`);
      return finalCost;
    } else {
      console.error(`Failed to fetch product ${productId}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error fetching cost for product ${productId}:`, error);
  }
  return 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: commissions, error: fetchError } = await supabaseClient
      .from("commissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      throw new Error(`Error fetching commissions: ${fetchError.message}`);
    }

    const results = [];

    for (const commission of commissions) {
      const marginDetails = commission.margin_details;
      if (!marginDetails || marginDetails.length === 0) {
        results.push({
          id: commission.id,
          status: "skipped",
          reason: "No margin details",
        });
        continue;
      }

      const { data: order } = await supabaseClient
        .from("orders")
        .select("items")
        .eq("id", commission.order_id)
        .single();

      const productCosts: { [key: number]: number} = {};

      if (order && order.items) {
        for (const orderItem of order.items) {
          const cost = orderItem.cost !== undefined && orderItem.cost !== null ? orderItem.cost : 0;
          productCosts[orderItem.productId] = cost;
          console.log(`Got cost from order for product ${orderItem.productId}: ${cost}`);
        }
      } else {
        const productIds = [
          ...new Set(marginDetails.map((item: any) => parseInt(item.productId))),
        ];
        for (const productId of productIds) {
          productCosts[productId] = await getProductCost(productId);
        }
      }

      let totalProductMargin = 0;
      let totalCommission = 0;
      const commissionRate = parseFloat(commission.commission_rate);

      const updatedMarginDetails = marginDetails.map((item: any) => {
        const productId = parseInt(item.productId);
        const correctCost = productCosts[productId] || 0;
        const price = parseFloat(item.price);
        const retailPrice = parseFloat(item.retailPrice || item.price);
        const quantity = parseInt(item.quantity);
        const hasMarkup = item.hasMarkup || false;

        const baseMargin = (retailPrice - correctCost) * quantity;
        const baseCommission = baseMargin * (commissionRate / 100);

        let markupAmount = 0;
        let markupCommission = 0;
        let totalItemCommission = baseCommission;

        if (hasMarkup) {
          markupAmount = (price - retailPrice) * quantity;
          markupCommission = markupAmount;
          totalItemCommission = baseCommission + markupCommission;
        }

        const itemMargin = baseMargin + markupAmount;
        totalProductMargin += itemMargin;
        totalCommission += totalItemCommission;

        return {
          productId: item.productId,
          name: item.name,
          price,
          retailPrice,
          cost: correctCost,
          quantity,
          hasMarkup,
          baseMargin: parseFloat(baseMargin.toFixed(2)),
          markupAmount: parseFloat(markupAmount.toFixed(2)),
          baseCommission: parseFloat(baseCommission.toFixed(2)),
          markupCommission: parseFloat(markupCommission.toFixed(2)),
          totalCommission: parseFloat(totalItemCommission.toFixed(2)),
          margin: parseFloat(itemMargin.toFixed(2)),
        };
      });

      const { error: updateError } = await supabaseClient
        .from("commissions")
        .update({
          product_margin: totalProductMargin.toFixed(2),
          commission_amount: totalCommission.toFixed(2),
          margin_details: updatedMarginDetails,
        })
        .eq("id", commission.id);

      if (updateError) {
        results.push({
          id: commission.id,
          status: "error",
          error: updateError.message,
        });
      } else {
        results.push({
          id: commission.id,
          status: "success",
          oldMargin: commission.product_margin,
          newMargin: totalProductMargin.toFixed(2),
          oldCommission: commission.commission_amount,
          newCommission: totalCommission.toFixed(2),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recalculated ${commissions.length} commission records`,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});