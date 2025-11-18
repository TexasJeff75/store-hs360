import React, { useState, useEffect } from 'react';
import { Package, Search, Eye, DollarSign, Tag, Hash, ChevronUp, ChevronDown, Building2, CheckCircle2, XCircle, Truck, RefreshCw } from 'lucide-react';
import { bigCommerceService, Product } from '@/services/bigcommerce';
import { bcRestAPI } from '@/services/bigcommerceRestAPI';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cacheService } from '@/services/cache';

interface ContractPricingInfo {
  organization_name: string;
  location_name?: string;
  contract_price: number;
  min_quantity?: number;
  max_quantity?: number;
  pricing_type: 'individual' | 'organization' | 'location';
}

const ProductsManagement: React.FC = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortField, setSortField] = useState<keyof Product | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [contractPricingCounts, setContractPricingCounts] = useState<Record<number, number>>({});
  const [contractPricingDetails, setContractPricingDetails] = useState<ContractPricingInfo[]>([]);
  const [loadingPricingDetails, setLoadingPricingDetails] = useState(false);
  const [productSettings, setProductSettings] = useState<Map<number, { allowMarkup: boolean }>>(new Map());
  const [savingMarkupSetting, setSavingMarkupSetting] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchContractPricingCounts();
    fetchProductSettings();
  }, []);

  const fetchProductSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('product_settings')
        .select('product_id, allow_markup');

      if (error) throw error;

      const settingsMap = new Map();
      data?.forEach((setting: any) => {
        settingsMap.set(setting.product_id, { allowMarkup: setting.allow_markup });
      });
      setProductSettings(settingsMap);
    } catch (err) {
      console.error('Error fetching product settings:', err);
    }
  };

  const handleToggleMarkupAllowance = async (productId: number, currentValue: boolean) => {
    try {
      setSavingMarkupSetting(true);

      const { error } = await supabase
        .from('product_settings')
        .upsert({
          product_id: productId,
          allow_markup: !currentValue,
          product_name: selectedProduct?.name
        });

      if (error) throw error;

      // Update local state
      const newSettings = new Map(productSettings);
      newSettings.set(productId, { allowMarkup: !currentValue });
      setProductSettings(newSettings);

    } catch (err) {
      console.error('Error updating markup setting:', err);
      alert('Failed to update markup setting');
    } finally {
      setSavingMarkupSetting(false);
    }
  };

  const fetchProducts = async (forceRefresh = false) => {
    try {
      setLoading(true);

      if (forceRefresh) {
        // Clear the products cache
        cacheService.delete('products_all');
        console.log('🗑️ Product cache cleared');
      }

      const { products, errorMessage } = await bigCommerceService.getProducts();

      if (errorMessage) {
        setError(errorMessage);
      } else {
        // Fetch actual cost_price and brand info from BigCommerce REST API
        const productIds = products.map(p => p.id);
        try {
          const costData = await bcRestAPI.getProductCosts(productIds);

          console.log('Cost data received:', Object.keys(costData).length, 'products');
          console.log('Sample cost data:', costData[productIds[0]]);

          // Update products with actual cost_price and brand info from BigCommerce
          const updatedProducts = products.map(product => {
            const costInfo = costData[product.id];
            if (costInfo) {
              return {
                ...product,
                cost: costInfo.cost_price !== undefined ? costInfo.cost_price : product.cost,
                brandId: costInfo.brand_id,
                brandName: costInfo.brand_name || product.brand
              };
            }
            return product;
          });

          console.log('Updated products sample:', updatedProducts[0]);
          setProducts(updatedProducts);
        } catch (costErr) {
          console.error('Failed to fetch product costs:', costErr);
          // Still set products even if cost fetch fails
          setProducts(products);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshProducts = async () => {
    await fetchProducts(true);
  };

  const handleViewProduct = async (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
    await fetchContractPricingDetails(product.id);
  };

  const fetchContractPricingCounts = async () => {
    if (!user || !profile) return;

    try {
      const counts: Record<number, number> = {};

      if (profile.role === 'admin') {
        // Admins see all pricing from all tables
        const [individualRes, orgRes, locationRes] = await Promise.all([
          supabase.from('contract_pricing').select('product_id').not('user_id', 'is', null),
          supabase.from('organization_pricing').select('product_id'),
          supabase.from('location_pricing').select('product_id')
        ]);

        // Count individual pricing
        individualRes.data?.forEach(item => {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1;
        });

        // Count organization pricing
        orgRes.data?.forEach(item => {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1;
        });

        // Count location pricing
        locationRes.data?.forEach(item => {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1;
        });

      } else if (profile.role === 'sales_rep') {
        // Sales reps see pricing for organizations they belong to
        const { data: userOrgs } = await supabase
          .from('user_organization_roles')
          .select('organization_id')
          .eq('user_id', user.id);

        if (userOrgs && userOrgs.length > 0) {
          const orgIds = userOrgs.map(o => o.organization_id);

          // Get organization pricing
          const { data: orgPricing } = await supabase
            .from('organization_pricing')
            .select('product_id')
            .in('organization_id', orgIds);

          orgPricing?.forEach(item => {
            counts[item.product_id] = (counts[item.product_id] || 0) + 1;
          });

          // Get location pricing for those organizations
          const { data: locations } = await supabase
            .from('locations')
            .select('id')
            .in('organization_id', orgIds);

          if (locations && locations.length > 0) {
            const locationIds = locations.map(l => l.id);
            const { data: locationPricing } = await supabase
              .from('location_pricing')
              .select('product_id')
              .in('location_id', locationIds);

            locationPricing?.forEach(item => {
              counts[item.product_id] = (counts[item.product_id] || 0) + 1;
            });
          }
        }
      } else if (profile.role === 'customer') {
        // Customers only see their own individual pricing
        const { data } = await supabase
          .from('contract_pricing')
          .select('product_id')
          .eq('user_id', user.id);

        data?.forEach(item => {
          counts[item.product_id] = (counts[item.product_id] || 0) + 1;
        });
      }

      setContractPricingCounts(counts);
    } catch (err) {
      console.error('Error fetching contract pricing counts:', err);
    }
  };

  const fetchContractPricingDetails = async (productId: number) => {
    if (!user || !profile) return;

    setLoadingPricingDetails(true);
    try {
      const details: ContractPricingInfo[] = [];

      if (profile.role === 'admin') {
        // Admins see all pricing types

        // Individual pricing
        const { data: individualPricing } = await supabase
          .from('contract_pricing')
          .select(`
            contract_price,
            min_quantity,
            max_quantity,
            user_id,
            profiles!contract_pricing_user_id_fkey(email)
          `)
          .eq('product_id', productId)
          .not('user_id', 'is', null);

        individualPricing?.forEach(pricing => {
          details.push({
            organization_name: `Individual: ${pricing.profiles?.email || 'Unknown'}`,
            contract_price: Number(pricing.contract_price),
            min_quantity: pricing.min_quantity,
            max_quantity: pricing.max_quantity,
            pricing_type: 'individual'
          });
        });

        // Organization pricing
        const { data: orgPricing } = await supabase
          .from('organization_pricing')
          .select(`
            contract_price,
            min_quantity,
            max_quantity,
            organizations(name)
          `)
          .eq('product_id', productId);

        orgPricing?.forEach(pricing => {
          details.push({
            organization_name: pricing.organizations?.name || 'Unknown',
            contract_price: Number(pricing.contract_price),
            min_quantity: pricing.min_quantity,
            max_quantity: pricing.max_quantity,
            pricing_type: 'organization'
          });
        });

        // Location pricing
        const { data: locationPricing } = await supabase
          .from('location_pricing')
          .select(`
            contract_price,
            min_quantity,
            max_quantity,
            locations(name, organization_id, organizations(name))
          `)
          .eq('product_id', productId);

        locationPricing?.forEach(pricing => {
          details.push({
            organization_name: pricing.locations?.organizations?.name || 'Unknown',
            location_name: pricing.locations?.name,
            contract_price: Number(pricing.contract_price),
            min_quantity: pricing.min_quantity,
            max_quantity: pricing.max_quantity,
            pricing_type: 'location'
          });
        });
      } else if (profile.role === 'sales_rep') {
        // Sales reps see pricing for their organizations
        const { data: userOrgs } = await supabase
          .from('user_organization_roles')
          .select('organization_id')
          .eq('user_id', user.id);

        if (userOrgs && userOrgs.length > 0) {
          const orgIds = userOrgs.map(o => o.organization_id);

          // Get organization pricing
          const { data: orgPricing } = await supabase
            .from('organization_pricing')
            .select(`
              contract_price,
              min_quantity,
              max_quantity,
              organizations(name)
            `)
            .eq('product_id', productId)
            .in('organization_id', orgIds);

          orgPricing?.forEach(pricing => {
            details.push({
              organization_name: pricing.organizations?.name || 'Unknown',
              contract_price: Number(pricing.contract_price),
              min_quantity: pricing.min_quantity,
              max_quantity: pricing.max_quantity,
              pricing_type: 'organization'
            });
          });

          // Get location pricing for those organizations
          const { data: locations } = await supabase
            .from('locations')
            .select('id')
            .in('organization_id', orgIds);

          if (locations && locations.length > 0) {
            const locationIds = locations.map(l => l.id);
            const { data: locationPricing } = await supabase
              .from('location_pricing')
              .select(`
                contract_price,
                min_quantity,
                max_quantity,
                locations(name, organization_id, organizations(name))
              `)
              .eq('product_id', productId)
              .in('location_id', locationIds);

            locationPricing?.forEach(pricing => {
              details.push({
                organization_name: pricing.locations?.organizations?.name || 'Unknown',
                location_name: pricing.locations?.name,
                contract_price: Number(pricing.contract_price),
                min_quantity: pricing.min_quantity,
                max_quantity: pricing.max_quantity,
                pricing_type: 'location'
              });
            });
          }
        }
      } else if (profile.role === 'customer') {
        // Customers only see their own pricing
        const { data: individualPricing } = await supabase
          .from('contract_pricing')
          .select('contract_price, min_quantity, max_quantity')
          .eq('product_id', productId)
          .eq('user_id', user.id);

        individualPricing?.forEach(pricing => {
          details.push({
            organization_name: 'Your Contract Pricing',
            contract_price: Number(pricing.contract_price),
            min_quantity: pricing.min_quantity,
            max_quantity: pricing.max_quantity,
            pricing_type: 'individual'
          });
        });
      }

      setContractPricingDetails(details);
    } catch (err) {
      console.error('Error fetching contract pricing details:', err);
    } finally {
      setLoadingPricingDetails(false);
    }
  };

  const handleSort = (field: keyof Product) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof Product) => {
    if (sortField !== field) {
      return <ChevronUp className="h-4 w-4 text-gray-300" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-gray-600" />
      : <ChevronDown className="h-4 w-4 text-gray-600" />;
  };
  const getCategories = () => {
    const categories = [...new Set(products.map(p => p.category))];
    return categories;
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (!sortField) return 0;

    let aValue = a[sortField];
    let bValue = b[sortField];

    // Special handling for brand - use brandName if available
    if (sortField === 'brand') {
      aValue = a.brandName || a.brand || '';
      bValue = b.brandName || b.brand || '';
    }

    // Handle different data types
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">BigCommerce Products</h2>
        <p className="text-gray-600">View all products from your BigCommerce store</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Products</p>
              <p className="text-2xl font-semibold text-gray-900">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Tag className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Categories</p>
              <p className="text-2xl font-semibold text-gray-900">{getCategories().length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">With Images</p>
              <p className="text-2xl font-semibold text-gray-900">
                {products.filter(p => p.hasImage).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <CheckCircle2 className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">With Descriptions</p>
              <p className="text-2xl font-semibold text-gray-900">
                {products.filter(p => p.hasDescription).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="all">All Categories</option>
          {getCategories().map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <button
          onClick={handleRefreshProducts}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                  >
                    <span>Product</span>
                    {getSortIcon('name')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('sku')}
                    className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                  >
                    <span>SKU</span>
                    {getSortIcon('sku')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('brand')}
                    className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                  >
                    <span>Brand</span>
                    {getSortIcon('brand')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                  >
                    <span>Category</span>
                    {getSortIcon('category')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('price')}
                    className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                  >
                    <span>Price</span>
                    {getSortIcon('price')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('cost')}
                    className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                  >
                    <span>Cost</span>
                    {getSortIcon('cost')}
                  </button>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract Pricing
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img
                          className="h-10 w-10 rounded object-cover"
                          src={product.image}
                          alt={product.name}
                        />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                          {product.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.sku || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {(product.brandName || product.brand) ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700">
                        {product.brandName || product.brand}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium">${product.price.toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.cost !== undefined && product.cost !== null ? (
                      <span className={`font-medium ${product.cost === 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                        ${product.cost.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {product.hasImage ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {product.hasDescription ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {product.isInStock ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contractPricingCounts[product.id] > 0 ? (
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-green-600 mr-1" />
                        <span className="font-medium text-green-700">
                          {contractPricingCounts[product.id]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleViewProduct(product)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || categoryFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No products are available from BigCommerce.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Product Details Modal */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl leading-6 font-medium text-gray-900">
                        Product Details
                      </h3>
                      <button
                        onClick={() => setIsModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <span className="sr-only">Close</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Product Image and Basic Info */}
                      <div className="space-y-4">
                        <div>
                          <img 
                            src={selectedProduct.image} 
                            alt={selectedProduct.name}
                            className="w-full h-64 object-cover rounded-lg"
                          />
                        </div>
                        
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">
                            {selectedProduct.name}
                          </h4>
                          <div className="flex items-center space-x-4 mb-4">
                            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">
                              {selectedProduct.category}
                            </span>
                            <div className="flex items-center">
                              <Hash className="h-4 w-4 text-gray-400 mr-1" />
                              <span className="text-sm text-gray-600">ID: {selectedProduct.id}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="space-y-6">
                        {/* Pricing */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-500 mb-2">Pricing</h5>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-700">Current Price:</span>
                              <span className="text-lg font-semibold text-gray-900">
                                ${selectedProduct.price.toFixed(2)}
                              </span>
                            </div>
                            {selectedProduct.originalPrice && selectedProduct.originalPrice !== selectedProduct.price && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Original Price:</span>
                                <span className="text-sm text-gray-500 line-through">
                                  ${selectedProduct.originalPrice.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Markup Settings (Admin Only) */}
                        {profile?.role === 'admin' && (
                          <div className="border-t pt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Markup Pricing Settings</h5>
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={productSettings.get(selectedProduct.id)?.allowMarkup || false}
                                      onChange={() => handleToggleMarkupAllowance(
                                        selectedProduct.id,
                                        productSettings.get(selectedProduct.id)?.allowMarkup || false
                                      )}
                                      disabled={savingMarkupSetting}
                                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-900">
                                      Allow Markup Above Retail
                                    </span>
                                  </label>
                                  <p className="mt-2 text-xs text-gray-600">
                                    {productSettings.get(selectedProduct.id)?.allowMarkup
                                      ? 'This product CAN be marked up above retail price (e.g., genetic testing, micronutrient testing).'
                                      : 'This product can ONLY be discounted below retail price (standard contract pricing).'
                                    }
                                  </p>
                                </div>
                                {savingMarkupSetting && (
                                  <div className="ml-4">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Product Details */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-500 mb-2">Product Information</h5>
                          <div className="space-y-2">
                            {selectedProduct.sku && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">SKU:</span>
                                <span className="text-sm font-medium">{selectedProduct.sku}</span>
                              </div>
                            )}
                            {selectedProduct.cost !== undefined && selectedProduct.cost > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Cost:</span>
                                <span className="text-sm font-medium">${selectedProduct.cost.toFixed(2)}</span>
                              </div>
                            )}
                            {selectedProduct.brand && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Brand:</span>
                                <span className="text-sm font-medium">{selectedProduct.brand}</span>
                              </div>
                            )}
                            {selectedProduct.condition && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Condition:</span>
                                <span className="text-sm font-medium">{selectedProduct.condition}</span>
                              </div>
                            )}
                            {selectedProduct.weight && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">Weight:</span>
                                <span className="text-sm font-medium">
                                  {selectedProduct.weight} {selectedProduct.weightUnit}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-700">In Stock:</span>
                              <span className="text-sm font-medium">
                                {selectedProduct.isInStock ? (
                                  <span className="text-green-600 flex items-center">
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Yes
                                  </span>
                                ) : (
                                  <span className="text-red-600 flex items-center">
                                    <XCircle className="h-4 w-4 mr-1" /> No
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Benefits */}
                        {selectedProduct.benefits.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-500 mb-2">Benefits</h5>
                            <div className="flex flex-wrap gap-2">
                              {selectedProduct.benefits.map((benefit, index) => (
                                <span 
                                  key={index}
                                  className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
                                >
                                  {benefit}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Additional Info */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-500 mb-2">Additional Information</h5>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Product ID:</span>
                                <span className="ml-2 font-medium">{selectedProduct.id}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Category:</span>
                                <span className="ml-2 font-medium">{selectedProduct.category}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Has Image:</span>
                                <span className="ml-2 font-medium">
                                  {selectedProduct.hasImage ? (
                                    <span className="text-green-600 flex items-center">
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Yes
                                    </span>
                                  ) : (
                                    <span className="text-red-600 flex items-center">
                                      <XCircle className="h-4 w-4 mr-1" /> No
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Has Description:</span>
                                <span className="ml-2 font-medium">
                                  {selectedProduct.hasDescription ? (
                                    <span className="text-green-600 flex items-center">
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Yes
                                    </span>
                                  ) : (
                                    <span className="text-red-600 flex items-center">
                                      <XCircle className="h-4 w-4 mr-1" /> No
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contract Pricing Section */}
                    <div className="mt-6 border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                          <Building2 className="h-5 w-5 mr-2 text-green-600" />
                          Contract Pricing
                        </h4>
                        {contractPricingCounts[selectedProduct.id] > 0 && (
                          <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                            {contractPricingCounts[selectedProduct.id]} {contractPricingCounts[selectedProduct.id] === 1 ? 'contract' : 'contracts'}
                          </span>
                        )}
                      </div>

                      {loadingPricingDetails ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                      ) : contractPricingDetails.length > 0 ? (
                        <div className="space-y-3">
                          {contractPricingDetails.map((pricing, index) => (
                            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className="font-medium text-gray-900">{pricing.organization_name}</span>
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                      pricing.pricing_type === 'individual'
                                        ? 'bg-blue-100 text-blue-700'
                                        : pricing.pricing_type === 'organization'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {pricing.pricing_type}
                                    </span>
                                  </div>
                                  {pricing.location_name && (
                                    <div className="text-sm text-gray-600 mb-2">
                                      Location: {pricing.location_name}
                                    </div>
                                  )}
                                  <div className="flex items-center space-x-4 text-sm">
                                    <div>
                                      <span className="text-gray-600">Price:</span>
                                      <span className="ml-2 font-semibold text-green-700">
                                        ${pricing.contract_price.toFixed(2)}
                                      </span>
                                    </div>
                                    {pricing.min_quantity && (
                                      <div>
                                        <span className="text-gray-600">Min Qty:</span>
                                        <span className="ml-2 font-medium text-gray-900">{pricing.min_quantity}</span>
                                      </div>
                                    )}
                                    {pricing.max_quantity && (
                                      <div>
                                        <span className="text-gray-600">Max Qty:</span>
                                        <span className="ml-2 font-medium text-gray-900">{pricing.max_quantity}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>No contract pricing available for this product</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsManagement;