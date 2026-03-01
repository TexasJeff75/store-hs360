import { qbClient } from './client';
import { supabase } from '../supabase';

interface QBCardToken {
  value: string;
  card?: {
    number: string;
    name?: string;
    address?: {
      streetAddress?: string;
      city?: string;
      region?: string;
      country?: string;
      postalCode?: string;
    };
    cardType?: string;
    expMonth?: string;
    expYear?: string;
    cvc?: string;
  };
}

interface QBCharge {
  amount: string;
  currency: string;
  card: {
    name: string;
    number: string;
    address: {
      streetAddress: string;
      city: string;
      region: string;
      country: string;
      postalCode: string;
    };
    expMonth: string;
    expYear: string;
    cvc: string;
  } | {
    token: string;
  };
  capture?: boolean;
  context?: {
    mobile: boolean;
    isEcommerce: boolean;
  };
}

interface QBChargeResponse {
  id: string;
  status: 'CAPTURED' | 'AUTHORIZED' | 'SETTLED' | 'VOIDED' | 'DECLINED';
  amount: string;
  currency: string;
  created: string;
  authCode?: string;
  card?: {
    name: string;
    number: string;
    cardType: string;
  };
}

interface QBPayment {
  CustomerRef: {
    value: string;
  };
  TotalAmt: number;
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{
      TxnId: string;
      TxnType: 'Invoice';
    }>;
  }>;
  PrivateNote?: string;
}

interface QBPaymentResponse {
  Payment: QBPayment & {
    Id: string;
    TxnDate: string;
    SyncToken: string;
  };
  time: string;
}

