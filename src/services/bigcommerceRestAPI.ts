const BC_STORE_HASH = import.meta.env.VITE_BC_STORE_HASH;
const API_BASE = import.meta.env.VITE_API_BASE || '/.netlify/functions';

async function callServerlessFunction(action: string, data: any) {
  const response = await fetch(`${API_BASE}/bigcommerce-cart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
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
      redirectUrl: response.redirectUrl,
    };
  }

  async getCart(cartId: string) {
    console.log('[BC REST API] Getting cart:', cartId);

    const response = await callServerlessFunction('getCart', { cartId });

    return response;
  }

  async createCheckout(cartId: string, billingAddress: AddressData, shippingAddress: AddressData) {
    console.log('[BC REST API] Creating checkout for cart:', cartId);

    const cart = await this.getCart(cartId);

    const lineItems = cart.line_items.physical_items.map((item: any) => ({
      item_id: item.id,
      quantity: item.quantity,
    }));

    const requestBody: CreateCheckoutRequest = {
      cart_id: cartId,
      billing_address: billingAddress,
      consignments: [
        {
          address: shippingAddress,
          line_items: lineItems,
        },
      ],
    };

    const response = await callRestAPI('/checkouts', {
      method: 'POST',
      body: requestBody,
    });

    console.log('[BC REST API] Checkout created:', response.data?.id);

    return {
      checkoutId: response.data?.id,
      checkout: response.data,
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

  getCheckoutUrl(checkoutId: string): string {
    if (!BC_STORE_HASH) {
      throw new Error('BC_STORE_HASH not configured');
    }

    return `https://store-${BC_STORE_HASH}.mybigcommerce.com/checkout/${checkoutId}`;
  }
}

export const bcRestAPI = new BigCommerceRestAPIService();
