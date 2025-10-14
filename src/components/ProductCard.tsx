import React, { useState, useRef, useEffect } from 'react';
import { Star, Heart, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import PriceDisplay from './PriceDisplay';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  category: string;
  benefits: string[];
  description?: string;
  plainTextDescription?: string;
  onAddToCart: (id: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  originalPrice,
  image,
  rating,
  reviews,
  category,
  benefits,
  description,
  plainTextDescription,
  onAddToCart
}) => {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite, animatingProductId } = useFavorites();
  const [showAnimation, setShowAnimation] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [animationStart, setAnimationStart] = useState({ x: 0, y: 0 });

  const favorited = user ? isFavorite(id) : false;
  const isAnimating = animatingProductId === id;

  useEffect(() => {
    if (isAnimating && !favorited && cardRef.current) {
      // Get card position for animation start point
      const rect = cardRef.current.getBoundingClientRect();
      setAnimationStart({ x: rect.left + rect.width / 2, y: rect.top + 50 });
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 1000);
    }
  }, [isAnimating, favorited]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    console.log('❤️ Heart button clicked!', { productId: id, user: user?.email, userId: user?.id });
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      console.warn('✗ User not logged in, cannot add to favorites');
      return;
    }

    console.log('✓ User is logged in, calling toggleFavorite');
    try {
      await toggleFavorite(id);
      console.log('✅ toggleFavorite completed');
    } catch (error) {
      console.error('❌ Error toggling favorite:', error);
    }
  };
  const getDescriptionText = () => {
    if (plainTextDescription) {
      return plainTextDescription.slice(0, 200) + (plainTextDescription.length > 200 ? '...' : '');
    }
    if (description) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = description;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      return text.slice(0, 200) + (text.length > 200 ? '...' : '');
    }
    return '';
  };

  const descriptionText = getDescriptionText();

  return (
    <div ref={cardRef} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 group relative">
      <div className="relative rounded-t-lg bg-white p-3">
        <div className="absolute top-2 left-2 z-20 opacity-90 group-hover:opacity-100">
          <span className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
            {category}
          </span>
        </div>

        <button
          onClick={handleFavoriteClick}
          className="absolute top-2 right-2 p-3 bg-white rounded-full shadow-lg hover:shadow-xl cursor-pointer z-50 transition-all hover:scale-110 active:scale-95"
          type="button"
          aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            className={`h-5 w-5 transition-colors ${
              favorited
                ? 'text-red-500 fill-red-500'
                : 'text-gray-400 hover:text-red-400'
            }`}
          />
        </button>

        {/* Flying heart animation */}
        {showAnimation && (
          <motion.div
            initial={{
              position: 'fixed',
              left: animationStart.x,
              top: animationStart.y,
              opacity: 1,
              scale: 1
            }}
            animate={{
              left: 100,
              top: window.innerHeight / 2,
              opacity: 0,
              scale: 0.5
            }}
            transition={{
              duration: 0.8,
              ease: 'easeInOut'
            }}
            className="pointer-events-none z-40"
            style={{ pointerEvents: 'none' }}
          >
            <Heart className="h-8 w-8 text-red-500 fill-red-500" />
          </motion.div>
        )}

        <div className="relative overflow-hidden rounded-lg bg-white">
          <img
            src={image}
            alt={name}
            className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {descriptionText && (
            <div className="absolute inset-0 bg-black bg-opacity-90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex items-center justify-center z-10 pointer-events-none">
              <p className="text-white text-sm leading-relaxed overflow-y-auto max-h-full">
                {descriptionText}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{name}</h3>
        
        {/* Rating */}
        <div className="flex items-center mb-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < Math.floor(rating) 
                    ? 'text-yellow-400 fill-current' 
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-600 ml-2">({reviews})</span>
        </div>

        {/* Benefits */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {benefits.slice(0, 2).map((benefit, index) => (
              <span 
                key={index}
                className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded-full"
              >
                {benefit}
              </span>
            ))}
          </div>
        </div>

        {/* Price */}
        <div className="mb-3">
          <PriceDisplay
            productId={id}
            regularPrice={price}
            originalPrice={originalPrice}
            showSavings={true}
          />
          <p className="text-xs text-gray-500 mt-1">+ tax</p>
        </div>

        {/* Add to Cart Button */}
        <button 
          onClick={() => onAddToCart(id)}
          className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-2 px-4 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  );
};

export default ProductCard;