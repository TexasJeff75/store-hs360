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

    const mutation = `
      mutation CreateCartRedirectUrls($createCartInput: CreateCartInput!) {
        cart {
          createCart(input: $createCartInput) {
            cart {
              entityId
              redirectUrls {
                checkout_url: checkoutUrl
              }
            }
          }
        }
      }
    `;

    const variables = {
      createCartInput: {
        lineItems: body.line_items.map(item => ({
          productEntityId: item.product_id,
          quantity: item.quantity,
        })),
      },
    };

    const graphqlResponse = await fetch(
      `https://store-${BC_STORE_HASH}.mybigcommerce.com/graphql`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BC_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: mutation,
          variables: variables,
        }),
      }
    );

    const result = await graphqlResponse.json();

    if (!graphqlResponse.ok || result.errors) {
      console.error("BigCommerce GraphQL cart creation failed:", result);
      return new Response(
        JSON.stringify({
          error: "Failed to create cart",
          details: result.errors || result,
        }),
        {
          status: graphqlResponse.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cartData = result.data?.cart?.createCart?.cart;

    if (!cartData) {
      console.error("No cart data in response:", result);
      return new Response(
        JSON.stringify({
          error: "Cart creation failed - no data returned",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Cart created successfully:", cartData.entityId);

    const redirectUrl = cartData.redirectUrls?.checkout_url;

    if (!redirectUrl) {
      console.error("No redirect URL in cart response:", cartData);
      return new Response(
        JSON.stringify({
          error: "Cart created but no checkout URL returned",
          cart_id: cartData.entityId,
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
        cart_id: cartData.entityId,
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