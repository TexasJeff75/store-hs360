import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { favoritesService } from '../services/favorites';

interface FavoritesContextType {
  favorites: number[];
  isFavorite: (productId: number) => boolean;
  toggleFavorite: (productId: number) => Promise<void>;
  isLoading: boolean;
  animatingProductId: number | null;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    console.error('❌ useFavorites must be used within a FavoritesProvider');
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [animatingProductId, setAnimatingProductId] = useState<number | null>(null);

  console.log('🔄 FavoritesProvider rendered, user:', user?.email);

  useEffect(() => {
    console.log('🔄 User changed in FavoritesProvider:', user?.email);
    if (user) {
      loadFavorites();
    } else {
      setFavorites([]);
    }
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;

    console.log('📥 Loading favorites for user:', user.id);
    setIsLoading(true);
    const userFavorites = await favoritesService.getUserFavorites(user.id);
    console.log('📥 Loaded favorites:', userFavorites);
    setFavorites(userFavorites);
    setIsLoading(false);
  };

  const isFavorite = (productId: number): boolean => {
    const result = favorites.includes(productId);
    console.log('🔍 isFavorite check:', { productId, favorites, result });
    return result;
  };

  const toggleFavorite = async (productId: number) => {
    if (!user) {
      console.log('⚠️ No user logged in, cannot favorite');
      return;
    }

    console.log('💜 Toggle favorite clicked:', { productId, userId: user.id });

    const currentlyFavorited = isFavorite(productId);
    console.log('Current favorite status:', currentlyFavorited);

    // Trigger animation
    setAnimatingProductId(productId);

    // Optimistic update
    if (currentlyFavorited) {
      setFavorites(prev => prev.filter(id => id !== productId));
    } else {
      setFavorites(prev => [...prev, productId]);
    }

    // Make API call
    const success = await favoritesService.toggleFavorite(user.id, productId, currentlyFavorited);

    if (!success) {
      console.log('❌ Failed to toggle favorite, reverting');
      // Revert on failure
      if (currentlyFavorited) {
        setFavorites(prev => [...prev, productId]);
      } else {
        setFavorites(prev => prev.filter(id => id !== productId));
      }
    }

    // Clear animation after delay
    setTimeout(() => {
      setAnimatingProductId(null);
    }, 1000);
  };

  const value: FavoritesContextType = {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading,
    animatingProductId
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
