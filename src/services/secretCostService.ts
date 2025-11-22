import { supabase } from './supabase';

interface SecretCost {
  id: string;
  product_id: number;
  secret_cost: number;
  notes?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SecretCostMap {
  [productId: number]: SecretCost;
}

class SecretCostService {
  async checkIsCostAdmin(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_cost_admin');
      if (error) {
        console.error('Error checking cost admin status:', error);
        return false;
      }
      return data === true;
    } catch (err) {
      console.error('Error checking cost admin status:', err);
      return false;
    }
  }

  async getSecretCosts(productIds: number[]): Promise<SecretCostMap> {
    try {
      const { data, error } = await supabase
        .from('product_secret_costs')
        .select('*')
        .in('product_id', productIds);

      if (error) throw error;

      const costMap: SecretCostMap = {};
      data?.forEach(cost => {
        costMap[cost.product_id] = cost;
      });

      await this.logAudit('viewed_secret_costs', undefined, {
        product_count: productIds.length
      });

      return costMap;
    } catch (err) {
      console.error('Error fetching secret costs:', err);
      return {};
    }
  }

  async getAllSecretCosts(): Promise<SecretCostMap> {
    try {
      const { data, error } = await supabase
        .from('product_secret_costs')
        .select('*');

      if (error) throw error;

      const costMap: SecretCostMap = {};
      data?.forEach(cost => {
        costMap[cost.product_id] = cost;
      });

      return costMap;
    } catch (err) {
      console.error('Error fetching all secret costs:', err);
      return {};
    }
  }

  async updateSecretCost(
    productId: number,
    secretCost: number,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: existingData } = await supabase
        .from('product_secret_costs')
        .select('id')
        .eq('product_id', productId)
        .maybeSingle();

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (existingData) {
        const { error } = await supabase
          .from('product_secret_costs')
          .update({
            secret_cost: secretCost,
            notes: notes,
            updated_by: userId
          })
          .eq('product_id', productId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('product_secret_costs')
          .insert({
            product_id: productId,
            secret_cost: secretCost,
            notes: notes,
            created_by: userId,
            updated_by: userId
          });

        if (error) throw error;
      }

      await this.logAudit('updated_secret_cost', productId, {
        secret_cost: secretCost,
        notes: notes
      });

      return { success: true };
    } catch (err) {
      console.error('Error updating secret cost:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update secret cost'
      };
    }
  }

  async deleteSecretCost(productId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('product_secret_costs')
        .delete()
        .eq('product_id', productId);

      if (error) throw error;

      await this.logAudit('deleted_secret_cost', productId);

      return { success: true };
    } catch (err) {
      console.error('Error deleting secret cost:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete secret cost'
      };
    }
  }

  async bulkUpdateSecretCosts(
    updates: Array<{ productId: number; secretCost: number; notes?: string }>
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      let successCount = 0;

      for (const update of updates) {
        const result = await this.updateSecretCost(
          update.productId,
          update.secretCost,
          update.notes
        );
        if (result.success) successCount++;
      }

      await this.logAudit('bulk_updated_secret_costs', undefined, {
        total: updates.length,
        successful: successCount
      });

      return {
        success: successCount === updates.length,
        count: successCount
      };
    } catch (err) {
      console.error('Error bulk updating secret costs:', err);
      return {
        success: false,
        count: 0,
        error: err instanceof Error ? err.message : 'Failed to bulk update secret costs'
      };
    }
  }

  private async logAudit(
    action: string,
    productId?: number,
    details?: any
  ): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      await supabase.from('cost_admin_audit').insert({
        user_id: userData.user.id,
        action,
        product_id: productId,
        details: details ? details : undefined
      });
    } catch (err) {
      console.error('Error logging audit:', err);
    }
  }
}

export const secretCostService = new SecretCostService();
