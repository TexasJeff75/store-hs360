import { quickbooksOAuth } from './oauth';
import { supabase } from '../supabase';

const QB_ENVIRONMENT = import.meta.env.VITE_QB_ENVIRONMENT || 'sandbox';

const QB_API_BASE_URL = QB_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

const QB_PAYMENTS_BASE_URL = QB_ENVIRONMENT === 'production'
  ? 'https://api.intuit.com/quickbooks/v4'
  : 'https://sandbox.api.intuit.com/quickbooks/v4';

export interface QuickBooksAPIError {
  message: string;
  code?: string;
  detail?: string;
}

export class QuickBooksClient {
  private realmId: string | null = null;
  private accessToken: string | null = null;

  async initialize(): Promise<void> {
    const credentials = await quickbooksOAuth.getActiveCredentials();
    if (!credentials) {
      throw new Error('No active QuickBooks connection found. Please connect your QuickBooks account.');
    }

    this.realmId = credentials.realm_id;
    this.accessToken = credentials.access_token;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.accessToken || !this.realmId) {
      await this.initialize();
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    usePaymentsAPI = false
  ): Promise<T> {
    await this.ensureInitialized();

    const baseUrl = usePaymentsAPI ? QB_PAYMENTS_BASE_URL : `${QB_API_BASE_URL}/v3/company/${this.realmId}`;
    const url = usePaymentsAPI ? `${baseUrl}/${endpoint}` : `${baseUrl}/${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      let errorMessage = `QuickBooks API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.Fault?.Error?.[0]?.Message || errorData.message || errorMessage;
      } catch {
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async get<T>(endpoint: string, usePaymentsAPI = false): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, usePaymentsAPI);
  }

  async post<T>(endpoint: string, body: any, usePaymentsAPI = false): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body)
      },
      usePaymentsAPI
    );
  }

  async put<T>(endpoint: string, body: any, usePaymentsAPI = false): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body)
      },
      usePaymentsAPI
    );
  }

  async delete(endpoint: string, usePaymentsAPI = false): Promise<void> {
    await this.request(endpoint, { method: 'DELETE' }, usePaymentsAPI);
  }

  async query<T>(queryString: string): Promise<T[]> {
    const encodedQuery = encodeURIComponent(queryString);
    const response = await this.get<{ QueryResponse: { [key: string]: T[] } }>(
      `query?query=${encodedQuery}`
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
