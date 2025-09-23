import React, { useState, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import UserProfile from '@/components/UserProfile';
import AdminDashboard from '@/components/admin/AdminDashboard';
import Hero from '@/components/Hero';
import ProductCarousel from '@/components/ProductCarousel';
import Cart from '@/components/Cart';
import Footer from '@/components/Footer';
import ErrorDebugPanel from '@/components/ErrorDebugPanel';
import { bigCommerceService, Product } from '@/services/bigcommerce';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { useAuth } from '@/contexts/AuthContext';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

function AppContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const { errors, logError, clearErrors } = useErrorLogger();
  const { user, profile, loading: authLoading } = useAuth();

  // Fetch products and categories from BigCommerce
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Add timeout to the entire fetch operation
        const fetchPromise = Promise.all([
          bigCommerceService.getProducts((err: unknown, ctx?: string) => logError(err, ctx)),
          bigCommerceService.getCategories((err: unknown, ctx?: string) => logError(err, ctx))
        ]);
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 20000)
        );
        
        const [productsData, categoriesData] = await Promise.race([
          fetchPromise,
          timeoutPromise
        ]) as any;
        
        console.log('🔍 Products fetched from BigCommerce:', productsData.products);
        setProducts(productsData.products);
        setCategories(categoriesData.categories);
        
        // Set error message if either API call failed
        if (productsData.errorMessage || categoriesData.errorMessage) {
          const errorMsg = productsData.errorMessage || categoriesData.errorMessage;
          console.log('⚠️ API Error:', errorMsg);
          setError(errorMsg);
        }
      } catch (err) {
        const errorMessage = err instanceof Error && err.message === 'Request timeout' 
          ? 'Request timed out. Please check your connection and try again.'
          : 'Failed to load products. Please try again later.';
        console.log('❌ Fetch error:', err);
        setError(errorMessage);
        logError(err, 'fetchData');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [logError]);

  // Debug auth state
  useEffect(() => {
    console.log('Auth state:', { user: user?.email, profile: profile?.role, authLoading });
  }, [user, profile, authLoading]);
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

  // Group products by their actual BigCommerce categories
  const productsByCategory = products.reduce((acc, product) => {
    const category = product.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as { [key: string]: Product[] });
  
  console.log('📂 Products grouped by category:', productsByCategory);
  console.log('🏷️ Available categories:', Object.keys(productsByCategory));

  // Show loading or auth gate
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth modal if user is not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header 
          cartCount={0} 
          onCartClick={() => {}}
          onAuthClick={() => setIsAuthModalOpen(true)}
          onProfileClick={() => {}}
          onAdminClick={() => {}}
        />
        
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Required</h2>
                <p className="text-gray-600">
                  Please sign in to access our premium health products and personalized pricing.
                </p>
              </div>
              
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 px-6 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 font-semibold"
              >
                Sign In to Continue
              </button>
              
              <p className="text-sm text-gray-500 mt-4">
                New to HealthSpan360? Create an account to get started.
              </p>
            </div>
          </div>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50">
        <Header 
          cartCount={cartCount} 
          onCartClick={() => setIsCartOpen(true)}
          onAuthClick={() => setIsAuthModalOpen(true)}
          onProfileClick={() => setIsProfileOpen(true)}
          onAdminClick={() => setIsAdminOpen(true)}
        />
        
        <Hero />

        {/* Product Carousels Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Product Categories</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explore our comprehensive range of health and wellness solutions
            </p>
          </div>
          
          {loading ? (
            <div className="space-y-16">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
                  <div className="flex space-x-6 overflow-hidden">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="flex-shrink-0 w-80 bg-gray-200 rounded-lg h-96"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-500 text-lg mb-4">Error loading products</p>
              <p className="text-gray-600">{error}</p>
            </div>
          ) : (
            <div className="space-y-16">
              {/* Dynamic Carousels based on actual BigCommerce categories */}
              {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                <ProductCarousel
                  key={category}
                  title={category}
                  products={categoryProducts}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          )}
          
          {!loading && !error && products.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">No products available at this time</p>
            </div>
          )}
        </section>

        {/* Featured Benefits Section */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose HealthSpan360?</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Experience the difference with our science-backed approach to health optimization
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Science-Based</h3>
                <p className="text-gray-600">All our products are backed by rigorous scientific research and clinical studies.</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Personalized</h3>
                <p className="text-gray-600">Tailored solutions based on your unique genetic profile and health goals.</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Expert Support</h3>
                <p className="text-gray-600">Access to healthcare professionals and personalized guidance throughout your journey.</p>
              </div>
            </div>
          </div>
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
                  className="flex-1 px-4 py-2 rounded-l-lg text-gray-900"
                />
                <button className="px-6 py-2 bg-white text-pink-600 rounded-r-lg hover:bg-gray-100 transition-colors">
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

        {profile?.role === 'admin' && (
          <AdminDashboard
            isOpen={isAdminOpen}
            onClose={() => setIsAdminOpen(false)}
          />
        )}
        <ErrorDebugPanel errors={errors} onClearErrors={clearErrors} />
      </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;