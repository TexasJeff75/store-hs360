const { createClient } = require('@supabase/supabase-js');
const { encrypt, decrypt, isEncrypted } = require('./utils/qb-token-encryption.cjs');

const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json'
};

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_AUTH_BASE_URL = 'https://appcenter.intuit.com/connect/oauth2';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase config missing. SUPABASE_SERVICE_ROLE_KEY is required for server-side token storage.');
  }

  return createClient(url, key);
}

function getQBConfig() {
  const clientId = process.env.QB_CLIENT_ID || process.env.VITE_QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const redirectUri = process.env.QB_REDIRECT_URI || process.env.VITE_QB_REDIRECT_URI;

  const missing = [];
  if (!clientId) missing.push('QB_CLIENT_ID');
  if (!clientSecret) missing.push('QB_CLIENT_SECRET');
  if (!redirectUri) missing.push('QB_REDIRECT_URI');

  if (missing.length > 0) {
    throw new Error(`QuickBooks credentials not configured. Missing: ${missing.join(', ')}`);
  }

  return { clientId, clientSecret, redirectUri };
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
    throw new Error('Only admins can manage QuickBooks connection');
  }

  return user;
}

async function handleAuthorize() {
  const { clientId, redirectUri } = getQBConfig();
  const supabase = getSupabaseAdmin();

  const scope = [
    'com.intuit.quickbooks.accounting',
    'com.intuit.quickbooks.payment'
  ].join(' ');

  const state = require('crypto').randomUUID();

  const { error } = await supabase
    .from('quickbooks_credentials')
    .insert({
      realm_id: `pending_state_${state}`,
      access_token: 'pending',
      refresh_token: 'pending',
      token_type: 'bearer',
      expires_at: new Date().toISOString(),
      refresh_token_expires_at: new Date().toISOString(),
      is_active: false
    });

  if (error) {
    console.error('Failed to store pending state:', JSON.stringify(error));
    throw new Error(`Failed to store pending state: ${error.message} (code: ${error.code}, details: ${error.details || 'none'})`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    response_type: 'code',
    state
  });

  return { url: `${QB_AUTH_BASE_URL}?${params.toString()}` };
}

async function handleExchange(body) {
  const { clientId, clientSecret, redirectUri } = getQBConfig();
  const { code, realmId, state } = body;
  const supabase = getSupabaseAdmin();

  if (!code || !realmId || !state) {
    throw new Error('Missing required parameters: code, realmId, state');
  }

  const { data: pendingRow } = await supabase
    .from('quickbooks_credentials')
    .select('id')
    .eq('realm_id', `pending_state_${state}`)
    .eq('is_active', false)
    .maybeSingle();

  if (!pendingRow) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }

  await supabase.from('quickbooks_credentials').delete().eq('id', pendingRow.id);

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenResponse = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to exchange code: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  const refreshExpiresAt = new Date();
  refreshExpiresAt.setSeconds(refreshExpiresAt.getSeconds() + (tokenData.x_refresh_token_expires_in || 8726400));

  await supabase
    .from('quickbooks_credentials')
    .update({ is_active: false })
    .eq('is_active', true);

  const { data: credentials, error: insertError } = await supabase
    .from('quickbooks_credentials')
    .insert({
      realm_id: realmId,
      access_token: encrypt(tokenData.access_token),
      refresh_token: encrypt(tokenData.refresh_token),
      token_type: tokenData.token_type || 'bearer',
      expires_at: expiresAt.toISOString(),
      refresh_token_expires_at: refreshExpiresAt.toISOString(),
      is_active: true
    })
    .select('id, realm_id, is_active, expires_at, created_at, updated_at')
    .single();

  if (insertError) {
    throw new Error(`Failed to store credentials: ${insertError.message}`);
  }

  return {
    success: true,
    credentials: {
      realm_id: credentials.realm_id,
      is_active: credentials.is_active,
      expires_at: credentials.expires_at,
      connected_at: credentials.created_at,
      updated_at: credentials.updated_at
    }
  };
}

