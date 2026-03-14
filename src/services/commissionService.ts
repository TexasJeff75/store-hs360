import { supabase } from './supabase';

interface OrganizationSalesRep {
  id: string;
  organization_id: string;
  sales_rep_id: string;
  commission_rate: number;
  is_active: boolean;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

export interface CommissionLineItem {
  id: string;
  commission_id: string;
  order_id: string;
  product_id?: number;
  product_name?: string;
  category_id?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  retail_price?: number;
  markup: number;
  base_margin: number;
  item_commission: number;
  rule_source: string;
  rule_id?: string;
  commission_type: string;
  commission_rate: number;
  use_customer_price: boolean;
  effective_price?: number;
  wholesale_price?: number;
  spread?: number;
  created_at: string;
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
    ruleType?: string;
    ruleRate?: number;
    ruleSource?: string;
    ruleId?: string;
    totalCommission?: number;
    commission?: number;
    effectivePrice?: number;
    useCustomerPrice?: boolean;
    wholesalePrice?: number;
    spread?: number;
    markup?: number;
  }>;
  commission_rate: number;
  commission_amount: number;
  sales_rep_commission?: number;
  distributor_commission?: number;
  company_rep_commission?: number;
  company_rep_id?: string;
  distributor_id?: string;
  commission_split_type?: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  paid_at?: string;
  payment_reference?: string;
  created_at: string;
  updated_at: string;
  // Joined relations
  line_items?: CommissionLineItem[];
}

interface CommissionSummary {
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
    commissionRate: number,
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
          distributor:distributors(id, name, code),
          sales_rep:profiles!sales_rep_id(id, email, full_name),
          organization:organizations(id, name)
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

