require('dotenv').config();
const express = require("express");
const app = express();

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

app.use(express.json());

// Get environment variables (with fallback for both VITE_ and non-prefixed)
const BC_STORE_HASH = process.env.BC_STORE_HASH || process.env.VITE_BC_STORE_HASH;
const BC_STOREFRONT_TOKEN = process.env.BC_STOREFRONT_TOKEN || process.env.VITE_BC_STOREFRONT_TOKEN;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

// Check for required environment variables
if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
  console.error('Missing required environment variables: BC_STORE_HASH and/or BC_STOREFRONT_TOKEN');
}

const ENDPOINT = `https://store-${BC_STORE_HASH}.mybigcommerce.com/graphql`;
// GraphQL endpoint
app.post("/api/gql", async (req, res) => {
  // Check for required environment variables
  if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
    return res.status(500).json({
      error: "MISSING_CREDENTIALS",
      detail: "BigCommerce store hash or storefront token not configured"
    });
  }

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${BC_STOREFRONT_TOKEN}`,
      },
      body: JSON.stringify(req.body || {})
    });
    res.status(r.status).type("application/json").send(await r.text());
  } catch (e) {
    res.status(502).json({ error: "GQL_PROXY_FAILED", detail: String(e) });
  }
});

// BigCommerce Cart REST API endpoint
app.post("/api/bigcommerce-cart", async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (!BC_STORE_HASH || !BC_ACCESS_TOKEN) {
    console.error('[Cart Function] Missing environment variables');
    return res.status(500).json({
      error: 'Server configuration error: Missing BigCommerce credentials',
    });
  }

  try {
    const { action, data } = req.body;
    console.log('[Cart Function] Action:', action);

    const headers = {
      'X-Auth-Token': BC_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    switch (action) {
      case 'createCart': {
        const response = await fetch(
          `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3/carts`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({
              line_items: data.line_items,
              channel_id: 1,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          const errorMsg = result.title || result.detail || 'Failed to create cart';
          console.error('[Cart Function] API Error:', errorMsg);
          throw new Error(errorMsg);
        }

        const cartId = result.data.id;
        const redirectUrls = result.data.redirect_urls || {};

        const checkoutUrl = redirectUrls.checkout_url ||
                           redirectUrls.embedded_checkout_url ||
                           redirectUrls.cart_url ||
                           `https://store-${BC_STORE_HASH}.mybigcommerce.com/cart.php?action=loadInCheckout&id=${cartId}`;

        return res.status(200).json({
          cartId: cartId,
          redirectUrl: checkoutUrl,
          redirectUrls: redirectUrls,
        });
      }

      case 'getCart': {
        const response = await fetch(
          `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3/carts/${data.cartId}`,
          {
            method: 'GET',
            headers,
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.title || 'Failed to get cart');
        }

        return res.status(200).json(result.data);
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[Cart Function] Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      storeHash: BC_STORE_HASH ? 'configured' : 'missing',
      storefrontToken: BC_STOREFRONT_TOKEN ? 'configured' : 'missing',
      accessToken: BC_ACCESS_TOKEN ? 'configured' : 'missing'
    }
  });
});

app.listen(4000, () => {
  console.log("\n" + "=".repeat(60));
  console.log("Local API server running on http://localhost:4000");
  console.log("=".repeat(60));
  console.log("  GraphQL proxy:", ENDPOINT);
  console.log("  Cart API: /api/bigcommerce-cart");
  console.log("  Health check: /api/health");
  console.log("\nConfiguration:");
  console.log("  Store Hash:", BC_STORE_HASH || '❌ NOT SET');
  console.log("  Storefront Token:", BC_STOREFRONT_TOKEN ? '✅ CONFIGURED' : '❌ NOT SET');
  console.log("  Access Token:", BC_ACCESS_TOKEN ? '✅ CONFIGURED' : '❌ NOT SET');
  console.log("=".repeat(60) + "\n");
});
