import { ENV } from '../config/env';

const BC_STORE_HASH = ENV.BC_STORE_HASH;
const API_BASE = ENV.API_BASE;

async function callServerlessFunction(action: string, data: any) {
  const url = `${API_BASE}/bigcommerce-cart`;
  console.log('[BC REST API] Calling serverless function:', url);
  console.log('[BC REST API] Action:', action);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, data }),
    });

    console.log('[BC REST API] Response status:', response.status);
    console.log('[BC REST API] Response headers:', Object.fromEntries(response.headers.entries()));

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[BC REST API] Non-JSON response:', text.substring(0, 500));
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
    }

    const result = await response.json();

    if (!response.ok) {
      console.error('[BC REST API] Error response:', result);
      const errorMsg = result.error || 'API request failed';

      if (errorMsg.toLowerCase().includes('scope') || errorMsg.toLowerCase().includes('unauthorized')) {
        console.error('❌ BigCommerce API Scope Error');
        console.error('📖 See BIGCOMMERCE_SCOPES.md for help configuring token scopes');
        console.error('   Your BC_ACCESS_TOKEN may be missing Carts/Checkouts/Orders scopes');
        throw new Error(`${errorMsg}. Check your BC_ACCESS_TOKEN scopes - see BIGCOMMERCE_SCOPES.md for help`);
      }

      throw new Error(errorMsg);
    }

    return result;
  } catch (error) {
    console.error('[BC REST API] Request failed:', error);
    throw error;
  }
}

async function callRestAPI(endpoint: string, options?: { method?: string; body?: any }) {
  const action = options?.method === 'POST' ? 'createCheckout' :
                 options?.method === 'PUT' ? 'updateCheckout' :
                 options?.method === 'GET' ? 'getCheckout' : 'checkoutAction';

  const data = {
    endpoint,
    method: options?.method || 'GET',
    body: options?.body
  };

  return callServerlessFunction(action, data);
}

export interface CartLineItem {
  product_id: number;
  quantity: number;
  variant_id?: number;
}

export interface CreateCartRequest {
  line_items: CartLineItem[];
  channel_id?: number;
  locale?: string;
}

export interface AddressData {
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state_or_province: string;
  postal_code: string;
  country_code: string;
  phone?: string;
}

export interface CreateCheckoutRequest {
  cart_id: string;
  billing_address: AddressData;
  consignments: Array<{
    address: AddressData;
    line_items: Array<{
      item_id: string;
      quantity: number;
    }>;
  }>;
}

class BigCommerceRestAPIService {
  async createCart(items: CartLineItem[]) {
    console.log('[BC REST API] Creating cart with items:', items);

    const response = await callServerlessFunction('createCart', {
      line_items: items,
    });

    console.log('[BC REST API] Cart created:', response.cartId);

    return {
      cartId: response.cartId,
      cart: response.cart || response,
    };
  }

  async getCart(cartId: string) {
    console.log('[BC REST API] Getting cart:', cartId);

    const response = await callServerlessFunction('getCart', { cartId });

    return response;
  }

  async createCheckout(cartId: string, billingAddress: AddressData, shippingAddress: AddressData) {
    console.log('[BC REST API] Adding addresses to checkout:', cartId);
    console.log('[BC REST API] Note: Cart ID and Checkout ID are the same in BigCommerce');

    const cart = await this.getCart(cartId);

    if (!cart.line_items?.physical_items || cart.line_items.physical_items.length === 0) {
      console.error('[BC REST API] No physical items in cart');
      throw new Error('Cart has no physical items');
    }

    const lineItems = cart.line_items.physical_items.map((item: any) => ({
      item_id: item.id,
      quantity: item.quantity,
    }));

    // Add billing address to checkout
    const billingResponse = await callRestAPI(`/checkouts/${cartId}/billing-address`, {
      method: 'POST',
      body: billingAddress,
    });

    console.log('[BC REST API] Billing address added');

    // Add consignment (shipping address + line items)
    const consignmentBody = [
      {
        address: shippingAddress,
        line_items: lineItems,
      },
    ];

    const consignmentResponse = await callRestAPI(`/checkouts/${cartId}/consignments?include=consignments.available_shipping_options`, {
      method: 'POST',
      body: consignmentBody,
    });

    console.log('[BC REST API] Shipping consignment added');

    return {
      checkoutId: cartId,
      checkout: consignmentResponse.data,
      consignments: consignmentResponse.data?.consignments,
    };
  }

  async getCheckout(checkoutId: string) {
    console.log('[BC REST API] Getting checkout:', checkoutId);

    const response = await callRestAPI(`/checkouts/${checkoutId}`);

    return response.data;
  }

  async addBillingAddress(checkoutId: string, address: AddressData) {
    console.log('[BC REST API] Adding billing address to checkout:', checkoutId);

    const response = await callRestAPI(`/checkouts/${checkoutId}/billing-address`, {
      method: 'POST',
      body: address,
    });

    return response.data;
  }

  async getShippingOptions(checkoutId: string, consignmentId: string) {
    console.log('[BC REST API] Getting shipping options for checkout:', checkoutId);

    const response = await callRestAPI(
      `/checkouts/${checkoutId}/consignments/${consignmentId}/shipping-options`
    );

    return response.data?.shipping_options || [];
  }

  async updateShippingOption(checkoutId: string, consignmentId: string, shippingOptionId: string) {
    console.log('[BC REST API] Updating shipping option:', shippingOptionId);

    const response = await callRestAPI(
      `/checkouts/${checkoutId}/consignments/${consignmentId}`,
      {
        method: 'PUT',
        body: {
          shipping_option_id: shippingOptionId,
        },
      }
    );

    return response.data;
  }

  async createOrder(checkoutId: string) {
    console.log('[BC REST API] Creating order from checkout:', checkoutId);

    const response = await callRestAPI(`/checkouts/${checkoutId}/orders`, {
      method: 'POST',
      body: {},
    });

    console.log('[BC REST API] Order created:', response.data?.id);

    return {
      orderId: response.data?.id,
      order: response.data,
    };
  }

  async processPayment(checkoutId: string, paymentData: {
    instrument: {
      type: 'card';
      cardholder_name: string;
      number: string;
      expiry_month: number;
      expiry_year: number;
      verification_value: string;
    };
  }) {
    console.log('[BC REST API] Processing payment for checkout:', checkoutId);

    const response = await callRestAPI(`/checkouts/${checkoutId}/payments`, {
      method: 'POST',
      body: {
        payment: paymentData,
      },
    });

    console.log('[BC REST API] Payment processed');

    return response.data;
  }

  async getProductCosts(productIds: number[]) {
    console.log('[BC REST API] Fetching product costs for:', productIds);

    const response = await callServerlessFunction('getProductCosts', { productIds });

    return response;
  }
}

export const bcRestAPI = new BigCommerceRestAPIService();
