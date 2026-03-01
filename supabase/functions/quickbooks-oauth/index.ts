import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get environment variables
    const QB_CLIENT_ID = Deno.env.get('QB_CLIENT_ID');
    const QB_CLIENT_SECRET = Deno.env.get('QB_CLIENT_SECRET');
    const QB_ENVIRONMENT = Deno.env.get('QB_ENVIRONMENT') || 'sandbox';
    const QB_REDIRECT_URI = Deno.env.get('QB_REDIRECT_URI');

    if (!QB_CLIENT_ID || !QB_CLIENT_SECRET || !QB_REDIRECT_URI) {
      throw new Error('QuickBooks credentials not configured');
    }

    const QB_AUTH_BASE_URL = 'https://appcenter.intuit.com/connect/oauth2';
    const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    // Handle get authorization URL
    if (action === 'authorize') {
      const scope = [
        'com.intuit.quickbooks.accounting',
        'com.intuit.quickbooks.payment'
      ].join(' ');

      const state = crypto.randomUUID();

      // Store state in database for verification
      await supabase.from('quickbooks_credentials').upsert({
        realm_id: 'pending',
        access_token: 'pending',
        refresh_token: 'pending',
        token_expires_at: new Date().toISOString(),
        is_active: false,
        connected_by: user.id,
        metadata: { state, pending: true }
      });

      const params = new URLSearchParams({
        client_id: QB_CLIENT_ID,
        scope,
        redirect_uri: QB_REDIRECT_URI,
        response_type: 'code',
        state
      });

      return new Response(
        JSON.stringify({ url: `${QB_AUTH_BASE_URL}?${params.toString()}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle token exchange
    if (action === 'exchange' && req.method === 'POST') {
      const { code, realmId, state } = await req.json();

      // Verify state
      const { data: pendingCreds } = await supabase
        .from('quickbooks_credentials')
        .select('*')
        .eq('connected_by', user.id)
        .eq('metadata->pending', true)
        .maybeSingle();

      if (!pendingCreds || pendingCreds.metadata.state !== state) {
        throw new Error('Invalid state parameter');
      }

      // Exchange code for tokens
      const basicAuth = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);

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
          redirect_uri: QB_REDIRECT_URI
        })
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Failed to exchange code: ${error}`);
      }

      const tokenData: TokenResponse = await tokenResponse.json();

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      // Deactivate all existing credentials
      await supabase
        .from('quickbooks_credentials')
        .update({ is_active: false })
        .eq('is_active', true);

      // Delete pending credential
      await supabase
        .from('quickbooks_credentials')
        .delete()
        .eq('id', pendingCreds.id);

      // Store new credentials
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
            refresh_token_expires_in: tokenData.x_refresh_token_expires_in,
            environment: QB_ENVIRONMENT
          }
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({ success: true, credentials }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle token refresh
    if (action === 'refresh' && req.method === 'POST') {
      const { credentialsId } = await req.json();

      const { data: creds, error: fetchError } = await supabase
        .from('quickbooks_credentials')
        .select('*')
        .eq('id', credentialsId)
        .single();

      if (fetchError || !creds) {
        throw new Error('Credentials not found');
      }

      const basicAuth = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);

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
        const error = await tokenResponse.text();
        throw new Error(`Failed to refresh token: ${error}`);
      }

      const tokenData: TokenResponse = await tokenResponse.json();

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

      return new Response(
        JSON.stringify({ success: true, credentials: updated }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle disconnect
    if (action === 'disconnect' && req.method === 'POST') {
      const { credentialsId } = await req.json();

      const { error } = await supabase
        .from('quickbooks_credentials')
        .update({ is_active: false })
        .eq('id', credentialsId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
