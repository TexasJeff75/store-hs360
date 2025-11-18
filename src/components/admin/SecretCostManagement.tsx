import React, { useState, useEffect } from 'react';
import { Eye, DollarSign, Save, AlertTriangle, Package } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { bigCommerceService } from '@/services/bigcommerce';
import { productCostsService } from '@/services/productCosts';
import SortableTable, { Column } from './SortableTable';

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

  const columns: Column<ProductWithCost>[] = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      filterable: true,
      render: (product) => (
        <div className="flex items-center">
          <Package className="w-5 h-5 text-gray-400 mr-2" />
          <div className="text-sm font-medium text-gray-900">{product.name}</div>
        </div>
      )
    },
    {
      key: 'sku',
      label: 'SKU',
      sortable: true,
      filterable: true,
      className: 'whitespace-nowrap',
      render: (product) => (
        <div className="text-sm text-gray-900">{product.sku || 'N/A'}</div>
      )
    },
    {
      key: 'price',
      label: 'Retail Price',
      sortable: true,
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (product) => (
        <div className="text-sm text-gray-900">${product.price.toFixed(2)}</div>
      )
    },
    {
      key: 'cost_price',
      label: 'Public Cost',
      sortable: true,
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (product) => (
        editingProduct === product.id ? (
          <input
            type="number"
            step="0.01"
            value={editValues.cost_price}
            onChange={(e) => setEditValues({ ...editValues, cost_price: e.target.value })}
            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right"
            placeholder="0.00"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text-sm font-medium text-gray-900">
            {product.cost_price ? `$${product.cost_price.toFixed(2)}` : '-'}
          </div>
        )
      )
    },
    {
      key: 'secret_cost',
      label: 'Secret Cost',
      sortable: true,
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (product) => (
        editingProduct === product.id ? (
          <input
            type="number"
            step="0.01"
            value={editValues.secret_cost}
            onChange={(e) => setEditValues({ ...editValues, secret_cost: e.target.value })}
            className="w-24 px-2 py-1 border border-red-300 rounded text-sm text-right bg-red-50"
            placeholder="0.00"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text-sm font-bold text-red-900">
            {product.secret_cost ? `$${product.secret_cost.toFixed(2)}` : '-'}
          </div>
        )
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (product) => (
        editingProduct === product.id ? (
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                saveCosts(product);
              }}
              className="inline-flex items-center px-3 py-1 border border-green-300 rounded-lg text-green-700 hover:bg-green-50"
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                cancelEditing();
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              startEditing(product);
            }}
            className="inline-flex items-center px-3 py-1 border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            Edit Costs
          </button>
        )
      )
    }
  ];

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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Secret Cost Management</h2>
          <p className="text-sm text-red-600 flex items-center">
            <Eye className="w-4 h-4 mr-1" />
            Confidential: This page contains true acquisition costs
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-center">
            <Package className="h-8 w-8 text-blue-600 animate-pulse mr-3" />
            <div>
              <p className="text-blue-700 font-medium">Loading product costs...</p>
              <p className="text-blue-600 text-sm">Fetching confidential cost data from BigCommerce</p>
            </div>
          </div>
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

      {/* Products Table */}
      <SortableTable
        data={products}
        columns={columns}
        keyExtractor={(product) => product.id}
        searchPlaceholder="Search products by name or SKU..."
        emptyMessage="No products available."
        emptyIcon={<Package className="mx-auto h-12 w-12 text-gray-400" />}
      />

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
