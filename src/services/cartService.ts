import { supabase } from './supabase';

interface CartItem {
  id: number;
  name: string;
  price: number;
  retailPrice?: number;
  cost?: number;
  quantity: number;
  image: string;
  hasMarkup?: boolean;
  brand?: string;
}

interface ShoppingCart {
  id: string;
  user_id: string;
  organization_id: string | null;
  cart_items: CartItem[];
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

class CartService {
  async getCart(userId: string, organizationId?: string): Promise<CartItem[]> {
    try {
      const { data, error } = await supabase
        .from('shopping_carts')
        .select('cart_items')
        .eq('user_id', userId)
        .eq('organization_id', organizationId || null)
        .maybeSingle();

      if (error) {
        console.error('Error fetching cart:', error);
        return [];
      }

      return data?.cart_items || [];
    } catch (error) {
      console.error('Error in getCart:', error);
      return [];
    }
  }

  async saveCart(userId: string, items: CartItem[], organizationId?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('shopping_carts')
        .upsert({
          user_id: userId,
          organization_id: organizationId || null,
          cart_items: items,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,organization_id'
        });

      if (error) {
        console.error('Error saving cart:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in saveCart:', error);
      throw error;
    }
  }

  async clearCart(userId: string, organizationId?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('shopping_carts')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId || null);

      if (error) {
        console.error('Error clearing cart:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in clearCart:', error);
      throw error;
    }
  }

  async getAllUserCarts(userId: string): Promise<ShoppingCart[]> {
    try {
      const { data, error } = await supabase
        .from('shopping_carts')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching all user carts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllUserCarts:', error);
      return [];
    }
  }

  async addItem(userId: string, item: CartItem, organizationId?: string): Promise<void> {
    try {
      const currentItems = await this.getCart(userId, organizationId);

      const existingItemIndex = currentItems.findIndex(i => i.id === item.id);

      let updatedItems: CartItem[];
      if (existingItemIndex >= 0) {
        updatedItems = [...currentItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + item.quantity
        };
      } else {
        updatedItems = [...currentItems, item];
      }

      await this.saveCart(userId, updatedItems, organizationId);
    } catch (error) {
      console.error('Error in addItem:', error);
      throw error;
    }
  }

  async updateItemQuantity(userId: string, itemId: number, quantity: number, organizationId?: string): Promise<void> {
    try {
      const currentItems = await this.getCart(userId, organizationId);

      const updatedItems = currentItems
        .map(item => item.id === itemId ? { ...item, quantity } : item)
        .filter(item => item.quantity > 0);

      await this.saveCart(userId, updatedItems, organizationId);
    } catch (error) {
      console.error('Error in updateItemQuantity:', error);
      throw error;
    }
  }

  async removeItem(userId: string, itemId: number, organizationId?: string): Promise<void> {
    try {
      const currentItems = await this.getCart(userId, organizationId);
      const updatedItems = currentItems.filter(item => item.id !== itemId);
      await this.saveCart(userId, updatedItems, organizationId);
    } catch (error) {
      console.error('Error in removeItem:', error);
      throw error;
    }
  }
}

export const cartService = new CartService();
