import { supabase } from './supabase';

export interface OrganizationSalesRep {
  id: string;
  organization_id: string;
  sales_rep_id: string;
  commission_rate: number;
  is_active: boolean;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

export interface Commission {
  id: string;
  order_id: string;
  sales_rep_id: string;
  organization_id?: string;
  order_total: number;
  product_margin?: number;
  margin_details?: Array<{
    productId: string;
    name: string;
    price: number;
    cost: number;
    quantity: number;
    margin: number;
  }>;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  paid_at?: string;
  payment_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface CommissionSummary {
  total_commissions: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
  total_orders: number;
}

class CommissionService {
  async assignSalesRepToOrganization(
    organizationId: string,
    salesRepId: string,
    commissionRate: number = 5.0,
    distributorId?: string
  ): Promise<{ success: boolean; error?: string; data?: OrganizationSalesRep }> {
    try {
      const { data: existingRep } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', salesRepId)
        .single();

      if (!existingRep || existingRep.role !== 'sales_rep') {
        return { success: false, error: 'User is not a sales rep' };
      }

      const { data, error } = await supabase
        .from('organization_sales_reps')
        .upsert({
          organization_id: organizationId,
          sales_rep_id: salesRepId,
          commission_rate: commissionRate,
          distributor_id: distributorId || null,
          is_active: true
        }, {
          onConflict: 'organization_id,sales_rep_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error assigning sales rep:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error assigning sales rep:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign sales rep'
      };
    }
  }

  async removeSalesRepFromOrganization(
    organizationId: string,
    salesRepId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('organization_sales_reps')
        .update({ is_active: false })
        .eq('organization_id', organizationId)
        .eq('sales_rep_id', salesRepId);

      if (error) {
        console.error('Error removing sales rep:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing sales rep:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove sales rep'
      };
    }
  }

  async getOrganizationSalesReps(
    organizationId: string
  ): Promise<{ reps: any[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('organization_sales_reps')
        .select(`
          *,
          sales_rep:profiles!sales_rep_id(id, email)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (error) throw error;
      return { reps: data || [] };
    } catch (error) {
      console.error('Error fetching organization sales reps:', error);
      return {
        reps: [],
        error: error instanceof Error ? error.message : 'Failed to fetch sales reps'
      };
    }
  }

  async getSalesRepCommissions(
    salesRepId: string,
    status?: string
  ): Promise<{ commissions: Commission[]; error?: string }> {
    try {
      let query = supabase
        .from('commissions')
        .select(`
          *,
          distributor:distributors(id, name, code)
        `)
        .eq('sales_rep_id', salesRepId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { commissions: data || [] };
    } catch (error) {
      console.error('Error fetching commissions:', error);
      return {
        commissions: [],
        error: error instanceof Error ? error.message : 'Failed to fetch commissions'
      };
    }
  }

  async getSalesRepCommissionSummary(
    salesRepId: string
  ): Promise<{ summary: CommissionSummary | null; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('commissions')
        .select('commission_amount, status')
        .eq('sales_rep_id', salesRepId);

      if (error) throw error;

      const summary: CommissionSummary = {
        total_commissions: 0,
        pending_amount: 0,
        approved_amount: 0,
        paid_amount: 0,
        total_orders: data?.length || 0
      };

      data?.forEach(commission => {
        const amount = Number(commission.commission_amount);
        summary.total_commissions += amount;

        switch (commission.status) {
          case 'pending':
            summary.pending_amount += amount;
            break;
          case 'approved':
            summary.approved_amount += amount;
            break;
          case 'paid':
            summary.paid_amount += amount;
            break;
        }
      });

      return { summary };
    } catch (error) {
      console.error('Error fetching commission summary:', error);
      return {
        summary: null,
        error: error instanceof Error ? error.message : 'Failed to fetch summary'
      };
    }
  }

  async approveCommission(
    commissionId: string,
    approvedBy: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          notes: notes
        })
        .eq('id', commissionId);

      if (error) {
        console.error('Error approving commission:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error approving commission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve commission'
      };
    }
  }

  async markCommissionPaid(
    commissionId: string,
    paymentReference?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: paymentReference
        })
        .eq('id', commissionId);

      if (error) {
        console.error('Error marking commission as paid:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking commission as paid:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark commission as paid'
      };
    }
  }

  async getAllCommissions(
    filters?: {
      status?: string;
      organizationId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ commissions: any[]; error?: string }> {
    try {
      let query = supabase
        .from('commissions')
        .select(`
          *,
          sales_rep:profiles!sales_rep_id(id, email),
          organization:organizations(id, name),
          distributor:distributors(id, name, code)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.organizationId) {
        query = query.eq('organization_id', filters.organizationId);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { commissions: data || [] };
    } catch (error) {
      console.error('Error fetching all commissions:', error);
      return {
        commissions: [],
        error: error instanceof Error ? error.message : 'Failed to fetch commissions'
      };
    }
  }

  async updateCommissionRate(
    organizationId: string,
    salesRepId: string,
    newRate: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (newRate < 0 || newRate > 100) {
        return { success: false, error: 'Commission rate must be between 0 and 100' };
      }

      const { error } = await supabase
        .from('organization_sales_reps')
        .update({ commission_rate: newRate })
        .eq('organization_id', organizationId)
        .eq('sales_rep_id', salesRepId);

      if (error) {
        console.error('Error updating commission rate:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating commission rate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update commission rate'
      };
    }
  }
}

export const commissionService = new CommissionService();
