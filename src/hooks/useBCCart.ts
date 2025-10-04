import { useState, useEffect } from 'react';
import { bcRestAPI } from '../lib/bigcommerce-rest';
import { BCCart } from '../types/bigcommerce';

const CART_ID_KEY = 'bc_cart_id';

export function useBCCart() {
  const [cart, setCart] = useState<BCCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCart();
  }, []);

  async function loadCart() {
    const cartId = localStorage.getItem(CART_ID_KEY);
    if (!cartId) return;

    try {
      setLoading(true);
      const response = await bcRestAPI.getCart(cartId);
      setCart(response.data);
      setError(null);
    } catch (err) {
      console.error('Error loading cart:', err);
      localStorage.removeItem(CART_ID_KEY);
      setCart(null);
    } finally {
      setLoading(false);
    }
  }

  async function addItem(productId: number, quantity: number = 1) {
    try {
      setLoading(true);
      setError(null);

      let response;
      const cartId = localStorage.getItem(CART_ID_KEY);

      if (!cartId || !cart) {
        response = await bcRestAPI.createCart([{ product_id: productId, quantity }]);
        localStorage.setItem(CART_ID_KEY, response.data.id);
      } else {
        const existingItem = cart.line_items.physical_items.find(
          item => item.product_id === productId
        );

        if (existingItem) {
          response = await bcRestAPI.updateCart(cartId, [{
            id: existingItem.id,
            product_id: productId,
            quantity: existingItem.quantity + quantity,
          }]);
        } else {
          response = await bcRestAPI.updateCart(cartId, [{
            product_id: productId,
            quantity,
          }]);
        }
      }

      setCart(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add item to cart';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function updateItemQuantity(itemId: string, productId: number, quantity: number) {
    const cartId = localStorage.getItem(CART_ID_KEY);
    if (!cartId) return;

    try {
      setLoading(true);
      setError(null);

      if (quantity <= 0) {
        await removeItem(itemId);
        return;
      }

      const response = await bcRestAPI.updateCart(cartId, [{
        id: itemId,
        product_id: productId,
        quantity,
      }]);

      setCart(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update item';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(itemId: string) {
    const cartId = localStorage.getItem(CART_ID_KEY);
    if (!cartId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await bcRestAPI.deleteCartItem(cartId, itemId);
      setCart(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove item';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function clearCart() {
    const cartId = localStorage.getItem(CART_ID_KEY);
    if (!cartId) return;

    try {
      setLoading(true);
      setError(null);

      await bcRestAPI.deleteCart(cartId);
      localStorage.removeItem(CART_ID_KEY);
      setCart(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear cart';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function getCheckoutUrl(): Promise<string> {
    const cartId = localStorage.getItem(CART_ID_KEY);
    if (!cartId) {
      throw new Error('No active cart');
    }

    try {
      const response = await bcRestAPI.createCheckoutRedirect(cartId);
      return response.checkout_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get checkout URL';
      setError(message);
      throw err;
    }
  }

  const itemCount = cart?.line_items.physical_items.reduce(
    (sum, item) => sum + item.quantity,
    0
  ) ?? 0;

  const total = cart?.cart_amount ?? 0;

  return {
    cart,
    loading,
    error,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    getCheckoutUrl,
    itemCount,
    total,
  };
}
