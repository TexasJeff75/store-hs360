import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LineItem {
  product_id: number;
  quantity: number;
}

interface CreateCartRequest {
  line_items: LineItem[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const BC_STORE_HASH = Deno.env.get("VITE_BC_STORE_HASH");
    const BC_ACCESS_TOKEN = Deno.env.get("BC_ACCESS_TOKEN");

    if (!BC_STORE_HASH || !BC_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "BigCommerce credentials not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: CreateCartRequest = await req.json();

    if (!body.line_items || body.line_items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No items provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Creating cart with items:", body.line_items);

    const cartResponse = await fetch(
      `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3/carts`,
      {
        method: "POST",
        headers: {
          "X-Auth-Token": BC_ACCESS_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          line_items: body.line_items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        }),
      }
    );

    const cartData = await cartResponse.json();

    if (!cartResponse.ok) {
      console.error("BigCommerce cart creation failed:", cartData);
      return new Response(
        JSON.stringify({
          error: "Failed to create cart",
          details: cartData,
        }),
        {
          status: cartResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Cart created successfully:", cartData.data.id);

    const redirectUrl = cartData.data.redirect_urls?.checkout_url;

    if (!redirectUrl) {
      console.error("No redirect URL in cart response:", cartData);
      return new Response(
        JSON.stringify({
          error: "Cart created but no checkout URL returned",
          cart_id: cartData.data.id,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        cart_id: cartData.data.id,
        checkout_url: redirectUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in create-cart function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});