import React from 'react';
import { ShoppingCart, Star, Heart } from 'lucide-react';
import { Product } from '../services/bigcommerce';
import PriceDisplay from './PriceDisplay';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (id: number) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart }) => {
  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <ShoppingCart className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
        <p className="text-gray-600 mb-6">
          Try adjusting your search terms or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <div
          key={product.id}
          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 group"
        >
          <div className="relative overflow-hidden rounded-t-lg">
            <img 
              src={product.image} 
              alt={product.name}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <button className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors opacity-0 group-hover:opacity-100">
              <Heart className="h-5 w-5 text-gray-600" />
            </button>
            <div className="absolute top-3 left-3">
              <span className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                {product.category}
              </span>
            </div>
          </div>

          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
            
            {/* Rating */}
            {product.rating > 0 && (
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
            )}

            {/* Benefits */}
            {product.benefits.length > 0 && (
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
                  {product.benefits.length > 2 && (
                    <span className="text-xs text-gray-500 px-2 py-1">
                      +{product.benefits.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            )}

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
  );
};

export default ProductGrid;