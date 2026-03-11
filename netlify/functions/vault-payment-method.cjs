const { createClient } = require('@supabase/supabase-js');
const { encrypt, decrypt, isEncrypted } = require('./utils/qb-token-encryption.cjs');

const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (!tokenResponse.ok) throw new Error('Token refresh failed');

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
    return org.qb_customer_id;
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

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    const existingCustomer = searchData?.QueryResponse?.Customer?.[0];
    if (existingCustomer) {
      // Link existing QB customer to org
      await supabase
        .from('organizations')
        .update({ qb_customer_id: existingCustomer.Id })
        .eq('id', organizationId);
      return existingCustomer.Id;
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

  if (!createResponse.ok) {
    const errorData = await createResponse.text();
    throw new Error(`Failed to create QB customer: ${errorData}`);
  }

  const createData = await createResponse.json();
  const qbCustomerId = createData.Customer.Id;

  // Save QB customer ID to org
  await supabase
    .from('organizations')
    .update({ qb_customer_id: qbCustomerId })
    .eq('id', organizationId);

  return qbCustomerId;
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
      const { data: membership } = await supabase
        .from('user_organization_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (!membership) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Not authorized for this organization' })
        };
      }
    }

    const creds = await getQBCredentials(supabase);
    const crypto = require('crypto');

    // Find or create a QB customer for this organization
    const qbCustomerId = await findOrCreateQBCustomer(supabase, creds, organizationId);

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
    let vaultData;
    try {
      vaultData = JSON.parse(vaultText);
    } catch {
      vaultData = { raw: vaultText };
    }

    if (!vaultResponse.ok) {
      const errorMsg = vaultData?.errors?.[0]?.message
        || vaultData?.message
        || 'Failed to vault payment method';

      // Log the failure
      await supabase.from('quickbooks_sync_log').insert({
        entity_type: isACH ? 'vault_bank' : 'vault_card',
        entity_id: `vault_${Date.now()}`,
        sync_type: 'create',
        status: 'failed',
        request_data: { organizationId, paymentType, qbCustomerId },
        error_message: errorMsg,
      }).then(() => {}).catch(() => {});

      return {
        statusCode: vaultResponse.status >= 400 && vaultResponse.status < 500 ? vaultResponse.status : 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: errorMsg })
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
      sync_type: 'create',
      status: 'success',
      request_data: { organizationId, paymentType, qbCustomerId },
      response_data: { reusableId, last4: lastFour },
      synced_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        paymentMethodId: savedMethod.id,
        reusableToken: reusableId,
        qbCustomerId,
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
      'Organization not found',
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