  async getDistributorCommissions(
    distributorId: string,
    status?: string
  ): Promise<{ commissions: Commission[]; error?: string }> {
    try {
      // Get all sales reps under this distributor
      const { data: salesReps, error: salesRepsError } = await supabase
        .from('distributor_sales_reps')
        .select('sales_rep_id')
        .eq('distributor_id', distributorId)
        .eq('is_active', true);

      if (salesRepsError) throw salesRepsError;

      const salesRepIds = salesReps?.map(sr => sr.sales_rep_id) || [];

      if (salesRepIds.length === 0) {
        return { commissions: [] };
      }

      // Get all commissions for these sales reps
      let query = supabase
        .from('commissions')
        .select(`
          *,
          distributor:distributors(id, name, code),
          sales_rep:profiles!sales_rep_id(id, email, full_name),
          organization:organizations(id, name)
        `)
        .in('sales_rep_id', salesRepIds)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { commissions: data || [] };
    } catch (error) {
      console.error('Error fetching distributor commissions:', error);
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
        .select('commission_amount, sales_rep_commission, status')
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
        // Sales reps should only see their share, not distributor's
        const amount = Number(commission.sales_rep_commission || 0);
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

  async getDistributorCommissionSummary(
    distributorId: string
  ): Promise<{ summary: CommissionSummary | null; error?: string }> {
    try {
      // Get all sales reps under this distributor
      const { data: salesReps, error: salesRepsError } = await supabase
        .from('distributor_sales_reps')
        .select('sales_rep_id')
        .eq('distributor_id', distributorId)
        .eq('is_active', true);

      if (salesRepsError) throw salesRepsError;

      const salesRepIds = salesReps?.map(sr => sr.sales_rep_id) || [];

      if (salesRepIds.length === 0) {
        return {
          summary: {
            total_commissions: 0,
            pending_amount: 0,
            approved_amount: 0,
            paid_amount: 0,
            total_orders: 0
          }
        };
      }

      const { data, error } = await supabase
        .from('commissions')
        .select('distributor_commission, status')
        .in('sales_rep_id', salesRepIds);

      if (error) throw error;

      const summary: CommissionSummary = {
        total_commissions: 0,
        pending_amount: 0,
        approved_amount: 0,
        paid_amount: 0,
        total_orders: data?.length || 0
      };

      data?.forEach(commission => {
        const amount = Number(commission.distributor_commission || 0);
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
      console.error('Error fetching distributor commission summary:', error);
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

  async cancelCommission(
    commissionId: string,
    reason: string,
    cancelledBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: commission, error: fetchError } = await supabase
        .from('commissions')
        .select('*')
        .eq('id', commissionId)
        .single();

      if (fetchError || !commission) {
        return { success: false, error: fetchError?.message || 'Commission not found' };
      }

      if (commission.status === 'paid') {
        return { success: false, error: 'Cannot cancel a commission that has already been paid' };
      }

      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'cancelled',
          notes: `${commission.notes ? commission.notes + '\n' : ''}[Cancelled] ${reason} (by ${cancelledBy} on ${new Date().toISOString()})`
        })
        .eq('id', commissionId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Log to audit trail
      await supabase.from('commission_audit_log').insert({
        order_id: commission.order_id,
        commission_id: commissionId,
        event_type: 'cancelled',
        details: { reason, cancelled_by: cancelledBy, previous_status: commission.status }
      });

      return { success: true };
    } catch (error) {
      console.error('Error cancelling commission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel commission'
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

  async getDistributorCommissionsByUserId(
    userId: string,
    status?: string
  ): Promise<{ commissions: any[]; error?: string }> {
    try {
      const { data: distributor, error: distError } = await supabase
        .from('distributors')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (distError) throw distError;
      if (!distributor) {
        return { commissions: [], error: 'No distributor found for this user' };
      }

      let query = supabase
        .from('commissions')
        .select(`
          *,
          sales_rep:profiles!sales_rep_id(id, email),
          organization:organizations(id, name),
          distributor:distributors(id, name, code)
        `)
        .eq('distributor_id', distributor.id)
        .not('distributor_commission', 'is', null)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { commissions: data || [] };
    } catch (error) {
      console.error('Error fetching distributor commissions:', error);
      return {
        commissions: [],
        error: error instanceof Error ? error.message : 'Failed to fetch distributor commissions'
      };
    }
  }

  async getDistributorCommissionSummaryByUserId(
    userId: string
  ): Promise<{ summary: CommissionSummary | null; error?: string }> {
    try {
      const { data: distributor, error: distError } = await supabase
        .from('distributors')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (distError) throw distError;
      if (!distributor) {
        return { summary: null, error: 'No distributor found for this user' };
      }

      const { data, error } = await supabase
        .from('commissions')
        .select('distributor_commission, status')
        .eq('distributor_id', distributor.id)
        .not('distributor_commission', 'is', null);

      if (error) throw error;

      const summary: CommissionSummary = {
        total_commissions: 0,
        pending_amount: 0,
        approved_amount: 0,
        paid_amount: 0,
        total_orders: data?.length || 0
      };

      data?.forEach(commission => {
        const amount = Number(commission.distributor_commission || 0);
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
      console.error('Error fetching distributor commission summary:', error);
      return {
        summary: null,
        error: error instanceof Error ? error.message : 'Failed to fetch summary'
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

  async getCommissionLineItems(
    commissionId: string
  ): Promise<{ lineItems: CommissionLineItem[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('commission_line_items')
        .select('*')
        .eq('commission_id', commissionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { lineItems: data || [] };
    } catch (error) {
      console.error('Error fetching commission line items:', error);
      return {
        lineItems: [],
        error: error instanceof Error ? error.message : 'Failed to fetch line items'
      };
    }
  }

  async getCommissionAuditLog(
    orderId: string
  ): Promise<{ logs: any[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('commission_audit_log')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { logs: data || [] };
    } catch (error) {
      console.error('Error fetching commission audit log:', error);
      return {
        logs: [],
        error: error instanceof Error ? error.message : 'Failed to fetch audit log'
      };
    }
  }

  async createIndependentDistributor(
    profileId: string,
    name: string,
    options?: {
      phone?: string;
      taxId?: string;
      taxIdType?: 'ein' | 'ssn';
      legalName?: string;
      businessName?: string;
      taxClassification?: string;
      w9Consent?: boolean;
    }
  ): Promise<{ data?: any; error?: string }> {
    try {
      const code = `IND-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`;

      const { data: distributor, error: distError } = await supabase
        .from('distributors')
        .insert({
          profile_id: profileId,
          name,
          code,
          distributor_class: 'independent',
          contact_name: name,
          phone: options?.phone || null,
          is_active: true,
          tax_id: options?.taxId || null,
          tax_id_type: options?.taxIdType || null,
          legal_name: options?.legalName || null,
          business_name: options?.businessName || null,
          tax_classification: options?.taxClassification || null,
          w9_consent: options?.w9Consent === true,
          w9_consent_date: options?.w9Consent ? new Date().toISOString() : null,
          w9_status: options?.w9Consent ? 'received' : 'pending',
        })
        .select('id')
        .single();

      if (distError) throw distError;

      // Self-link: sales rep belongs to their own distributor entity
      const { error: dsrError } = await supabase
        .from('distributor_sales_reps')
        .upsert({
          distributor_id: distributor.id,
          sales_rep_id: profileId,
          commission_split_type: 'percentage_of_distributor',
          sales_rep_rate: 100,
          distributor_override_rate: 0,
          is_active: true,
        }, { onConflict: 'distributor_id,sales_rep_id' });

      if (dsrError) throw dsrError;

      return { data: distributor };
    } catch (error) {
      console.error('Error creating independent distributor:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to create independent distributor'
      };
    }
  }

  async promoteToCompany(distributorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('distributors')
        .update({ distributor_class: 'company' })
        .eq('id', distributorId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error promoting distributor:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to promote distributor'
      };
    }
  }
}

export const commissionService = new CommissionService();
