import React, { useState, useEffect, useRef } from 'react';
import { Eye, DollarSign, Save, AlertTriangle, Package, Upload, Download, FileText } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { bigCommerceService } from '@/services/bigcommerce';
import { bcRestAPI } from '@/services/bigcommerceRestAPI';
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
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportData, setBulkImportData] = useState<string>('');
  const [bulkImportResults, setBulkImportResults] = useState<{success: number; failed: number; errors: string[]}>({success: 0, failed: 0, errors: []});
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Fetch BigCommerce costs via REST API
      const productIds = bcProducts.map(p => p.id);
      const bcCostsData = await bcRestAPI.getProductCosts(productIds);

      // Fetch secret costs from database
      const costsMap = await productCostsService.getProductCosts(productIds);

      // Merge data
      const productsWithCosts: ProductWithCost[] = bcProducts.map(product => {
        const bcCost = bcCostsData[product.id];
        const dbCostData = costsMap.get(product.id);

        return {
          id: product.id,
          name: product.name,
          sku: product.sku || '',
          price: product.price,
          cost_price: bcCost?.cost_price || null,
          secret_cost: dbCostData?.secret_cost || null,
          retail_price: product.price
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

      const secretCost = editValues.secret_cost ? parseFloat(editValues.secret_cost) : null;

      // Update only secret_cost in database (cost_price comes from BigCommerce)
      await productCostsService.upsertProductCost({
        product_id: product.id,
        cost_price: product.cost_price,
        secret_cost: secretCost,
        retail_price: product.retail_price,
        sale_price: null,
        product_name: product.name,
        sku: product.sku
      });

      // Update local state
      setProducts(products.map(p =>
        p.id === product.id
          ? { ...p, secret_cost: secretCost }
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

  const handleBulkImport = () => {
    setIsBulkImportOpen(true);
    setBulkImportData('');
    setBulkImportResults({success: 0, failed: 0, errors: []});
  };

  const handleDownloadTemplate = () => {
    const csvLines = ['Product ID,Product Name,SKU,Retail Price,Public Cost,Secret Cost'];

    products.forEach(product => {
      csvLines.push([
        product.id,
        `"${product.name}"`,
        product.sku || '',
        product.price.toFixed(2),
        product.cost_price?.toFixed(2) || '',
        product.secret_cost?.toFixed(2) || ''
      ].join(','));
    });

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `secret_costs_template_${new Date().toISOString().split('T')[0]}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setBulkImportData(text);
    };
    reader.readAsText(file);
  };

  const processBulkImport = async () => {
    if (!bulkImportData.trim()) {
      alert('Please paste CSV data or upload a file first.');
      return;
    }

    const lines = bulkImportData.trim().split('\n');
    if (lines.length < 2) {
      alert('CSV must contain at least a header row and one data row.');
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Handle CSV with quoted fields
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim());

        if (parts.length < 6) {
          errors.push(`Line ${i + 1}: Invalid format - expected 6 columns`);
          failedCount++;
          continue;
        }

        const [productIdStr, productName, sku, retailPriceStr, publicCostStr, secretCostStr] = parts;
        const productId = parseInt(productIdStr);

        if (isNaN(productId)) {
          errors.push(`Line ${i + 1}: Invalid product ID "${productIdStr}"`);
          failedCount++;
          continue;
        }

        const product = products.find(p => p.id === productId);
        if (!product) {
          errors.push(`Line ${i + 1}: Product ID ${productId} not found`);
          failedCount++;
          continue;
        }

        const secretCost = secretCostStr ? parseFloat(secretCostStr) : null;

        // Update only secret_cost in database (public cost comes from BigCommerce)
        await productCostsService.upsertProductCost({
          product_id: productId,
          cost_price: product.cost_price,
          secret_cost: secretCost,
          retail_price: product.retail_price,
          sale_price: null,
          product_name: product.name,
          sku: product.sku
        });

        // Update local state
        setProducts(prevProducts => prevProducts.map(p =>
          p.id === productId
            ? { ...p, secret_cost: secretCost }
            : p
        ));

        successCount++;

        // Log the access
        await supabase.from('cost_admin_audit').insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'bulk_updated_secret_cost',
          product_id: productId,
          accessed_at: new Date().toISOString()
        });
      } catch (err) {
        errors.push(`Line ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        failedCount++;
      }
    }

    setBulkImportResults({ success: successCount, failed: failedCount, errors });

    if (successCount > 0) {
      setSuccessMessage(`Successfully imported ${successCount} cost updates`);
      setTimeout(() => setSuccessMessage(null), 5000);
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
      label: 'Public Cost (from BC)',
      sortable: true,
      className: 'whitespace-nowrap text-right',
      headerClassName: 'text-right',
      render: (product) => (
        <div className="text-sm font-medium text-blue-900" title="This cost comes from BigCommerce and cannot be edited here">
          {product.cost_price ? `$${product.cost_price.toFixed(2)}` : '-'}
        </div>
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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Secret Cost Management</h2>
          <p className="text-sm text-red-600 flex items-center">
            <Eye className="w-4 h-4 mr-1" />
            Confidential: This page contains true acquisition costs
          </p>
        </div>
        <button
          onClick={handleBulkImport}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
        >
          <Upload className="h-5 w-5" />
          <span>Bulk Import</span>
        </button>
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
              <li><strong>Public Cost</strong>: Comes from BigCommerce cost_price field. Synced automatically and shown to all admins for pricing validation.</li>
              <li><strong>Secret Cost</strong>: Your TRUE acquisition cost. Only cost admins can see and edit this. Used for real profit calculations.</li>
              <li><strong>Why have both?</strong>: BigCommerce cost may include markup or be outdated. Secret cost is your actual cost, giving you true profit visibility.</li>
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

      {/* Bulk Import Modal */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsBulkImportOpen(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center space-x-2">
                      <Upload className="h-6 w-6 text-red-600" />
                      <span>Bulk Import Secret Costs</span>
                      <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">ADMIN ONLY</span>
                    </h3>

                    <div className="space-y-4">
                      {/* Instructions */}
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-red-900 mb-2 flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>How to use bulk import (Cost Admin Only):</span>
                        </h4>
                        <ol className="text-sm text-red-800 space-y-1 list-decimal list-inside">
                          <li>Download the CSV template with all products pre-filled</li>
                          <li>Edit ONLY the "Secret Cost" column (Public Cost is from BigCommerce)</li>
                          <li>Public Cost is for reference only - it cannot be changed via import</li>
                          <li>Upload the completed CSV or paste the data below</li>
                          <li>Click "Process Import" to import secret cost updates</li>
                        </ol>
                        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded">
                          <p className="text-xs text-red-900 font-medium flex items-center">
                            <Eye className="inline w-3 h-3 mr-1" />
                            All bulk imports are logged in the cost admin audit trail
                          </p>
                        </div>
                      </div>

                      {/* Template Download */}
                      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">CSV Template</h4>
                          <p className="text-xs text-gray-600">Download with all products and current costs pre-filled</p>
                        </div>
                        <button
                          onClick={handleDownloadTemplate}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download Template</span>
                        </button>
                      </div>

                      {/* File Upload */}
                      <div className="border-2 border-dashed border-red-300 rounded-lg p-6">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                        >
                          <Upload className="h-5 w-5" />
                          <span>Upload CSV File</span>
                        </button>
                      </div>

                      {/* CSV Data Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Or Paste CSV Data Here:
                        </label>
                        <textarea
                          value={bulkImportData}
                          onChange={(e) => setBulkImportData(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-xs"
                          rows={10}
                          placeholder='Product ID,Product Name,SKU,Retail Price,Public Cost,Secret Cost\n123,"Example Product",SKU123,150.00,75.00,60.00'
                        />
                      </div>

                      {/* Import Results */}
                      {(bulkImportResults.success > 0 || bulkImportResults.failed > 0) && (
                        <div className="border rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Import Results</h4>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-green-50 border border-green-200 rounded p-3">
                              <div className="text-2xl font-bold text-green-600">{bulkImportResults.success}</div>
                              <div className="text-xs text-green-700">Successful</div>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded p-3">
                              <div className="text-2xl font-bold text-red-600">{bulkImportResults.failed}</div>
                              <div className="text-xs text-red-700">Failed</div>
                            </div>
                          </div>
                          {bulkImportResults.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                              <h5 className="text-xs font-semibold text-red-900 mb-2">Errors:</h5>
                              <ul className="text-xs text-red-700 space-y-1">
                                {bulkImportResults.errors.map((error, idx) => (
                                  <li key={idx}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={processBulkImport}
                  disabled={!bulkImportData.trim()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Process Import
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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

export default SecretCostManagement;
