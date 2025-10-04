import { ShoppingCart } from 'lucide-react';
import { Product } from '../types/bigcommerce';

interface ProductCardProps {
  product: Product;
  onAddToCart: () => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const price = product.prices.salePrice || product.prices.price;
  const originalPrice = product.prices.retailPrice || product.prices.price;
  const hasDiscount = product.prices.salePrice &&
    product.prices.salePrice.value < originalPrice.value;

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
      <div className="aspect-square overflow-hidden bg-gray-100 dark:bg-gray-700">
        {product.defaultImage ? (
          <img
            src={product.defaultImage.url}
            alt={product.defaultImage.altText || product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
      </div>

      <div className="p-4">
        {product.brand && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {product.brand.name}
          </p>
        )}

        <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-gray-900 dark:text-white">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
            {product.description.replace(/<[^>]*>/g, '')}
          </p>
        )}

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              ${price.value.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                ${originalPrice.value.toFixed(2)}
              </span>
            )}
          </div>

          <button
            onClick={onAddToCart}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors duration-200"
            disabled={product.availabilityV2.status !== 'Available'}
          >
            <ShoppingCart className="w-4 h-4" />
            Add
          </button>
        </div>

        {product.availabilityV2.status !== 'Available' && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            Out of Stock
          </p>
        )}
      </div>
    </div>
  );
}
