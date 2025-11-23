exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Get environment variables
  const BC_STORE_HASH = process.env.BC_STORE_HASH;
  const BC_STOREFRONT_TOKEN = process.env.BC_STOREFRONT_TOKEN;

  // Validate environment variables
  if (!BC_STORE_HASH) {
    console.error('❌ BC_STORE_HASH is missing from environment variables');
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        errors: [{ message: 'BC_STORE_HASH environment variable is missing' }] 
      })
    };
  }

  if (!BC_STOREFRONT_TOKEN) {
    console.error('❌ BC_STOREFRONT_TOKEN is missing from environment variables');
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        errors: [{ message: 'BC_STOREFRONT_TOKEN environment variable is missing' }] 
      })
    };
  }

  if (!BC_STOREFRONT_TOKEN.startsWith('eyJ')) {
    console.error('❌ BC_STOREFRONT_TOKEN does not appear to be a valid JWT');
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        errors: [{ message: 'BC_STOREFRONT_TOKEN is not a valid JWT token' }] 
      })
    };
  }

  const ENDPOINT = `https://store-${BC_STORE_HASH}.mybigcommerce.com/graphql`;

  console.log('✅ Environment variables loaded:');
  console.log('   Store Hash:', BC_STORE_HASH);
  console.log('   JWT Token:', BC_STOREFRONT_TOKEN.substring(0, 20) + '...');
  console.log('   Endpoint:', ENDPOINT);

  try {
    // Parse the request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          errors: [{ message: 'Invalid JSON in request body' }] 
        })
      };
    }

    console.log('Proxy request received:', {
      query: requestBody.query?.substring(0, 100) + '...',
      variables: requestBody.variables
    });
    
    // Make request to BigCommerce GraphQL API
    const response = await fetch(ENDPOINT, { 
      method: "POST",
      headers: { 
        "content-type": "application/json", 
        "authorization": `Bearer ${BC_STOREFRONT_TOKEN}` 
      },
      body: JSON.stringify(requestBody) 
    });
    
    console.log('BigCommerce response:', {
      status: response.status,
      statusText: response.statusText
    });
    
    const responseText = await response.text();
    console.log('Response text length:', responseText.length);
    console.log('Response text preview:', responseText.substring(0, 200));

    // Validate that we got valid JSON back
    if (!responseText || responseText.trim() === '') {
      console.error('❌ Empty response from BigCommerce');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errors: [{ message: 'Empty response from BigCommerce API' }]
        })
      };
    }

    // Try to parse to ensure it's valid JSON
    try {
      JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Invalid JSON from BigCommerce:', responseText.substring(0, 500));
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errors: [{ message: 'Invalid JSON response from BigCommerce API' }]
        })
      };
    }

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      },
      body: responseText
    };
  } catch (error) {
    console.error('GraphQL proxy error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        errors: [{ message: 'Internal server error' }] 
      })
    };
  }
};