import { gql } from './bigcommerce';

// Get BigCommerce configuration from environment
const BC_STORE_HASH = import.meta.env.VITE_BC_STORE_HASH;

// GraphQL mutations for cart operations
const ADD_CART_LINE_ITEMS = /* GraphQL */ `
  mutation AddCartLineItems($cartId: String!, $data: AddCartLineItemsInput!) {
    cart {
      addCartLineItems(input: { cartId: $cartId, data: $data }) {
        cart {
          entityId
          lineItems {
            totalQuantity
            physicalItems {
              entityId
              productEntityId
              quantity
              name
              brand
              imageUrl
              listPrice {
                value
                currencyCode
              }
              salePrice {
                value
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_CART = /* GraphQL */ `
  mutation CreateCart($createCartInput: CreateCartInput!) {
    cart {
      createCart(input: $createCartInput) {
        cart {
          entityId
          lineItems {
            totalQuantity
          }
        }
      }
    }
  }
`;

const GET_CHECKOUT_URL = /* GraphQL */ `
  query GetCheckoutUrl($cartId: String!) {
    site {
      cart(entityId: $cartId) {
        entityId
        lineItems {
          totalQuantity
        }
        # Note: BigCommerce doesn't expose checkout URL via GraphQL
        # We'll construct it manually
      }
    }
  }
`;

export interface CartLineItem {
  productId: number;
  quantity: number;
  variantId?: number;
}

export interface CheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  cartId?: string;
  checkoutId?: string;
  error?: string;
}

class CheckoutService {
  private cartId: string | null = null;

  /**
   * Create a new cart in BigCommerce
   */
  async createCart(lineItems: CartLineItem[]): Promise<{ cartId: string | null; error?: string }> {
    try {
      const createCartInput = {
        lineItems: lineItems.map(item => ({
          productEntityId: item.productId,
          quantity: item.quantity,
          ...(item.variantId && { variantEntityId: item.variantId })
        }))
      };

      const data = await gql(CREATE_CART, { createCartInput });
      
      const cart = data?.cart?.createCart?.cart;
      if (cart?.entityId) {
        this.cartId = cart.entityId;
        return { cartId: cart.entityId };
      } else {
        return { cartId: null, error: 'Failed to create cart' };
      }
    } catch (error) {
      console.error('Error creating cart:', error);
      return { 
        cartId: null, 
        error: error instanceof Error ? error.message : 'Failed to create cart' 
      };
    }
  }

  /**
   * Add items to existing cart
   */
  async addToCart(cartId: string, lineItems: CartLineItem[]): Promise<{ success: boolean; error?: string }> {
    try {
      const data = {
        lineItems: lineItems.map(item => ({
          productEntityId: item.productId,
          quantity: item.quantity,
          ...(item.variantId && { variantEntityId: item.variantId })
        }))
      };

      await gql(ADD_CART_LINE_ITEMS, { cartId, data });
      return { success: true };
    } catch (error) {
      console.error('Error adding to cart:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add items to cart' 
      };
    }
  }

  /**
   * Process checkout using REST API edge function
   */
  async processCheckout(lineItems: CartLineItem[]): Promise<CheckoutResult> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return {
          success: false,
          error: 'Supabase not configured'
        };
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-cart`;

      console.log('Creating cart via edge function with items:', lineItems);

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          line_items: lineItems.map(item => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('Cart creation failed:', data);
        return {
          success: false,
          error: data.error || 'Failed to create cart'
        };
      }

      console.log('Cart created successfully:', data);

      return {
        success: true,
        cartId: data.cart_id,
        checkoutUrl: data.checkout_url
      };
    } catch (error) {
      console.error('Checkout process error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Checkout failed'
      };
    }
  }

  /**
   * Quick checkout for single item
   */
  async checkoutSingleItem(productId: number, quantity: number = 1): Promise<CheckoutResult> {
    return this.processCheckout([{ productId, quantity }]);
  }

  /**
   * Clear current cart reference
   */
  clearCart(): void {
    this.cartId = null;
  }
}

export const checkoutService = new CheckoutService();