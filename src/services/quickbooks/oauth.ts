import { supabase } from '../supabase';

const FUNCTION_URL = '/.netlify/functions/quickbooks-oauth';

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
  async getAuthorizationUrl(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${FUNCTION_URL}?action=authorize`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get authorization URL');
    }

    const { url } = await response.json();
    return url;
  },

  async exchangeCodeForTokens(code: string, realmId: string, state: string): Promise<QuickBooksCredentials> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${FUNCTION_URL}?action=exchange`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, realmId, state })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to exchange code for tokens');
    }

    const { credentials } = await response.json();
    return credentials;
  },

  async refreshAccessToken(credentialsId: string): Promise<QuickBooksCredentials> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${FUNCTION_URL}?action=refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ credentialsId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to refresh token');
    }

    const { credentials } = await response.json();
    return credentials;
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${FUNCTION_URL}?action=disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ credentialsId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to disconnect');
    }
  }
};
