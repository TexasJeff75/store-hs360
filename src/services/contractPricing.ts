import { supabase, ContractPricing } from './supabase';
import { cacheService, CacheKeys, CacheTTL } from './cache';

export type PricingType = 'individual' | 'organization' | 'location';

export interface ContractPrice {
  id: string;
  pricing_type: PricingType;
  entity_id: string;
  user_id?: string; // Legacy field for backward compatibility
  product_id: number;
  contract_price: number;
  min_quantity?: number;
  max_quantity?: number;
  effective_date?: string;
  expiry_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

class ContractPricingService {
  /**
   * Get contract price for a specific entity and product
   */
  async getContractPrice(
    entityId: string, 
    productId: number, 
    pricingType: PricingType = 'individual'
  ): Promise<ContractPrice | null> {
    // Try cache first
    const cacheKey = `contract_price_${pricingType}_${entityId}_${productId}`;
    const cached = cacheService.get<ContractPrice | null>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .select('*')
        .eq('pricing_type', pricingType)
        .eq('entity_id', entityId)
        .eq('product_id', productId)
        .lte('effective_date', new Date().toISOString())
        .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString())
        .order('effective_date', { ascending: false })
        .maybeSingle();

      if (error) {
        throw error;
      }

      // Cache the result (including null results)
      cacheService.set(cacheKey, data, CacheTTL.pricing);

