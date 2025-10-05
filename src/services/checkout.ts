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
  error?: string;
}

class CheckoutService {
  private cartId: string | null = null;

  /**
   * Create a new cart in BigCommerce
   */
  async createCart(lineItems: CartLineItem[]): Promise<{ cartId: string | null; error?: string }> {
    try {
      if (!BC_STORE_HASH) {
        return {
          cartId: null,
          error: 'BigCommerce store not configured. Please add VITE_BC_STORE_HASH to your .env file.'
        };
      }

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
   * Get BigCommerce embedded checkout URL
   */
  getEmbeddedCheckoutUrl(cartId: string): string {
    if (!BC_STORE_HASH) {
      throw new Error('BigCommerce store not configured. Add VITE_BC_STORE_HASH and VITE_BC_STOREFRONT_TOKEN to .env');
    }

    return `https://store-${BC_STORE_HASH}.mybigcommerce.com/embedded-checkout/${cartId}`;
  }

  /**
   * Process checkout - create cart and return embedded checkout URL
   */
  async processCheckout(lineItems: CartLineItem[]): Promise<CheckoutResult> {
    try {
      if (!BC_STORE_HASH) {
        return {
          success: false,
          error: 'BigCommerce store not configured. Please check your environment variables.'
        };
      }

      const { cartId, error } = await this.createCart(lineItems);

      if (!cartId || error) {
        return {
          success: false,
          error: error || 'Failed to create checkout cart'
        };
      }

      const checkoutUrl = this.getEmbeddedCheckoutUrl(cartId);

      console.log('Created embedded checkout:', { cartId, checkoutUrl });

      return {
        success: true,
        checkoutUrl,
        cartId
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