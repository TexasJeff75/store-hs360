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

const QB_API_BASE_URL = QB_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

const QB_PAYMENTS_BASE_URL = QB_ENVIRONMENT === 'production'
  ? 'https://api.intuit.com/quickbooks/v4'
  : 'https://sandbox.api.intuit.com/quickbooks/v4';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase config missing');
  return createClient(url, key);
}

async function authenticateUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }
  const supabase = getSupabaseAdmin();
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

async function getQBCredentials(supabase) {
  const { data: creds } = await supabase
    .from('quickbooks_credentials')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (!creds) throw new Error('No active QuickBooks connection');

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
  if (!clientId || !clientSecret) throw new Error('QuickBooks client credentials not configured');

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

  const refreshIntuitTid = tokenResponse.headers.get('intuit_tid') || undefined;

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token refresh failed:', errorText.substring(0, 500), 'intuit_tid:', refreshIntuitTid);

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

/**
 * Find or create a QuickBooks Customer for the given organization.
 * Stores the QB customer ID on organizations.qb_customer_id.
 */
async function findOrCreateQBCustomer(supabase, creds, organizationId) {
  // Check if org already has a QB customer ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, code, qb_customer_id')
    .eq('id', organizationId)
    .single();

  if (!org) throw new Error('Organization not found');

  if (org.qb_customer_id) {
    return { customerId: org.qb_customer_id, intuit_tid: undefined };
  }

  // Search QB for existing customer by org name
  const searchQuery = `SELECT * FROM Customer WHERE DisplayName = '${org.name.replace(/'/g, "\\'")}'`;
  const searchUrl = `${QB_API_BASE_URL}/v3/company/${creds.realm_id}/query?query=${encodeURIComponent(searchQuery)}`;

  const searchResponse = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${creds.access_token}`,
      'Accept': 'application/json',
    }
  });

  const searchIntuitTid = searchResponse.headers.get('intuit_tid') || undefined;

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    const existingCustomer = searchData?.QueryResponse?.Customer?.[0];
    if (existingCustomer) {
      // Link existing QB customer to org
      await supabase
        .from('organizations')
        .update({ qb_customer_id: existingCustomer.Id })
        .eq('id', organizationId);
      return { customerId: existingCustomer.Id, intuit_tid: searchIntuitTid };
    }
  }

  // Create new QB customer
  const createUrl = `${QB_API_BASE_URL}/v3/company/${creds.realm_id}/customer`;
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.access_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      DisplayName: org.name,
      CompanyName: org.name,
    })
  });

  const createIntuitTid = createResponse.headers.get('intuit_tid') || undefined;

  if (!createResponse.ok) {
    const errorData = await createResponse.text();
    let errorMsg = `Failed to create QuickBooks customer (HTTP ${createResponse.status})`;
    try {
      const errorJson = JSON.parse(errorData);
      const qbError = errorJson?.Fault?.Error?.[0]?.Message || errorJson?.message;
      if (qbError) errorMsg = `Failed to create QuickBooks customer: ${qbError}`;
    } catch {
      // Non-JSON response — don't leak raw HTML
    }
    console.error('QB customer creation failed:', errorData.substring(0, 500));
    throw new Error(errorMsg);
  }

  const createData = await createResponse.json();
  const qbCustomerId = createData.Customer.Id;

  // Save QB customer ID to org
  await supabase
    .from('organizations')
    .update({ qb_customer_id: qbCustomerId })
    .eq('id', organizationId);

  return { customerId: qbCustomerId, intuit_tid: createIntuitTid };
}

/**
 * Vault a card or bank account with QuickBooks for reuse.
 *
 * Cards:  POST /customers/{id}/cards   { token: "..." } → { id: "reusableCardId" }
 * Banks:  POST /customers/{id}/bank-accounts { token: "..." } → { id: "reusableBankId" }
 */
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

    const {
      token,           // single-use token from QB tokenization
      organizationId,
      paymentType,     // 'credit_card', 'debit_card', 'ach', 'bank_account'
      label,
      lastFour,
      expiryMonth,
      expiryYear,
      accountHolderName,
      bankName,
      accountType,     // 'checking' or 'savings'
      isDefault,
    } = body;

    if (!token || !organizationId || !paymentType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields: token, organizationId, paymentType' })
      };
    }

    const supabase = getSupabaseAdmin();

    // Verify user has access to this organization
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = userProfile?.role === 'admin';

    if (!isAdmin) {
      // Check user_organization_roles first
      const { data: membership } = await supabase
        .from('user_organization_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (!membership) {
        // Fallback: check if the user's profile is directly linked to this org
        const { data: profileOrg } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (!profileOrg) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Not authorized for this organization' })
          };
        }
      }
    }

    const creds = await getQBCredentials(supabase);
    const crypto = require('crypto');

    // Find or create a QB customer for this organization
    const qbCustomerResult = await findOrCreateQBCustomer(supabase, creds, organizationId);
    const qbCustomerId = qbCustomerResult.customerId;
    const customerIntuitTid = qbCustomerResult.intuit_tid;

    const isACH = paymentType === 'ach' || paymentType === 'bank_account';

    let vaultUrl, vaultBody;
    if (isACH) {
      vaultUrl = `${QB_PAYMENTS_BASE_URL}/customers/${qbCustomerId}/bank-accounts`;
      vaultBody = { token };
    } else {
      vaultUrl = `${QB_PAYMENTS_BASE_URL}/customers/${qbCustomerId}/cards`;
      vaultBody = { token };
    }

    const vaultResponse = await fetch(vaultUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Request-Id': crypto.randomUUID(),
      },
      body: JSON.stringify(vaultBody),
    });

    const vaultText = await vaultResponse.text();
    const vaultIntuitTid = vaultResponse.headers.get('intuit_tid') || undefined;
    let vaultData;
    try {
      vaultData = JSON.parse(vaultText);
    } catch {
      vaultData = { raw: vaultText.substring(0, 500) };
    }

    if (!vaultResponse.ok) {
      const errorMsg = vaultData?.errors?.[0]?.message
        || vaultData?.message
        || 'Failed to vault payment method';

      // Log the failure
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: isACH ? 'vault_bank' : 'vault_card',
        entity_id: `vault_${Date.now()}`,
        operation: 'create',
        status: 'failed',
        request_payload: { organizationId, paymentType, qbCustomerId, intuit_tid: vaultIntuitTid },
        error_message: errorMsg,
      }).then(({ error: logErr }) => {
        if (logErr) console.error('sync_log insert failed:', logErr.message);
      }).catch((e) => console.error('sync_log insert failed:', e.message));

      return {
        statusCode: vaultResponse.status >= 400 && vaultResponse.status < 500 ? vaultResponse.status : 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: errorMsg, intuit_tid: vaultIntuitTid })
      };
    }

    // The reusable ID from QB
    const reusableId = vaultData.id;

    // Save payment method with the reusable token
    const { data: savedMethod, error: saveError } = await supabase
      .from('payment_methods')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        label: label || `${isACH ? 'Bank' : 'Card'} ****${lastFour}`,
        payment_type: paymentType,
        last_four: lastFour,
        expiry_month: expiryMonth,
        expiry_year: expiryYear,
        account_holder_name: accountHolderName,
        bank_name: bankName,
        account_type: accountType,
        payment_token: reusableId,
        payment_processor: 'quickbooks',
        is_default: isDefault || false,
      })
      .select()
      .maybeSingle();

    if (saveError) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Failed to save payment method: ${saveError.message}` })
      };
    }

    // Log success
    await supabase.from('quickbooks_sync_log').insert({
      entity_type: isACH ? 'vault_bank' : 'vault_card',
      entity_id: `vault_${Date.now()}`,
      quickbooks_id: reusableId,
      operation: 'create',
      status: 'success',
      request_payload: { organizationId, paymentType, qbCustomerId, intuit_tid: vaultIntuitTid },
      response_payload: { reusableId, last4: lastFour },


    }).then(({ error: logErr }) => {
        if (logErr) console.error('sync_log insert failed:', logErr.message);
      }).catch((e) => console.error('sync_log insert failed:', e.message));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        paymentMethodId: savedMethod.id,
        reusableToken: reusableId,
        qbCustomerId,
        intuit_tid: vaultIntuitTid,
      })
    };
  } catch (error) {
    console.error('Vault payment method error:', error.message, error.stack);
    const knownErrors = [
      'Unauthorized',
      'Missing or invalid authorization header',
      'No active QuickBooks connection',
      'QuickBooks client credentials not configured',
      'Supabase config missing',
      'Organization not found',
      'QuickBooks credentials are corrupted. Please reconnect.',
      'QuickBooks connection expired. Please reconnect.',
    ];
    const isKnown = knownErrors.includes(error.message)
      || error.message?.startsWith('Token refresh failed')
      || error.message?.startsWith('Failed to create QuickBooks customer');
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
