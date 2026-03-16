import { supabase } from './supabase';
import type { Organization, UserOrganizationRole } from './supabase';
import type { CustomerAddress } from './customerAddresses';

export const multiTenantService = {
  // Organization management
  async getOrganizations() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    if (error) throw error;
    return data;
  },

  async createOrganization(organization: Omit<Organization, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('organizations')
      .insert(organization)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrganization(id: string, updates: Partial<Organization>) {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getOrganizationById(id: string) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Organization address management (uses customer_addresses table)
  async getOrganizationAddresses(organizationId: string, addressType?: 'shipping' | 'billing') {
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
  },

  async createOrganizationAddress(address: {
    user_id: string;
    organization_id: string;
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
    country_code?: string;
    phone?: string;
    email?: string;
    is_default?: boolean;
  }) {
    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({ ...address, country_code: address.country_code || 'US' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrganizationAddress(id: string, updates: Partial<CustomerAddress>) {
    const { data, error } = await supabase
      .from('customer_addresses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteOrganizationAddress(id: string) {
    const { error } = await supabase
      .from('customer_addresses')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  // User organization role management
  async getUserOrganizationRoles(userId?: string) {
    let query = supabase
      .from('user_organization_roles')
      .select(`
        *,
        organizations(name, code),
        profiles(email)
      `);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async assignUserToOrganization(assignment: Omit<UserOrganizationRole, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('user_organization_roles')
      .insert(assignment)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateUserOrganizationRole(id: string, updates: Partial<UserOrganizationRole>) {
    const { data, error } = await supabase
      .from('user_organization_roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeUserFromOrganization(id: string) {
    const { error } = await supabase
      .from('user_organization_roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
