import React, { useState, useMemo } from 'react';
import { Package, Search, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { Product } from '@/services/bigcommerce';
import { useAuth } from '@/contexts/AuthContext';
import { useProductData } from './useProductData';
import { useContractPricing } from './useContractPricing';
import { useSecretCosts } from './useSecretCosts';
import { useProductSettings } from './useProductSettings';
import { ProductTableRow } from './ProductTableRow';
import { ProductDetailsModal } from './ProductDetailsModal';

const ProductsManagement: React.FC = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortField, setSortField] = useState<keyof Product | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { products, loading, loadingCosts, error, refetchProducts } = useProductData();
  const {
    contractPricingCounts,
    contractPricingDetails,
    loadingPricingDetails,
    fetchContractPricingDetails,
  } = useContractPricing();
  const {
    isCostAdmin,
    secretCosts,
    editingSecretCost,
    editSecretCostValue,
    savingSecretCost,
    setEditSecretCostValue,
    handleEditSecretCost,
    handleCancelEditSecretCost,
    handleSaveSecretCost,
  } = useSecretCosts(products);
  const { productSettings, savingMarkupSetting, handleToggleMarkupAllowance } = useProductSettings();

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['all', ...Array.from(cats).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term)
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [products, searchTerm, categoryFilter, sortField, sortDirection]);

  const handleSort = (field: keyof Product) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleViewProduct = async (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
    await fetchContractPricingDetails(product.id);
  };

  const handleRefreshProducts = async () => {
    await refetchProducts(true);
  };

  const handleToggleMarkup = (productId: number, currentValue: boolean) => {
    handleToggleMarkupAllowance(productId, currentValue, selectedProduct);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading products</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Package className="h-8 w-8 text-gray-700" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Products Management</h2>
            <p className="text-sm text-gray-500">
              Manage products, pricing, and inventory
              {loadingCosts && <span className="ml-2 text-blue-600">(Loading costs...)</span>}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefreshProducts}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
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
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Product Name
                    {sortField === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sku')}
                  className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-center">
                    SKU
                    {sortField === 'sku' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brand
                </th>
                <th
                  onClick={() => handleSort('price')}
                  className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-end">
                    Price
                    {sortField === 'price' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('cost')}
                  className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-end">
                    Cost
                    {sortField === 'cost' && (
                      sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                {isCostAdmin && (
                  <th className="px-2 py-2 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                    Secret Cost
                  </th>
                )}
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pricing
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  isCostAdmin={isCostAdmin}
                  secretCosts={secretCosts}
                  editingSecretCost={editingSecretCost}
                  editSecretCostValue={editSecretCostValue}
                  savingSecretCost={savingSecretCost}
                  contractPricingCount={contractPricingCounts[product.id] || 0}
                  onViewProduct={handleViewProduct}
                  onEditSecretCost={handleEditSecretCost}
                  onSaveSecretCost={handleSaveSecretCost}
                  onCancelEditSecretCost={handleCancelEditSecretCost}
                  setEditSecretCostValue={setEditSecretCostValue}
                />
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

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          isOpen={isModalOpen}
          isCostAdmin={isCostAdmin}
          isAdmin={profile?.role === 'admin'}
          secretCosts={secretCosts}
          contractPricingDetails={contractPricingDetails}
          loadingPricingDetails={loadingPricingDetails}
          productSettings={productSettings}
          savingMarkupSetting={savingMarkupSetting}
          onClose={() => setIsModalOpen(false)}
          onEditSecretCost={handleEditSecretCost}
          onToggleMarkupAllowance={handleToggleMarkup}
        />
      )}
    </div>
  );
};

export default ProductsManagement;
