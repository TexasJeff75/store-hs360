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

export interface QBChargeRequest {
  amount: string;
  currency: string;
  token?: string;
  card?: { number: string; expMonth: string; expYear: string; cvc: string; name: string };
  bankAccountOnFile?: string;
  context?: {
    mobile: boolean;
    isEcommerce: boolean;
  };
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
  context?: {
    mobile: boolean;
    isEcommerce: boolean;
  };
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
  context?: {
    mobile: boolean;
    isEcommerce: boolean;
  };
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

export const quickbooksPayments = {
  async tokenizeCard(cardData: QBCardTokenRequest): Promise<QBCardToken> {
    const response = await qbClient.post<QBCardToken>(
      'payments/tokens',
      cardData,
      true
    );
    return response;
  },

  async tokenizeBankAccount(bankData: QBBankAccountTokenRequest): Promise<QBBankAccountToken> {
    const response = await qbClient.post<QBBankAccountToken>(
      'payments/tokens',
      bankData,
      true
    );
    return response;
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
      context: {
        mobile: false,
        isEcommerce: true,
      },
      description,
    };

    const response = await qbClient.post<QBChargeResponse>(
      'payments/charges',
      chargeData,
      true
    );
    return response;
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
      context: {
        mobile: false,
        isEcommerce: true,
      },
      description,
    };

    const response = await qbClient.post<QBChargeResponse>(
      'payments/charges',
      chargeData,
      true
    );
    return response;
  },

  async captureCharge(
    chargeId: string,
    amount: number
  ): Promise<QBChargeResponse> {
    const captureData: QBCaptureRequest = {
      amount: amount.toFixed(2),
      context: {
        mobile: false,
        isEcommerce: true,
      },
    };

    const response = await qbClient.post<QBChargeResponse>(
      `payments/charges/${chargeId}/capture`,
      captureData,
      true
    );
    return response;
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
      context: {
        mobile: false,
        isEcommerce: true,
      },
    };

    const response = await qbClient.post<QBECheckResponse>(
      'payments/echecks',
      echeckData,
      true
    );
    return response;
  },

  async getCharge(chargeId: string): Promise<QBChargeResponse> {
    return qbClient.get<QBChargeResponse>(
      `payments/charges/${chargeId}`,
      true
    );
  },

  async getECheck(echeckId: string): Promise<QBECheckResponse> {
    return qbClient.get<QBECheckResponse>(
      `payments/echecks/${echeckId}`,
      true
    );
  },

  async refundCharge(
    chargeId: string,
    amount?: number,
    description?: string
  ): Promise<QBChargeResponse> {
    const refundData: QBRefundRequest = {
      description,
    };
    if (amount) {
      refundData.amount = amount.toFixed(2);
    }

    return qbClient.post<QBChargeResponse>(
      `payments/charges/${chargeId}/refunds`,
      refundData,
      true
    );
  },

  async voidCharge(chargeId: string): Promise<QBChargeResponse> {
    return qbClient.post<QBChargeResponse>(
      `payments/charges/${chargeId}/void`,
      {},
      true
    );
  },

  async refundECheck(
    echeckId: string,
    amount?: number,
    description?: string
  ): Promise<QBECheckResponse> {
    const refundData: QBRefundRequest = {
      description,
    };
    if (amount) {
      refundData.amount = amount.toFixed(2);
    }

    return qbClient.post<QBECheckResponse>(
      `payments/echecks/${echeckId}/refunds`,
      refundData,
      true
    );
  },

  async voidECheck(echeckId: string): Promise<QBECheckResponse> {
    return qbClient.post<QBECheckResponse>(
      `payments/echecks/${echeckId}/void`,
      {},
      true
    );
  },

  async savePaymentMethod(params: {
    organizationId: string;
    locationId?: string;
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
        location_id: params.locationId || null,
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
