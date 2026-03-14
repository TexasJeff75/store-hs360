import { supabase } from '../supabase';

const API_PROXY_URL = '/.netlify/functions/quickbooks-api';

export interface QuickBooksAPIError {
  message: string;
  code?: string;
  detail?: string;
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

export class QuickBooksClient {
  private realmId: string | null = null;
  private syncLogEnabled: boolean | null = null;

  private async proxyRequest<T>(
    endpoint: string,
    method: string = 'GET',
    data?: any,
    usePaymentsAPI = false,
    isQuery = false
  ): Promise<T> {
    const headers = await getAuthHeaders();

    const response = await fetch(API_PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        endpoint,
        method,
        data,
        usePaymentsAPI,
        isQuery
      })
    });

    if (!response.ok) {
      let errorMessage = `QuickBooks API error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error_code === 'INVALID_GRANT') {
          throw new Error('[RECONNECT_REQUIRED] QuickBooks connection has expired. Please disconnect and reconnect.');
        }
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Re-throw RECONNECT_REQUIRED errors; swallow JSON parse failures
        if (e instanceof Error && e.message.startsWith('[RECONNECT_REQUIRED]')) throw e;
        // If .json() failed, the response was not JSON (e.g. HTML error page) — use default message
      }
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    if (!responseText) {
      return { data: null as unknown as T, realm_id: this.realmId };
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`QuickBooks returned invalid JSON response`);
    }

    this.realmId = result.realm_id || this.realmId;
    return result.data;
  }

  async get<T>(endpoint: string, usePaymentsAPI = false): Promise<T> {
    return this.proxyRequest<T>(endpoint, 'GET', undefined, usePaymentsAPI);
  }

  async post<T>(endpoint: string, body: any, usePaymentsAPI = false): Promise<T> {
    return this.proxyRequest<T>(endpoint, 'POST', body, usePaymentsAPI);
  }

  async put<T>(endpoint: string, body: any, usePaymentsAPI = false): Promise<T> {
    return this.proxyRequest<T>(endpoint, 'PUT', body, usePaymentsAPI);
  }

  async delete(endpoint: string, usePaymentsAPI = false): Promise<void> {
    await this.proxyRequest(endpoint, 'DELETE', undefined, usePaymentsAPI);
  }

  async query<T>(queryString: string): Promise<T[]> {
    const response = await this.proxyRequest<{ QueryResponse: { [key: string]: T[] } }>(
      queryString,
      'GET',
      undefined,
      false,
      true
    );

    const resultKey = Object.keys(response.QueryResponse)[0];
    return response.QueryResponse[resultKey] || [];
  }

  async logSync(
    entityType: string,
    entityId: string,
    syncType: 'create' | 'update' | 'delete' | 'read',
    status: 'pending' | 'success' | 'failed' | 'retry',
    quickbooksId?: string,
    requestData?: any,
    responseData?: any,
    errorMessage?: string
  ): Promise<void> {
    try {
      // After a failed insert (RLS denial), skip further attempts this session
      // to avoid flooding the console with 400 errors
      if (this.syncLogEnabled === false) return;

      const { error } = await supabase.from('quickbooks_sync_log').insert({
        entity_type: entityType,
        entity_id: entityId,
        quickbooks_id: quickbooksId,
        sync_type: syncType,
        status,
        request_data: requestData,
        response_data: responseData,
        error_message: errorMessage,
        synced_at: status === 'success' ? new Date().toISOString() : null
      });

      if (error) {
        // RLS denial or schema error — disable sync logging for this session
        console.warn('Sync logging disabled for this session:', error.message);
        this.syncLogEnabled = false;
      } else {
        this.syncLogEnabled = true;
      }
    } catch {
      // Sync logging is best-effort — don't let failures propagate
      this.syncLogEnabled = false;
    }
  }

  getRealmId(): string | null {
    return this.realmId;
  }
}

export const qbClient = new QuickBooksClient();
