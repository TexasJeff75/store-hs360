import { supabase } from './supabase';
import { bcRestAPI, CartLineItem, AddressData } from './bigcommerceRestAPI';
import { orderService, CreateOrderData, OrderItem, Address } from './orderService';

interface CheckoutSessionData {
  id: string;
  user_id: string;
  organization_id?: string;
  location_id?: string;
  cart_id?: string;
  checkout_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'abandoned';
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

interface CheckoutFlowResult {
  success: boolean;
  sessionId?: string;
  cartId?: string;
  checkoutId?: string;
  orderId?: string;
  error?: string;
}

class RestCheckoutService {
  async createCheckoutSession(
    userId: string,
    items: any[],
    organizationId?: string,
    locationId?: string
  ): Promise<CheckoutFlowResult> {
    try {
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = 0; // Tax will be fetched from BigCommerce after address is added
      const shipping = 0;
      const total = subtotal + tax + shipping;

      const { data: session, error } = await supabase
        .from('checkout_sessions')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          location_id: locationId,
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
          status: 'processing',
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

      await supabase
        .from('checkout_sessions')
        .update({
          status: 'processing',
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


      // NOTE: This creates the order in the local Supabase database only.
      // To sync orders to BigCommerce, you would need to:
      // 1. Use BigCommerce Orders V2/V3 API to create the order
      // 2. Handle inventory management
      // 3. Process payment through BigCommerce Payments API or external gateway
      // 4. Store the BigCommerce order ID in the database
      // For development/testing, orders are stored locally with simulated payment.

      const orderData: CreateOrderData = {
        userId: session.user_id,
        bigcommerceCartId: session.cart_id || '',
        items: session.cart_items.map((item: any) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          retailPrice: item.retailPrice,
          cost: item.cost,
          image: item.image,
          hasMarkup: item.hasMarkup,
          brand: item.brand,
        })),
        subtotal: session.subtotal,
        tax: session.tax,
        shipping: session.shipping,
        total: session.total,
        shippingAddress: session.shipping_address,
        billingAddress: session.billing_address,
        customerEmail: session.billing_address?.email || '',
        organizationId: session.organization_id,
        locationId: session.location_id,
        notes: 'Test order - Payment simulated (card ending in ' + paymentData.number.slice(-4) + ')',
      };

      const result = await orderService.createOrder(orderData);

      if (!result.order) {
        throw new Error(result.error || 'Failed to create order');
      }

      const paymentAuthId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await orderService.updatePaymentStatus(
        result.order.id,
        'authorized',
        paymentAuthId
      );

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
        orderId: result.order.id,
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
