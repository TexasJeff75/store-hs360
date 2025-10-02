import React, { useState, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import UserProfile from '@/components/UserProfile';
import AdminDashboard from '@/components/admin/AdminDashboard';
import Hero from '@/components/Hero';
import ProductGrid from '@/components/ProductGrid';
import ProductFilter from '@/components/ProductFilter';
import ProductModal from '@/components/ProductModal';
import Cart from '@/components/Cart';
import Footer from '@/components/Footer';
import OrganizationSelector from '@/components/OrganizationSelector';
import ErrorDebugPanel from '@/components/ErrorDebugPanel';
import { bigCommerceService, Product } from '@/services/bigcommerce';
import { checkoutService, CartLineItem } from '@/services/checkout';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { cacheService } from '@/services/cache';
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { errors, logError, clearErrors } = useErrorLogger();
  const { user, profile, loading: authLoading } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isOrgSelectorOpen, setIsOrgSelectorOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔄 Starting data fetch...');
        console.log('📊 Cache stats:', cacheService.getStats());
        
        // Check if BigCommerce credentials are available before making API calls
        const hasCredentials = !!(import.meta.env.VITE_BC_STORE_HASH && import.meta.env.VITE_BC_STOREFRONT_TOKEN);
        
        if (!hasCredentials) {
          console.log('⚠️ BigCommerce credentials not configured (missing VITE_BC_STORE_HASH or VITE_BC_ACCESS_TOKEN), skipping API calls');
          setError('BigCommerce credentials not configured. Please set up BC_STORE_HASH and BC_STOREFRONT_TOKEN in your .env file.');
          setProducts([]);
          setCategories([]);
          setLoading(false);
          return;
        }
        
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
        
        console.log('✅ Data fetch completed');
        console.log('📊 Updated cache stats:', cacheService.getStats());
      } catch (err) {
        const errorMessage = err instanceof Error && err.message === 'Request timeout' 
          ? 'Request timed out. Please check your connection and try again.'
          : 'Failed to load data from BigCommerce. Please check your API configuration.';
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
  const addToCart = (productId: number, quantity: number = 1) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === productId);
      if (existingItem) {
        return prev.map(item =>
          item.id === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        return [...prev, {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          image: product.image
        }];
      }
    });
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleCloseProductModal = () => {
    setIsProductModalOpen(false);
    setSelectedProduct(null);
  };

  const handleBuyNow = async (productId: number, quantity: number) => {
    try {
      setIsCheckingOut(true);
      
      // Process immediate checkout for single item
      const result = await checkoutService.checkoutSingleItem(productId, quantity);

      if (result.success && result.checkoutUrl) {
        console.log('Redirecting to buy now checkout:', result.checkoutUrl);
        
        // Try to open in new tab first, fallback to same window
        try {
          const newWindow = window.open(result.checkoutUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            // Popup blocked, redirect in same window
            window.location.href = result.checkoutUrl;
          }
        } catch (error) {
          // Fallback to same window redirect
          window.location.href = result.checkoutUrl;
        }
      } else {
        // Show error message
        logError(new Error(result.error || 'Buy now failed'), 'buyNow');
      }
    } catch (error) {
      logError(error, 'buyNow');
    } finally {
      setIsCheckingOut(false);
    }
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

  // Filter products based on search and filters
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.benefits.some(benefit => benefit.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    return matchesSearch && matchesCategory && matchesPrice;
  });

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
         onSalesRepClick={() => {}}
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
         onSalesRepClick={() => setIsSalesRepOpen(true)}
          onSalesRepClick={() => setIsOrgSelectorOpen(true)}
        />
        
        <Hero />

        {/* Products Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Products</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover our comprehensive range of health and wellness solutions
            </p>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-96"></div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-red-800">Configuration Required</h3>
                  </div>
                  <p className="text-red-700 mb-4">{error}</p>
                  {error.includes('credentials not configured') && (
                    <div className="bg-white rounded border border-red-200 p-4">
                      <p className="text-sm text-gray-700 mb-3">
                        <strong>To connect to BigCommerce:</strong>
                      </p>
                      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                        <li>Get your store hash from BigCommerce admin (found in the URL: store-<strong>HASH</strong>.mybigcommerce.com)</li>
                        <li>Create a Storefront API token in BigCommerce Settings → API → Storefront API</li>
                        <li>Add these to your <code className="bg-gray-100 px-1 rounded">.env</code> file (without VITE_ prefix):
                          <div className="mt-2 bg-gray-50 p-2 rounded text-xs font-mono">
                            BC_STORE_HASH=your_store_hash<br/>
                            BC_STOREFRONT_TOKEN=your_storefront_token
                          </div>
                        </li>
                        <li>Restart the development server</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Filters and Search */}
              <div className="flex flex-col lg:flex-row gap-8 mb-8">
                <div className="lg:w-64 flex-shrink-0">
                  <ProductFilter
                    categories={Object.keys(productsByCategory)}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    priceRange={priceRange}
                    onPriceRangeChange={setPriceRange}
                    isOpen={isFilterOpen}
                    onToggle={() => setIsFilterOpen(!isFilterOpen)}
                  />
                </div>
                
                <div className="flex-1">
                  {/* Search Bar */}
                  <div className="mb-6">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-lg"
                      />
                    </div>
                  </div>

                  {/* Results Summary */}
                  <div className="mb-6 flex items-center justify-between">
                    <p className="text-gray-600">
                      Showing {filteredProducts.length} of {products.length} products
                      {selectedCategory !== 'all' && ` in ${selectedCategory}`}
                      {searchTerm && ` matching "${searchTerm}"`}
                    </p>
                  </div>

                  {/* Product Grid */}
                  <ProductGrid
                    products={filteredProducts}
                    onAddToCart={addToCart}
                    onProductClick={handleProductClick}
                  />
                </div>
              </div>
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

        <ProductModal
          product={selectedProduct}
          isOpen={isProductModalOpen}
          onClose={handleCloseProductModal}
          onAddToCart={addToCart}
          onBuyNow={handleBuyNow}
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