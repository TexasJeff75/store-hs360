import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { fetchProducts } from './lib/bigcommerce';
import { Product } from './types/bigcommerce';
import { useCart } from './hooks/useCart';
import Header from './components/Header';
import ProductCard from './components/ProductCard';
import Cart from './components/Cart';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const { addItem, itemCount } = useCart();

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      setError('Failed to load products. Please try again later.');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddToCart = (product: Product) => {
    const price = product.prices.salePrice || product.prices.price;
    addItem({
      productId: product.entityId,
      name: product.name,
      price: price.value,
      image: product.defaultImage?.url,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header cartItemCount={itemCount} onCartClick={() => setCartOpen(true)} />

      <main className="container mx-auto px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading products...</p>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                Error Loading Products
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={loadProducts}
                className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-600 dark:text-gray-400">
              No products available at the moment.
            </p>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.entityId}
                product={product}
                onAddToCart={() => handleAddToCart(product)}
              />
            ))}
          </div>
        )}
      </main>

      <Cart isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