async function handleRefresh() {
  const { clientId, clientSecret } = getQBConfig();
  const supabase = getSupabaseAdmin();

  const { data: creds } = await supabase
    .from('quickbooks_credentials')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (!creds) {
    throw new Error('No active QuickBooks credentials found');
  }

  const refreshToken = isEncrypted(creds.refresh_token) ? decrypt(creds.refresh_token) : creds.refresh_token;
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
      refresh_token: refreshToken
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
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
    .select('id, realm_id, is_active, expires_at, created_at, updated_at')
    .single();

  if (updateError) {
    throw new Error(`Failed to update credentials: ${updateError.message}`);
  }

  return {
    success: true,
    credentials: {
      realm_id: updated.realm_id,
      is_active: updated.is_active,
      expires_at: updated.expires_at,
      connected_at: updated.created_at,
      updated_at: updated.updated_at
    }
  };
}

async function handleDisconnect() {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('quickbooks_credentials')
    .update({ is_active: false })
    .eq('is_active', true);

  return { success: true };
}

async function handleStatus() {
  const supabase = getSupabaseAdmin();

  const { data: creds } = await supabase
    .from('quickbooks_credentials')
    .select('id, realm_id, is_active, expires_at, created_at, updated_at')
    .eq('is_active', true)
    .maybeSingle();

  if (!creds) {
    return { connected: false };
  }

  const expiresAt = new Date(creds.expires_at);
  const now = new Date();
  const isExpired = expiresAt <= now;
  const expiresInMinutes = Math.round((expiresAt.getTime() - now.getTime()) / 60000);

  return {
    connected: true,
    realm_id: creds.realm_id,
    is_active: creds.is_active,
    expires_at: creds.expires_at,
    is_expired: isExpired,
    expires_in_minutes: expiresInMinutes,
    connected_at: creds.created_at,
    updated_at: creds.updated_at
  };
}

async function handleDiagnostics() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  let qbConfig = null;
  let qbError = null;
  try {
    qbConfig = getQBConfig();
    qbConfig = {
      clientId: qbConfig.clientId.substring(0, 8) + '...',
      redirectUri: qbConfig.redirectUri,
      hasSecret: !!qbConfig.clientSecret
    };
  } catch (e) {
    qbError = e.message;
  }

  let dbStatus = 'unknown';
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('quickbooks_credentials')
      .select('id')
      .limit(1);
    dbStatus = error ? `error: ${error.message}` : 'table exists';
  } catch (e) {
    dbStatus = `connection failed: ${e.message}`;
  }

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    storage: 'supabase-server-side',
    supabase: {
      url: url ? url.substring(0, 30) + '...' : 'MISSING',
      hasServiceRoleKey: hasServiceKey,
      usage: 'auth-verification-and-token-storage'
    },
    database: { quickbooks_credentials: dbStatus },
    quickbooks: qbError ? { error: qbError } : qbConfig
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const params = event.queryStringParameters || {};
  const action = params.action;

  if (action === 'diagnostics') {
    try {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(await handleDiagnostics())
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: e.message })
      };
    }
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

    let result;

    switch (action) {
      case 'authorize':
        result = await handleAuthorize();
        break;
      case 'exchange':
        result = await handleExchange(body);
        break;
      case 'refresh':
        result = await handleRefresh();
        break;
      case 'disconnect':
        result = await handleDisconnect();
        break;
      case 'status':
        result = await handleStatus();
        break;
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: `Invalid action: ${action}` })
        };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('QuickBooks OAuth error:', error.message, error.stack);
    const statusCode = error.message === 'Unauthorized' || error.message?.includes('Auth error') || error.message?.includes('Only admins') ? 401 : 500;
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message,
        action: action || 'unknown',
        code: error.code || undefined
      })
    };
  }
};
