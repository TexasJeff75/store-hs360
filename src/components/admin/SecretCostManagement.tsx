import React, { useState, useEffect } from 'react';
import { Eye, DollarSign, Save, Search, AlertTriangle, Package } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { bigCommerceService } from '@/services/bigcommerce';
import { productCostsService } from '@/services/productCosts';

interface ProductWithCost {
  id: number;
  name: string;
  sku: string;
  price: number;
  cost_price: number | null;
  secret_cost: number | null;
  retail_price: number | null;
}

const SecretCostManagement: React.FC = () => {
  const [products, setProducts] = useState<ProductWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCostAdmin, setIsCostAdmin] = useState(false);
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ cost_price: string; secret_cost: string }>({
    cost_price: '',
    secret_cost: ''
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    checkCostAdmin();
  }, []);

  useEffect(() => {
    if (isCostAdmin) {
      fetchProducts();
    }
  }, [isCostAdmin]);

  const checkCostAdmin = async () => {
    try {
      const { data, error } = await supabase.rpc('is_cost_admin');
      if (error) throw error;
      setIsCostAdmin(data);

      if (!data) {
        setError('Access Denied: Only cost admins can manage secret costs. Contact jeff.lutz for access.');
      }
    } catch (err) {
      console.error('Error checking cost admin status:', err);
      setIsCostAdmin(false);
      setError('Unable to verify permissions');
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch products from BigCommerce
      const { products: bcProducts } = await bigCommerceService.getProducts();

      // Fetch product costs from database
      const productIds = bcProducts.map(p => p.id);
      const costsMap = await productCostsService.getProductCosts(productIds);

      // Merge data
      const productsWithCosts: ProductWithCost[] = bcProducts.map(product => {
        const costData = costsMap.get(product.id);
        return {
          id: product.id,
          name: product.name,
          sku: product.sku || '',
          price: product.price,
          cost_price: costData?.cost_price || null,
          secret_cost: costData?.secret_cost || null,
          retail_price: costData?.retail_price || product.price
        };
      });

      setProducts(productsWithCosts);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (product: ProductWithCost) => {
    setEditingProduct(product.id);
    setEditValues({
      cost_price: product.cost_price?.toString() || '',
      secret_cost: product.secret_cost?.toString() || ''
    });
  };

  const cancelEditing = () => {
    setEditingProduct(null);
    setEditValues({ cost_price: '', secret_cost: '' });
  };

  const saveCosts = async (product: ProductWithCost) => {
    try {
      setError(null);

      const costPrice = editValues.cost_price ? parseFloat(editValues.cost_price) : null;
      const secretCost = editValues.secret_cost ? parseFloat(editValues.secret_cost) : null;

      // Update in database
      await productCostsService.upsertProductCost({
        product_id: product.id,
        cost_price: costPrice,
        secret_cost: secretCost,
        retail_price: product.retail_price,
        sale_price: null,
        product_name: product.name,
        sku: product.sku
      });

      // Update local state
      setProducts(products.map(p =>
        p.id === product.id
          ? { ...p, cost_price: costPrice, secret_cost: secretCost }
          : p
      ));

      setEditingProduct(null);
      setSuccessMessage(`Costs updated for ${product.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);

      // Log the access
      await supabase.from('cost_admin_audit').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'updated_secret_cost',
        product_id: product.id,
        accessed_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error saving costs:', err);
      setError(err instanceof Error ? err.message : 'Failed to save costs');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isCostAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <Eye className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-red-900 mb-2">Access Restricted</h2>
          <p className="text-red-700">{error || 'You do not have permission to manage secret costs.'}</p>
          <p className="text-sm text-red-600 mt-2">Contact jeff.lutz for cost admin access.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Secret Cost Management</h2>
        <p className="text-sm text-red-600 flex items-center">
          <Eye className="w-4 h-4 mr-1" />
          Confidential: This page contains true acquisition costs
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      {/* Info Box */}
      <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900 mb-1">Understanding Cost Types</h3>
            <ul className="text-sm text-red-800 space-y-1">
              <li><strong>Public Cost (cost_price)</strong>: Shown to all admins for pricing validation. Can be higher than true cost.</li>
              <li><strong>Secret Cost (secret_cost)</strong>: Your TRUE acquisition cost. Only cost admins see this. Used for real profit calculations.</li>
              <li><strong>Why have both?</strong>: You can show higher "costs" to regular admins while protecting your true margins.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retail Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Public Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-red-500 uppercase tracking-wider">
                  <Eye className="inline w-3 h-3 mr-1" />
                  Secret Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Package className="w-5 h-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.sku || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">${product.price.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {editingProduct === product.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.cost_price}
                        onChange={(e) => setEditValues({ ...editValues, cost_price: e.target.value })}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="text-sm font-medium text-gray-900">
                        {product.cost_price ? `$${product.cost_price.toFixed(2)}` : '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {editingProduct === product.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.secret_cost}
                        onChange={(e) => setEditValues({ ...editValues, secret_cost: e.target.value })}
                        className="w-24 px-2 py-1 border border-red-300 rounded text-sm text-right bg-red-50"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="text-sm font-bold text-red-900">
                        {product.secret_cost ? `$${product.secret_cost.toFixed(2)}` : '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingProduct === product.id ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => saveCosts(product)}
                          className="inline-flex items-center px-3 py-1 border border-green-300 rounded-lg text-green-700 hover:bg-green-50"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(product)}
                        className="inline-flex items-center px-3 py-1 border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50"
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Edit Costs
                      </button>
                    )}
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
              {searchTerm ? 'Try adjusting your search criteria.' : 'No products available.'}
            </p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total Products</div>
          <div className="text-2xl font-bold text-gray-900">{products.length}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">With Public Cost</div>
          <div className="text-2xl font-bold text-gray-900">
            {products.filter(p => p.cost_price !== null).length}
          </div>
        </div>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="text-sm text-red-600 mb-1 flex items-center">
            <Eye className="w-3 h-3 mr-1" />
            With Secret Cost
          </div>
          <div className="text-2xl font-bold text-red-900">
            {products.filter(p => p.secret_cost !== null).length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecretCostManagement;
