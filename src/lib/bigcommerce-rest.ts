const STORE_HASH = import.meta.env.VITE_BC_STORE_HASH;
const ACCESS_TOKEN = import.meta.env.VITE_BC_ACCESS_TOKEN;
const BASE_URL = `https://api.bigcommerce.com/stores/${STORE_HASH}/v3`;

interface CreateCartPayload {
  line_items: Array<{
    product_id: number;
    quantity: number;
  }>;
  channel_id?: number;
}

interface UpdateCartPayload {
  line_items: Array<{
    id?: string;
    product_id: number;
    quantity: number;
  }>;
}

interface CartResponse {
  data: {
    id: string;
    line_items: {
      physical_items: Array<{
        id: string;
        product_id: number;
        name: string;
        quantity: number;
        sale_price: number;
        list_price: number;
        image_url: string;
      }>;
    };
    cart_amount: number;
    redirect_urls: {
      checkout_url: string;
      embedded_checkout_url: string;
      cart_url: string;
    };
  };
}

export class BigCommerceRestAPI {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': ACCESS_TOKEN,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  async createCart(items: CreateCartPayload['line_items']): Promise<CartResponse> {
    return this.request<CartResponse>('/carts', {
      method: 'POST',
      body: JSON.stringify({
        line_items: items,
        channel_id: 1,
      }),
    });
  }

  async getCart(cartId: string): Promise<CartResponse> {
    return this.request<CartResponse>(`/carts/${cartId}`);
  }

  async updateCart(cartId: string, items: UpdateCartPayload['line_items']): Promise<CartResponse> {
    return this.request<CartResponse>(`/carts/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        line_items: items,
      }),
    });
  }

  async deleteCartItem(cartId: string, itemId: string): Promise<CartResponse> {
    return this.request<CartResponse>(`/carts/${cartId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async deleteCart(cartId: string): Promise<void> {
    await this.request(`/carts/${cartId}`, {
      method: 'DELETE',
    });
  }

  async createCheckoutRedirect(cartId: string): Promise<{ checkout_url: string }> {
    const cart = await this.getCart(cartId);
    return {
      checkout_url: cart.data.redirect_urls.checkout_url,
    };
  }

  async getCustomerOrders(customerId: number) {
    return this.request(`/orders?customer_id=${customerId}`);
  }

  async getOrder(orderId: number) {
    return this.request(`/orders/${orderId}`);
  }

  async getProducts(params?: { limit?: number; page?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());

    return this.request(`/catalog/products?${queryParams}`);
  }

  async getProduct(productId: number) {
    return this.request(`/catalog/products/${productId}`);
  }
}

export const bcRestAPI = new BigCommerceRestAPI();
