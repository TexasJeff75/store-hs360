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

  useEffect(() => {
    if (user) {
      loadFavorites();
    } else {
      setFavorites([]);
    }
  }, [user]);

  const loadFavorites = async () => {
    if (!user) return;

    setIsLoading(true);
    const userFavorites = await favoritesService.getUserFavorites(user.id);
    setFavorites(userFavorites);
    setIsLoading(false);
  };

  const isFavorite = (productId: number): boolean => {
    return favorites.includes(productId);
  };

  const toggleFavorite = async (productId: number) => {
    if (!user) {
      return;
    }

    const currentlyFavorited = isFavorite(productId);

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