      return data;
    } catch (error) {
      console.error('Error fetching contract price:', error);
      return null;
    }
  }

  /**
   * Get all contract prices for an entity
   */
  async getEntityContractPrices(
    entityId: string, 
    pricingType: PricingType = 'individual'
  ): Promise<ContractPrice[]> {
    // Try cache first
    const cacheKey = `entity_prices_${pricingType}_${entityId}`;
    const cached = cacheService.get<ContractPrice[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .select('*')
        .eq('pricing_type', pricingType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const result = data || [];
      
      // Cache the result
      cacheService.set(cacheKey, result, CacheTTL.pricing);
      
      return result;
    } catch (error) {
      console.error('Error fetching user contract prices:', error);
      return [];
    }
  }

  /**
   * Set contract price for any entity and product (Admin only)
   */
  async setContractPrice(
    entityId: string,
    productId: number, 
    contractPrice: number,
    pricingType: PricingType = 'individual',
    minQuantity: number = 1,
    maxQuantity?: number,
    effectiveDate?: string,
    expiryDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .upsert({
          pricing_type: pricingType,
          entity_id: entityId,
          // Keep user_id for backward compatibility with individual pricing
          ...(pricingType === 'individual' && { user_id: entityId }),
          product_id: productId,
          contract_price: contractPrice,
          min_quantity: minQuantity,
          max_quantity: maxQuantity,
          effective_date: effectiveDate || new Date().toISOString(),
          expiry_date: expiryDate,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Invalidate related cache entries
      this.invalidatePricingCache(entityId, productId, pricingType);
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
   * Remove contract price for an entity and product (Admin only)
   */
  async removeContractPrice(
    entityId: string,
    productId: number,
    pricingType: PricingType = 'individual',
    effectiveDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let query = supabase
        .from('contract_pricing')
        .delete()
        .eq('pricing_type', pricingType)
        .eq('entity_id', entityId)
        .eq('product_id', productId);

      if (effectiveDate) {
        query = query.eq('effective_date', effectiveDate);
      }

      const { error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      // Invalidate related cache entries
      this.invalidatePricingCache(entityId, productId, pricingType);
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
   * Get all contract prices for a product across all entities (Admin only)
   */
  async getProductContractPrices(productId: number): Promise<ContractPrice[]> {
    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .select(`
          *,
          profiles:entity_id (email, role),
          organizations:entity_id (name, code),
          locations:entity_id (name, code)
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
   * Calculate the effective price for a user considering all pricing levels
   */
  async getEffectivePrice(
    userId: string, 
    productId: number, 
    userRole?: string,
    quantity?: number
  ): Promise<{ price: number; source: 'regular' | 'individual' | 'organization' | 'location' } | null> {
    // Try cache first
    const cacheKey = CacheKeys.effectivePrice(userId, productId, quantity);
    const cached = cacheService.get<{ price: number; source: 'regular' | 'individual' | 'organization' | 'location' } | null>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // If user is not logged in or not approved, return regular price
    if (!userId || (userRole && !['approved', 'admin'].includes(userRole))) {
      return null;
    }

    try {
      // Check for location-specific pricing first (highest priority)
      const locationPrice = await this.getLocationPrice(userId, productId, quantity);
      if (locationPrice) {
        const result = { 
          price: locationPrice.contract_price, 
          source: 'location' as const
        };
        cacheService.set(cacheKey, result, CacheTTL.effectivePrice);
        return result;
      }

      // Check for organization-level pricing
      const organizationPrice = await this.getOrganizationPrice(userId, productId, quantity);
      if (organizationPrice) {
        const result = { 
          price: organizationPrice.contract_price, 
          source: 'organization' as const
        };
        cacheService.set(cacheKey, result, CacheTTL.effectivePrice);
        return result;
      }

      // Check for individual contract pricing (lowest priority)
      const contractPrice = await this.getContractPrice(userId, productId, 'individual');
      
      if (contractPrice) {
        const result = { 
          price: contractPrice.contract_price, 
          source: 'individual' as const
        };
        cacheService.set(cacheKey, result, CacheTTL.effectivePrice);
        return result;
      }

      // Cache null result too
      cacheService.set(cacheKey, null, CacheTTL.effectivePrice);
      return null;
    } catch (error) {
      console.error('Error calculating effective price:', error);
      return null;
    }
  }

  /**
   * Invalidate pricing cache entries for a specific entity/product
   */
  private invalidatePricingCache(entityId: string, productId: number, pricingType: PricingType): void {
    // Clear specific cache entries
    const contractPriceKey = `contract_price_${pricingType}_${entityId}_${productId}`;
    const entityPricesKey = `entity_prices_${pricingType}_${entityId}`;
    
    cacheService.delete(contractPriceKey);
    cacheService.delete(entityPricesKey);
    
    // Clear effective price cache for this user/product combination
    // Note: We can't easily clear all quantity variations, so we'll let them expire naturally
    const effectivePriceKey = CacheKeys.effectivePrice(entityId, productId);
    cacheService.delete(effectivePriceKey);
    
    console.log('🗑️ Invalidated pricing cache for', pricingType, entityId, productId);
  }

  /**
   * Clear all pricing cache (useful for admin operations)
   */
  clearPricingCache(): void {
    // This is a simple implementation - in a more sophisticated system,
    // we might track cache keys by category
    cacheService.clear();
    console.log('🗑️ All pricing cache cleared');
  }

  /**
   * Get location-specific pricing for a user and product (now uses unified table)
   */
  async getLocationPrice(userId: string, productId: number, quantity?: number): Promise<any | null> {
    // Try cache first
    const cacheKey = `location_price_${userId}_${productId}_${quantity || 1}`;
    const cached = cacheService.get<any | null>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      // Get user's locations through organization roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_organization_roles')
        .select(`
          location_id,
          locations(id, name)
        `)
        .eq('user_id', userId)
        .not('location_id', 'is', null);

      if (rolesError || !userRoles?.length) {
        cacheService.set(cacheKey, null, CacheTTL.pricing);
        return null;
      }

      const locationIds = userRoles.map(role => role.location_id).filter(Boolean);
      
      // Check if locationIds array is empty to prevent malformed query
      if (locationIds.length === 0) {
        cacheService.set(cacheKey, null, CacheTTL.pricing);
        return null;
      }
      
      let query = supabase
        .from('contract_pricing')
        .select('*')
        .eq('pricing_type', 'location')
        .in('entity_id', locationIds)
        .eq('product_id', productId)
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

      // Cache the result
      cacheService.set(cacheKey, data, CacheTTL.pricing);
      return data;
    } catch (error) {
      console.error('Error fetching location price:', error);
      return null;
    }
  }

  /**
   * Get organization-level pricing for a user and product (now uses unified table)
   */
  async getOrganizationPrice(userId: string, productId: number, quantity?: number): Promise<any | null> {
    // Try cache first
    const cacheKey = `org_price_${userId}_${productId}_${quantity || 1}`;
    const cached = cacheService.get<any | null>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      // Get user's organizations through organization roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_organization_roles')
        .select(`
          organization_id,
          organizations(id, name)
        `)
        .eq('user_id', userId);

      if (rolesError || !userRoles?.length) {
        cacheService.set(cacheKey, null, CacheTTL.pricing);
        return null;
      }

      const organizationIds = userRoles.map(role => role.organization_id).filter(Boolean);
      
      // Check if organizationIds array is empty to prevent malformed query
      if (organizationIds.length === 0) {
        cacheService.set(cacheKey, null, CacheTTL.pricing);
        return null;
      }
      
      let query = supabase
        .from('contract_pricing')
        .select('*')
        .eq('pricing_type', 'organization')
        .in('entity_id', organizationIds)
        .eq('product_id', productId)
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

      // Cache the result
      cacheService.set(cacheKey, data, CacheTTL.pricing);
      return data;
    } catch (error) {
      console.error('Error fetching organization price:', error);
      return null;
    }
  }

  /**
   * Legacy method - now uses unified setContractPrice
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
      return await this.setContractPrice(
        organizationId,
        productId,
        contractPrice,
        'organization',
        minQuantity,
        maxQuantity,
        effectiveDate,
        expiryDate
      );
    } catch (error) {
      console.error('Error setting organization price:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Legacy method - now uses unified setContractPrice
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
      return await this.setContractPrice(
        locationId,
        productId,
        contractPrice,
        'location',
        minQuantity,
        maxQuantity,
        effectiveDate,
        expiryDate
      );
    } catch (error) {
      console.error('Error setting location price:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Legacy method - now uses unified removeContractPrice
   */
  async removeOrganizationPrice(
    organizationId: string,
    productId: number,
    effectiveDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    return await this.removeContractPrice(organizationId, productId, 'organization', effectiveDate);
  }

  /**
   * Legacy method - now uses unified removeContractPrice
   */
  async removeLocationPrice(
    locationId: string,
    productId: number,
    effectiveDate?: string
  ): Promise<{ success: boolean; error?: string }> {
    return await this.removeContractPrice(locationId, productId, 'location', effectiveDate);
  }

  /**
   * Get all pricing entries for admin management
   */
  async getAllPricingEntries(): Promise<ContractPrice[]> {
    try {
      const { data, error } = await supabase
        .from('contract_pricing')
        .select(`
          *,
          profiles:entity_id (email),
          organizations:entity_id (name, code),
          locations:entity_id (name, code)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching all pricing entries:', error);
      return [];
    }
  }

  /**
   * Get pricing entries for a specific organization (including its locations)
   */
  async getOrganizationPricingEntries(organizationId: string): Promise<ContractPrice[]> {
    try {
      // Get organization pricing
      const { data: orgPricing, error: orgError } = await supabase
        .from('contract_pricing')
        .select(`
          *,
          organizations:entity_id (name, code)
        `)
        .eq('pricing_type', 'organization')
        .eq('entity_id', organizationId);

      if (orgError) throw orgError;

      // Get location pricing for this organization's locations
      const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id')
        .eq('organization_id', organizationId);

      if (locError) throw locError;

      const locationIds = locations?.map(loc => loc.id) || [];
      
      let locationPricing: any[] = [];
      if (locationIds.length > 0) {
        const { data: locPricing, error: locPricingError } = await supabase
          .from('contract_pricing')
          .select(`
            *,
            locations:entity_id (name, code)
          `)
          .eq('pricing_type', 'location')
          .in('entity_id', locationIds);

        if (locPricingError) throw locPricingError;
        locationPricing = locPricing || [];
      }

      return [...(orgPricing || []), ...locationPricing];
    } catch (error) {
      console.error('Error fetching organization pricing entries:', error);
      return [];
    }
  }
}

export const contractPricingService = new ContractPricingService();