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
  backorder?: boolean;
  backorder_reason?: string;
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

interface Order {
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
  parent_order_id?: string;
  split_from_order_id?: string;
  order_type?: string;
  payment_status?: string;
  payment_authorization_id?: string;
  payment_captured_at?: string;
  shipped_at?: string;
  backorder_reason?: string;
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
        .eq('viewed_by_admin', false)
        .in('status', ['pending', 'processing']);

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

  async getPendingUserCount(): Promise<{ count: number; error?: string }> {
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');

      if (error) {
        console.error('Error fetching pending user count:', error);
        return { count: 0, error: error.message };
      }

      return { count: count || 0 };
    } catch (error) {
      console.error('Error fetching pending user count:', error);
      return {
        count: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch pending user count'
      };
    }
  }

  async splitOrderByBackorder(
    orderId: string,
    backorderedItemIds: number[]
  ): Promise<{ originalOrder: Order | null; backorder: Order | null; error?: string }> {
    try {
      const { order: originalOrder, error: fetchError } = await this.getOrderById(orderId);

      if (fetchError || !originalOrder) {
        return {
          originalOrder: null,
          backorder: null,
          error: fetchError || 'Order not found'
        };
      }

      const availableItems = originalOrder.items.filter(
        item => !backorderedItemIds.includes(item.productId)
      );
      const backorderedItems = originalOrder.items.filter(
        item => backorderedItemIds.includes(item.productId)
      );

      if (backorderedItems.length === 0) {
        return {
          originalOrder: null,
          backorder: null,
          error: 'No backordered items specified'
        };
      }

      const availableSubtotal = availableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const backorderSubtotal = backorderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const taxRatio = originalOrder.subtotal > 0 ? originalOrder.tax / originalOrder.subtotal : 0;
      const shippingRatio = originalOrder.subtotal > 0 ? originalOrder.shipping / originalOrder.subtotal : 0;

      const availableTax = availableSubtotal * taxRatio;
      const availableShipping = availableSubtotal * shippingRatio;
      const backorderTax = backorderSubtotal * taxRatio;
      const backorderShipping = backorderSubtotal * shippingRatio;

      const { data: updatedOriginal, error: updateError } = await supabase
        .from('orders')
        .update({
          items: availableItems,
          subtotal: availableSubtotal,
          tax: availableTax,
          shipping: availableShipping,
          total: availableSubtotal + availableTax + availableShipping,
          order_type: 'partial',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating original order:', updateError);
        return { originalOrder: null, backorder: null, error: updateError.message };
      }

      const { data: backorderOrder, error: backorderError } = await supabase
        .from('orders')
        .insert({
          user_id: originalOrder.user_id,
          bigcommerce_cart_id: originalOrder.bigcommerce_cart_id,
          status: 'backorder',
          order_type: 'backorder',
          subtotal: backorderSubtotal,
          tax: backorderTax,
          shipping: backorderShipping,
          total: backorderSubtotal + backorderTax + backorderShipping,
          currency: originalOrder.currency,
          items: backorderedItems,
          shipping_address: originalOrder.shipping_address,
          billing_address: originalOrder.billing_address,
          customer_email: originalOrder.customer_email,
          organization_id: originalOrder.organization_id,
          location_id: originalOrder.location_id,
          parent_order_id: originalOrder.parent_order_id || orderId,
          split_from_order_id: orderId,
          payment_status: originalOrder.payment_status,
          payment_authorization_id: originalOrder.payment_authorization_id,
          notes: `Backordered items from order ${originalOrder.order_number || orderId}`
        })
        .select()
        .single();

      if (backorderError) {
        console.error('Error creating backorder:', backorderError);
        return { originalOrder: null, backorder: null, error: backorderError.message };
      }

      return { originalOrder: updatedOriginal, backorder: backorderOrder };
    } catch (error) {
      console.error('Error splitting order:', error);
      return {
        originalOrder: null,
        backorder: null,
        error: error instanceof Error ? error.message : 'Failed to split order'
      };
    }
  }

  async splitOrderByBackorderWithQuantities(
    orderId: string,
    backorderedItems: Array<{ productId: number; quantity: number }>
  ): Promise<{ originalOrder: Order | null; backorder: Order | null; error?: string }> {
    try {
      const { order: originalOrder, error: fetchError } = await this.getOrderById(orderId);

      if (fetchError || !originalOrder) {
        return {
          originalOrder: null,
          backorder: null,
          error: fetchError || 'Order not found'
        };
      }

      if (backorderedItems.length === 0) {
        return {
          originalOrder: null,
          backorder: null,
          error: 'No backordered items specified'
        };
      }

      const backorderMap = new Map(backorderedItems.map(item => [item.productId, item.quantity]));

      const updatedOriginalItems: OrderItem[] = [];
      const backorderItemsList: OrderItem[] = [];

      originalOrder.items.forEach(item => {
        const backorderQty = backorderMap.get(item.productId);

        if (backorderQty && backorderQty > 0) {
          const remainingQty = item.quantity - backorderQty;

          if (remainingQty > 0) {
            updatedOriginalItems.push({
              ...item,
              quantity: remainingQty
            });
          }

          backorderItemsList.push({
            ...item,
            quantity: backorderQty
          });
        } else {
          updatedOriginalItems.push(item);
        }
      });

      if (backorderItemsList.length === 0) {
        return {
          originalOrder: null,
          backorder: null,
          error: 'No valid backorder quantities specified'
        };
      }

      const availableSubtotal = updatedOriginalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const backorderSubtotal = backorderItemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const taxRatio = originalOrder.subtotal > 0 ? originalOrder.tax / originalOrder.subtotal : 0;
      const shippingRatio = originalOrder.subtotal > 0 ? originalOrder.shipping / originalOrder.subtotal : 0;

      const availableTax = availableSubtotal * taxRatio;
      const availableShipping = availableSubtotal * shippingRatio;
      const backorderTax = backorderSubtotal * taxRatio;
      const backorderShipping = backorderSubtotal * shippingRatio;

      const { data: updatedOriginal, error: updateError } = await supabase
        .from('orders')
        .update({
          items: updatedOriginalItems,
          subtotal: availableSubtotal,
          tax: availableTax,
          shipping: availableShipping,
          total: availableSubtotal + availableTax + availableShipping,
          order_type: 'partial',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating original order:', updateError);
        return { originalOrder: null, backorder: null, error: updateError.message };
      }

      const { data: backorderOrder, error: backorderError } = await supabase
        .from('orders')
        .insert({
          user_id: originalOrder.user_id,
          bigcommerce_cart_id: originalOrder.bigcommerce_cart_id,
          status: 'backorder',
          order_type: 'backorder',
          subtotal: backorderSubtotal,
          tax: backorderTax,
          shipping: backorderShipping,
          total: backorderSubtotal + backorderTax + backorderShipping,
          currency: originalOrder.currency,
          items: backorderItemsList,
          shipping_address: originalOrder.shipping_address,
          billing_address: originalOrder.billing_address,
          customer_email: originalOrder.customer_email,
          organization_id: originalOrder.organization_id,
          location_id: originalOrder.location_id,
          parent_order_id: originalOrder.parent_order_id || orderId,
          split_from_order_id: orderId,
          payment_status: originalOrder.payment_status,
          payment_authorization_id: originalOrder.payment_authorization_id,
          notes: `Backordered items from order ${originalOrder.order_number || orderId}`
        })
        .select()
        .single();

      if (backorderError) {
        console.error('Error creating backorder:', backorderError);
        return { originalOrder: null, backorder: null, error: backorderError.message };
      }

      return { originalOrder: updatedOriginal, backorder: backorderOrder };
    } catch (error) {
      console.error('Error splitting order:', error);
      return {
        originalOrder: null,
        backorder: null,
        error: error instanceof Error ? error.message : 'Failed to split order'
      };
    }
  }

  async updatePaymentStatus(
    orderId: string,
    paymentStatus: string,
    paymentAuthorizationId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      };

      if (paymentAuthorizationId) {
        updateData.payment_authorization_id = paymentAuthorizationId;
      }

      if (paymentStatus === 'captured') {
        updateData.payment_captured_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        console.error('Error updating payment status:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating payment status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update payment status'
      };
    }
  }

  async capturePaymentOnShipment(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { order, error: fetchError } = await this.getOrderById(orderId);

      if (fetchError || !order) {
        return { success: false, error: fetchError || 'Order not found' };
      }

      if (order.payment_status === 'captured') {
        return { success: true };
      }

      if (order.payment_status !== 'authorized') {
        return { success: false, error: 'Payment must be authorized before capture' };
      }

      const captureResult = await this.updatePaymentStatus(orderId, 'captured');

      if (!captureResult.success) {
        return captureResult;
      }

      return { success: true };
    } catch (error) {
      console.error('Error capturing payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture payment'
      };
    }
  }

  async getRelatedOrders(orderId: string): Promise<{ orders: Order[]; error?: string }> {
    try {
      const { order, error: fetchError } = await this.getOrderById(orderId);

      if (fetchError || !order) {
        return { orders: [], error: fetchError || 'Order not found' };
      }

      const parentId = order.parent_order_id || orderId;

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${parentId},parent_order_id.eq.${parentId},split_from_order_id.eq.${orderId}`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching related orders:', error);
        return { orders: [], error: error.message };
      }

      return { orders: data || [] };
    } catch (error) {
      console.error('Error fetching related orders:', error);
      return {
        orders: [],
        error: error instanceof Error ? error.message : 'Failed to fetch related orders'
      };
    }
  }
}

export const orderService = new OrderService();
