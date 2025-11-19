import { supabase } from './supabase';

export interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  retailPrice?: number;
  cost?: number;
  image?: string;
  hasMarkup?: boolean;
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface CreateOrderData {
  userId: string;
  bigcommerceCartId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  shippingAddress?: Address;
  billingAddress?: Address;
  customerEmail: string;
  organizationId?: string;
  locationId?: string;
  notes?: string;
}

export interface Order {
  id: string;
  user_id: string;
  bigcommerce_order_id?: string;
  bigcommerce_cart_id: string;
  order_number?: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  items: OrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
  customer_email: string;
  organization_id?: string;
  location_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

class OrderService {
  async createOrder(data: CreateOrderData): Promise<{ order: Order | null; error?: string }> {
    try {
      let salesRepId = null;

      if (data.organizationId) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('default_sales_rep_id, is_house_account')
          .eq('id', data.organizationId)
          .maybeSingle();

        if (!orgError && orgData && !orgData.is_house_account) {
          salesRepId = orgData.default_sales_rep_id;

          if (!salesRepId) {
            const { data: salesRepData } = await supabase
              .from('organization_sales_reps')
              .select('sales_rep_id')
              .eq('organization_id', data.organizationId)
              .eq('is_active', true)
              .maybeSingle();

            if (salesRepData) {
              salesRepId = salesRepData.sales_rep_id;
            }
          }
        }
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          user_id: data.userId,
          bigcommerce_cart_id: data.bigcommerceCartId,
          status: 'pending',
          subtotal: data.subtotal,
          tax: data.tax,
          shipping: data.shipping,
          total: data.total,
          items: data.items,
          shipping_address: data.shippingAddress,
          billing_address: data.billingAddress,
          customer_email: data.customerEmail,
          organization_id: data.organizationId,
          location_id: data.locationId,
          sales_rep_id: salesRepId,
          notes: data.notes
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating order:', error);
        return { order: null, error: error.message };
      }

      return { order };
    } catch (error) {
      console.error('Error creating order:', error);
      return {
        order: null,
        error: error instanceof Error ? error.message : 'Failed to create order'
      };
    }
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
    bigcommerceOrderId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (bigcommerceOrderId) {
        updateData.bigcommerce_order_id = bigcommerceOrderId;
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order status:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating order status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update order status'
      };
    }
  }

  async getUserOrders(userId: string): Promise<{ orders: Order[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user orders:', error);
        return { orders: [], error: error.message };
      }

      return { orders: data || [] };
    } catch (error) {
      console.error('Error fetching user orders:', error);
      return {
        orders: [],
        error: error instanceof Error ? error.message : 'Failed to fetch orders'
      };
    }
  }

  async getOrderById(orderId: string): Promise<{ order: Order | null; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching order:', error);
        return { order: null, error: error.message };
      }

      return { order: data };
    } catch (error) {
      console.error('Error fetching order:', error);
      return {
        order: null,
        error: error instanceof Error ? error.message : 'Failed to fetch order'
      };
    }
  }

  async getOrganizationOrders(
    organizationId: string
  ): Promise<{ orders: Order[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching organization orders:', error);
        return { orders: [], error: error.message };
      }

      return { orders: data || [] };
    } catch (error) {
      console.error('Error fetching organization orders:', error);
      return {
        orders: [],
        error: error instanceof Error ? error.message : 'Failed to fetch orders'
      };
    }
  }

  async getNewOrderCount(userId?: string, userRole?: string): Promise<{ count: number; error?: string }> {
    try {
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('viewed_by_admin', false);

      // Apply same filtering as OrderManagement component
      if (userRole === 'sales_rep' && userId) {
        query = query.eq('sales_rep_id', userId);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error fetching new order count:', error);
        return { count: 0, error: error.message };
      }

      return { count: count || 0 };
    } catch (error) {
      console.error('Error fetching new order count:', error);
      return {
        count: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch new order count'
      };
    }
  }

  async markOrderAsViewed(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ viewed_by_admin: true })
        .eq('id', orderId);

      if (error) {
        console.error('Error marking order as viewed:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking order as viewed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark order as viewed'
      };
    }
  }
}

export const orderService = new OrderService();
