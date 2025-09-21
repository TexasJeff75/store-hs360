import { supabase } from './supabase';

export interface Organization {
  id: string;
  name: string;
  code: string;
  description?: string;
  billing_address?: any;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address?: any;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

export interface UserOrganizationRole {
  id: string;
  user_id: string;
  organization_id: string;
  location_id?: string;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  organization?: Organization;
  location?: Location;
}

export interface OrganizationPricing {
  id: string;
  organization_id: string;
  product_id: number;
  contract_price: number;
  min_quantity: number;
  max_quantity?: number;
  effective_date: string;
  expiry_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LocationPricing {
  id: string;
  location_id: string;
  product_id: number;
  contract_price: number;
  min_quantity: number;
  max_quantity?: number;
  effective_date: string;
  expiry_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

class MultiTenantService {
  // Organizations
  async getOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async createOrganization(org: Partial<Organization>): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .insert(org)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Locations
  async getLocationsByOrganization(organizationId: string): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select(`
        *,
        organization:organizations(*)
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async createLocation(location: Partial<Location>): Promise<Location> {
    const { data, error } = await supabase
      .from('locations')
      .insert(location)
      .select(`
        *,
        organization:organizations(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async updateLocation(id: string, updates: Partial<Location>): Promise<Location> {
    const { data, error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        organization:organizations(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  // User Organization Roles
  async getUserOrganizations(userId: string): Promise<UserOrganizationRole[]> {
    const { data, error } = await supabase
      .from('user_organization_roles')
      .select(`
        *,
        organization:organizations(*),
        location:locations(*)
      `)
      .eq('user_id', userId)
      .order('is_primary', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getOrganizationUsers(organizationId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('user_organization_roles')
      .select(`
        *,
        user:profiles(*),
        location:locations(*)
      `)
      .eq('organization_id', organizationId)
      .order('role');

    if (error) throw error;
    return data || [];
  }

  async assignUserToOrganization(
    userId: string,
    organizationId: string,
    role: string,
    locationId?: string,
    isPrimary: boolean = false
  ): Promise<UserOrganizationRole> {
    const { data, error } = await supabase
      .from('user_organization_roles')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        location_id: locationId,
        role,
        is_primary: isPrimary
      })
      .select(`
        *,
        organization:organizations(*),
        location:locations(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async updateUserOrganizationRole(
    id: string,
    updates: Partial<UserOrganizationRole>
  ): Promise<UserOrganizationRole> {
    const { data, error } = await supabase
      .from('user_organization_roles')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        organization:organizations(*),
        location:locations(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async removeUserFromOrganization(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_organization_roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Pricing
  async getOrganizationPricing(organizationId: string): Promise<OrganizationPricing[]> {
    const { data, error } = await supabase
      .from('organization_pricing')
      .select('*')
      .eq('organization_id', organizationId)
      .order('product_id');

    if (error) throw error;
    return data || [];
  }

  async getLocationPricing(locationId: string): Promise<LocationPricing[]> {
    const { data, error } = await supabase
      .from('location_pricing')
      .select('*')
      .eq('location_id', locationId)
      .order('product_id');

    if (error) throw error;
    return data || [];
  }

  async setOrganizationPricing(pricing: Partial<OrganizationPricing>): Promise<OrganizationPricing> {
    const { data, error } = await supabase
      .from('organization_pricing')
      .upsert(pricing)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async setLocationPricing(pricing: Partial<LocationPricing>): Promise<LocationPricing> {
    const { data, error } = await supabase
      .from('location_pricing')
      .upsert(pricing)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get effective pricing for a user (location > organization > individual > regular)
  async getEffectivePricing(
    userId: string,
    productId: number,
    regularPrice: number
  ): Promise<{
    price: number;
    source: 'location' | 'organization' | 'individual' | 'regular';
    savings?: number;
  }> {
    try {
      // Get user's organizations and locations
      const userOrgs = await this.getUserOrganizations(userId);
      
      let bestPrice = regularPrice;
      let source: 'location' | 'organization' | 'individual' | 'regular' = 'regular';

      // Check location pricing first (highest priority)
      for (const userOrg of userOrgs) {
        if (userOrg.location_id) {
          const locationPricing = await supabase
            .from('location_pricing')
            .select('*')
            .eq('location_id', userOrg.location_id)
            .eq('product_id', productId)
            .lte('effective_date', new Date().toISOString())
            .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString())
            .order('effective_date', { ascending: false })
            .limit(1)
            .single();

          if (locationPricing.data && locationPricing.data.contract_price < bestPrice) {
            bestPrice = locationPricing.data.contract_price;
            source = 'location';
          }
        }
      }

      // Check organization pricing if no location pricing found
      if (source === 'regular') {
        for (const userOrg of userOrgs) {
          const orgPricing = await supabase
            .from('organization_pricing')
            .select('*')
            .eq('organization_id', userOrg.organization_id)
            .eq('product_id', productId)
            .lte('effective_date', new Date().toISOString())
            .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString())
            .order('effective_date', { ascending: false })
            .limit(1)
            .single();

          if (orgPricing.data && orgPricing.data.contract_price < bestPrice) {
            bestPrice = orgPricing.data.contract_price;
            source = 'organization';
          }
        }
      }

      // Check individual contract pricing if no org/location pricing
      if (source === 'regular') {
        const individualPricing = await supabase
          .from('contract_pricing')
          .select('*')
          .eq('user_id', userId)
          .eq('product_id', productId)
          .single();

        if (individualPricing.data && individualPricing.data.contract_price < bestPrice) {
          bestPrice = individualPricing.data.contract_price;
          source = 'individual';
        }
      }

      const savings = bestPrice < regularPrice ? regularPrice - bestPrice : undefined;

      return {
        price: bestPrice,
        source,
        savings
      };
    } catch (error) {
      console.error('Error getting effective pricing:', error);
      return {
        price: regularPrice,
        source: 'regular'
      };
    }
  }
}

export const multiTenantService = new MultiTenantService();