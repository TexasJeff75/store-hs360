import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileSpreadsheet, Download, AlertTriangle, CheckCircle, Loader, Info } from 'lucide-react';
import {
  parseCSV,
  validateImportData,
  importProducts,
  generateTemplate,
  exportProductsCSV,
  type ImportRow,
  type ImportValidationError,
  type ImportResult,
} from '@/services/productImportService';
import { Product } from '@/services/productService';
import { SecretCostMap } from '@/services/secretCostService';

interface ProductImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  products: Product[];
  secretCosts?: SecretCostMap;
}

type Step = 'upload' | 'preview' | 'importing' | 'complete';

const ProductImport: React.FC<ProductImportProps> = ({ isOpen, onClose, onImportComplete, products, secretCosts }) => {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ImportValidationError[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setValidationErrors([]);
    setImportResult(null);
    setProgress({ current: 0, total: 0 });
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setValidationErrors([{ row: 0, field: 'file', message: 'Please upload a CSV file.' }]);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      const { parsedRows: validated, errors } = validateImportData(headers, rows);
      setParsedRows(validated);
      setValidationErrors(errors);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    setStep('importing');
    const result = await importProducts(parsedRows, (current, total) => {
      setProgress({ current, total });
    });
    setImportResult(result);
    setStep('complete');
    if (result.created > 0 || result.updated > 0) {
      onImportComplete();
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCurrent = () => {
    const exportData = products.map(p => ({
      name: p.name,
      sku: p.sku,
      price: p.price,
      cost: p.cost,
      original_price: p.originalPrice,
      category: p.category !== 'Uncategorized' ? p.category : undefined,
      brand: p.brand,
      description: p.plainTextDescription,
      condition: p.condition,
      weight: p.weight,
      weight_unit: p.weightUnit,
      is_in_stock: p.isInStock,
      is_active: p.isActive,
      image_url: p.image || undefined,
      extended_description: p.extendedDescription,
      reference_1: p.reference1,
      reference_2: p.reference2,
      reference_3: p.reference3,
      secret_cost: secretCosts?.[p.id]?.secret_cost,
    }));
    const csv = exportProductsCSV(exportData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const hasBlockingErrors = validationErrors.some(e => e.row === 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={e => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Import Products</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="flex items-start space-x-3 bg-blue-50 rounded-lg p-4">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">CSV Format</p>
                  <p>
                    Required columns: <span className="font-medium">name, price</span>.
                    Optional: sku, cost, original_price, category, brand, description, condition, weight, weight_unit,
                    is_in_stock, is_active, image_url, secret_cost, contract_price, pricing_type, entity_id.
                  </p>
                  <p className="mt-1">
                    Existing products are matched by SKU first, then by name. Matched products will be updated.
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">Images:</span> For image_url, use a full URL or just a filename
                    (e.g. <code className="bg-blue-100 px-1 py-0.5 rounded text-xs font-mono">my-product.jpg</code>)
                    from the Image Library.
                  </p>
                </div>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <Upload className={`mx-auto h-10 w-10 mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="text-sm font-medium text-gray-700">
                  Drop your CSV file here, or click to browse
                </p>
                <p className="text-xs text-gray-500 mt-1">CSV files only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </button>
                {products.length > 0 && (
                  <button
                    onClick={handleExportCurrent}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Current Products
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{fileName}</span> -- {parsedRows.length} product{parsedRows.length !== 1 ? 's' : ''} found
                </p>
                <button
                  onClick={reset}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Choose Different File
                </button>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <h4 className="text-sm font-semibold text-red-800">
                      {validationErrors.length} Validation Error{validationErrors.length !== 1 ? 's' : ''}
                    </h4>
                  </div>
                  <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                    {validationErrors.map((err, i) => (
                      <li key={i}>
                        {err.row > 0 ? `Row ${err.row}` : 'File'} ({err.field}): {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-80">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">SKU</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Price</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Cost</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Brand</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-600">Active</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Secret Cost</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Contract $</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.slice(0, 100).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate">{row.name}</td>
                            <td className="px-3 py-2 text-gray-600">{row.sku || '--'}</td>
                            <td className="px-3 py-2 text-right text-gray-900">${row.price.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{row.cost !== undefined ? `$${row.cost.toFixed(2)}` : '--'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.category || '--'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.brand || '--'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block w-2 h-2 rounded-full ${row.is_active !== false ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {row.secret_cost !== undefined ? `$${row.secret_cost.toFixed(2)}` : '--'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {row.contract_price !== undefined ? `$${row.contract_price.toFixed(2)}` : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedRows.length > 100 && (
                      <p className="text-xs text-gray-500 text-center py-2">
                        Showing first 100 of {parsedRows.length} rows
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader className="h-10 w-10 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-gray-700">
                Importing products... {progress.current} / {progress.total}
              </p>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {step === 'complete' && importResult && (
            <div className="space-y-5">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Import Complete</h3>
                  <p className="text-sm text-gray-600">Processed {importResult.totalRows} rows</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
                  <p className="text-xs text-green-600 font-medium">Created</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
                  <p className="text-xs text-blue-600 font-medium">Updated</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{importResult.skipped}</p>
                  <p className="text-xs text-gray-600 font-medium">Skipped</p>
                </div>
                <div className="bg-teal-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-teal-700">{importResult.pricingCreated}</p>
                  <p className="text-xs text-teal-600 font-medium">Pricing Set</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">
                    {importResult.errors.length} Error{importResult.errors.length !== 1 ? 's' : ''}
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>
                        Row {err.row} ({err.field}): {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {step === 'upload' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || hasBlockingErrors}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import {parsedRows.length} Product{parsedRows.length !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              onClick={handleClose}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductImport;
