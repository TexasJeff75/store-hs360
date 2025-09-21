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
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - no contract price exists
          return null;
        }
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
    userRole?: string
  ): Promise<{ price: number; source: 'regular' | 'individual' | 'organization' | 'location'; savings?: number } | null> {
    // If user is not logged in or not approved, return regular price
    if (!userId || (userRole && !['approved', 'admin'].includes(userRole))) {
      return null;
    }

    try {
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
}

export const contractPricingService = new ContractPricingService();