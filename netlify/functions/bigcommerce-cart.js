const fetch = require('node-fetch');

const BC_STORE_HASH = process.env.BC_STORE_HASH;
const BC_ACCESS_TOKEN = process.env.BC_ACCESS_TOKEN;

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
    const { action, data } = JSON.parse(event.body);

    console.log('[BigCommerce Cart Function] Action:', action);

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
          throw new Error(result.title || 'Failed to create cart');
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            cartId: result.data.id,
            redirectUrl: result.data.redirect_urls?.embedded_checkout_url,
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
