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
const QB_ENVIRONMENT = process.env.QB_ENVIRONMENT || process.env.VITE_QB_ENVIRONMENT || 'sandbox';

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
  let needsMigration = false;
  try {
    needsMigration = !isEncrypted(creds.access_token) || !isEncrypted(creds.refresh_token);
    creds.access_token = isEncrypted(creds.access_token) ? decrypt(creds.access_token) : creds.access_token;
    creds.refresh_token = isEncrypted(creds.refresh_token) ? decrypt(creds.refresh_token) : creds.refresh_token;
  } catch (decryptError) {
    console.error('Failed to decrypt QB tokens:', decryptError.message);
    throw new Error('QuickBooks credentials are corrupted. Please reconnect.');
  }

  // Migrate legacy plain text tokens to encrypted format
  if (needsMigration) {
    try {
      console.log('Migrating plain text QB tokens to encrypted format');
      const encAccessToken = encrypt(creds.access_token);
      const encRefreshToken = encrypt(creds.refresh_token);
      await supabase
        .from('quickbooks_credentials')
        .update({
          access_token: encAccessToken,
          refresh_token: encRefreshToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', creds.id);
    } catch (migrationError) {
      // Log but don't fail — tokens are already decrypted in memory for this request
      console.error('Token migration failed (will retry next request):', migrationError.message);
    }
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
    let safeErrorMessage = `Token refresh failed (HTTP ${tokenResponse.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      isInvalidGrant = errorJson.error === 'invalid_grant';
      // Use QB's error description if available, but never include raw token data
      if (errorJson.error_description) {
        safeErrorMessage = `Token refresh failed: ${errorJson.error_description}`;
      }
    } catch {
      isInvalidGrant = errorText.includes('invalid_grant');
    }

    // Log refresh failure to audit trail (best-effort)
    try {
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: 'oauth',
        entity_id: creds.realm_id,
        operation: 'update',
        status: 'failed',
        error_message: isInvalidGrant
          ? 'Refresh token expired or revoked - reconnection required'
          : safeErrorMessage,
        request_payload: { action: 'auto_refresh', grant_type: 'refresh_token' },
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log token refresh failure:', logError.message);
    }

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

    throw new Error(safeErrorMessage);
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

    const crypto = require('crypto');
    const requestId = crypto.randomUUID();
    const supabase = getSupabaseAdmin();

    const headers = {
      'Authorization': `Bearer ${creds.access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (usePaymentsAPI) {
      headers['Request-Id'] = requestId;
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
          const { encrypted, ...existingDeviceInfo } = data.context.deviceInfo || {};
          data.context.deviceInfo = {
            ...existingDeviceInfo,
            ipAddress: clientIp,
          };
        }
      }
      fetchOptions.body = JSON.stringify(data);
    }

    console.log('QB API request:', method.toUpperCase(), url, usePaymentsAPI ? '(payments)' : '(accounting)');
    const qbResponse = await fetch(url, fetchOptions);

    // Capture intuit_tid from response headers for QB support troubleshooting
    const intuitTid = qbResponse.headers.get('intuit_tid') || undefined;

    const responseText = await qbResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // Non-JSON response (e.g. HTML error page) — truncate to prevent leaking server internals
      responseData = { raw: responseText.substring(0, 500) };
    }

    if (!qbResponse.ok) {
      const errorMessage = responseData?.Fault?.Error?.[0]?.Message
        || responseData?.message
        || `QuickBooks API error: ${qbResponse.status}`;

      // Only include structured error details, never raw HTML
      const safeDetails = responseData?.Fault || responseData?.errors || undefined;

      // Log QB error details to Netlify function logs for troubleshooting
      console.error('QB API error:', JSON.stringify({
        status: qbResponse.status,
        endpoint,
        method: method.toUpperCase(),
        usePaymentsAPI,
        error: errorMessage,
        details: safeDetails,
        intuit_tid: intuitTid,
        response: responseData,
      }));

      // Log failed API call for troubleshooting (best-effort, don't block response)
      supabase.from('quickbooks_sync_log').insert({
        entity_type: usePaymentsAPI ? 'payment_api' : 'accounting_api',
        entity_id: `api_${Date.now()}`,
        operation: method.toLowerCase(),
        status: 'failed',
        error_message: errorMessage,
        request_payload: {
          endpoint,
          method: method.toUpperCase(),
          requestId,
          intuit_tid: intuitTid,
          httpStatus: qbResponse.status,
          usePaymentsAPI,
          isQuery,
        },
        response_payload: safeDetails ? { fault: safeDetails } : undefined,
        created_at: new Date().toISOString(),
      }).then(({ error: logErr }) => {
        if (logErr) console.error('Failed to log QB API error to sync_log:', logErr.message);
      }).catch((e) => {
        console.error('Failed to log QB API error to sync_log:', e.message);
      });

      return {
        statusCode: qbResponse.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: errorMessage,
          details: safeDetails,
          intuit_tid: intuitTid,
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        data: responseData,
        realm_id: creds.realm_id,
        intuit_tid: intuitTid,
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
