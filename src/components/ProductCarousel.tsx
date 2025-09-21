import React from 'react';
import { ChevronLeft, ChevronRight, Star, ShoppingCart } from 'lucide-react';
import { Product } from '../services/bigcommerce';
import PriceDisplay from './PriceDisplay';

interface ProductCarouselProps {
  title: string;
  products: Product[];
  onAddToCart: (id: number) => void;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ title, products, onAddToCart }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const carouselRef = React.useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (carouselRef.current) {
      const cardWidth = 320; // Approximate card width including gap
      carouselRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      const cardWidth = 320;
      carouselRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
      setCurrentIndex(Math.min(products.length - 1, currentIndex + 1));
    }
  };

  if (products.length === 0) {
    return (
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <p className="text-gray-500">No products available in this category</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={scrollLeft}
            disabled={currentIndex === 0}
            className="p-2 rounded-full bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={scrollRight}
            disabled={currentIndex >= products.length - 1}
            className="p-2 rounded-full bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div 
        ref={carouselRef}
        className="flex space-x-6 overflow-x-auto scrollbar-hide pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 group"
          >
            <div className="relative overflow-hidden rounded-t-lg">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-3 left-3">
                <span className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                  {product.category}
                </span>
              </div>
            </div>

            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
              
              {/* Rating */}
              <div className="flex items-center mb-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(product.rating) 
                          ? 'text-yellow-400 fill-current' 
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600 ml-2">({product.reviews})</span>
              </div>

              {/* Benefits */}
              <div className="mb-3">
                <div className="flex flex-wrap gap-1">
                  {product.benefits.slice(0, 2).map((benefit, index) => (
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
                  productId={product.id}
                  regularPrice={product.price}
                  originalPrice={product.originalPrice}
                  showSavings={true}
                />
              </div>

              {/* Add to Cart Button */}
              <button 
                onClick={() => onAddToCart(product.id)}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-2 px-4 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductCarousel;