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
        errorMessage = errorData.error || errorMessage;
      } catch {
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
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
    return this.proxyRequest<T>(endpoint, 'POST', body, usePaymentsAPI);
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
    await supabase.from('quickbooks_sync_log').insert({
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
  }

  getRealmId(): string | null {
    return this.realmId;
  }
}

export const qbClient = new QuickBooksClient();
