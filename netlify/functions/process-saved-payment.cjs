const { createClient } = require('@supabase/supabase-js');

const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json'
};

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_ENVIRONMENT = process.env.VITE_QB_ENVIRONMENT || process.env.QB_ENVIRONMENT || 'sandbox';

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
    throw new Error('Token refresh failed');
  }

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  const refreshExpiresAt = new Date();
  refreshExpiresAt.setSeconds(refreshExpiresAt.getSeconds() + (tokenData.x_refresh_token_expires_in || 8726400));

  const { data: updated } = await supabase
    .from('quickbooks_credentials')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
      refresh_token_expires_at: refreshExpiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', creds.id)
    .select('*')
    .single();

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

    let qbUrl, requestBody;

    if (isACH) {
      qbUrl = `${QB_PAYMENTS_BASE_URL}/payments/echecks`;
      requestBody = {
        amount: amount.toFixed(2),
        currency: currency || 'USD',
        bankAccountOnFile: token,
        description: description || 'Saved payment method charge',
        paymentMode: 'WEB',
        context: { mobile: false, isEcommerce: true },
      };
    } else {
      qbUrl = `${QB_PAYMENTS_BASE_URL}/payments/charges`;
      requestBody = {
        amount: amount.toFixed(2),
        currency: currency || 'USD',
        cardOnFile: token,
        capture: false,
        description: description || 'Saved payment method authorization',
        context: { mobile: false, isEcommerce: true },
      };
    }

    const requestId = crypto.randomUUID();
    const logId = `saved_${isACH ? 'ach' : 'card'}_${Date.now()}`;

    // Log pending payment attempt
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: isACH ? 'payment_ach' : 'payment_charge',
      entity_id: logId,
      sync_type: 'create',
      status: 'pending',
      request_data: { amount, currency: currency || 'USD', paymentMethodId, isACH, requestId },
    }).then(() => {}).catch(() => {});

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

    const responseText = await qbResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
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
        sync_type: 'create',
        status: 'failed',
        request_data: { amount, currency: currency || 'USD', paymentMethodId, isACH, requestId },
        error_message: errorMsg,
        response_data: { status: responseData?.status, httpStatus: qbResponse.status },
      }).then(() => {}).catch(() => {});

      return {
        statusCode: qbResponse.status >= 400 && qbResponse.status < 500 ? qbResponse.status : 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: userMessage,
          status: isInvalidToken ? 'INVALID_TOKEN' : (responseData?.status || 'FAILED'),
          invalidPaymentMethod: isInvalidToken,
        })
      };
    }

    if (responseData.status === 'DECLINED') {
      // Log declined payment
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: isACH ? 'payment_ach' : 'payment_charge',
        entity_id: logId,
        quickbooks_id: responseData.id,
        sync_type: 'create',
        status: 'failed',
        request_data: { amount, currency: currency || 'USD', paymentMethodId, isACH, requestId },
        error_message: 'Payment declined',
        response_data: { id: responseData.id, status: 'DECLINED', amount: responseData.amount },
      }).then(() => {}).catch(() => {});

      return {
        statusCode: 402,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Payment was declined',
          status: 'DECLINED',
        })
      };
    }

    // Log successful payment
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: isACH ? 'payment_ach' : 'payment_charge',
      entity_id: logId,
      quickbooks_id: responseData.id,
      sync_type: 'create',
      status: 'success',
      request_data: { amount, currency: currency || 'USD', paymentMethodId, isACH, requestId },
      response_data: { id: responseData.id, status: responseData.status, amount: responseData.amount, authCode: responseData.authCode },
      synced_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});

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
    const knownErrors = [
      'Unauthorized',
      'Missing or invalid authorization header',
      'No active QuickBooks connection',
      'QuickBooks client credentials not configured',
      'Token refresh failed',
      'Supabase config missing',
    ];
    const isKnown = knownErrors.includes(error.message);
    const statusCode = error.message === 'Unauthorized' || error.message === 'Missing or invalid authorization header' ? 401 : 500;
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ error: isKnown ? error.message : 'An internal error occurred' })
    };
  }
};
