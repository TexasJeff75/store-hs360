import { supabase } from './supabase';

export interface RecurringOrder {
  id: string;
  user_id: string;
  organization_id: string | null;
  product_id: number;
  quantity: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  frequency_interval: number;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  next_order_date: string;
  start_date: string;
  end_date: string | null;
  payment_method_id: string | null;
  shipping_address_id: string | null;
  location_id: string | null;
  discount_percentage: number;
  last_order_date: string | null;
  total_orders: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringOrderHistory {
  id: string;
  recurring_order_id: string;
  order_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  scheduled_date: string;
  processed_date: string | null;
  amount: number;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export interface CreateRecurringOrderData {
  user_id: string;
  product_id: number;
  quantity: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  frequency_interval?: number;
  organization_id?: string;
  payment_method_id?: string;
  shipping_address_id?: string;
  location_id?: string;
  discount_percentage?: number;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

export interface UpdateRecurringOrderData {
  quantity?: number;
  frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  frequency_interval?: number;
  status?: 'active' | 'paused' | 'cancelled' | 'expired';
  payment_method_id?: string;
  shipping_address_id?: string;
  location_id?: string;
  discount_percentage?: number;
  end_date?: string;
  notes?: string;
}

export const recurringOrderService = {
  async createRecurringOrder(data: CreateRecurringOrderData): Promise<RecurringOrder | null> {
    try {
      const nextOrderDate = data.start_date || new Date().toISOString().split('T')[0];

      const { data: recurringOrder, error } = await supabase
        .from('recurring_orders')
        .insert({
          user_id: data.user_id,
          product_id: data.product_id,
          quantity: data.quantity,
          frequency: data.frequency,
          frequency_interval: data.frequency_interval || 1,
          organization_id: data.organization_id,
          payment_method_id: data.payment_method_id,
          shipping_address_id: data.shipping_address_id,
          location_id: data.location_id,
          discount_percentage: data.discount_percentage || 0,
          start_date: data.start_date || new Date().toISOString().split('T')[0],
          end_date: data.end_date,
          notes: data.notes,
          next_order_date: nextOrderDate,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating recurring order:', error);
        return null;
      }

      return recurringOrder;
    } catch (error) {
      console.error('Error in createRecurringOrder:', error);
      return null;
    }
  },

  async getUserRecurringOrders(userId: string): Promise<RecurringOrder[]> {
    try {
      const { data, error } = await supabase
        .from('recurring_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user recurring orders:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserRecurringOrders:', error);
      return [];
    }
  },

  async getOrganizationRecurringOrders(organizationId: string): Promise<RecurringOrder[]> {
    try {
      const { data, error } = await supabase
        .from('recurring_orders')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching organization recurring orders:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getOrganizationRecurringOrders:', error);
      return [];
    }
  },

  async getAllRecurringOrders(): Promise<RecurringOrder[]> {
    try {
      const { data, error } = await supabase
        .from('recurring_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all recurring orders:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllRecurringOrders:', error);
      return [];
    }
  },

  async getRecurringOrder(recurringOrderId: string): Promise<RecurringOrder | null> {
    try {
      const { data, error } = await supabase
        .from('recurring_orders')
        .select('*')
        .eq('id', recurringOrderId)
        .single();

      if (error) {
        console.error('Error fetching recurring order:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getRecurringOrder:', error);
      return null;
    }
  },

  async updateRecurringOrder(recurringOrderId: string, updates: UpdateRecurringOrderData): Promise<RecurringOrder | null> {
    try {
      const { data, error } = await supabase
        .from('recurring_orders')
        .update(updates)
        .eq('id', recurringOrderId)
        .select()
        .single();

      if (error) {
        console.error('Error updating recurring order:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateRecurringOrder:', error);
      return null;
    }
  },

  async pauseRecurringOrder(recurringOrderId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recurring_orders')
        .update({ status: 'paused' })
        .eq('id', recurringOrderId);

      if (error) {
        console.error('Error pausing recurring order:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in pauseRecurringOrder:', error);
      return false;
    }
  },

  async resumeRecurringOrder(recurringOrderId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recurring_orders')
        .update({ status: 'active' })
        .eq('id', recurringOrderId);

      if (error) {
        console.error('Error resuming recurring order:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in resumeRecurringOrder:', error);
      return false;
    }
  },

  async cancelRecurringOrder(recurringOrderId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recurring_orders')
        .update({ status: 'cancelled' })
        .eq('id', recurringOrderId);

      if (error) {
        console.error('Error cancelling recurring order:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in cancelRecurringOrder:', error);
      return false;
    }
  },

  async deleteRecurringOrder(recurringOrderId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recurring_orders')
        .delete()
        .eq('id', recurringOrderId);

      if (error) {
        console.error('Error deleting recurring order:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteRecurringOrder:', error);
      return false;
    }
  },

  async getRecurringOrderHistory(recurringOrderId: string): Promise<RecurringOrderHistory[]> {
    try {
      const { data, error } = await supabase
        .from('recurring_order_history')
        .select('*')
        .eq('recurring_order_id', recurringOrderId)
        .order('scheduled_date', { ascending: false });

      if (error) {
        console.error('Error fetching recurring order history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRecurringOrderHistory:', error);
      return [];
    }
  },

  async getDueRecurringOrders(date?: string): Promise<RecurringOrder[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('recurring_orders')
        .select('*')
        .eq('status', 'active')
        .lte('next_order_date', targetDate)
        .order('next_order_date', { ascending: true });

      if (error) {
        console.error('Error fetching due recurring orders:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getDueRecurringOrders:', error);
      return [];
    }
  },

  getFrequencyDisplay(frequency: string, interval: number = 1): string {
    if (interval === 1) {
      switch (frequency) {
        case 'weekly':
          return 'Every week';
        case 'biweekly':
          return 'Every 2 weeks';
        case 'monthly':
          return 'Every month';
        case 'quarterly':
          return 'Every 3 months';
        case 'yearly':
          return 'Every year';
        default:
          return frequency;
      }
    } else {
      switch (frequency) {
        case 'weekly':
          return `Every ${interval} weeks`;
        case 'biweekly':
          return `Every ${interval * 2} weeks`;
        case 'monthly':
          return `Every ${interval} months`;
        case 'quarterly':
          return `Every ${interval * 3} months`;
        case 'yearly':
          return `Every ${interval} years`;
        default:
          return `${frequency} (${interval}x)`;
      }
    }
  },

  calculateNextOrderDate(currentDate: string, frequency: string, interval: number = 1): string {
    const date = new Date(currentDate);

    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + (interval * 7));
        break;
      case 'biweekly':
        date.setDate(date.getDate() + (interval * 14));
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + interval);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + (interval * 3));
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + interval);
        break;
      default:
        date.setDate(date.getDate() + (interval * 30));
    }

    return date.toISOString().split('T')[0];
  }
};
