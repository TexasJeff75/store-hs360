import React, { useState, useEffect } from 'react';
import { Users, Building2, ShoppingCart, User, Search, Package, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { multiTenantService } from '@/services/multiTenant';
import { bigCommerceService, Product } from '@/services/bigcommerce';
import { bigCommerceCustomerService } from '@/services/bigCommerceCustomer';
import { checkoutService } from '@/services/checkout';
import ProductGrid from './ProductGrid';
import ProductModal from './ProductModal';
import Cart from './Cart';
import type { Organization } from '@/services/supabase';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface SalesRepDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const SalesRepDashboard: React.FC<SalesRepDashboardProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [syncingCustomer, setSyncingCustomer] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [orgsData, productsData] = await Promise.all([
        multiTenantService.getOrganizations(),
        bigCommerceService.getProducts()
      ]);
      
      setOrganizations(orgsData.filter(org => org.is_active));
      setProducts(productsData.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrganization = async (org: Organization) => {
    setSelectedOrganization(org);
    setCartItems([]); // Clear cart when switching organizations
    
    // Sync organization data with BigCommerce
    await syncOrganizationWithBigCommerce(org);
  };

  const syncOrganizationWithBigCommerce = async (org: Organization) => {
    try {
      setSyncingCustomer(true);
      
      // Check if customer exists in BigCommerce, create if not
      const result = await bigCommerceCustomerService.syncOrganizationCustomer(org);
      
      if (!result.success) {
        setError(`Failed to sync customer data: ${result.error}`);
      }
    } catch (err) {
      setError('Failed to sync customer data with BigCommerce');
    } finally {
      setSyncingCustomer(false);
    }
  };

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

  const handlePlaceOrder = async () => {
    if (!selectedOrganization || cartItems.length === 0) return;

    try {
      setIsPlacingOrder(true);
      setError(null);

      // Create order in BigCommerce for the organization
      const result = await bigCommerceCustomerService.createOrderForOrganization(
        selectedOrganization,
        cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity
        }))
      );

      if (result.success) {
        setOrderSuccess(`Order #${result.orderId} placed successfully for ${selectedOrganization.name}`);
        setCartItems([]); // Clear cart
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setOrderSuccess(null);
        }, 5000);
      } else {
        setError(result.error || 'Failed to place order');
      }
    } catch (err) {
      setError('Failed to place order');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.benefits.some(benefit => benefit.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  // Check if user has sales rep permissions
  if (profile?.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">Sales rep dashboard requires admin privileges.</p>
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Rep Dashboard</h1>
            <p className="text-blue-100">Place orders on behalf of organizations</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Organization Selection */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Organization</h2>
            
            {/* Success Message */}
            {orderSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-700 text-sm">{orderSuccess}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            {/* Selected Organization Info */}
            {selectedOrganization && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-900">{selectedOrganization.name}</h3>
                    <p className="text-sm text-blue-700">Code: {selectedOrganization.code}</p>
                  </div>
                  {syncingCustomer && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
                
                {/* Cart Summary */}
                {cartItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-700">Cart: {cartCount} items</span>
                      <span className="font-semibold text-blue-900">${cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="mt-2 w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span>View Cart</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Organizations List */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-16"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrganization(org)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedOrganization?.id === org.id
                        ? 'bg-blue-100 border-blue-300 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Building2 className="h-5 w-5 text-gray-500" />
                      <div>
                        <h3 className="font-medium">{org.name}</h3>
                        <p className="text-sm text-gray-500">Code: {org.code}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Product Selection */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedOrganization ? (
            <>
              {/* Product Search */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Select Products for {selectedOrganization.name}
                  </h2>
                  {cartItems.length > 0 && (
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isPlacingOrder}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                    >
                      {isPlacingOrder ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      <span>{isPlacingOrder ? 'Placing Order...' : 'Place Order'}</span>
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <ProductGrid
                  products={filteredProducts}
                  onAddToCart={addToCart}
                  onProductClick={handleProductClick}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Select an Organization</h2>
                <p className="text-gray-600">
                  Choose an organization from the sidebar to start placing an order
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Modal */}
      <ProductModal
        product={selectedProduct}
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setSelectedProduct(null);
        }}
        onAddToCart={addToCart}
      />

      {/* Cart Modal */}
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeFromCart}
      />
    </div>
  );
};

export default SalesRepDashboard;