import { supabase } from '../supabase';

const FUNCTION_URL = '/.netlify/functions/quickbooks-oauth';

export interface QBConnectionStatus {
  connected: boolean;
  realm_id?: string;
  is_active?: boolean;
  expires_at?: string;
  is_expired?: boolean;
  expires_in_minutes?: number;
  connected_at?: string;
  updated_at?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('User not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

export const quickbooksOAuth = {
  async getAuthorizationUrl(): Promise<string> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${FUNCTION_URL}?action=authorize`, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get authorization URL');
    }

    const { url } = await response.json();
    return url;
  },

  async exchangeCodeForTokens(code: string, realmId: string, state: string): Promise<QBConnectionStatus> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${FUNCTION_URL}?action=exchange`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, realmId, state })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to exchange code for tokens');
    }

    const { credentials } = await response.json();
    return credentials;
  },

  async refreshTokens(): Promise<QBConnectionStatus> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${FUNCTION_URL}?action=refresh`, {
      method: 'POST',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to refresh token');
    }

    const { credentials } = await response.json();
    return credentials;
  },

  async getConnectionStatus(): Promise<QBConnectionStatus> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${FUNCTION_URL}?action=status`, { headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get connection status');
    }

    return await response.json();
  },

  async disconnect(): Promise<void> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${FUNCTION_URL}?action=disconnect`, {
      method: 'POST',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to disconnect');
    }
  }
};
