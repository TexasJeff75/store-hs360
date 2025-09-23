import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Search, Eye, EyeOff, Star, Tag, Image, DollarSign, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { bigCommerceService, Product } from '@/services/bigcommerce';

interface ProductSettings {
  id: number;
  isVisible: boolean;
  displayOrder: number;
  customCategory?: string;
  customBenefits?: string[];
  customRating?: number;
  customReviews?: number;
}

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productSettings, setProductSettings] = useState<ProductSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSettings, setSelectedSettings] = useState<ProductSettings | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customBenefitInput, setCustomBenefitInput] = useState('');
  const [pendingProductSettings, setPendingProductSettings] = useState<{ [key: number]: Partial<ProductSettings> }>({});
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
    loadProductSettings();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { products } = await bigCommerceService.getProducts();
      setProducts(products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const loadProductSettings = () => {
    // Load from localStorage for now - in a real app this would be from a database
    const saved = localStorage.getItem('productSettings');
    if (saved) {
      setProductSettings(JSON.parse(saved));
    }
  };

  const saveProductSettings = (settings: ProductSettings[]) => {
    localStorage.setItem('productSettings', JSON.stringify(settings));
    setProductSettings(settings);
  };

  const getProductSettings = (productId: number): ProductSettings => {
    return productSettings.find(s => s.id === productId) || {
      id: productId,
      isVisible: true,
      displayOrder: 0,
      customCategory: undefined,
      customBenefits: undefined,
      customRating: undefined,
      customReviews: undefined
    };
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedSettings(getProductSettings(product.id));
    setCustomBenefitInput(getProductSettings(product.id).customBenefits?.join(', ') || '');
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSaveProduct = () => {
    if (!selectedProduct || !selectedSettings) return;

    const updatedSettings = productSettings.filter(s => s.id !== selectedProduct.id);
    const newSettings = {
      ...selectedSettings,
      customBenefits: customBenefitInput 
        ? customBenefitInput.split(',').map(b => b.trim()).filter(Boolean)
        : undefined
    };
    
    updatedSettings.push(newSettings);
    saveProductSettings(updatedSettings);
    
    setIsModalOpen(false);
    setSelectedProduct(null);
    setSelectedSettings(null);
    setCustomBenefitInput('');
  };

  const toggleProductVisibility = (productId: number) => {
    const currentSettings = getProductSettings(productId);
    setPendingProductSettings(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        isVisible: !currentSettings.isVisible
      }
    }));
  };

  const updateDisplayOrder = (productId: number, order: number) => {
    setPendingProductSettings(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        displayOrder: order
      }
    }));
  };

  const getEffectiveSettings = (productId: number): ProductSettings => {
    const baseSettings = getProductSettings(productId);
    const pendingChanges = pendingProductSettings[productId];
    return {
      ...baseSettings,
      ...pendingChanges
    };
  };

  const handleSaveAllProductSettings = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      
      const updatedSettings = [...productSettings];
      
      // Apply all pending changes
      Object.entries(pendingProductSettings).forEach(([productIdStr, changes]) => {
        const productId = parseInt(productIdStr);
        const existingIndex = updatedSettings.findIndex(s => s.id === productId);
        const currentSettings = getProductSettings(productId);
        const newSettings = { ...currentSettings, ...changes };
        
        if (existingIndex >= 0) {
          updatedSettings[existingIndex] = newSettings;
        } else {
          updatedSettings.push(newSettings);
        }
      });
      
      // Save to localStorage (in future this will be Supabase)
      saveProductSettings(updatedSettings);
      
      // Clear pending changes
      setPendingProductSettings({});
      
      setSaveMessage({ type: 'success', text: 'All changes saved successfully!' });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (err) {
      setSaveMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to save changes' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setPendingProductSettings({});
    setSaveMessage({ type: 'success', text: 'Changes discarded successfully!' });
    
    // Auto-hide message after 2 seconds
    setTimeout(() => {
      setSaveMessage(null);
    }, 2000);
  };

  const hasPendingChanges = Object.keys(pendingProductSettings).length > 0;

  const handleSaveProduct = () => {
    if (!selectedProduct || !selectedSettings) return;

    const updatedSettings = productSettings.filter(s => s.id !== selectedProduct.id);
    const newSettings = {
      ...selectedSettings,
      customBenefits: customBenefitInput 
        ? customBenefitInput.split(',').map(b => b.trim()).filter(Boolean)
        : undefined
    };
    
    updatedSettings.push(newSettings);
    saveProductSettings(updatedSettings);
    
    // Clear any pending changes for this product since we just saved via modal
    setPendingProductSettings(prev => {
      const updated = { ...prev };
      delete updated[selectedProduct.id];
      return updated;
    });
    
    setIsModalOpen(false);
    setSelectedProduct(null);
    setSelectedSettings(null);
    setCustomBenefitInput('');
  };

  const getCategories = () => {
    const categories = [...new Set(products.map(p => p.category))];
    return categories;
  };

  const getEffectiveProduct = (product: Product): Product => {
    const settings = getProductSettings(product.id);
    return {
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Carousel Product Management</h2>
        <p className="text-gray-600">Manage which products appear in carousels and customize their display</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Save Message */}
      {saveMessage && (
        <div className={`mb-4 p-4 rounded-lg flex items-center space-x-2 ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {saveMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className={`text-sm ${
            saveMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
          }`}>
            {saveMessage.text}
          </span>
        </div>
      )}

      {/* Save/Discard Actions */}
      {hasPendingChanges && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                You have unsaved changes ({Object.keys(pendingProductSettings).length} product{Object.keys(pendingProductSettings).length !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDiscardChanges}
                disabled={isSaving}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Discard Changes</span>
              </button>
              <button
                onClick={handleSaveAllProductSettings}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save All Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Display Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visibility
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const settings = getProductSettings(product.id);
                const effectiveProduct = getEffectiveProduct(product);
                return (
                  <tr key={product.id} className={`hover:bg-gray-50 ${!settings.isVisible ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12">
                          <img 
                            className="h-12 w-12 rounded-lg object-cover" 
                            src={product.image} 
                            alt={product.name}
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">ID: {product.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        settings.customCategory 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {effectiveProduct.category}
                      </span>
                      {settings.customCategory && (
                        <div className="text-xs text-gray-500 mt-1">Custom</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${product.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        value={getEffectiveSettings(product.id).displayOrder}
                        onChange={(e) => updateDisplayOrder(product.id, parseInt(e.target.value) || 0)}
                        className={`w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                          pendingProductSettings[product.id]?.displayOrder !== undefined
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-gray-300'
                        }`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleProductVisibility(product.id)}
                        className={`p-2 rounded-full transition-colors relative ${
                          getEffectiveSettings(product.id).isVisible
                            ? 'text-green-600 hover:bg-green-100'
                            : 'text-gray-400 hover:bg-gray-100'
                        } ${
                          pendingProductSettings[product.id]?.isVisible !== undefined
                            ? 'ring-2 ring-yellow-400 ring-offset-1'
                            : ''
                        }`}
                      >
                        {getEffectiveSettings(product.id).isVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                        {pendingProductSettings[product.id]?.isVisible !== undefined && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"></div>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="text-purple-600 hover:text-purple-900 p-1 rounded"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
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
                : 'No products are available.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Edit Product Modal */}
      {isModalOpen && selectedProduct && selectedSettings && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Edit Product: {selectedProduct.name}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Product Preview */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Preview
                          </label>
                          <div className="border border-gray-200 rounded-lg p-4">
                            <img 
                              src={selectedProduct.image} 
                              alt={selectedProduct.name}
                              className="w-full h-32 object-cover rounded-lg mb-3"
                            />
                            <h4 className="font-medium text-gray-900">{selectedProduct.name}</h4>
                            <p className="text-sm text-gray-600">${selectedProduct.price.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Settings */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Custom Category
                          </label>
                          <input
                            type="text"
                            value={selectedSettings.customCategory || ''}
                            onChange={(e) => setSelectedSettings({
                              ...selectedSettings,
                              customCategory: e.target.value || undefined
                            })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder={selectedProduct.category}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Leave empty to use original: {selectedProduct.category}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Custom Benefits (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={customBenefitInput}
                            onChange={(e) => setCustomBenefitInput(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder={selectedProduct.benefits.join(', ')}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Leave empty to use original: {selectedProduct.benefits.join(', ')}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Custom Rating
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="5"
                              step="0.1"
                              value={selectedSettings.customRating || ''}
                              onChange={(e) => setSelectedSettings({
                                ...selectedSettings,
                                customRating: e.target.value ? parseFloat(e.target.value) : undefined
                              })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder={selectedProduct.rating.toString()}
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Custom Reviews
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={selectedSettings.customReviews || ''}
                              onChange={(e) => setSelectedSettings({
                                ...selectedSettings,
                                customReviews: e.target.value ? parseInt(e.target.value) : undefined
                              })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder={selectedProduct.reviews.toString()}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Display Order
                          </label>
                          <input
                            type="number"
                            value={selectedSettings.displayOrder}
                            onChange={(e) => setSelectedSettings({
                              ...selectedSettings,
                              displayOrder: parseInt(e.target.value) || 0
                            })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Lower numbers appear first
                          </p>
                        </div>
                        
                        <div>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedSettings.isVisible}
                              onChange={(e) => setSelectedSettings({
                                ...selectedSettings,
                                isVisible: e.target.checked
                              })}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Visible in Carousels</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveProduct}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;