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
  async getCart(userId: string, organizationId?: string | null): Promise<CartItem[]> {
    try {
      let query = supabase
        .from('shopping_carts')
        .select('cart_items')
        .eq('user_id', userId);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      } else {
        query = query.is('organization_id', null);
      }

      const { data, error } = await query.maybeSingle();

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

  async saveCart(userId: string, items: CartItem[], organizationId?: string | null): Promise<void> {
    try {
      const orgId = organizationId || null;

      let query = supabase
        .from('shopping_carts')
        .select('id')
        .eq('user_id', userId);

      if (orgId) {
        query = query.eq('organization_id', orgId);
      } else {
        query = query.is('organization_id', null);
      }

      const existingCart = await query.maybeSingle();

      if (existingCart.data) {
        const { error } = await supabase
          .from('shopping_carts')
          .update({
            cart_items: items,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCart.data.id);

        if (error) {
          console.error('Error updating cart:', error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('shopping_carts')
          .insert({
            user_id: userId,
            organization_id: orgId,
            cart_items: items,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error creating cart:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in saveCart:', error);
      throw error;
    }
  }

  async clearCart(userId: string, organizationId?: string | null): Promise<void> {
    try {
      let query = supabase
        .from('shopping_carts')
        .delete()
        .eq('user_id', userId);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      } else {
        query = query.is('organization_id', null);
      }

      const { error } = await query;

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
