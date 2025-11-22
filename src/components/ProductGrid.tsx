import React from 'react';
import { ShoppingCart, Star } from 'lucide-react';
import { Product } from '../services/bigcommerce';
import PriceDisplay from './PriceDisplay';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (id: number, quantity: number) => void;
  onProductClick: (product: Product) => void;
  organizationId?: string;
}

const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart, onProductClick, organizationId }) => {
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
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
              onClick={() => onProductClick(product)}
            />

            {/* Description overlay on hover */}
            {(product.plainTextDescription || product.description) && (
              <div className="absolute inset-0 bg-black bg-opacity-90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex items-center justify-center cursor-pointer"
                onClick={() => {
                  onProductClick(product);
                }}>
                <p className="text-white text-sm leading-relaxed overflow-y-auto max-h-full">
                  {product.plainTextDescription
                    ? product.plainTextDescription.slice(0, 200) + (product.plainTextDescription.length > 200 ? '...' : '')
                    : (() => {
                        try {
                          const tempDiv = document.createElement('div');
                          tempDiv.innerHTML = product.description || '';
                          const text = tempDiv.textContent || tempDiv.innerText || '';
                          return text.slice(0, 200) + (text.length > 200 ? '...' : '');
                        } catch (error) {
                          console.error('Error parsing product description for', product.name, error);
                          return 'Description unavailable';
                        }
                      })()
                  }
                </p>
              </div>
            )}

            <div className="absolute top-3 left-3 z-10">
              <span className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                {product.category}
              </span>
            </div>
          </div>

          <div className="p-4">
            <h3
              className="font-semibold text-gray-900 mb-2 line-clamp-2 cursor-pointer hover:text-pink-600 transition-colors"
              onClick={(e) => {

                // Try alert for visibility
                if (product.name.toLowerCase().includes('proxigene')) {
                  alert('Proxigene name clicked! Check console for details.');
                }

                onProductClick(product);
              }}
            >
              {product.name}
            </h3>
            
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
            {product.benefits && Array.isArray(product.benefits) && product.benefits.length > 0 && (
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
                organizationId={organizationId}
              />
              <p className="text-xs text-gray-500 mt-1">+ tax</p>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={() => onAddToCart(product.id, 1)}
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