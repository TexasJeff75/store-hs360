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
  store_hash: string;
  storefront_token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: CreateCartRequest = await req.json();

    const BC_STORE_HASH = body.store_hash;
    const BC_STOREFRONT_TOKEN = body.storefront_token;

    if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "BigCommerce credentials not provided",
          debug: {
            hasStoreHash: !!BC_STORE_HASH,
            hasToken: !!BC_STOREFRONT_TOKEN,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const BC_STORE_URL = `https://store-${BC_STORE_HASH}.mybigcommerce.com`;

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
      mutation CreateCart($createCartInput: CreateCartInput!) {
        cart {
          createCart(input: $createCartInput) {
            cart {
              entityId
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

    const graphqlEndpoint = `${BC_STORE_URL}/graphql`;
    console.log("Using GraphQL endpoint:", graphqlEndpoint);

    const graphqlResponse = await fetch(
      graphqlEndpoint,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BC_STOREFRONT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: mutation,
          variables: variables,
        }),
      }
    );

    const responseText = await graphqlResponse.text();
    console.log("GraphQL Response Status:", graphqlResponse.status);
    console.log("GraphQL Response:", responseText.substring(0, 500));

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", responseText.substring(0, 1000));
      return new Response(
        JSON.stringify({
          error: "Invalid response from BigCommerce",
          details: responseText.substring(0, 500),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    const checkoutUrl = `${BC_STORE_URL}/cart.php?action=loadInCheckout&id=${cartData.entityId}`;

    return new Response(
      JSON.stringify({
        success: true,
        cart_id: cartData.entityId,
        checkout_url: checkoutUrl,
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