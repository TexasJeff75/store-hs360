import { supabase } from './supabase';
import { bcRestAPI, CartLineItem as RestCartLineItem, AddressData } from './bigcommerceRestAPI';
import { orderService, CreateOrderData, OrderItem, Address } from './orderService';
import { v4 as uuidv4 } from 'uuid';

export interface CheckoutSession {
  id: string;
  user_id: string;
  organization_id?: string;
  location_id?: string;
  cart_id?: string;
  checkout_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'abandoned';
  step: 'cart_creation' | 'address_entry' | 'payment' | 'confirmation';
  cart_items: CartItem[];
  shipping_address?: any;
  billing_address?: any;
  payment_method?: 'online' | 'offline';
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  error_log: ErrorLogEntry[];
  retry_count: number;
  last_error?: string;
  idempotency_key: string;
  metadata?: any;
  completed_at?: string;
  abandoned_at?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  cost?: number;
  image?: string;
}

export interface ErrorLogEntry {
  timestamp: string;
  step: string;
  error: string;
  retryable: boolean;
}

export interface CheckoutResult {
  success: boolean;
  sessionId?: string;
  cartId?: string;
  checkoutId?: string;
  orderId?: string;
  error?: string;
  canRetry?: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const SESSION_TIMEOUT_HOURS = 24;

class BulletproofCheckoutService {
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async exponentialBackoff(retryCount: number): Promise<void> {
    const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
    await this.sleep(delay);
  }

  private isRetryableError(error: any): boolean {
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /503/,
      /502/,
      /504/,
      /rate limit/i,
    ];

    const errorMessage = error?.message || error?.toString() || '';
    return retryablePatterns.some(pattern => pattern.test(errorMessage));
  }

  private logError(session: CheckoutSession, step: string, error: any): ErrorLogEntry {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      step,
      error: error?.message || error?.toString() || 'Unknown error',
      retryable: this.isRetryableError(error),
    };

    session.error_log.push(entry);
    session.last_error = entry.error;

