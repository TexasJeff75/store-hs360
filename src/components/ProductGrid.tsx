import React, { useState } from 'react';
import { ShoppingCart, Star, Package } from 'lucide-react';
import { Product } from '../services/productService';
import PriceDisplay from './PriceDisplay';

export type ViewMode = 'grid' | 'list';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (id: number, quantity: number) => void;
  onProductClick: (product: Product) => void;
  organizationId?: string;
  viewMode?: ViewMode;
}

const ProductImage: React.FC<{ src: string; alt: string; className?: string; onClick?: () => void }> = ({ src, alt, className, onClick }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`w-full h-48 bg-gray-100 flex items-center justify-center cursor-pointer ${className || ''}`} onClick={onClick}>
        <div className="text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="text-xs text-gray-400 mt-1">No image</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
};

const getPlainDescription = (product: Product): string => {
  if (product.plainTextDescription) {
    return product.plainTextDescription;
  }
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = product.description || '';
    return tempDiv.textContent || tempDiv.innerText || '';
  } catch {
    return '';
  }
};

const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart, onProductClick, organizationId, viewMode = 'grid' }) => {
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

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {products.map((product) => {
          const desc = getPlainDescription(product);
          return (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 flex items-center gap-4 p-4"
            >
              <div className="flex-shrink-0 w-24 h-24 relative rounded-lg overflow-hidden">
                <ProductImage
                  src={product.image}
                  alt={product.name}
                  className="w-24 h-24 object-cover cursor-pointer"
                  onClick={() => onProductClick(product)}
                />
                <div className="absolute top-1 left-1">
                  <span className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
                    {product.category}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold text-gray-900 cursor-pointer hover:text-pink-600 transition-colors truncate"
                  onClick={() => onProductClick(product)}
                >
                  {product.name}
                </h3>

                {desc && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {desc.slice(0, 150)}{desc.length > 150 ? '...' : ''}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {product.rating > 0 && (
                    <div className="flex items-center">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < Math.floor(product.rating)
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-600 ml-1">({product.reviews})</span>
                    </div>
                  )}

                  {product.benefits && Array.isArray(product.benefits) && product.benefits.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {product.benefits.slice(0, 3).map((benefit, index) => (
                        <span
                          key={index}
                          className="text-xs bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full"
                        >
                          {benefit}
                        </span>
                      ))}
                      {product.benefits.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{product.benefits.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-4">
                <div className="text-right">
                  <PriceDisplay
                    productId={product.id}
                    regularPrice={product.price}
                    originalPrice={product.originalPrice}
                    showSavings={true}
                    organizationId={organizationId}
                  />
                </div>

                <button
                  onClick={() => onAddToCart(product.id, 1)}
                  className="bg-gradient-to-r from-pink-500 to-orange-500 text-white py-2 px-4 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 flex items-center space-x-2 whitespace-nowrap"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Add to Cart</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => {
        const desc = getPlainDescription(product);
        return (
        <div
          key={product.id}
          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 group"
        >
          <div className="relative overflow-hidden rounded-t-lg">
            <ProductImage
              src={product.image}
              alt={product.name}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
              onClick={() => onProductClick(product)}
            />

            {/* Description overlay on hover */}
            {desc && (
              <div className="absolute inset-0 bg-black bg-opacity-90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex items-center justify-center cursor-pointer"
                onClick={() => onProductClick(product)}>
                <p className="text-white text-sm leading-relaxed overflow-y-auto max-h-full">
                  {desc.slice(0, 200)}{desc.length > 200 ? '...' : ''}
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
              onClick={() => onProductClick(product)}
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
        );
      })}
    </div>
  );
};

export default ProductGrid;