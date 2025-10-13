import React, { useState, useEffect } from 'react';
import { Heart, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';

interface Product {
  id: number;
  name: string;
  image: string;
  price: number;
}

interface FavoritesListProps {
  products: Product[];
  onProductClick?: (productId: number) => void;
}

const FavoritesList: React.FC<FavoritesListProps> = ({ products, onProductClick }) => {
  const { user } = useAuth();
  const { favorites, toggleFavorite, animatingProductId } = useFavorites();
  const [justAdded, setJustAdded] = useState<number | null>(null);

  useEffect(() => {
    // Track when a new favorite is added
    if (animatingProductId && favorites.includes(animatingProductId)) {
      setJustAdded(animatingProductId);
      setTimeout(() => setJustAdded(null), 1000);
    }
  }, [animatingProductId, favorites]);

  const favoriteProducts = products.filter(p => favorites.includes(p.id));

  if (!user) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Heart className="h-5 w-5 text-red-500 fill-red-500" />
          <h3 className="font-semibold text-gray-900">Favorites</h3>
          {favoriteProducts.length > 0 && (
            <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
              {favoriteProducts.length}
            </span>
          )}
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {favoriteProducts.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-gray-500 text-center py-4"
          >
            No favorites yet
          </motion.p>
        ) : (
          <div className="space-y-2">
            {favoriteProducts.map((product) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: justAdded === product.id ? [0.9, 1.1, 1] : 1,
                }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                transition={{
                  layout: { duration: 0.3 },
                  scale: { duration: 0.5 }
                }}
                className={`flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer group relative ${
                  justAdded === product.id ? 'ring-2 ring-red-500 ring-opacity-50' : ''
                }`}
                onClick={() => onProductClick?.(product.id)}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                  {justAdded === product.id && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-20 rounded"
                    >
                      <Heart className="h-6 w-6 text-red-500 fill-red-500" />
                    </motion.div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    ${product.price.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(product.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-full transition-all"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FavoritesList;