    return entry;
  }

  async createSession(
    userId: string,
    cartItems: CartItem[],
    organizationId?: string
  ): Promise<CheckoutResult> {
    try {
      console.log('[Bulletproof Checkout] Creating session for user:', userId);
      console.log('[Bulletproof Checkout] Cart items:', cartItems);

      const idempotencyKey = uuidv4();
      const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const tax = subtotal * 0.08;
      const shipping = 0;
      const total = subtotal + tax + shipping;

      const { data: session, error } = await supabase
        .from('checkout_sessions')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          cart_items: cartItems,
          status: 'pending',
          step: 'cart_creation',
          subtotal,
          tax,
          shipping,
          total,
          currency: 'USD',
          idempotency_key: idempotencyKey,
          error_log: [],
          retry_count: 0,
          expires_at: new Date(Date.now() + SESSION_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[Bulletproof Checkout] Failed to create checkout session:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
          canRetry: true,
        };
      }

      console.log('[Bulletproof Checkout] Session created:', session.id);

      return {
        success: true,
        sessionId: session.id,
      };
    } catch (error) {
      console.error('[Bulletproof Checkout] Error creating checkout session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
        canRetry: true,
      };
    }
  }

  async getSession(sessionId: string): Promise<CheckoutSession | null> {
    try {
      const { data, error } = await supabase
        .from('checkout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error) {
        console.error('Failed to get checkout session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting checkout session:', error);
      return null;
    }
  }

  async updateSession(
    sessionId: string,
    updates: Partial<CheckoutSession>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('checkout_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) {
        console.error('Failed to update checkout session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating checkout session:', error);
      return false;
    }
  }

  async createCartWithRetry(
    sessionId: string,
    lineItems: RestCartLineItem[]
  ): Promise<CheckoutResult> {
    console.log('[Bulletproof Checkout] Creating cart with retry for session:', sessionId);

    const session = await this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        canRetry: false,
      };
    }

    let lastError: any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Bulletproof Checkout] Cart creation attempt ${attempt + 1}/${MAX_RETRIES + 1}`);

        await this.updateSession(sessionId, {
          status: 'processing',
          step: 'cart_creation',
          retry_count: attempt,
        });

        const { cartId } = await bcRestAPI.createCart(lineItems);

        if (cartId) {
          console.log('[Bulletproof Checkout] Cart created successfully:', cartId);
          await this.updateSession(sessionId, {
            cart_id: cartId,
            step: 'address_entry',
          });

          return {
            success: true,
            sessionId,
            cartId,
          };
        } else {
          lastError = new Error('Failed to create cart - no cart ID returned');
          console.error('[Bulletproof Checkout] Cart creation failed:', lastError.message);
          this.logError(session, 'cart_creation', lastError);
        }
      } catch (error) {
        lastError = error;
        console.error('[Bulletproof Checkout] Cart creation error:', error);
        this.logError(session, 'cart_creation', error);

        if (this.isRetryableError(error) && attempt < MAX_RETRIES) {
          console.log('[Bulletproof Checkout] Error is retryable, backing off...');
          await this.exponentialBackoff(attempt);
          continue;
        }
      }
    }

    console.error('[Bulletproof Checkout] All retry attempts exhausted');

    await this.updateSession(sessionId, {
      status: 'failed',
      last_error: lastError?.message || 'Failed to create cart after retries',
    });

    return {
      success: false,
      error: lastError?.message || 'Failed to create cart',
      canRetry: this.isRetryableError(lastError),
    };
  }

  async processRestAPICheckout(
    sessionId: string,
    lineItems: RestCartLineItem[]
  ): Promise<CheckoutResult> {
    console.log('[Bulletproof Checkout] Processing REST API checkout for session:', sessionId);

    const session = await this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        canRetry: false,
      };
    }

    if (session.cart_id) {
      console.log('[Bulletproof Checkout] Using existing cart:', session.cart_id);
      return {
        success: true,
        sessionId,
        cartId: session.cart_id,
      };
    }

    console.log('[Bulletproof Checkout] Creating new cart...');
    const cartResult = await this.createCartWithRetry(sessionId, lineItems);

    return cartResult;
  }

  async processFullCheckout(
    sessionId: string,
    checkoutData: CheckoutData
  ): Promise<CheckoutResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        canRetry: false,
      };
    }

    let lastError: any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.updateSession(sessionId, {
          status: 'processing',
          retry_count: attempt,
          shipping_address: checkoutData.shippingAddress,
          billing_address: checkoutData.billingAddress,
        });

        const result = await bigCommerceCheckoutService.processCheckout(checkoutData);

        if (result.success && result.checkoutId) {
          await this.updateSession(sessionId, {
            checkout_id: result.checkoutId,
            step: 'payment',
          });

          return {
            success: true,
            sessionId,
            checkoutId: result.checkoutId,
          };
        } else {
          lastError = new Error(result.error || 'Checkout failed');
          this.logError(session, 'checkout', lastError);
        }
      } catch (error) {
        lastError = error;
        this.logError(session, 'checkout', error);

        if (this.isRetryableError(error) && attempt < MAX_RETRIES) {
          await this.exponentialBackoff(attempt);
          continue;
        }
      }
    }

    await this.updateSession(sessionId, {
      status: 'failed',
      last_error: lastError?.message || 'Checkout failed after retries',
    });

    return {
      success: false,
      error: lastError?.message || 'Checkout failed',
      canRetry: this.isRetryableError(lastError),
    };
  }

  async completeCheckout(
    sessionId: string,
    bigcommerceOrderId: string
  ): Promise<CheckoutResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        canRetry: false,
      };
    }

    try {
      const orderData: CreateOrderData = {
        userId: session.user_id,
        bigcommerceCartId: session.cart_id || '',
        items: session.cart_items.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost,
          image: item.image,
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
      };

      const { order, error } = await orderService.createOrder(orderData);

      if (error || !order) {
        await this.updateSession(sessionId, {
          status: 'failed',
          last_error: error || 'Failed to create order',
        });

        return {
          success: false,
          error: error || 'Failed to create order',
          canRetry: true,
        };
      }

      await orderService.updateOrderStatus(order.id, 'completed', bigcommerceOrderId);

      await this.updateSession(sessionId, {
        status: 'completed',
        step: 'confirmation',
        completed_at: new Date().toISOString(),
      });

      return {
        success: true,
        sessionId,
        orderId: order.id,
      };
    } catch (error) {
      console.error('Error completing checkout:', error);

      await this.updateSession(sessionId, {
        status: 'failed',
        last_error: error instanceof Error ? error.message : 'Failed to complete checkout',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete checkout',
        canRetry: true,
      };
    }
  }

  async recoverSession(sessionId: string): Promise<CheckoutResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        canRetry: false,
      };
    }

    if (session.status === 'completed') {
      return {
        success: true,
        sessionId,
        orderId: session.id,
      };
    }

    if (new Date(session.expires_at) < new Date()) {
      await this.updateSession(sessionId, {
        status: 'abandoned',
        abandoned_at: new Date().toISOString(),
      });

      return {
        success: false,
        error: 'Session expired',
        canRetry: false,
      };
    }

    switch (session.step) {
      case 'cart_creation':
        return this.createCartWithRetry(
          sessionId,
          session.cart_items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          }))
        );

      case 'address_entry':
      case 'payment':
        if (session.cart_id) {
          return {
            success: true,
            sessionId,
            cartId: session.cart_id,
            checkoutId: session.checkout_id,
          };
        }
        return {
          success: false,
          error: 'No cart ID found',
          canRetry: true,
        };

      case 'confirmation':
        return {
          success: true,
          sessionId,
        };

      default:
        return {
          success: false,
          error: 'Unknown session state',
          canRetry: false,
        };
    }
  }

  async abandonSession(sessionId: string): Promise<void> {
    await this.updateSession(sessionId, {
      status: 'abandoned',
      abandoned_at: new Date().toISOString(),
    });
  }

  async getUserActiveSessions(userId: string): Promise<CheckoutSession[]> {
    try {
      const { data, error } = await supabase
        .from('checkout_sessions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'processing'])
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get active sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }
}

export const bulletproofCheckoutService = new BulletproofCheckoutService();
