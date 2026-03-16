import { supabase } from './supabase';

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface DeletedRecord {
  id: string;
  deleted_at: string;
  deleted_by: string | null;
  [key: string]: unknown;
}

export const softDeleteService = {
  // ── Orders ──

  async deleteOrder(orderId: string, deletedBy: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
        .eq('id', orderId)
        .is('deleted_at', null);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete order' };
    }
  },

  async restoreOrder(orderId: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', orderId);

      if (error) throw error;

      // Restore cascaded commissions
      await supabase
        .from('commissions')
        .update({ deleted_at: null, deleted_by: null })
        .eq('order_id', orderId);

      // Un-orphan commission line items
      await supabase
        .from('commission_line_items')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('order_id', orderId)
        .eq('orphaned_reason', 'order_deleted');

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore order' };
    }
  },

  // ── Profiles (Users / Customers / Sales Reps) ──

  async deleteProfile(profileId: string, deletedBy: string): Promise<DeleteResult> {
    try {
      // Safety: cannot delete yourself
      if (profileId === deletedBy) {
        return { success: false, error: 'You cannot delete your own account' };
      }

      // Safety: cannot delete the last admin
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .is('deleted_at', null);

      const activeAdmins = (admins || []).filter(a => a.id !== profileId);
      if (activeAdmins.length === 0) {
        return { success: false, error: 'Cannot delete the last admin account' };
      }

      // Soft-delete the profile
      const { error } = await supabase
        .from('profiles')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy,
          is_approved: false,
        })
        .eq('id', profileId)
        .is('deleted_at', null);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete user' };
    }
  },

  async restoreProfile(profileId: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', profileId);

      if (error) throw error;

      // Restore cascaded orders
      await supabase
        .from('orders')
        .update({ deleted_at: null, deleted_by: null })
        .eq('user_id', profileId);

      // Restore cascaded commissions
      await supabase
        .from('commissions')
        .update({ deleted_at: null, deleted_by: null })
        .eq('sales_rep_id', profileId);

      // Un-orphan child records
      await supabase
        .from('organization_sales_reps')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('sales_rep_id', profileId)
        .eq('orphaned_reason', 'sales_rep_deleted');

      await supabase
        .from('distributor_sales_reps')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('sales_rep_id', profileId)
        .eq('orphaned_reason', 'sales_rep_deleted');

      await supabase
        .from('contract_pricing')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('user_id', profileId)
        .eq('orphaned_reason', 'user_deleted');

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore user' };
    }
  },

  // ── Distributors ──

  async deleteDistributor(distributorId: string, deletedBy: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('distributors')
        .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
        .eq('id', distributorId)
        .is('deleted_at', null);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete distributor' };
    }
  },

  async restoreDistributor(distributorId: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('distributors')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', distributorId);

      if (error) throw error;

      // Un-orphan child records
      await supabase
        .from('distributor_sales_reps')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('distributor_id', distributorId)
        .eq('orphaned_reason', 'distributor_deleted');

      await supabase
        .from('distributor_commission_rules')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('distributor_id', distributorId)
        .eq('orphaned_reason', 'distributor_deleted');

      await supabase
        .from('distributor_product_pricing')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('distributor_id', distributorId)
        .eq('orphaned_reason', 'distributor_deleted');

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore distributor' };
    }
  },

  // ── Commissions ──

  async deleteCommission(commissionId: string, deletedBy: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('commissions')
        .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
        .eq('id', commissionId)
        .is('deleted_at', null);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete commission' };
    }
  },

  async restoreCommission(commissionId: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('commissions')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', commissionId);

      if (error) throw error;

      await supabase
        .from('commission_line_items')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('commission_id', commissionId)
        .eq('orphaned_reason', 'commission_deleted');

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore commission' };
    }
  },

  // ── Organizations ──

  async deleteOrganization(orgId: string, deletedBy: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy,
          is_active: false,
        })
        .eq('id', orgId)
        .is('deleted_at', null);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete organization' };
    }
  },

  async restoreOrganization(orgId: string): Promise<DeleteResult> {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ deleted_at: null, deleted_by: null, is_active: true })
        .eq('id', orgId);

      if (error) throw error;

      await supabase
        .from('organization_pricing')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('organization_id', orgId)
        .eq('orphaned_reason', 'organization_deleted');

      await supabase
        .from('organization_sales_reps')
        .update({ is_orphaned: false, orphaned_reason: null })
        .eq('organization_id', orgId)
        .eq('orphaned_reason', 'organization_deleted');

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to restore organization' };
    }
  },
};
