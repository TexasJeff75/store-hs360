import { supabase } from '../supabase';

const QB_CLIENT_ID = import.meta.env.VITE_QB_CLIENT_ID;
const QB_CLIENT_SECRET = import.meta.env.VITE_QB_CLIENT_SECRET;
const QB_ENVIRONMENT = import.meta.env.VITE_QB_ENVIRONMENT || 'sandbox';
const QB_REDIRECT_URI = window.location.hostname === 'localhost'
  ? import.meta.env.VITE_QB_REDIRECT_URI
  : import.meta.env.VITE_QB_REDIRECT_URI_PROD;

const QB_AUTH_BASE_URL = QB_ENVIRONMENT === 'production'
  ? 'https://appcenter.intuit.com/connect/oauth2'
  : 'https://appcenter.intuit.com/connect/oauth2';

const QB_TOKEN_URL = QB_ENVIRONMENT === 'production'
  ? 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
  : 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

interface QuickBooksCredentials {
  id: string;
  realm_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  is_active: boolean;
  connected_by: string | null;
  last_refresh_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}

export const quickbooksOAuth = {
  getAuthorizationUrl(): string {
    const scope = [
      'com.intuit.quickbooks.accounting',
      'com.intuit.quickbooks.payment'
    ].join(' ');

    const state = crypto.randomUUID();
    sessionStorage.setItem('qb_oauth_state', state);

    const params = new URLSearchParams({
      client_id: QB_CLIENT_ID,
      scope,
      redirect_uri: QB_REDIRECT_URI,
      response_type: 'code',
      state
    });

    return `${QB_AUTH_BASE_URL}?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string, realmId: string): Promise<QuickBooksCredentials> {
    const basicAuth = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);

    const response = await fetch(QB_TOKEN_URL, {
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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const tokenData: TokenResponse = await response.json();

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('User not authenticated');
    }

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const credentialsData = {
      realm_id: realmId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      is_active: true,
      connected_by: user.user.id,
      last_refresh_at: new Date().toISOString(),
      metadata: {
        token_type: tokenData.token_type,
        refresh_token_expires_in: tokenData.x_refresh_token_expires_in
      }
    };

    const { data: existing } = await supabase
      .from('quickbooks_credentials')
      .select('id')
      .eq('realm_id', realmId)
      .maybeSingle();

    let credentials;
    if (existing) {
      const { data, error } = await supabase
        .from('quickbooks_credentials')
        .update(credentialsData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      credentials = data;
    } else {
      const { data, error } = await supabase
        .from('quickbooks_credentials')
        .insert(credentialsData)
        .select()
        .single();

      if (error) throw error;
      credentials = data;
    }

    return credentials;
  },

  async refreshAccessToken(credentialsId: string): Promise<QuickBooksCredentials> {
    const { data: creds, error: fetchError } = await supabase
      .from('quickbooks_credentials')
      .select('*')
      .eq('id', credentialsId)
      .single();

    if (fetchError || !creds) {
      throw new Error('Credentials not found');
    }

    const basicAuth = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);

    const response = await fetch(QB_TOKEN_URL, {
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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const tokenData: TokenResponse = await response.json();

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

    return updated;
  },

  async getActiveCredentials(): Promise<QuickBooksCredentials | null> {
    const { data, error } = await supabase
      .from('quickbooks_credentials')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    const expiresAt = new Date(data.token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt <= fiveMinutesFromNow) {
      return await this.refreshAccessToken(data.id);
    }

    return data;
  },

  async disconnect(credentialsId: string): Promise<void> {
    const { error } = await supabase
      .from('quickbooks_credentials')
      .update({ is_active: false })
      .eq('id', credentialsId);

    if (error) throw error;
  },

  async revokeToken(accessToken: string): Promise<void> {
    const basicAuth = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);

    const response = await fetch('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        token: accessToken
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to revoke token: ${error}`);
    }
  }
};
