import { supabase, ContractPricing } from './supabase';

export interface ContractPrice {
  id: string;
  user_id: string;
  product_id: number;
  contract_price: number;
  created_at: string;
  updated_at: string;
}

class ContractPricingService {
  /**
   * Get contract price for a specific user and product
   */
  async getContractPrice(userId: string, productId: number): Promise<ContractPrice | null> {
    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .select('*')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching contract price:', error);
      return null;
    }
  }

  /**
   * Get all contract prices for a user
   */
  async getUserContractPrices(userId: string): Promise<ContractPrice[]> {
    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user contract prices:', error);
      return [];
    }
  }

  /**
   * Set contract price for a user and product (Admin only)
   */
  async setContractPrice(
    userId: string, 
    productId: number, 
    contractPrice: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .upsert({
          user_id: userId,
          product_id: productId,
          contract_price: contractPrice,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting contract price:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Remove contract price for a user and product (Admin only)
   */
  async removeContractPrice(
    userId: string, 
    productId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('contract_pricing')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing contract price:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Get all contract prices for a product (Admin only)
   */
  async getProductContractPrices(productId: number): Promise<ContractPrice[]> {
    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .select(`
          *,
          profiles:user_id (
            email,
            role
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching product contract prices:', error);
      return [];
    }
  }

  /**
   * Calculate the effective price for a user (contract price if available, otherwise regular price)
   */
  async getEffectivePrice(
    userId: string, 
    productId: number, 
    userRole?: string,
    quantity?: number
  ): Promise<{ price: number; source: 'regular' | 'individual' | 'organization' | 'location' } | null> {
    // If user is not logged in or not approved, return regular price
    if (!userId || (userRole && !['approved', 'admin'].includes(userRole))) {
      return null;
    }

    try {
      // Check for location-specific pricing first (highest priority)
      const locationPrice = await this.getLocationPrice(userId, productId, quantity);
      if (locationPrice) {
        return { 
          price: locationPrice.contract_price, 
          source: 'location' as const
        };
      }

      // Check for organization-level pricing
      const organizationPrice = await this.getOrganizationPrice(userId, productId, quantity);
      if (organizationPrice) {
        return { 
          price: organizationPrice.contract_price, 
          source: 'organization' as const
        };
      }

      // Check for individual contract pricing (lowest priority)
      const contractPrice = await this.getContractPrice(userId, productId);
      
      if (contractPrice) {
        return { 
          price: contractPrice.contract_price, 
          source: 'individual' as const
        };
      }

      return null;
    } catch (error) {
      console.error('Error calculating effective price:', error);
      return null;
    }
  }

  /**
   * Get location-specific pricing for a user and product
   */
  async getLocationPrice(userId: string, productId: number, quantity?: number): Promise<any | null> {
    try {
      let query = supabase
        .from('location_pricing')
        .select(`
          *,
          locations!inner(
            user_organization_roles!inner(user_id)
          )
        `)
        .eq('product_id', productId)
        .eq('locations.user_organization_roles.user_id', userId)
        .lte('effective_date', new Date().toISOString())
        .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString());
      
      // Add quantity filtering if provided
      if (quantity !== undefined) {
        query = query
          .lte('min_quantity', quantity)
          .or('max_quantity.is.null,max_quantity.gte.' + quantity);
      }
      
      const { data, error } = await query
        .order('contract_price', { ascending: true }) // Get lowest price first
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching location price:', error);
      return null;
    }
  }

  /**
   * Get organization-level pricing for a user and product
   */
  async getOrganizationPrice(userId: string, productId: number, quantity?: number): Promise<any | null> {
    try {
      let query = supabase
        .from('organization_pricing')
        .select(`
          *,
          organizations!inner(
            user_organization_roles!inner(user_id)
          )
        `)
        .eq('product_id', productId)
        .eq('organizations.user_organization_roles.user_id', userId)
        .lte('effective_date', new Date().toISOString())
        .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString());
      
      // Add quantity filtering if provided
      if (quantity !== undefined) {
        query = query
          .lte('min_quantity', quantity)
          .or('max_quantity.is.null,max_quantity.gte.' + quantity);
      }
      
      const { data, error } = await query
        .order('contract_price', { ascending: true }) // Get lowest price first
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching organization price:', error);
      return null;
    }
  }

  /**
   * Set organization pricing (Admin only)
   */
  async setOrganizationPrice(
    organizationId: string,
    productId: number,
    contractPrice: number,
    minQuantity?: number,
    maxQuantity?: number,
    effectiveDate?: string,
    expiryDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('organization_pricing')
        .upsert({
          organization_id: organizationId,
          product_id: productId,
          contract_price: contractPrice,
          min_quantity: minQuantity || 1,
          max_quantity: maxQuantity,
          effective_date: effectiveDate || new Date().toISOString(),
          expiry_date: expiryDate,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting organization price:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Set location pricing (Admin only)
   */
  async setLocationPrice(
    locationId: string,
    productId: number,
    contractPrice: number,
    minQuantity?: number,
    maxQuantity?: number,
    effectiveDate?: string,
    expiryDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('location_pricing')
        .upsert({
          location_id: locationId,
          product_id: productId,
          contract_price: contractPrice,
          min_quantity: minQuantity || 1,
          max_quantity: maxQuantity,
          effective_date: effectiveDate || new Date().toISOString(),
          expiry_date: expiryDate,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting location price:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Remove organization pricing (Admin only)
   */
  async removeOrganizationPrice(
    organizationId: string,
    productId: number,
    effectiveDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let query = supabase
        .from('organization_pricing')
        .delete()
        .eq('organization_id', organizationId)
        .eq('product_id', productId);

      if (effectiveDate) {
        query = query.eq('effective_date', effectiveDate);
      }

      const { error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing organization price:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Remove location pricing (Admin only)
   */
  async removeLocationPrice(
    locationId: string,
    productId: number,
    effectiveDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let query = supabase
        .from('location_pricing')
        .delete()
        .eq('location_id', locationId)
        .eq('product_id', productId);

      if (effectiveDate) {
        query = query.eq('effective_date', effectiveDate);
      }

      const { error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing location price:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const contractPricingService = new ContractPricingService();