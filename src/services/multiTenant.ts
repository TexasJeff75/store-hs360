import { supabase } from './supabase';
import type { Organization, Location, UserOrganizationRole } from './supabase';

export const multiTenantService = {
  // Organization management
  async getOrganizations() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('is_active', true)
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

  // Location management
  async getLocations(organizationId?: string) {
    let query = supabase
      .from('locations')
      .select('*, organizations(name)')
      .eq('is_active', true);
    
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    
    const { data, error } = await query.order('name');
    
    if (error) throw error;
    return data;
  },

  async createLocation(location: Omit<Location, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('locations')
      .insert(location)
      .select('*, organizations(name)')
      .single();

    if (error) {
      console.error('Supabase error creating location:', error);
      throw new Error(`Failed to create location: ${error.message} (Code: ${error.code})`);
    }
    return data;
  },

  async updateLocation(id: string, updates: Partial<Location>) {
    const { data, error } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', id)
      .select('*, organizations(name)')
      .single();

    if (error) throw error;
    return data;
  },

  // User organization role management
  async getUserOrganizationRoles(userId?: string) {
    let query = supabase
      .from('user_organization_roles')
      .select(`
        *,
        organizations(name, code),
        locations(name, code),
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