export const quickbooksPayments = {
  async tokenizeCard(cardData: {
    number: string;
    name: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    address: {
      streetAddress: string;
      city: string;
      region: string;
      country: string;
      postalCode: string;
    };
  }): Promise<string> {
    const tokenRequest: QBCardToken = {
      value: cardData.number,
      card: {
        number: cardData.number,
        name: cardData.name,
        expMonth: cardData.expMonth,
        expYear: cardData.expYear,
        cvc: cardData.cvc,
        address: cardData.address
      }
    };

    const response = await qbClient.post<{ value: string }>(
      'tokens',
      tokenRequest,
      true
    );

    return response.value;
  },

  async authorizePayment(
    amount: number,
    token: string,
    cardholderName: string
  ): Promise<QBChargeResponse> {
    const chargeData: QBCharge = {
      amount: amount.toFixed(2),
      currency: 'USD',
      card: {
        token
      },
      capture: false,
      context: {
        mobile: false,
        isEcommerce: true
      }
    };

    const response = await qbClient.post<QBChargeResponse>(
      'payments/charges',
      chargeData,
      true
    );

    return response;
  },

  async capturePayment(chargeId: string, amount?: number): Promise<QBChargeResponse> {
    const captureData = amount ? {
      amount: amount.toFixed(2)
    } : {};

    const response = await qbClient.post<QBChargeResponse>(
      `payments/charges/${chargeId}/capture`,
      captureData,
      true
    );

    return response;
  },

  async voidPayment(chargeId: string): Promise<QBChargeResponse> {
    const response = await qbClient.post<QBChargeResponse>(
      `payments/charges/${chargeId}/refunds`,
      {
        amount: '0.00',
        description: 'Voided authorization'
      },
      true
    );

    return response;
  },

  async refundPayment(chargeId: string, amount: number): Promise<QBChargeResponse> {
    const response = await qbClient.post<QBChargeResponse>(
      `payments/charges/${chargeId}/refunds`,
      {
        amount: amount.toFixed(2)
      },
      true
    );

    return response;
  },

  async recordPaymentToInvoice(
    customerId: string,
    invoiceId: string,
    amount: number,
    chargeId: string
  ): Promise<string> {
    const paymentData: QBPayment = {
      CustomerRef: {
        value: customerId
      },
      TotalAmt: amount,
      Line: [{
        Amount: amount,
        LinkedTxn: [{
          TxnId: invoiceId,
          TxnType: 'Invoice'
        }]
      }],
      PrivateNote: `QuickBooks Payments Charge ID: ${chargeId}`
    };

    const response = await qbClient.post<QBPaymentResponse>('payment', paymentData);
    return response.Payment.Id;
  },

  async processInvoicePayment(
    orderId: string,
    invoiceId: string,
    paymentMethodId: string
  ): Promise<{ chargeId: string; paymentId: string }> {
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, payment_methods(*)')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        throw new Error('Order not found');
      }

      const { data: paymentMethod, error: pmError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('id', paymentMethodId)
        .single();

      if (pmError || !paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (!paymentMethod.quickbooks_payment_method_id) {
        throw new Error('Payment method not synced with QuickBooks');
      }

      await qbClient.logSync(
        'payment',
        orderId,
        'create',
        'pending',
        undefined,
        { orderId, invoiceId, paymentMethodId }
      );

      const chargeResponse = await this.authorizePayment(
        Number(order.total),
        paymentMethod.quickbooks_payment_method_id,
        paymentMethod.account_holder_name
      );

      if (chargeResponse.status === 'DECLINED') {
        throw new Error('Payment was declined');
      }

      let customerId: string;
      if (order.location_id) {
        const { data: location } = await supabase
          .from('locations')
          .select('quickbooks_customer_id')
          .eq('id', order.location_id)
          .single();
        customerId = location!.quickbooks_customer_id!;
      } else {
        const { data: org } = await supabase
          .from('organizations')
          .select('quickbooks_customer_id')
          .eq('id', order.organization_id!)
          .single();
        customerId = org!.quickbooks_customer_id!;
      }

      const qbPaymentId = await this.recordPaymentToInvoice(
        customerId,
        invoiceId,
        Number(order.total),
        chargeResponse.id
      );

      await qbClient.logSync(
        'payment',
        orderId,
        'create',
        'success',
        qbPaymentId,
        { orderId, invoiceId, chargeId: chargeResponse.id },
        { chargeResponse, qbPaymentId }
      );

      await supabase
        .from('orders')
        .update({
          quickbooks_payment_id: qbPaymentId,
          payment_status: 'authorized',
          payment_authorization_id: chargeResponse.id
        })
        .eq('id', orderId);

      return {
        chargeId: chargeResponse.id,
        paymentId: qbPaymentId
      };
    } catch (error: any) {
      await qbClient.logSync(
        'payment',
        orderId,
        'create',
        'failed',
        undefined,
        undefined,
        undefined,
        error.message
      );

      await supabase
        .from('orders')
        .update({
          payment_status: 'failed'
        })
        .eq('id', orderId);

      throw error;
    }
  },

  async captureOrderPayment(orderId: string): Promise<void> {
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order || !order.payment_authorization_id) {
      throw new Error('No authorization found for this order');
    }

    const captureResponse = await this.capturePayment(order.payment_authorization_id);

    await supabase
      .from('orders')
      .update({
        payment_status: 'captured',
        payment_captured_at: new Date().toISOString()
      })
      .eq('id', orderId);
  },

  async savePaymentMethod(
    organizationId: string,
    locationId: string | null,
    cardData: {
      number: string;
      name: string;
      expMonth: string;
      expYear: string;
      cvc: string;
      address: {
        streetAddress: string;
        city: string;
        region: string;
        country: string;
        postalCode: string;
      };
    },
    label: string,
    isDefault: boolean = false
  ): Promise<string> {
    const token = await this.tokenizeCard(cardData);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('User not authenticated');
    }

    const lastFour = cardData.number.slice(-4);

    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .insert({
        organization_id: organizationId,
        location_id: locationId,
        user_id: user.user.id,
        label,
        payment_type: 'credit_card',
        last_four: lastFour,
        expiry_month: parseInt(cardData.expMonth),
        expiry_year: parseInt(cardData.expYear),
        account_holder_name: cardData.name,
        is_default: isDefault,
        payment_token: token,
        payment_processor: 'quickbooks',
        quickbooks_payment_method_id: token,
        last_synced_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return paymentMethod.id;
  }
};
