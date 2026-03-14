import { qbClient } from './client';
import { supabase } from '../supabase';

export interface QBCardToken {
  value: string;
  created: string;
}

export interface QBCardTokenRequest {
  card: {
    number: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    name: string;
  };
}

export interface QBBankAccountToken {
  value: string;
  created: string;
}

export interface QBBankAccountTokenRequest {
  bankAccount: {
    name: string;
    routingNumber: string;
    accountNumber: string;
    accountType: 'PERSONAL_CHECKING' | 'PERSONAL_SAVINGS' | 'BUSINESS_CHECKING' | 'BUSINESS_SAVINGS';
    phone: string;
  };
}

export interface QBDeviceInfo {
  macAddress?: string;
  ipAddress?: string;
  longitude?: string;
  latitude?: string;
  phoneNumber?: string;
  type?: string;
  encrypted?: boolean;
}

export interface QBPaymentContext {
  mobile: boolean;
  isEcommerce: boolean;
  deviceInfo?: QBDeviceInfo;
}

export interface QBChargeRequest {
  amount: string;
  currency: string;
  token?: string;
  bankAccountOnFile?: string;
  context?: QBPaymentContext;
  description?: string;
  capture?: boolean;
}

export interface QBChargeResponse {
  id: string;
  created: string;
  status: 'CAPTURED' | 'DECLINED' | 'CANCELLED' | 'SETTLED';
  amount: string;
  currency: string;
  token?: string;
  card?: {
    number: string;
    name: string;
    cardType: string;
    expMonth: string;
    expYear: string;
  };
  authCode?: string;
  captureDetail?: {
    created: string;
    amount: string;
  };
  avsStreet?: string;
  avsZip?: string;
  cardSecurityCodeMatch?: string;
}

export interface QBCaptureRequest {
  amount: string;
  context?: QBPaymentContext;
}

export interface QBECheckRequest {
  amount: string;
  currency: string;
  bankAccount: {
    name: string;
    routingNumber: string;
    accountNumber: string;
    accountType: 'PERSONAL_CHECKING' | 'PERSONAL_SAVINGS' | 'BUSINESS_CHECKING' | 'BUSINESS_SAVINGS';
    phone: string;
  };
  description?: string;
  context?: QBPaymentContext;
  checkNumber?: string;
  paymentMode?: 'WEB' | 'TEL' | 'PPD' | 'CCD';
}

export interface QBECheckResponse {
  id: string;
  created: string;
  status: 'PENDING' | 'SUCCEEDED' | 'DECLINED' | 'VOIDED' | 'REFUNDED';
  amount: string;
  currency: string;
  bankAccount?: {
    name: string;
    routingNumber: string;
    accountNumber: string;
    accountType: string;
    phone: string;
  };
  authCode?: string;
  checkNumber?: string;
}

export interface QBRefundRequest {
  amount?: string;
  description?: string;
}

export interface QBVoidRequest {
  amount?: string;
}

function sanitizeForLog(data: any): any {
  if (!data) return data;
  const allowedKeys = ['amount', 'currency', 'capture', 'description', 'paymentMode', 'checkNumber', 'cardOnFile', 'bankAccountOnFile'];
  const sanitized: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  }
  if (data.context) {
    sanitized.context = data.context;
  }
  return sanitized;
}

function sanitizeResponseForLog(response: any): any {
  if (!response) return response;
  return {
    id: response.id,
    status: response.status,
    amount: response.amount,
    currency: response.currency,
    created: response.created,
    authCode: response.authCode,
  };
}

