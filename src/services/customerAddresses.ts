import { supabase } from './supabase';

export interface CustomerAddress {
  id: string;
  user_id: string;
  organization_id?: string;
  address_type: 'shipping' | 'billing';
  label: string;
  first_name: string;
  last_name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state_or_province: string;
  postal_code: string;
  country_code: string;
  phone?: string;
  email?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateAddressData {
  user_id: string;
  organization_id?: string;
  address_type: 'shipping' | 'billing';
  label: string;
  first_name: string;
  last_name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state_or_province: string;
  postal_code: string;
  country_code: string;
  phone?: string;
  email?: string;
  is_default?: boolean;
}

/**
 * Customer Address Service
 *
 * Uses Supabase RPC functions with SECURITY DEFINER to bypass RLS entirely.
 * This solves the persistent issue where RLS policies blocked admins from
 * seeing all organization addresses during checkout.
 */
class CustomerAddressService {
  /**
   * Get all active addresses for a user (personal, no organization).
   */
  async getUserAddresses(userId: string): Promise<CustomerAddress[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_addresses', {
        p_user_id: userId,
      });

      if (error) {
        console.error('RPC get_user_addresses error:', error);
        // Fallback to direct query
        return this.getUserAddressesFallback(userId);
      }
      return (data as CustomerAddress[]) || [];
    } catch (error) {
      console.error('Error fetching user addresses:', error);
      return [];
    }
  }

  /**
   * Get all active addresses for an organization.
   * Uses SECURITY DEFINER RPC to bypass RLS - any authenticated user can see all org addresses.
   */
  async getOrganizationAddresses(organizationId: string): Promise<CustomerAddress[]> {
    try {
      const { data, error } = await supabase.rpc('get_organization_addresses', {
        org_id: organizationId,
      });

      if (error) {
        console.error('RPC get_organization_addresses error:', error);
        // Fallback to direct query
        return this.getOrganizationAddressesFallback(organizationId);
      }
      return (data as CustomerAddress[]) || [];
    } catch (error) {
      console.error('Error fetching organization addresses:', error);
      return [];
    }
  }

  /**
   * Get the default address for a given scope.
   */
  async getDefaultAddress(
    userId: string,
    addressType: 'shipping' | 'billing',
    organizationId?: string
  ): Promise<CustomerAddress | null> {
    try {
      let addresses: CustomerAddress[];
      if (organizationId) {
        addresses = await this.getOrganizationAddresses(organizationId);
      } else {
        addresses = await this.getUserAddresses(userId);
      }

      return addresses.find(
        (a) => a.address_type === addressType && a.is_default
      ) || null;
    } catch (error) {
      console.error('Error fetching default address:', error);
      return null;
    }
  }

  /**
   * Create a new address using RPC.
   */
  async createAddress(addressData: CreateAddressData): Promise<CustomerAddress | null> {
    try {
      const { data, error } = await supabase.rpc('create_customer_address', {
        p_user_id: addressData.user_id,
        p_organization_id: addressData.organization_id || null,
        p_address_type: addressData.address_type,
        p_label: addressData.label,
        p_first_name: addressData.first_name,
        p_last_name: addressData.last_name,
        p_company: addressData.company || '',
        p_address1: addressData.address1,
        p_address2: addressData.address2 || '',
        p_city: addressData.city,
        p_state_or_province: addressData.state_or_province,
        p_postal_code: addressData.postal_code,
        p_country_code: addressData.country_code || 'US',
        p_phone: addressData.phone || '',
        p_email: addressData.email || '',
        p_is_default: addressData.is_default || false,
      });

      if (error) {
        console.error('RPC create_customer_address error:', error);
        // Fallback to direct insert
        return this.createAddressFallback(addressData);
      }
      return data as CustomerAddress;
    } catch (error) {
      console.error('Error creating address:', error);
      return null;
    }
  }

  /**
   * Update an existing address using RPC.
   */
  async updateAddress(addressId: string, updates: Partial<CreateAddressData>): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('update_customer_address', {
        p_address_id: addressId,
        p_label: updates.label ?? null,
        p_first_name: updates.first_name ?? null,
        p_last_name: updates.last_name ?? null,
        p_company: updates.company ?? null,
        p_address1: updates.address1 ?? null,
        p_address2: updates.address2 ?? null,
        p_city: updates.city ?? null,
        p_state_or_province: updates.state_or_province ?? null,
        p_postal_code: updates.postal_code ?? null,
        p_country_code: updates.country_code ?? null,
        p_phone: updates.phone ?? null,
        p_email: updates.email ?? null,
        p_is_default: updates.is_default ?? null,
        p_address_type: updates.address_type ?? null,
      });

      if (error) {
        console.error('RPC update_customer_address error:', error);
        // Fallback
        return this.updateAddressFallback(addressId, updates);
      }
      return true;
    } catch (error) {
      console.error('Error updating address:', error);
      return false;
    }
  }

  /**
   * Soft-delete an address.
   */
  async deleteAddress(addressId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('delete_customer_address', {
        p_address_id: addressId,
      });

      if (error) {
        console.error('RPC delete_customer_address error:', error);
        // Fallback
        const { error: fallbackError } = await supabase
          .from('customer_addresses')
          .update({ is_active: false })
          .eq('id', addressId);
        return !fallbackError;
      }
      return data as boolean;
    } catch (error) {
      console.error('Error deleting address:', error);
      return false;
    }
  }

  /**
   * Set an address as the default for its type/scope.
   */
  async setDefaultAddress(addressId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('set_default_customer_address', {
        p_address_id: addressId,
      });

      if (error) {
        console.error('RPC set_default_customer_address error:', error);
        return false;
      }
      return data as boolean;
    } catch (error) {
      console.error('Error setting default address:', error);
      return false;
    }
  }

  // ---- Fallback methods using direct queries (in case RPC not yet deployed) ----

  private async getUserAddressesFallback(userId: string): Promise<CustomerAddress[]> {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', userId)
      .is('organization_id', null)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fallback getUserAddresses error:', error);
      return [];
    }
    return data || [];
  }

  private async getOrganizationAddressesFallback(organizationId: string): Promise<CustomerAddress[]> {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fallback getOrganizationAddresses error:', error);
      return [];
    }
    return data || [];
  }

  private async createAddressFallback(addressData: CreateAddressData): Promise<CustomerAddress | null> {
    if (addressData.is_default) {
      await this.clearDefaultAddressFallback(
        addressData.user_id,
        addressData.address_type,
        addressData.organization_id
      );
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .insert([addressData])
      .select()
      .single();

    if (error) {
      console.error('Fallback createAddress error:', error);
      return null;
    }
    return data;
  }

  private async updateAddressFallback(addressId: string, updates: Partial<CreateAddressData>): Promise<boolean> {
    if (updates.is_default) {
      const { data: existing } = await supabase
        .from('customer_addresses')
        .select('user_id, address_type, organization_id')
        .eq('id', addressId)
        .single();

      if (existing) {
        await this.clearDefaultAddressFallback(
          existing.user_id,
          existing.address_type,
          existing.organization_id
        );
      }
    }

    const { error } = await supabase
      .from('customer_addresses')
      .update(updates)
      .eq('id', addressId);

    return !error;
  }

  private async clearDefaultAddressFallback(
    userId: string,
    addressType: string,
    organizationId?: string | null
  ): Promise<void> {
    let query = supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('address_type', addressType)
      .eq('is_default', true);

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else {
      query = query.eq('user_id', userId).is('organization_id', null);
    }

    await query;
  }
}

export const customerAddressService = new CustomerAddressService();
