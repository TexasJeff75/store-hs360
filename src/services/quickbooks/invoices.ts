import { qbClient } from './client';
import { quickbooksCustomers } from './customers';
import { supabase } from '../supabase';

interface QBInvoiceLine {
  DetailType: 'SalesItemLineDetail';
  Amount: number;
  SalesItemLineDetail: {
    ItemRef: {
      value: string;
      name?: string;
    };
    Qty: number;
    UnitPrice: number;
    TaxCodeRef?: {
      value: string;
    };
  };
  Description?: string;
}

interface QBInvoice {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  CustomerRef: {
    value: string;
    name?: string;
  };
  Line: QBInvoiceLine[];
  BillEmail?: {
    Address: string;
  };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  CustomerMemo?: {
    value: string;
  };
  PrivateNote?: string;
  TotalAmt?: number;
  Balance?: number;
  SyncToken?: string;
}

interface QBInvoiceResponse {
  Invoice: QBInvoice;
  time: string;
}

export const quickbooksInvoices = {
  async createInvoiceFromOrder(orderId: string): Promise<string> {
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        throw new Error('Order not found');
      }

      let customerId: string;

      if (order.location_id) {
        const { data: location } = await supabase
          .from('locations')
          .select('quickbooks_customer_id')
          .eq('id', order.location_id)
          .single();

        if (location?.quickbooks_customer_id) {
          customerId = location.quickbooks_customer_id;
        } else {
          customerId = await quickbooksCustomers.syncLocation(order.location_id);
        }
      } else if (order.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('quickbooks_customer_id')
          .eq('id', order.organization_id)
          .single();

        if (org?.quickbooks_customer_id) {
          customerId = org.quickbooks_customer_id;
        } else {
          customerId = await quickbooksCustomers.syncOrganization(order.organization_id);
        }
      } else {
        throw new Error('Order must have either organization_id or location_id');
      }

      const invoiceLines: QBInvoiceLine[] = [];

      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          invoiceLines.push({
            DetailType: 'SalesItemLineDetail',
            Amount: Number(item.subtotal || (item.quantity * item.price)),
            SalesItemLineDetail: {
              ItemRef: {
                value: '1',
                name: 'Services'
              },
              Qty: item.quantity,
              UnitPrice: Number(item.price)
            },
            Description: `${item.name}${item.sku ? ` (SKU: ${item.sku})` : ''}`
          });
        }
      }

      const invoiceData: QBInvoice = {
        CustomerRef: {
          value: customerId
        },
        Line: invoiceLines,
        TxnDate: new Date().toISOString().split('T')[0],
        DueDate: this.calculateDueDate(30)
      };

      if (order.customer_email) {
        invoiceData.BillEmail = {
          Address: order.customer_email
        };
      }

      if (order.billing_address) {
        invoiceData.BillAddr = {
          Line1: order.billing_address.address1,
          Line2: order.billing_address.address2,
          City: order.billing_address.city,
          CountrySubDivisionCode: order.billing_address.state_or_province,
          PostalCode: order.billing_address.postal_code,
          Country: order.billing_address.country_code || 'US'
        };
      }

      if (order.notes) {
        invoiceData.CustomerMemo = {
          value: order.notes
        };
      }

      invoiceData.PrivateNote = `Order ID: ${order.id}${order.order_number ? ` | Order #${order.order_number}` : ''}`;

      await qbClient.logSync(
        'invoice',
        orderId,
        'create',
        'pending',
        undefined,
        invoiceData
      );

      const response = await qbClient.post<QBInvoiceResponse>('invoice', invoiceData);
      const invoiceId = response.Invoice.Id!;

      await qbClient.logSync(
        'invoice',
        orderId,
        'create',
        'success',
        invoiceId,
        invoiceData,
        response.Invoice
      );

      await supabase
        .from('orders')
        .update({
          quickbooks_invoice_id: invoiceId,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString()
        })
        .eq('id', orderId);

      return invoiceId;
    } catch (error: any) {
      await qbClient.logSync(
        'invoice',
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
          sync_status: 'failed'
        })
        .eq('id', orderId);

      throw error;
    }
  },

  async getInvoice(invoiceId: string): Promise<QBInvoice> {
    const response = await qbClient.get<QBInvoiceResponse>(`invoice/${invoiceId}`);
    return response.Invoice;
  },

  async sendInvoice(invoiceId: string, email: string): Promise<void> {
    await qbClient.post(
      `invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}`,
      {}
    );
  },

  async voidInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);

    const voidData = {
      Id: invoice.Id,
      SyncToken: invoice.SyncToken
    };

    await qbClient.post(`invoice/${invoiceId}?operation=void`, voidData);
  },

  calculateDueDate(daysFromNow: number): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysFromNow);
    return dueDate.toISOString().split('T')[0];
  },

  async getInvoicePdfUrl(invoiceId: string): Promise<string> {
    const realmId = qbClient.getRealmId();
    if (!realmId) {
      throw new Error('QuickBooks not connected');
    }

    const env = import.meta.env.VITE_QB_ENVIRONMENT || 'sandbox';
    const baseUrl = env === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    return `${baseUrl}/v3/company/${realmId}/invoice/${invoiceId}/pdf`;
  },

  async batchCreateInvoices(orderIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const orderId of orderIds) {
      try {
        await this.createInvoiceFromOrder(orderId);
        success.push(orderId);
      } catch (error) {
        console.error(`Failed to create invoice for order ${orderId}:`, error);
        failed.push(orderId);
      }
    }

    return { success, failed };
  }
};
