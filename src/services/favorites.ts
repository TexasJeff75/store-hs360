import { supabase } from './supabase';

interface Favorite {
  id: string;
  user_id: string;
  product_id: number;
  created_at: string;
}

export const favoritesService = {
  async getUserFavorites(userId: string): Promise<number[]> {
    if (!userId) {
      console.error('❌ getUserFavorites: No userId provided');
      return [];
    }

    try {
      console.log('📚 favoritesService.getUserFavorites called for:', userId);

      const { data, error } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error fetching favorites:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return [];
      }

      console.log('✅ Favorites data from DB:', data);
      return data?.map(f => f.product_id) || [];
    } catch (err) {
      console.error('❌ Unexpected error in getUserFavorites:', err);
      return [];
    }
  },

  async addFavorite(userId: string, productId: number): Promise<{ success: boolean; error?: string }> {
    if (!userId || !productId) {
      console.error('❌ addFavorite: Missing required parameters', { userId, productId });
      return { success: false, error: 'Missing required parameters' };
    }

    try {
      console.log('➕ Adding favorite:', { userId, productId });

      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, product_id: productId });

      if (error) {
        console.error('❌ Error adding favorite:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        if (error.code === '23505') {
          return { success: true };
        }

        return { success: false, error: error.message };
      }

      console.log('✅ Favorite added successfully');
      return { success: true };
    } catch (err) {
      console.error('❌ Unexpected error in addFavorite:', err);
      return { success: false, error: 'Unexpected error occurred' };
    }
  },

  async removeFavorite(userId: string, productId: number): Promise<{ success: boolean; error?: string }> {
    if (!userId || !productId) {
      console.error('❌ removeFavorite: Missing required parameters', { userId, productId });
      return { success: false, error: 'Missing required parameters' };
    }

    try {
      console.log('➖ Removing favorite:', { userId, productId });

      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) {
        console.error('❌ Error removing favorite:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return { success: false, error: error.message };
      }

      console.log('✅ Favorite removed successfully');
      return { success: true };
    } catch (err) {
      console.error('❌ Unexpected error in removeFavorite:', err);
      return { success: false, error: 'Unexpected error occurred' };
    }
  },

  async toggleFavorite(userId: string, productId: number, isFavorited: boolean): Promise<{ success: boolean; error?: string }> {
    if (isFavorited) {
      return await this.removeFavorite(userId, productId);
    } else {
      return await this.addFavorite(userId, productId);
    }
  }
};
