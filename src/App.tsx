import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Hero from './components/Hero';
import ProductCard from './components/ProductCard';
import ProductFilter from './components/ProductFilter';
import Cart from './components/Cart';
import Footer from './components/Footer';
import ErrorDebugPanel from './components/ErrorDebugPanel';
import { bigCommerceService, Product } from './services/bigcommerce';
import { useErrorLogger } from './hooks/useErrorLogger';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { errors, logError, clearErrors } = useErrorLogger();

  // Fetch products and categories from BigCommerce
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [productsData, categoriesData] = await Promise.all([
          bigCommerceService.getProducts(logError),
          bigCommerceService.getCategories(logError)
        ]);
        
        setProducts(productsData.products);
        setCategories(categoriesData.categories);
        
        // Set error message if either API call failed
        if (productsData.errorMessage || categoriesData.errorMessage) {
          const errorMsg = productsData.errorMessage || categoriesData.errorMessage;
          setError(errorMsg);
        }
      } catch (err) {
        setError('Failed to load products. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [logError]);

  const addToCart = (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === productId);
      if (existingItem) {
        return prev.map(item =>
          item.id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image: product.image
        }];
      }
    });
  };

  const updateCartQuantity = (id: number, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(id);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (id: number) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Filter products
  const filteredProducts = products.filter(product => {
    const categoryMatch = selectedCategory === 'all' || product.category === selectedCategory;
    const priceMatch = product.price >= priceRange[0] && product.price <= priceRange[1];
    return categoryMatch && priceMatch;
  });

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Header cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
        
        <Hero />

        {/* Products Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Products</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Discover our range of products</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-100 animate-pulse">
                  <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-500 text-lg mb-4">Error loading products</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-6 py-2 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          )}

          {!loading && !error && filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">No products found</p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setPriceRange([0, 100]);
                }}
                className="mt-4 text-pink-600 hover:text-pink-700 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        {/* Newsletter Section */}
        <section className="bg-gradient-to-r from-pink-600 to-orange-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">Stay Connected with HealthSpan360</h2>
              <p className="text-pink-100 mb-8 max-w-2xl mx-auto">
                Get the latest insights on peptide therapy, genetic testing, and personalized healthcare delivered to your inbox.
              </p>
              <div className="max-w-md mx-auto flex">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-l-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <button className="bg-white text-pink-600 px-6 py-3 rounded-r-lg hover:bg-gray-100 transition-colors font-semibold">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </section>

        <Footer />

        <Cart
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={updateCartQuantity}
          onRemoveItem={removeFromCart}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />

        <UserProfile
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />

        <AdminDashboard
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
        />

        <ErrorDebugPanel errors={errors} onClearErrors={clearErrors} />
      </div>
    </AuthProvider>
  );
}

export default App;