const BC_STORE_HASH = process.env.BC_STORE_HASH;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

if (!BC_STORE_HASH || !BC_ACCESS_TOKEN) {
  console.error('[BigCommerce Cart Function] Missing environment variables');
  console.error('BC_STORE_HASH:', BC_STORE_HASH ? 'present' : 'missing');
  console.error('BC_ACCESS_TOKEN:', BC_ACCESS_TOKEN ? 'present' : 'missing');
}

const headers = {
  'X-Auth-Token': BC_ACCESS_TOKEN,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    if (!BC_STORE_HASH || !BC_ACCESS_TOKEN) {
      console.error('[BigCommerce Cart Function] Environment variables not configured');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Server configuration error: Missing BigCommerce credentials',
        }),
      };
    }

    const { action, data } = JSON.parse(event.body);

    console.log('[BigCommerce Cart Function] Action:', action);
    console.log('[BigCommerce Cart Function] Store Hash:', BC_STORE_HASH);

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

        console.log('[BigCommerce Cart Function] Response status:', response.status);
        console.log('[BigCommerce Cart Function] Response data:', JSON.stringify(result));

        if (!response.ok) {
          const errorMsg = result.title || result.detail || 'Failed to create cart';
          console.error('[BigCommerce Cart Function] API Error:', errorMsg);
          throw new Error(errorMsg);
        }

        const cartId = result.data.id;
        const redirectUrls = result.data.redirect_urls || {};

        console.log('[BigCommerce Cart Function] Cart ID:', cartId);
        console.log('[BigCommerce Cart Function] Redirect URLs:', JSON.stringify(redirectUrls));

        const checkoutUrl = redirectUrls.checkout_url ||
                           redirectUrls.embedded_checkout_url ||
                           redirectUrls.cart_url ||
                           `https://store-${BC_STORE_HASH}.mybigcommerce.com/cart.php?action=loadInCheckout&id=${cartId}`;

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            cartId: cartId,
            redirectUrl: checkoutUrl,
            redirectUrls: redirectUrls,
          }),
        };
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

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.data),
        };
      }

      case 'getProductCosts': {
        const { productIds } = data;
        console.log('[BigCommerce Cart Function] Fetching costs for products:', productIds.length, 'products');

        const productCosts = {};

        // Fetch products in bulk (BigCommerce supports up to 250 products per request)
        const BATCH_SIZE = 250;
        const batches = [];
        for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
          batches.push(productIds.slice(i, i + BATCH_SIZE));
        }

        // Process all batches in parallel
        const batchPromises = batches.map(async (batch) => {
          const idsParam = batch.join(',');
          const response = await fetch(
            `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3/catalog/products?id:in=${idsParam}&include=variants`,
            {
              method: 'GET',
              headers,
            }
          );

          if (response.ok) {
            const result = await response.json();
            return result.data || [];
          }
          return [];
        });

        const batchResults = await Promise.all(batchPromises);
        const allProducts = batchResults.flat();

        // Process all products
        allProducts.forEach(product => {
          // Use variant cost_price if available and product has variants
          let costPrice = product.cost_price;
          if (product.variants && product.variants.length > 0) {
            const variant = product.variants[0];
            if (variant.cost_price !== undefined && variant.cost_price !== null) {
              costPrice = variant.cost_price;
            }
          }

          productCosts[product.id] = {
            id: product.id,
            name: product.name,
            sku: product.sku || null,
            cost_price: (costPrice !== undefined && costPrice !== null && costPrice > 0) ? costPrice : null,
            price: product.price || 0,
            brand_id: product.brand_id || null,
            brand_name: null,
          };
        });

        // Fetch brand names in bulk
        const brandIds = [...new Set(
          Object.values(productCosts)
            .map(p => p.brand_id)
            .filter(id => id !== null)
        )];

        if (brandIds.length > 0) {
          const brandsResponse = await fetch(
            `https://api.bigcommerce.com/stores/${BC_STORE_HASH}/v3/catalog/brands?id:in=${brandIds.join(',')}&limit=250`,
            {
              method: 'GET',
              headers,
            }
          );

          if (brandsResponse.ok) {
            const brandsResult = await brandsResponse.json();
            const brandNames = {};
            brandsResult.data.forEach(brand => {
              brandNames[brand.id] = brand.name;
            });

            // Update product costs with brand names
            Object.values(productCosts).forEach(product => {
              if (product.brand_id && brandNames[product.brand_id]) {
                product.brand_name = brandNames[product.brand_id];
              }
            });
          }
        }

        console.log('[BigCommerce Cart Function] Successfully fetched', Object.keys(productCosts).length, 'products');

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(productCosts),
        };
      }

      case 'createCheckout':
      case 'updateCheckout':
      case 'getCheckout':
      case 'checkoutAction': {
        const { endpoint, method, body } = data;

        // Ensure endpoint has proper v3 prefix for checkouts API
        let apiEndpoint = endpoint;
        if (endpoint.startsWith('/checkouts')) {
          apiEndpoint = `/v3${endpoint}`;
        } else if (!endpoint.startsWith('/v3/')) {
          apiEndpoint = `/v3${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        }

        const url = `https://api.bigcommerce.com/stores/${BC_STORE_HASH}${apiEndpoint}`;

        console.log('[BigCommerce Cart Function] API Request:', method, url);

        console.log('[BigCommerce Cart Function] Request URL:', url);
        console.log('[BigCommerce Cart Function] Request method:', method);

        const response = await fetch(url, {
          method: method || 'GET',
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        console.log('[BigCommerce Cart Function] API Response status:', response.status);
        console.log('[BigCommerce Cart Function] Response headers:', Object.fromEntries(response.headers.entries()));

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('[BigCommerce Cart Function] Non-JSON response:', text.substring(0, 500));
          throw new Error(`BigCommerce returned non-JSON response: ${text.substring(0, 200)}`);
        }

        const result = await response.json();

        if (!response.ok) {
          const errorMsg = result.title || result.detail || result.message || 'API request failed';
          console.error('[BigCommerce Cart Function] API Error:', errorMsg);
          console.error('[BigCommerce Cart Function] Full error response:', JSON.stringify(result));
          throw new Error(errorMsg);
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result),
        };
      }

      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid action' }),
        };
    }
  } catch (error) {
    console.error('[BigCommerce Cart Function] Error:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};
