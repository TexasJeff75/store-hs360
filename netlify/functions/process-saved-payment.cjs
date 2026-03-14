const { createClient } = require('@supabase/supabase-js');
const { encrypt, decrypt, isEncrypted } = require('./utils/qb-token-encryption.cjs');
const { verifyTurnstileToken } = require('./utils/turnstile-verify.cjs');

const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json'
};

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_ENVIRONMENT = process.env.QB_ENVIRONMENT || process.env.VITE_QB_ENVIRONMENT || 'sandbox';

const QB_PAYMENTS_BASE_URL = QB_ENVIRONMENT === 'production'
  ? 'https://api.intuit.com/quickbooks/v4'
  : 'https://sandbox.api.intuit.com/quickbooks/v4';

const paymentAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(userId) {
  const now = Date.now();
  const key = userId;
  const record = paymentAttempts.get(key);

  if (!record || now - record.windowStart > WINDOW_MS) {
    paymentAttempts.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase config missing');
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
    throw new Error('Unauthorized');
  }

  return user;
}

async function getQBCredentials(supabase) {
  const { data: creds } = await supabase
    .from('quickbooks_credentials')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (!creds) {
    throw new Error('No active QuickBooks connection');
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
      console.error('Token migration failed (will retry next request):', migrationError.message);
    }
  }

  const expiresAt = new Date(creds.expires_at);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

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

    if (isInvalidGrant) {
      await supabase
        .from('quickbooks_credentials')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', creds.id);

      const err = new Error('QuickBooks connection expired. Please reconnect.');
      err.code = 'INVALID_GRANT';
      throw err;
    }

    throw new Error(`Token refresh failed (HTTP ${tokenResponse.status})`);
  }

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  const refreshExpiresAt = new Date();
  refreshExpiresAt.setSeconds(refreshExpiresAt.getSeconds() + (tokenData.x_refresh_token_expires_in || 8726400));

  const { data: updated } = await supabase
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

  // Return plain text tokens in volatile memory for immediate use
  updated.access_token = tokenData.access_token;
  updated.refresh_token = tokenData.refresh_token;

  return updated;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = await authenticateUser(authHeader);

    if (!checkRateLimit(user.id)) {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Too many payment attempts. Please try again later.' })
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid request body' })
      };
    }

    // Verify Turnstile CAPTCHA token
    if (body.turnstileToken) {
      const captchaResult = await verifyTurnstileToken(
        body.turnstileToken,
        event.headers['x-forwarded-for'] || event.headers['client-ip']
      );
      if (!captchaResult.success) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'CAPTCHA verification failed. Please try again.' })
        };
      }
    }

    const { paymentMethodId, amount, currency, description } = body;

    if (!paymentMethodId || !amount) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing paymentMethodId or amount' })
      };
    }

    if (typeof amount !== 'number' || amount <= 0 || amount > 1000000) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid amount' })
      };
    }

    const supabase = getSupabaseAdmin();

    const { data: paymentMethod } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', paymentMethodId)
      .maybeSingle();

    if (!paymentMethod) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment method not found' })
      };
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isSystemAdmin = userProfile?.role === 'admin';

    if (!isSystemAdmin) {
      const { data: membership } = await supabase
        .from('user_organization_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', paymentMethod.organization_id)
        .maybeSingle();

      if (!membership) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Not authorized to use this payment method' })
        };
      }
    }

    const token = paymentMethod.payment_token;
    if (!token) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Payment method has no stored token' })
      };
    }

    const creds = await getQBCredentials(supabase);
    const crypto = require('crypto');

    const isACH = paymentMethod.payment_type === 'ach' || paymentMethod.payment_type === 'bank_account';

    // Extract client IP for fraud prevention (QuickBooks deviceInfo)
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || event.headers['client-ip']
      || event.headers['x-nf-client-connection-ip'];
    const paymentContext = {
      mobile: false,
      isEcommerce: true,
      ...(clientIp ? { deviceInfo: { ipAddress: clientIp } } : {}),
    };

    let qbUrl, requestBody;

    if (isACH) {
      qbUrl = `${QB_PAYMENTS_BASE_URL}/payments/echecks`;
      requestBody = {
        amount: amount.toFixed(2),
        currency: currency || 'USD',
        bankAccountOnFile: token,
        description: description || 'Saved payment method charge',
        paymentMode: 'WEB',
        context: paymentContext,
      };
    } else {
      qbUrl = `${QB_PAYMENTS_BASE_URL}/payments/charges`;
      requestBody = {
        amount: amount.toFixed(2),
        currency: currency || 'USD',
        cardOnFile: token,
        capture: false,
        description: description || 'Saved payment method authorization',
        context: paymentContext,
      };
    }

    const requestId = crypto.randomUUID();
    const logId = `saved_${isACH ? 'ach' : 'card'}_${Date.now()}`;

    // Log pending payment attempt
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: isACH ? 'payment_ach' : 'payment_charge',
      entity_id: logId,
      operation: 'create',
      status: 'pending',
      request_payload: { amount, currency: currency || 'USD', paymentMethodId, isACH, requestId },
    }).then(({ error: logErr }) => {
        if (logErr) console.error('sync_log insert failed:', logErr.message);
      }).catch((e) => console.error('sync_log insert failed:', e.message));

    const qbResponse = await fetch(qbUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Request-Id': requestId,
      },
      body: JSON.stringify(requestBody),
    });

    // Capture intuit_tid from response headers for QB support troubleshooting
    const intuitTid = qbResponse.headers.get('intuit_tid') || undefined;

    const responseText = await qbResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText.substring(0, 500) };
    }

    if (!qbResponse.ok) {
      const errorMsg = responseData?.errors?.[0]?.message
        || responseData?.message
        || 'Payment processing failed';

      // Detect expired/invalid token errors and give a clear message
      const isInvalidToken = qbResponse.status === 400 && (
        /invalid.*token/i.test(errorMsg) ||
        /token.*invalid/i.test(errorMsg) ||
        /card.*not found/i.test(errorMsg) ||
        /account.*not found/i.test(errorMsg) ||
        /invalid.*card/i.test(errorMsg)
      );

      const userMessage = isInvalidToken
        ? 'This saved payment method is no longer valid. Please remove it and add a new one.'
        : errorMsg;

      // Log failed payment
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: isACH ? 'payment_ach' : 'payment_charge',
        entity_id: logId,
        operation: 'create',
        status: 'failed',
        request_payload: { amount, currency: currency || 'USD', paymentMethodId, isACH, requestId, intuit_tid: intuitTid },
        error_message: errorMsg,
        response_payload: { status: responseData?.status, httpStatus: qbResponse.status },
      }).then(({ error: logErr }) => {
        if (logErr) console.error('sync_log insert failed:', logErr.message);
      }).catch((e) => console.error('sync_log insert failed:', e.message));

      return {
        statusCode: qbResponse.status >= 400 && qbResponse.status < 500 ? qbResponse.status : 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: userMessage,
          status: isInvalidToken ? 'INVALID_TOKEN' : (responseData?.status || 'FAILED'),
          invalidPaymentMethod: isInvalidToken,
          intuit_tid: intuitTid,
        })
      };
    }

    if (responseData.status === 'DECLINED') {
      // Log declined payment
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: isACH ? 'payment_ach' : 'payment_charge',
        entity_id: logId,
        quickbooks_id: responseData.id,
        operation: 'create',
        status: 'failed',
        request_payload: { amount, currency: currency || 'USD', paymentMethodId, isACH, requestId, intuit_tid: intuitTid },
        error_message: 'Payment declined',
        response_payload: { id: responseData.id, status: 'DECLINED', amount: responseData.amount },
      }).then(({ error: logErr }) => {
        if (logErr) console.error('sync_log insert failed:', logErr.message);
      }).catch((e) => console.error('sync_log insert failed:', e.message));

      return {
        statusCode: 402,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Payment was declined',
          status: 'DECLINED',
          intuit_tid: intuitTid,
        })
      };
    }

    // Log successful payment
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: isACH ? 'payment_ach' : 'payment_charge',
      entity_id: logId,
      quickbooks_id: responseData.id,
      operation: 'create',
      status: 'success',
      request_payload: { amount, currency: currency || 'USD', paymentMethodId, isACH, requestId, intuit_tid: intuitTid },
      response_payload: { id: responseData.id, status: responseData.status, amount: responseData.amount, authCode: responseData.authCode },


    }).then(({ error: logErr }) => {
        if (logErr) console.error('sync_log insert failed:', logErr.message);
      }).catch((e) => console.error('sync_log insert failed:', e.message));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        transactionId: responseData.id,
        paymentStatus: isACH ? 'pending' : 'authorized',
        amount: responseData.amount,
        status: responseData.status,
      })
    };
  } catch (error) {
    console.error('Payment processing error:', error.message, error.stack);
    const knownErrors = [
      'Unauthorized',
      'Missing or invalid authorization header',
      'No active QuickBooks connection',
      'QuickBooks client credentials not configured',
      'Supabase config missing',
      'QuickBooks credentials are corrupted. Please reconnect.',
      'QuickBooks connection expired. Please reconnect.',
    ];
    const isKnown = knownErrors.includes(error.message) || error.message?.startsWith('Token refresh failed');
    let statusCode = 500;
    if (error.message === 'Unauthorized' || error.message === 'Missing or invalid authorization header') {
      statusCode = 401;
    } else if (error.code === 'INVALID_GRANT') {
      statusCode = 401;
    }
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        error: isKnown ? error.message : 'An internal error occurred',
        error_code: error.code || undefined
      })
    };
  }
};
