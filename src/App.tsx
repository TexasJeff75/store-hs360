import React, { useState, useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import UserProfile from '@/components/UserProfile';
import ResetPassword from '@/components/ResetPassword';
import AdminDashboard from '@/components/admin/AdminDashboard';
import ProductGrid from '@/components/ProductGrid';
import ProductFilter from '@/components/ProductFilter';
import FavoritesList from '@/components/FavoritesList';
import ProductModal from '@/components/ProductModal';
import Cart from '@/components/Cart';
import Footer from '@/components/Footer';
import OrganizationSelector from '@/components/OrganizationSelector';
import ErrorDebugPanel from '@/components/ErrorDebugPanel';
import Toast from '@/components/Toast';
import { bigCommerceService, Product } from '@/services/bigcommerce';
import { checkoutService, CartLineItem } from '@/services/checkout';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { cacheService } from '@/services/cache';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { contractPricingService } from '@/services/contractPricing';
import { supabase } from '@/services/supabase';

interface CartItem {
  id: number;
  name: string;
  price: number;
  retailPrice?: number;
  cost?: number;
  quantity: number;
  image: string;
  hasMarkup?: boolean;
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
  const { user, profile, loading: authLoading, isPasswordRecovery } = useAuth();
  const { toastMessage, toastType, clearToast } = useFavorites();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isOrgSelectorOpen, setIsOrgSelectorOpen] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<any>(null);
  const [userHasMultipleOrgs, setUserHasMultipleOrgs] = useState(false);
  const [showOnlyContractPricing, setShowOnlyContractPricing] = useState(false);
  const [productsWithContractPricing, setProductsWithContractPricing] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔄 Starting data fetch...');
        console.log('📊 Cache stats:', cacheService.getStats());
        
        // Add timeout to the entire fetch operation
        const fetchPromise = Promise.all([
          bigCommerceService.getProducts((err: unknown, ctx?: string) => logError(err, ctx)),
          bigCommerceService.getCategories((err: unknown, ctx?: string) => logError(err, ctx))
        ]);
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 35000)
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

  // Auto-load user's organization
  useEffect(() => {
    const loadUserOrganization = async () => {
      if (!user?.id || selectedOrganization) return;

      try {
        const { data, error } = await supabase
          .from('user_organization_roles')
          .select(`
            organization_id,
            organizations!inner(id, name, code, is_active)
          `)
          .eq('user_id', user.id)
          .eq('organizations.is_active', true);

        if (!error && data && data.length > 0) {
          setUserHasMultipleOrgs(data.length > 1);

          // Auto-select if only one organization
          if (data.length === 1) {
            setSelectedOrganization(data[0].organizations);
          }
        }
      } catch (error) {
        console.error('Error loading user organization:', error);
      }
    };

    loadUserOrganization();
  }, [user?.id, selectedOrganization]);

  // Fetch products with contract pricing when organization or user changes
  useEffect(() => {
    const fetchContractPricingProducts = async () => {
      if (!user) {
        setProductsWithContractPricing([]);
        return;
      }

      try {
        const productIds = await contractPricingService.getProductsWithContractPricing(
          selectedOrganization ? undefined : user.id,
          selectedOrganization?.id
        );
        setProductsWithContractPricing(productIds);
      } catch (error) {
        console.error('Error fetching contract pricing products:', error);
        setProductsWithContractPricing([]);
      }
    };

    fetchContractPricingProducts();

    // Clear the contract pricing filter if no organization is selected
    if (!selectedOrganization) {
      setShowOnlyContractPricing(false);
    }
  }, [user, selectedOrganization]);
  const addToCart = async (productId: number, quantity: number = 1) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Fetch the effective price (contract or regular)
    let effectivePrice = product.price;
    let retailPrice = product.price;
    let hasMarkup = false;

    if (user && (profile || selectedOrganization)) {
      try {
        let priceResult;
        let productPricingData;

        if (selectedOrganization) {
          // Sales rep mode - get organization pricing
          const orgPricing = await contractPricingService.getOrganizationPricing(selectedOrganization.id);
          const productPricing = orgPricing.find(p => p.product_id === productId);

          if (productPricing &&
              quantity >= (productPricing.min_quantity || 1) &&
              (!productPricing.max_quantity || quantity <= productPricing.max_quantity)) {
            productPricingData = productPricing;

            // Check if markup_price is being used
            if (productPricing.markup_price !== null && productPricing.markup_price !== undefined) {
              effectivePrice = productPricing.markup_price;
              retailPrice = productPricing.contract_price || product.price;
              hasMarkup = true;
            } else if (productPricing.contract_price !== null && productPricing.contract_price !== undefined) {
              effectivePrice = productPricing.contract_price;
              retailPrice = effectivePrice;
              hasMarkup = false;
            }

            priceResult = {
              price: effectivePrice,
              source: 'organization' as const
            };
          }
        } else if (profile) {
          // Regular user mode
          priceResult = await contractPricingService.getEffectivePrice(
            user.id,
            productId,
            profile.role,
            quantity
          );

          if (priceResult) {
            effectivePrice = priceResult.price;
            retailPrice = effectivePrice;
            hasMarkup = false;
          }
        }
      } catch (error) {
        console.error('Error fetching contract price for cart:', error);
        // Fall back to regular price
      }
    }

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
          price: effectivePrice,
          retailPrice: retailPrice,
          cost: product.cost,
          quantity: quantity,
          image: product.image,
          hasMarkup: hasMarkup
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

  const clearCart = () => {
    setCartItems([]);
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
  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.benefits.some(benefit => benefit.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      const matchesContractPricing = !showOnlyContractPricing || productsWithContractPricing.includes(product.id);
      return matchesSearch && matchesCategory && matchesPrice && matchesContractPricing;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

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
          onOrderHistoryClick={() => setIsAdminOpen(true)}
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

  if (isPasswordRecovery) {
    return <ResetPassword onComplete={() => window.location.reload()} />;
  }

  return (
      <div className="min-h-screen bg-gray-50">
        <Header
          cartCount={cartCount}
          onCartClick={() => setIsCartOpen(true)}
          onAuthClick={() => setIsAuthModalOpen(true)}
          onProfileClick={() => setIsProfileOpen(true)}
          onAdminClick={() => setIsAdminOpen(true)}
          onSalesRepClick={() => setIsOrgSelectorOpen(true)}
          onOrderHistoryClick={() => setIsAdminOpen(true)}
        />

        {/* Products Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Products</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
              Discover our comprehensive range of health and wellness solutions
            </p>

            {/* Organization Selector Button - Only show if user has multiple organizations */}
            {userHasMultipleOrgs && (
              <div className="flex justify-center">
                <button
                  onClick={() => setIsOrgSelectorOpen(true)}
                  className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="font-medium">
                    Change Organization ({selectedOrganization?.name})
                  </span>
                </button>
              </div>
            )}
            {selectedOrganization && !userHasMultipleOrgs && (
              <div className="flex justify-center">
                <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-6 py-3 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="font-medium">Ordering for: {selectedOrganization.name}</span>
                </div>
              </div>
            )}
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
                        <li>Add these to your <code className="bg-gray-100 px-1 rounded">.env</code> file (with VITE_ prefix):
                          <div className="mt-2 bg-gray-50 p-2 rounded text-xs font-mono">
                            VITE_BC_STORE_HASH=your_store_hash<br/>
                            VITE_BC_STOREFRONT_TOKEN=your_jwt_token
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
                <div className="lg:w-64 flex-shrink-0 space-y-6">
                  <ProductFilter
                    categories={Object.keys(productsByCategory)}
                    selectedCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    priceRange={priceRange}
                    onPriceRangeChange={setPriceRange}
                    isOpen={isFilterOpen}
                    onToggle={() => setIsFilterOpen(!isFilterOpen)}
                  />
                  <FavoritesList
                    products={products.map(p => ({
                      id: p.id,
                      name: p.name,
                      image: p.image,
                      price: p.price
                    }))}
                    onProductClick={(productId) => {
                      const product = products.find(p => p.id === productId);
                      if (product) handleProductClick(product);
                    }}
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

                  {/* Results Summary and Filters */}
                  <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                    <p className="text-gray-600">
                      Showing {filteredProducts.length} of {products.length} products
                      {selectedCategory !== 'all' && ` in ${selectedCategory}`}
                      {searchTerm && ` matching "${searchTerm}"`}
                    </p>

                    <div className="flex items-center space-x-4">
                      {selectedOrganization && (
                        <div className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm">
                          <span className="font-medium">{selectedOrganization.name}</span>
                          <button
                            onClick={() => setSelectedOrganization(null)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      <label className={`flex items-center space-x-2 ${selectedOrganization ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                        <input
                          type="checkbox"
                          checked={showOnlyContractPricing}
                          onChange={(e) => setShowOnlyContractPricing(e.target.checked)}
                          disabled={!selectedOrganization}
                          className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 disabled:cursor-not-allowed"
                        />
                        <span className="text-sm text-gray-700">
                          Only show contract pricing
                          {!selectedOrganization && ' (select organization first)'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Product Grid */}
                  <ProductGrid
                    products={filteredProducts}
                    onAddToCart={addToCart}
                    onProductClick={handleProductClick}
                    organizationId={selectedOrganization?.id}
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
          onClearCart={clearCart}
          organizationId={selectedOrganization?.id}
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
          organizationId={selectedOrganization?.id}
        />
        <UserProfile
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />

        <AdminDashboard
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
        />

        <OrganizationSelector
          isOpen={isOrgSelectorOpen}
          onClose={() => setIsOrgSelectorOpen(false)}
          onSelectOrganization={setSelectedOrganization}
          selectedOrganization={selectedOrganization}
        />

        <ErrorDebugPanel errors={errors} onClearErrors={clearErrors} />

        <Toast
          message={toastMessage || ''}
          type={toastType || 'success'}
          isVisible={!!toastMessage}
          onClose={clearToast}
        />
      </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <AppContent />
      </FavoritesProvider>
    </AuthProvider>
  );
}

export default App;