export const quickbooksPayments = {
  async tokenizeCard(cardData: QBCardTokenRequest): Promise<QBCardToken> {
    const logId = `token_card_${Date.now()}`;
    try {
      await qbClient.logSync('payment_token', logId, 'create', 'pending', undefined, { operation: 'card_tokenize' });
      const response = await qbClient.post<QBCardToken>('payments/tokens', cardData, true);
      await qbClient.logSync('payment_token', logId, 'create', 'success', undefined, { operation: 'card_tokenize' }, { created: response.created });
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_token', logId, 'create', 'failed', undefined, { operation: 'card_tokenize' }, undefined, error.message);
      throw error;
    }
  },

  async tokenizeBankAccount(bankData: QBBankAccountTokenRequest): Promise<QBBankAccountToken> {
    const logId = `token_bank_${Date.now()}`;
    try {
      await qbClient.logSync('payment_token', logId, 'create', 'pending', undefined, { operation: 'bank_tokenize' });
      const response = await qbClient.post<QBBankAccountToken>('payments/tokens', bankData, true);
      await qbClient.logSync('payment_token', logId, 'create', 'success', undefined, { operation: 'bank_tokenize' }, { created: response.created });
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_token', logId, 'create', 'failed', undefined, { operation: 'bank_tokenize' }, undefined, error.message);
      throw error;
    }
  },

  async authorizeCard(
    amount: number,
    token: string,
    currency = 'USD',
    description?: string
  ): Promise<QBChargeResponse> {
    const chargeData: QBChargeRequest = {
      amount: amount.toFixed(2),
      currency,
      token,
      capture: false,
      context: { mobile: false, isEcommerce: true },
      description,
    };
    const logId = `auth_${Date.now()}`;
    try {
      await qbClient.logSync('payment_authorize', logId, 'create', 'pending', undefined, sanitizeForLog(chargeData));
      const response = await qbClient.post<QBChargeResponse>('payments/charges', chargeData, true);
      await qbClient.logSync('payment_authorize', logId, 'create', 'success', response.id, sanitizeForLog(chargeData), sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_authorize', logId, 'create', 'failed', undefined, sanitizeForLog(chargeData), undefined, error.message);
      throw error;
    }
  },

  async authorizeCardOnFile(
    amount: number,
    cardOnFileId: string,
    currency = 'USD',
    description?: string
  ): Promise<QBChargeResponse> {
    const chargeData = {
      amount: amount.toFixed(2),
      currency,
      cardOnFile: cardOnFileId,
      capture: false,
      context: { mobile: false, isEcommerce: true },
      description,
    };
    const logId = `auth_cof_${Date.now()}`;
    try {
      await qbClient.logSync('payment_authorize', logId, 'create', 'pending', undefined, sanitizeForLog(chargeData));
      const response = await qbClient.post<QBChargeResponse>('payments/charges', chargeData, true);
      await qbClient.logSync('payment_authorize', logId, 'create', 'success', response.id, sanitizeForLog(chargeData), sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_authorize', logId, 'create', 'failed', undefined, sanitizeForLog(chargeData), undefined, error.message);
      throw error;
    }
  },

  async chargeCard(
    amount: number,
    token: string,
    currency = 'USD',
    description?: string
  ): Promise<QBChargeResponse> {
    const chargeData: QBChargeRequest = {
      amount: amount.toFixed(2),
      currency,
      token,
      capture: true,
      context: { mobile: false, isEcommerce: true },
      description,
    };
    const logId = `charge_${Date.now()}`;
    try {
      await qbClient.logSync('payment_charge', logId, 'create', 'pending', undefined, sanitizeForLog(chargeData));
      const response = await qbClient.post<QBChargeResponse>('payments/charges', chargeData, true);
      await qbClient.logSync('payment_charge', logId, 'create', 'success', response.id, sanitizeForLog(chargeData), sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_charge', logId, 'create', 'failed', undefined, sanitizeForLog(chargeData), undefined, error.message);
      throw error;
    }
  },

  async captureCharge(
    chargeId: string,
    amount: number
  ): Promise<QBChargeResponse> {
    const captureData: QBCaptureRequest = {
      amount: amount.toFixed(2),
      context: { mobile: false, isEcommerce: true },
    };
    try {
      await qbClient.logSync('payment_capture', chargeId, 'update', 'pending', chargeId, captureData);
      const response = await qbClient.post<QBChargeResponse>(`payments/charges/${chargeId}/capture`, captureData, true);
      await qbClient.logSync('payment_capture', chargeId, 'update', 'success', chargeId, sanitizeForLog(captureData), sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_capture', chargeId, 'update', 'failed', chargeId, captureData, undefined, error.message);
      throw error;
    }
  },

  async processACH(
    amount: number,
    bankAccount: QBECheckRequest['bankAccount'],
    currency = 'USD',
    description?: string
  ): Promise<QBECheckResponse> {
    const echeckData: QBECheckRequest = {
      amount: amount.toFixed(2),
      currency,
      bankAccount,
      description,
      paymentMode: 'WEB',
      context: { mobile: false, isEcommerce: true },
    };
    const logId = `ach_${Date.now()}`;
    try {
      await qbClient.logSync('payment_ach', logId, 'create', 'pending', undefined, sanitizeForLog(echeckData));
      const response = await qbClient.post<QBECheckResponse>('payments/echecks', echeckData, true);
      await qbClient.logSync('payment_ach', logId, 'create', 'success', response.id, sanitizeForLog(echeckData), sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_ach', logId, 'create', 'failed', undefined, sanitizeForLog(echeckData), undefined, error.message);
      throw error;
    }
  },

  async processACHWithToken(
    amount: number,
    token: string,
    currency = 'USD',
    description?: string
  ): Promise<QBECheckResponse> {
    const echeckData = {
      amount: amount.toFixed(2),
      currency,
      bankAccountOnFile: token,
      description,
      paymentMode: 'WEB' as const,
      context: { mobile: false, isEcommerce: true },
    };
    const logId = `ach_token_${Date.now()}`;
    try {
      await qbClient.logSync('payment_ach', logId, 'create', 'pending', undefined, sanitizeForLog(echeckData));
      const response = await qbClient.post<QBECheckResponse>('payments/echecks', echeckData, true);
      await qbClient.logSync('payment_ach', logId, 'create', 'success', response.id, sanitizeForLog(echeckData), { id: response.id, status: response.status, amount: response.amount });
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_ach', logId, 'create', 'failed', undefined, sanitizeForLog(echeckData), undefined, error.message);
      throw error;
    }
  },

  async getCharge(chargeId: string): Promise<QBChargeResponse> {
    return qbClient.get<QBChargeResponse>(`payments/charges/${chargeId}`, true);
  },

  async getECheck(echeckId: string): Promise<QBECheckResponse> {
    return qbClient.get<QBECheckResponse>(`payments/echecks/${echeckId}`, true);
  },

  async refundCharge(
    chargeId: string,
    amount?: number,
    description?: string
  ): Promise<QBChargeResponse> {
    const refundData: QBRefundRequest = { description };
    if (amount) {
      refundData.amount = amount.toFixed(2);
    }
    try {
      await qbClient.logSync('payment_refund', chargeId, 'create', 'pending', chargeId, refundData);
      const response = await qbClient.post<QBChargeResponse>(`payments/charges/${chargeId}/refunds`, refundData, true);
      await qbClient.logSync('payment_refund', chargeId, 'create', 'success', chargeId, refundData, sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_refund', chargeId, 'create', 'failed', chargeId, refundData, undefined, error.message);
      throw error;
    }
  },

  async voidCharge(chargeId: string): Promise<QBChargeResponse> {
    // QB Payments API has no /void endpoint. For authorized (uncaptured) charges,
    // capture then immediately refund. For already-captured charges, just refund.
    try {
      await qbClient.logSync('payment_void', chargeId, 'update', 'pending', chargeId);

      // Try to capture first (may already be captured)
      try {
        const charge = await this.getCharge(chargeId);
        if (charge.status !== 'CAPTURED' && charge.status !== 'SETTLED') {
          await qbClient.post<QBChargeResponse>(`payments/charges/${chargeId}/capture`, {
            amount: charge.amount,
            context: { mobile: false, isEcommerce: true },
          }, true);
        }
      } catch {
        // Capture may fail if already captured — continue to refund
      }

      const response = await this.refundCharge(chargeId);
      await qbClient.logSync('payment_void', chargeId, 'update', 'success', chargeId, undefined, sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_void', chargeId, 'update', 'failed', chargeId, undefined, undefined, error.message);
      throw error;
    }
  },

  async refundECheck(
    echeckId: string,
    amount?: number,
    description?: string
  ): Promise<QBECheckResponse> {
    const refundData: QBRefundRequest = { description };
    if (amount) {
      refundData.amount = amount.toFixed(2);
    }
    try {
      await qbClient.logSync('payment_ach_refund', echeckId, 'create', 'pending', echeckId, refundData);
      const response = await qbClient.post<QBECheckResponse>(`payments/echecks/${echeckId}/refunds`, refundData, true);
      await qbClient.logSync('payment_ach_refund', echeckId, 'create', 'success', echeckId, refundData, sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_ach_refund', echeckId, 'create', 'failed', echeckId, refundData, undefined, error.message);
      throw error;
    }
  },

  async voidECheck(echeckId: string): Promise<QBECheckResponse> {
    // QB Payments API has no /void endpoint for echecks — use refund instead
    try {
      await qbClient.logSync('payment_ach_void', echeckId, 'update', 'pending', echeckId);
      const response = await this.refundECheck(echeckId);
      await qbClient.logSync('payment_ach_void', echeckId, 'update', 'success', echeckId, undefined, sanitizeResponseForLog(response));
      return response;
    } catch (error: any) {
      await qbClient.logSync('payment_ach_void', echeckId, 'update', 'failed', echeckId, undefined, undefined, error.message);
      throw error;
    }
  },

  async savePaymentMethod(params: {
    organizationId: string;
    userId: string;
    label: string;
    paymentType: 'credit_card' | 'debit_card' | 'bank_account' | 'ach';
    lastFour: string;
    expiryMonth?: number;
    expiryYear?: number;
    accountHolderName: string;
    bankName?: string;
    accountType?: 'checking' | 'savings';
    token: string;
    isDefault?: boolean;
  }) {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        label: params.label,
        payment_type: params.paymentType,
        last_four: params.lastFour,
        expiry_month: params.expiryMonth,
        expiry_year: params.expiryYear,
        account_holder_name: params.accountHolderName,
        bank_name: params.bankName,
        account_type: params.accountType,
        payment_token: params.token,
        payment_processor: 'quickbooks',
        is_default: params.isDefault || false,
      })
      .select()
      .maybeSingle();

    if (error) throw new Error(`Failed to save payment method: ${error.message}`);
    return data;
  },

  async deletePaymentMethod(paymentMethodId: string) {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', paymentMethodId);

    if (error) throw new Error(`Failed to delete payment method: ${error.message}`);
  },
};
