import { supabase } from './supabase';

export interface Subscription {
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

export interface SubscriptionOrder {
  id: string;
  subscription_id: string;
  order_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  scheduled_date: string;
  processed_date: string | null;
  amount: number;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export interface CreateSubscriptionData {
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

export interface UpdateSubscriptionData {
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

export const subscriptionService = {
  async createSubscription(data: CreateSubscriptionData): Promise<Subscription | null> {
    try {
      const nextOrderDate = data.start_date || new Date().toISOString().split('T')[0];

      const { data: subscription, error } = await supabase
        .from('subscriptions')
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
        console.error('Error creating subscription:', error);
        return null;
      }

      return subscription;
    } catch (error) {
      console.error('Error in createSubscription:', error);
      return null;
    }
  },

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user subscriptions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserSubscriptions:', error);
      return [];
    }
  },

  async getOrganizationSubscriptions(organizationId: string): Promise<Subscription[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching organization subscriptions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getOrganizationSubscriptions:', error);
      return [];
    }
  },

  async getAllSubscriptions(): Promise<Subscription[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all subscriptions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllSubscriptions:', error);
      return [];
    }
  },

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getSubscription:', error);
      return null;
    }
  },

  async updateSubscription(subscriptionId: string, updates: UpdateSubscriptionData): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateSubscription:', error);
      return null;
    }
  },

  async pauseSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'paused' })
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error pausing subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in pauseSubscription:', error);
      return false;
    }
  },

  async resumeSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'active' })
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error resuming subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in resumeSubscription:', error);
      return false;
    }
  },

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error cancelling subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in cancelSubscription:', error);
      return false;
    }
  },

  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error deleting subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteSubscription:', error);
      return false;
    }
  },

  async getSubscriptionOrders(subscriptionId: string): Promise<SubscriptionOrder[]> {
    try {
      const { data, error } = await supabase
        .from('subscription_orders')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('scheduled_date', { ascending: false });

      if (error) {
        console.error('Error fetching subscription orders:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSubscriptionOrders:', error);
      return [];
    }
  },

  async getDueSubscriptions(date?: string): Promise<Subscription[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .lte('next_order_date', targetDate)
        .order('next_order_date', { ascending: true });

      if (error) {
        console.error('Error fetching due subscriptions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getDueSubscriptions:', error);
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
