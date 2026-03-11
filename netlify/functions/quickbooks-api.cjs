const { createClient } = require('@supabase/supabase-js');
const { encrypt, decrypt, isEncrypted } = require('./utils/qb-token-encryption.cjs');

const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
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

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase config missing. SUPABASE_SERVICE_ROLE_KEY is required.');
  }

  return createClient(url, key);
}

async function authenticateUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const supabase = getSupabaseAdmin();
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error(error ? `Auth error: ${error.message}` : 'Unauthorized');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    throw new Error('Only admins can access QuickBooks API');
  }

  return user;
}

async function getCredentials() {
  const supabase = getSupabaseAdmin();

  const { data: creds } = await supabase
    .from('quickbooks_credentials')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (!creds) {
    throw new Error('No active QuickBooks connection. Please connect QuickBooks first.');
  }

  // Decrypt tokens — they are only held in plain text in volatile function memory
  const needsMigration = !isEncrypted(creds.access_token) || !isEncrypted(creds.refresh_token);
  creds.access_token = isEncrypted(creds.access_token) ? decrypt(creds.access_token) : creds.access_token;
  creds.refresh_token = isEncrypted(creds.refresh_token) ? decrypt(creds.refresh_token) : creds.refresh_token;

  // Migrate legacy plain text tokens to encrypted format
  if (needsMigration) {
    console.log('Migrating plain text QB tokens to encrypted format');
    await supabase
      .from('quickbooks_credentials')
      .update({
        access_token: encrypt(creds.access_token),
        refresh_token: encrypt(creds.refresh_token),
        updated_at: new Date().toISOString()
      })
      .eq('id', creds.id);
  }

  const expiresAt = new Date(creds.expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    return await refreshTokens(creds, supabase);
  }

  return creds;
}

async function refreshTokens(creds, supabase) {
  const clientId = process.env.QB_CLIENT_ID || process.env.VITE_QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;

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

    // Detect invalid_grant (expired/revoked refresh token)
    let isInvalidGrant = false;
    try {
      const errorJson = JSON.parse(errorText);
      isInvalidGrant = errorJson.error === 'invalid_grant';
    } catch {
      isInvalidGrant = errorText.includes('invalid_grant');
    }

    // Log refresh failure to audit trail
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: 'oauth',
      entity_id: creds.realm_id,
      sync_type: 'update',
      status: 'failed',
      error_message: isInvalidGrant
        ? 'Refresh token expired or revoked - reconnection required'
        : `Token refresh failed: ${errorText}`,
      request_data: { action: 'auto_refresh', grant_type: 'refresh_token' },
      created_at: new Date().toISOString()
    });

    if (isInvalidGrant) {
      // Deactivate stale credentials
      await supabase
        .from('quickbooks_credentials')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', creds.id);

      const err = new Error('QuickBooks connection expired. Please reconnect.');
      err.code = 'INVALID_GRANT';
      throw err;
    }

    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  const refreshExpiresAt = new Date();
  refreshExpiresAt.setSeconds(refreshExpiresAt.getSeconds() + (tokenData.x_refresh_token_expires_in || 8726400));

  const { data: updated, error: updateError } = await supabase
    .from('quickbooks_credentials')
    .update({
      access_token: encrypt(tokenData.access_token),
      refresh_token: encrypt(tokenData.refresh_token),
      expires_at: expiresAt.toISOString(),
      refresh_token_expires_at: refreshExpiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', creds.id)
    .select('*')
    .single();

  if (updateError) {
    throw new Error(`Failed to update credentials: ${updateError.message}`);
  }

  // Return plain text tokens in volatile memory for immediate use
  updated.access_token = tokenData.access_token;
  updated.refresh_token = tokenData.refresh_token;

  return updated;
}

const paymentRateLimits = new Map();
const PAYMENT_MAX_ATTEMPTS = 10;
const PAYMENT_WINDOW_MS = 15 * 60 * 1000;

function checkPaymentRateLimit(userId) {
  const now = Date.now();
  const record = paymentRateLimits.get(userId);
  if (!record || now - record.windowStart > PAYMENT_WINDOW_MS) {
    paymentRateLimits.set(userId, { windowStart: now, count: 1 });
    return true;
  }
  if (record.count >= PAYMENT_MAX_ATTEMPTS) {
    return false;
  }
  record.count++;
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await authenticateUser(authHeader);

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

    if (usePaymentsAPI && method.toUpperCase() === 'POST') {
      if (!checkPaymentRateLimit(user.id)) {
        return {
          statusCode: 429,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Too many payment attempts. Please try again later.' })
        };
      }
    }

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

    const headers = {
      'Authorization': `Bearer ${creds.access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (usePaymentsAPI) {
      const crypto = require('crypto');
      headers['Request-Id'] = crypto.randomUUID();
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers
    };

    if (data && ['POST', 'PUT'].includes(method.toUpperCase())) {
      // Inject client IP into deviceInfo for payment API requests (fraud prevention)
      if (usePaymentsAPI && data.context) {
        const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || event.headers['client-ip']
          || event.headers['x-nf-client-connection-ip'];
        if (clientIp) {
          data.context.deviceInfo = {
            ...data.context.deviceInfo,
            ipAddress: clientIp,
          };
        }
      }
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
    let statusCode = 500;
    if (error.message === 'Unauthorized' || error.message?.includes('Auth error')) {
      statusCode = 401;
    } else if (error.code === 'INVALID_GRANT') {
      statusCode = 401;
    }
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message,
        error_code: error.code || undefined
      })
    };
  }
};
