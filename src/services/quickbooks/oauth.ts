import { supabase } from '../supabase';

const FUNCTION_URL = '/.netlify/functions/quickbooks-oauth';

export interface QBConnectionStatus {
  connected: boolean;
  realm_id?: string;
  is_active?: boolean;
  expires_at?: string;
  is_expired?: boolean;
  expires_in_minutes?: number;
  refresh_token_expires_at?: string;
  refresh_token_is_expired?: boolean;
  refresh_token_expires_in_days?: number;
  refresh_token_expiring_soon?: boolean;
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

async function parseErrorResponse(response: Response, fallback: string): Promise<string> {
  try {
    const errorData = await response.json();
    return errorData.error || fallback;
  } catch {
    return `${fallback} (HTTP ${response.status})`;
  }
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
      const errorMessage = await parseErrorResponse(response, 'Failed to get authorization URL');
      throw new Error(errorMessage);
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
      const errorMessage = await parseErrorResponse(response, 'Failed to exchange code for tokens');
      throw new Error(errorMessage);
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
      try {
        const errorData = await response.json();
        if (errorData.code === 'INVALID_GRANT' || errorData.error_code === 'INVALID_GRANT' || errorData.error?.includes('expired')) {
          throw new Error('[RECONNECT_REQUIRED] QuickBooks connection has expired. Please disconnect and reconnect.');
        }
        throw new Error(errorData.error || 'Failed to refresh token');
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('[RECONNECT_REQUIRED]')) throw e;
        throw new Error(`Failed to refresh token (HTTP ${response.status})`);
      }
    }

    const { credentials } = await response.json();
    return credentials;
  },

  async getConnectionStatus(): Promise<QBConnectionStatus> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${FUNCTION_URL}?action=status`, { headers });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response, 'Failed to get connection status');
      throw new Error(errorMessage);
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
      const errorMessage = await parseErrorResponse(response, 'Failed to disconnect');
      throw new Error(errorMessage);
    }
  }
};
