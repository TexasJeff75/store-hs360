const { getStore } = require('@netlify/blobs');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_ENVIRONMENT = process.env.VITE_QB_ENVIRONMENT || process.env.QB_ENVIRONMENT || 'sandbox';

const QB_API_BASE_URL = QB_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

const QB_PAYMENTS_BASE_URL = QB_ENVIRONMENT === 'production'
  ? 'https://api.intuit.com/quickbooks/v4'
  : 'https://sandbox.api.intuit.com/quickbooks/v4';

const CREDENTIALS_KEY = 'active_credentials';

function getTokenStore() {
  return getStore({ name: 'quickbooks-tokens', consistency: 'strong' });
}

async function authenticateUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase config missing for auth verification');
  }

  const supabase = createClient(url, key);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error(error ? `Auth error: ${error.message}` : 'Unauthorized');
  }

  return user;
}

async function getCredentials() {
  const store = getTokenStore();
  const creds = await store.get(CREDENTIALS_KEY, { type: 'json' });

  if (!creds || !creds.is_active) {
    throw new Error('No active QuickBooks connection. Please connect QuickBooks first.');
  }

  const expiresAt = new Date(creds.expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    return await refreshTokens(creds, store);
  }

  return creds;
}

async function refreshTokens(creds, store) {
  const clientId = process.env.QB_CLIENT_ID || process.env.VITE_QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET || process.env.VITE_QB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks client credentials not configured');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenResponse = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refresh_token
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  const refreshExpiresAt = new Date();
  refreshExpiresAt.setSeconds(refreshExpiresAt.getSeconds() + (tokenData.x_refresh_token_expires_in || 8726400));

  const updatedCreds = {
    ...creds,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt.toISOString(),
    refresh_token_expires_at: refreshExpiresAt.toISOString(),
    updated_at: new Date().toISOString()
  };

  await store.setJSON(CREDENTIALS_KEY, updatedCreds);

  return updatedCreds;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    await authenticateUser(authHeader);

    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid JSON body' })
        };
      }
    }

    const { endpoint, method = 'GET', data, usePaymentsAPI = false, isQuery = false } = body;

    if (!endpoint) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing endpoint parameter' })
      };
    }

    const creds = await getCredentials();

    let url;
    if (usePaymentsAPI) {
      url = `${QB_PAYMENTS_BASE_URL}/${endpoint}`;
    } else if (isQuery) {
      url = `${QB_API_BASE_URL}/v3/company/${creds.realm_id}/query?query=${encodeURIComponent(endpoint)}`;
    } else {
      url = `${QB_API_BASE_URL}/v3/company/${creds.realm_id}/${endpoint}`;
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: {
        'Authorization': `Bearer ${creds.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    if (data && ['POST', 'PUT'].includes(method.toUpperCase())) {
      fetchOptions.body = JSON.stringify(data);
    }

    const qbResponse = await fetch(url, fetchOptions);

    const responseText = await qbResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!qbResponse.ok) {
      const errorMessage = responseData?.Fault?.Error?.[0]?.Message
        || responseData?.message
        || `QuickBooks API error: ${qbResponse.status}`;

      return {
        statusCode: qbResponse.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: errorMessage,
          details: responseData
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        data: responseData,
        realm_id: creds.realm_id
      })
    };
  } catch (error) {
    console.error('QuickBooks API proxy error:', error);
    const statusCode = error.message === 'Unauthorized' || error.message?.includes('Auth error') ? 401 : 500;
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
