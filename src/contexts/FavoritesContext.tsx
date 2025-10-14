import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { favoritesService } from '../services/favorites';

interface FavoritesContextType {
  favorites: number[];
  isFavorite: (productId: number) => boolean;
  toggleFavorite: (productId: number) => Promise<void>;
  isLoading: boolean;
  animatingProductId: number | null;
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'warning' | null;
  clearToast: () => void;
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
  };

  const clearToast = () => {
    setToastMessage(null);
    setToastType(null);
  };

  useEffect(() => {
    console.log('🔄 FavoritesProvider useEffect - user changed:', user?.email);
    if (user) {
      loadFavorites();
    } else {
      setFavorites([]);
    }
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;

    console.log('📥 Loading favorites for user:', user.email);
    setIsLoading(true);
    const userFavorites = await favoritesService.getUserFavorites(user.id);
    console.log('✅ Loaded favorites:', userFavorites);
    setFavorites(userFavorites);
    setIsLoading(false);
  };

  const isFavorite = (productId: number): boolean => {
    return favorites.includes(productId);
  };

  const toggleFavorite = async (productId: number) => {
    console.log('🎯 toggleFavorite called:', { productId, user: user?.email, userId: user?.id });
    if (!user) {
      console.error('❌ No user authenticated, cannot toggle favorite');
      return;
    }

    const currentlyFavorited = isFavorite(productId);
    console.log('Current favorite status:', currentlyFavorited, 'Favorites array:', favorites);

    setAnimatingProductId(productId);

    if (currentlyFavorited) {
      setFavorites(prev => prev.filter(id => id !== productId));
    } else {
      setFavorites(prev => [...prev, productId]);
    }

    console.log('📡 Calling favoritesService.toggleFavorite with:', { userId: user.id, productId, currentlyFavorited });
    const result = await favoritesService.toggleFavorite(user.id, productId, currentlyFavorited);
    console.log('📡 toggleFavorite result:', result);

    if (!result.success) {
      console.error('❌ Failed to toggle favorite:', result.error);
      showToast(result.error || 'Failed to update favorites', 'error');

      if (currentlyFavorited) {
        setFavorites(prev => [...prev, productId]);
      } else {
        setFavorites(prev => prev.filter(id => id !== productId));
      }
    } else {
      showToast(
        currentlyFavorited ? 'Removed from favorites' : 'Added to favorites',
        'success'
      );
    }

    setTimeout(() => {
      setAnimatingProductId(null);
    }, 1000);
  };

  const value: FavoritesContextType = {
    favorites,
    isFavorite,
    toggleFavorite,
    isLoading,
    animatingProductId,
    toastMessage,
    toastType,
    clearToast
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
