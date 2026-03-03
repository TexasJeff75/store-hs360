import { qbClient } from './client';
import { supabase } from '../supabase';

interface QBCustomer {
  Id?: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Notes?: string;
  Active?: boolean;
  SyncToken?: string;
}

interface QBCustomerResponse {
  Customer: QBCustomer;
  time: string;
}

export const quickbooksCustomers = {
  async syncOrganization(organizationId: string): Promise<string> {
    let existingQbId: string | null = null;
    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        throw new Error('Organization not found');
      }

      existingQbId = org.quickbooks_customer_id || null;

      let qbCustomer: QBCustomer = {
        DisplayName: org.name,
        CompanyName: org.name,
        PrimaryEmailAddr: org.contact_email ? {
          Address: org.contact_email
        } : undefined,
        PrimaryPhone: org.contact_phone ? {
          FreeFormNumber: org.contact_phone
        } : undefined,
        Notes: org.description || undefined,
        Active: org.is_active
      };

      if (org.billing_address) {
        qbCustomer.BillAddr = {
          Line1: org.billing_address.address1,
          Line2: org.billing_address.address2,
          City: org.billing_address.city,
          CountrySubDivisionCode: org.billing_address.state_or_province,
          PostalCode: org.billing_address.postal_code,
          Country: org.billing_address.country_code || 'US'
        };
      }

      let quickbooksId: string;

      if (existingQbId) {
        const existing = await this.getCustomer(existingQbId);
        qbCustomer.Id = existing.Id;
        qbCustomer.SyncToken = existing.SyncToken;

        await qbClient.logSync(
          'customer',
          organizationId,
          'update',
          'pending',
          existingQbId,
          qbCustomer
        );

        const response = await qbClient.post<QBCustomerResponse>('customer', qbCustomer);
        quickbooksId = response.Customer.Id!;

        await qbClient.logSync(
          'customer',
          organizationId,
          'update',
          'success',
          quickbooksId,
          qbCustomer,
          response.Customer
        );
      } else {
        await qbClient.logSync(
          'customer',
          organizationId,
          'create',
          'pending',
          undefined,
          qbCustomer
        );

        const response = await qbClient.post<QBCustomerResponse>('customer', qbCustomer);
        quickbooksId = response.Customer.Id!;

        await qbClient.logSync(
          'customer',
          organizationId,
          'create',
          'success',
          quickbooksId,
          qbCustomer,
          response.Customer
        );
      }

      await supabase
        .from('organizations')
        .update({
          quickbooks_customer_id: quickbooksId,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', organizationId);

      return quickbooksId;
    } catch (error: any) {
      await qbClient.logSync(
        'customer',
        organizationId,
        existingQbId ? 'update' : 'create',
        'failed',
        existingQbId || undefined,
        undefined,
        undefined,
        error.message
      );
      throw error;
    }
  },

  async syncLocation(locationId: string): Promise<string> {
    let existingQbId: string | null = null;
    try {
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .select('*, organizations!inner(*)')
        .eq('id', locationId)
        .single();

      if (locationError || !location) {
        throw new Error('Location not found');
      }

      existingQbId = location.quickbooks_customer_id || null;

      const displayName = `${location.organizations.name} - ${location.name}`;

      let qbCustomer: QBCustomer = {
        DisplayName: displayName,
        CompanyName: location.organizations.name,
        PrimaryEmailAddr: location.contact_email ? {
          Address: location.contact_email
        } : undefined,
        PrimaryPhone: location.contact_phone ? {
          FreeFormNumber: location.contact_phone
        } : undefined,
        Notes: `Location: ${location.name}${location.code ? ` (${location.code})` : ''}`,
        Active: location.is_active
      };

      if (location.address) {
        qbCustomer.BillAddr = {
          Line1: location.address.address1,
          Line2: location.address.address2,
          City: location.address.city,
          CountrySubDivisionCode: location.address.state_or_province,
          PostalCode: location.address.postal_code,
          Country: location.address.country_code || 'US'
        };
      }

      let quickbooksId: string;

      if (existingQbId) {
        const existing = await this.getCustomer(existingQbId);
        qbCustomer.Id = existing.Id;
        qbCustomer.SyncToken = existing.SyncToken;

        await qbClient.logSync(
          'customer',
          locationId,
          'update',
          'pending',
          existingQbId,
          qbCustomer
        );

        const response = await qbClient.post<QBCustomerResponse>('customer', qbCustomer);
        quickbooksId = response.Customer.Id!;

        await qbClient.logSync(
          'customer',
          locationId,
          'update',
          'success',
          quickbooksId,
          qbCustomer,
          response.Customer
        );
      } else {
        await qbClient.logSync(
          'customer',
          locationId,
          'create',
          'pending',
          undefined,
          qbCustomer
        );

        const response = await qbClient.post<QBCustomerResponse>('customer', qbCustomer);
        quickbooksId = response.Customer.Id!;

        await qbClient.logSync(
          'customer',
          locationId,
          'create',
          'success',
          quickbooksId,
          qbCustomer,
          response.Customer
        );
      }

      await supabase
        .from('locations')
        .update({
          quickbooks_customer_id: quickbooksId,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', locationId);

      return quickbooksId;
    } catch (error: any) {
      await qbClient.logSync(
        'customer',
        locationId,
        existingQbId ? 'update' : 'create',
        'failed',
        existingQbId || undefined,
        undefined,
        undefined,
        error.message
      );
      throw error;
    }
  },

  async getCustomer(customerId: string): Promise<QBCustomer> {
    const response = await qbClient.get<QBCustomerResponse>(`customer/${customerId}`);
    return response.Customer;
  },

  async findCustomerByName(name: string): Promise<QBCustomer | null> {
    const sanitized = name.replace(/'/g, "''").replace(/[\\;]/g, '');
    const customers = await qbClient.query<QBCustomer>(
      `SELECT * FROM Customer WHERE DisplayName = '${sanitized}'`
    );
    return customers.length > 0 ? customers[0] : null;
  },

  async batchSyncOrganizations(): Promise<{ success: string[]; failed: string[] }> {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true);

    if (!orgs || orgs.length === 0) {
      return { success: [], failed: [] };
    }

    const success: string[] = [];
    const failed: string[] = [];

    for (const org of orgs) {
      try {
        await this.syncOrganization(org.id);
        success.push(org.id);
      } catch (error) {
        console.error(`Failed to sync organization ${org.id}:`, error);
        failed.push(org.id);
      }
    }

    return { success, failed };
  }
};
