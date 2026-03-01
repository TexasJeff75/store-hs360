const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_AUTH_BASE_URL = 'https://appcenter.intuit.com/connect/oauth2';

function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return createClient(url, serviceKey || anonKey);
}

async function authenticateUser(supabase, authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  return user;
}

function getQBConfig() {
  const clientId = process.env.QB_CLIENT_ID || process.env.VITE_QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET || process.env.VITE_QB_CLIENT_SECRET;
  const redirectUri = process.env.QB_REDIRECT_URI || process.env.VITE_QB_REDIRECT_URI;

  const missing = [];
  if (!clientId) missing.push('QB_CLIENT_ID');
  if (!clientSecret) missing.push('QB_CLIENT_SECRET');
  if (!redirectUri) missing.push('QB_REDIRECT_URI');

  if (missing.length > 0) {
    console.error('Missing QB env vars:', missing.join(', '));
    console.error('Available env keys with QB:', Object.keys(process.env).filter(k => k.includes('QB')).join(', '));
    throw new Error(`QuickBooks credentials not configured. Missing: ${missing.join(', ')}`);
  }

  return { clientId, clientSecret, redirectUri };
}

async function handleAuthorize(supabase, user) {
  const { clientId, redirectUri } = getQBConfig();

  const scope = [
    'com.intuit.quickbooks.accounting',
    'com.intuit.quickbooks.payment'
  ].join(' ');

  const state = require('crypto').randomUUID();

  await supabase.from('quickbooks_credentials').upsert({
    realm_id: `pending_${state.substring(0, 8)}`,
    access_token: 'pending',
    refresh_token: 'pending',
    token_expires_at: new Date().toISOString(),
    is_active: false,
    connected_by: user.id,
    metadata: { state, pending: true }
  });

  const params = new URLSearchParams({
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    response_type: 'code',
    state
  });

  return { url: `${QB_AUTH_BASE_URL}?${params.toString()}` };
}

async function handleExchange(supabase, user, body) {
  const { clientId, clientSecret, redirectUri } = getQBConfig();
  const { code, realmId, state } = body;

  if (!code || !realmId || !state) {
    throw new Error('Missing required parameters: code, realmId, state');
  }

  const { data: pendingCreds } = await supabase
    .from('quickbooks_credentials')
    .select('*')
    .eq('connected_by', user.id)
    .eq('is_active', false)
    .order('created_at', { ascending: false })
    .limit(10);

  const matchingCred = pendingCreds?.find(c => c.metadata?.state === state && c.metadata?.pending === true);
  if (!matchingCred) {
    throw new Error('Invalid state parameter - possible CSRF attack');
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

  await supabase
    .from('quickbooks_credentials')
    .update({ is_active: false })
    .eq('is_active', true);

  await supabase
    .from('quickbooks_credentials')
    .delete()
    .eq('id', matchingCred.id);

  const { data: credentials, error: insertError } = await supabase
    .from('quickbooks_credentials')
    .insert({
      realm_id: realmId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      is_active: true,
      connected_by: user.id,
      last_refresh_at: new Date().toISOString(),
      metadata: {
        token_type: tokenData.token_type,
        refresh_token_expires_in: tokenData.x_refresh_token_expires_in
      }
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return { success: true, credentials };
}

async function handleRefresh(supabase, body) {
  const { clientId, clientSecret } = getQBConfig();
  const { credentialsId } = body;

  if (!credentialsId) {
    throw new Error('Missing credentialsId');
  }

  const { data: creds, error: fetchError } = await supabase
    .from('quickbooks_credentials')
    .select('*')
    .eq('id', credentialsId)
    .single();

  if (fetchError || !creds) {
    throw new Error('Credentials not found');
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
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

  const { data: updated, error: updateError } = await supabase
    .from('quickbooks_credentials')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      last_refresh_at: new Date().toISOString()
    })
    .eq('id', credentialsId)
    .select()
    .single();

  if (updateError) throw updateError;

  return { success: true, credentials: updated };
}

async function handleDisconnect(supabase, body) {
  const { credentialsId } = body;

  if (!credentialsId) {
    throw new Error('Missing credentialsId');
  }

  const { error } = await supabase
    .from('quickbooks_credentials')
    .update({ is_active: false })
    .eq('id', credentialsId);

  if (error) throw error;

  return { success: true };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const supabase = getSupabaseClient();
    const user = await authenticateUser(supabase, event.headers.authorization || event.headers.Authorization);

    const params = event.queryStringParameters || {};
    const action = params.action;

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
        result = await handleAuthorize(supabase, user);
        break;
      case 'exchange':
        result = await handleExchange(supabase, user, body);
        break;
      case 'refresh':
        result = await handleRefresh(supabase, body);
        break;
      case 'disconnect':
        result = await handleDisconnect(supabase, body);
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
    console.error('QuickBooks OAuth error:', error);
    return {
      statusCode: error.message === 'Unauthorized' ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
