import { supabase } from './supabase';
import { bcRestAPI, CartLineItem, AddressData } from './bigcommerceRestAPI';
import { orderService, CreateOrderData, OrderItem, Address } from './orderService';

export interface CheckoutSessionData {
  id: string;
  user_id: string;
  organization_id?: string;
  cart_id?: string;
  checkout_id?: string;
  status: 'pending' | 'address_entered' | 'payment_pending' | 'completed' | 'failed';
  cart_items: any[];
  shipping_address?: AddressData;
  billing_address?: AddressData;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface CheckoutFlowResult {
  success: boolean;
  sessionId?: string;
  cartId?: string;
  checkoutId?: string;
  orderId?: string;
  error?: string;
}

class RestCheckoutService {
  async createCheckoutSession(userId: string, items: any[]): Promise<CheckoutFlowResult> {
    try {
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.08;
      const shipping = 9.99;
      const total = subtotal + tax + shipping;

      const { data: session, error } = await supabase
        .from('checkout_sessions')
        .insert({
          user_id: userId,
          cart_items: items,
          status: 'pending',
          subtotal,
          tax,
          shipping,
          total,
        })
        .select()
        .maybeSingle();

      if (error || !session) {
        console.error('Failed to create checkout session:', error);
        return {
          success: false,
          error: 'Failed to create checkout session',
        };
      }

      return {
        success: true,
        sessionId: session.id,
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createCart(sessionId: string, items: CartLineItem[]): Promise<CheckoutFlowResult> {
    try {
      const cartResult = await bcRestAPI.createCart(items);

      const { error } = await supabase
        .from('checkout_sessions')
        .update({
          cart_id: cartResult.cartId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Failed to update session with cart ID:', error);
      }

      return {
        success: true,
        sessionId,
        cartId: cartResult.cartId,
      };
    } catch (error) {
      console.error('Error creating cart:', error);

      await supabase
        .from('checkout_sessions')
        .update({
          status: 'failed',
          last_error: error instanceof Error ? error.message : 'Failed to create cart',
        })
        .eq('id', sessionId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create cart',
      };
    }
  }

  async addAddresses(
    sessionId: string,
    cartId: string,
    billingAddress: AddressData,
    shippingAddress: AddressData
  ): Promise<CheckoutFlowResult> {
    try {
      const checkoutResult = await bcRestAPI.createCheckout(cartId, billingAddress, shippingAddress);

      const { error } = await supabase
        .from('checkout_sessions')
        .update({
          checkout_id: checkoutResult.checkoutId,
          billing_address: billingAddress,
          shipping_address: shippingAddress,
          status: 'address_entered',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Failed to update session with addresses:', error);
      }

      return {
        success: true,
        sessionId,
        cartId,
        checkoutId: checkoutResult.checkoutId,
      };
    } catch (error) {
      console.error('Error adding addresses:', error);

      await supabase
        .from('checkout_sessions')
        .update({
          status: 'failed',
          last_error: error instanceof Error ? error.message : 'Failed to add addresses',
        })
        .eq('id', sessionId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add addresses',
      };
    }
  }

  async processPayment(
    sessionId: string,
    checkoutId: string,
    paymentData: {
      cardholder_name: string;
      number: string;
      expiry_month: number;
      expiry_year: number;
      verification_value: string;
    }
  ): Promise<CheckoutFlowResult> {
    try {
      console.log('[RestCheckout] Processing payment for session:', sessionId);

      await supabase
        .from('checkout_sessions')
        .update({
          status: 'payment_pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      const { data: session } = await supabase
        .from('checkout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (!session) {
        throw new Error('Checkout session not found');
      }

      console.log('[RestCheckout] Creating order in database...');

      const orderData: CreateOrderData = {
        user_id: session.user_id,
        organization_id: session.organization_id,
        bigcommerce_order_id: null,
        bigcommerce_cart_id: session.cart_id,
        status: 'pending',
        subtotal: session.subtotal,
        tax: session.tax,
        shipping: session.shipping,
        total: session.total,
        currency: session.currency || 'USD',
        items: session.cart_items.map((item: any) => ({
          product_id: item.productId,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
        })),
        shipping_address: session.shipping_address,
        billing_address: session.billing_address,
        customer_email: session.billing_address?.email || '',
        notes: 'Test order - Payment simulated (card ending in ' + paymentData.number.slice(-4) + ')',
      };

      const createdOrder = await orderService.createOrder(orderData);

      if (!createdOrder) {
        throw new Error('Failed to create order');
      }

      console.log('[RestCheckout] Order created:', createdOrder.id);

      await supabase
        .from('checkout_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      return {
        success: true,
        sessionId,
        checkoutId,
        orderId: createdOrder.id,
      };
    } catch (error) {
      console.error('Error processing payment:', error);

      await supabase
        .from('checkout_sessions')
        .update({
          status: 'failed',
          last_error: error instanceof Error ? error.message : 'Payment failed',
        })
        .eq('id', sessionId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  async getSession(sessionId: string): Promise<CheckoutSessionData | null> {
    try {
      const { data, error } = await supabase
        .from('checkout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !data) {
        console.error('Failed to get session:', error);
        return null;
      }

      return data as CheckoutSessionData;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }
}

export const restCheckoutService = new RestCheckoutService();
