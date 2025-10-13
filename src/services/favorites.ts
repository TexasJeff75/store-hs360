import { supabase } from './supabase';

export interface Favorite {
  id: string;
  user_id: string;
  product_id: number;
  created_at: string;
}

export const favoritesService = {
  async getUserFavorites(userId: string): Promise<number[]> {
    console.log('📚 favoritesService.getUserFavorites called for:', userId);
    const { data, error } = await supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error fetching favorites:', error);
      return [];
    }

    console.log('✅ Favorites data from DB:', data);
    return data?.map(f => f.product_id) || [];
  },

  async addFavorite(userId: string, productId: number): Promise<boolean> {
    console.log('➕ Adding favorite:', { userId, productId });
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, product_id: productId });

    if (error) {
      console.error('❌ Error adding favorite:', error);
      return false;
    }

    console.log('✅ Favorite added successfully');
    return true;
  },

  async removeFavorite(userId: string, productId: number): Promise<boolean> {
    console.log('➖ Removing favorite:', { userId, productId });
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) {
      console.error('❌ Error removing favorite:', error);
      return false;
    }

    console.log('✅ Favorite removed successfully');
    return true;
  },

  async toggleFavorite(userId: string, productId: number, isFavorited: boolean): Promise<boolean> {
    if (isFavorited) {
      return await this.removeFavorite(userId, productId);
    } else {
      return await this.addFavorite(userId, productId);
    }
  }
};
