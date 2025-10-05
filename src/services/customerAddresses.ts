import { supabase } from './supabase';

export interface CustomerAddress {
  id: string;
  user_id: string;
  organization_id?: string;
  location_id?: string;
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

export interface CreateAddressData {
  user_id: string;
  organization_id?: string;
  location_id?: string;
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

class CustomerAddressService {
  async getUserAddresses(userId: string, addressType?: 'shipping' | 'billing'): Promise<CustomerAddress[]> {
    try {
      let query = supabase
        .from('customer_addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (addressType) {
        query = query.eq('address_type', addressType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user addresses:', error);
      return [];
    }
  }

  async getOrganizationAddresses(
    organizationId: string,
    addressType?: 'shipping' | 'billing'
  ): Promise<CustomerAddress[]> {
    try {
      let query = supabase
        .from('customer_addresses')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (addressType) {
        query = query.eq('address_type', addressType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching organization addresses:', error);
      return [];
    }
  }

  async getLocationAddresses(
    locationId: string,
    addressType?: 'shipping' | 'billing'
  ): Promise<CustomerAddress[]> {
    try {
      let query = supabase
        .from('customer_addresses')
        .select('*')
        .eq('location_id', locationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (addressType) {
        query = query.eq('address_type', addressType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching location addresses:', error);
      return [];
    }
  }

  async getDefaultAddress(
    userId: string,
    addressType: 'shipping' | 'billing'
  ): Promise<CustomerAddress | null> {
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('address_type', addressType)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching default address:', error);
      return null;
    }
  }

  async createAddress(addressData: CreateAddressData): Promise<CustomerAddress | null> {
    try {
      if (addressData.is_default) {
        await this.clearDefaultAddress(addressData.user_id, addressData.address_type);
      }

      const { data, error } = await supabase
        .from('customer_addresses')
        .insert([addressData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating address:', error);
      return null;
    }
  }

  async updateAddress(addressId: string, updates: Partial<CreateAddressData>): Promise<boolean> {
    try {
      if (updates.is_default) {
        const { data: existingAddress } = await supabase
          .from('customer_addresses')
          .select('user_id, address_type')
          .eq('id', addressId)
          .single();

        if (existingAddress) {
          await this.clearDefaultAddress(existingAddress.user_id, existingAddress.address_type);
        }
      }

      const { error } = await supabase
        .from('customer_addresses')
        .update(updates)
        .eq('id', addressId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating address:', error);
      return false;
    }
  }

  async deleteAddress(addressId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('customer_addresses')
        .update({ is_active: false })
        .eq('id', addressId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting address:', error);
      return false;
    }
  }

  async setDefaultAddress(addressId: string): Promise<boolean> {
    try {
      const { data: address } = await supabase
        .from('customer_addresses')
        .select('user_id, address_type')
        .eq('id', addressId)
        .single();

      if (!address) return false;

      await this.clearDefaultAddress(address.user_id, address.address_type);

      const { error } = await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting default address:', error);
      return false;
    }
  }

  private async clearDefaultAddress(userId: string, addressType: 'shipping' | 'billing'): Promise<void> {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('address_type', addressType)
      .eq('is_default', true);
  }
}

export const customerAddressService = new CustomerAddressService();
