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

      case 'createCheckout':
      case 'updateCheckout':
      case 'getCheckout':
      case 'checkoutAction': {
        const { endpoint, method, body } = data;
        const url = `https://api.bigcommerce.com/stores/${BC_STORE_HASH}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

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
