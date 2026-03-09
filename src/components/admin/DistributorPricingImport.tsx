import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Loader,
  ChevronRight,
  Download,
} from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number;
}

interface ExistingPricing {
  id: string;
  product_id: number;
  wholesale_price: number;
  notes: string | null;
}

interface ImportRow {
  product_id: number;
  product_name: string;
  sku: string | null;
  wholesale_price: number;
  notes: string | null;
  rowIndex: number;
  existingPriceId?: string;
  currentPrice?: number;
  error?: string;
}

interface DistributorPricingImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  distributorId: string;
  distributorName: string;
  products: Product[];
  existingPricing: ExistingPricing[];
}

type Step = 'upload' | 'preview' | 'importing' | 'complete';

const DistributorPricingImport: React.FC<DistributorPricingImportProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  distributorId,
  distributorName,
  products,
  existingPricing,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productMap = useMemo(() => {
    const map = new Map<number, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const skuMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => {
      if (p.sku) map.set(p.sku.toLowerCase(), p);
    });
    return map;
  }, [products]);

  const existingPriceMap = useMemo(() => {
    const map = new Map<number, ExistingPricing>();
    existingPricing.forEach((ep) => map.set(ep.product_id, ep));
    return map;
  }, [existingPricing]);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setParseError(null);
    setProgress({ current: 0, total: 0 });
    setImportErrors([]);
    setImportedCount(0);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const headers = ['product_id', 'sku', 'product_name', 'retail_price', 'wholesale_price', 'notes'];
    const rows = products.map((p) => {
      const existing = existingPriceMap.get(p.id);
      return [
        p.id,
        p.sku ?? '',
        `"${p.name.replace(/"/g, '""')}"`,
        p.price.toFixed(2),
        existing ? existing.wholesale_price.toFixed(2) : '',
        existing?.notes ? `"${existing.notes.replace(/"/g, '""')}"` : '',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = distributorName.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'distributor';
    a.download = `wholesale-pricing-template-${safeName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSVText = (text: string): ImportRow[] => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

    const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
    const skuIdx = headers.findIndex((h) => ['sku', 'product_sku'].includes(h));
    const idIdx = headers.findIndex((h) => ['product_id', 'id', 'productid'].includes(h));
    const priceIdx = headers.findIndex((h) => ['wholesale_price', 'price', 'cost', 'wholesale_cost', 'wholesale'].includes(h));
    const notesIdx = headers.findIndex((h) => ['notes', 'note'].includes(h));

    if (priceIdx === -1) throw new Error('Missing required column: wholesale_price (or price/cost)');
    if (skuIdx === -1 && idIdx === -1) throw new Error('Missing required column: sku or product_id');

    const rows: ImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      const priceStr = cols[priceIdx] || '';
      const price = parseFloat(priceStr);
      const notes = notesIdx !== -1 ? cols[notesIdx] || null : null;

      // Resolve product by ID or SKU
      let product: Product | undefined;
      let resolvedBy = '';

      if (idIdx !== -1 && cols[idIdx]) {
        const pid = parseInt(cols[idIdx], 10);
        if (!isNaN(pid)) {
          product = productMap.get(pid);
          resolvedBy = `ID ${pid}`;
        }
      }

      if (!product && skuIdx !== -1 && cols[skuIdx]) {
        const sku = cols[skuIdx].toLowerCase();
        product = skuMap.get(sku);
        resolvedBy = `SKU "${cols[skuIdx]}"`;
      }

      // Skip completely blank rows
      if (!product && !cols[idIdx] && (!cols[skuIdx] || cols[skuIdx] === '')) continue;

      const existing = product ? existingPriceMap.get(product.id) : undefined;

      const row: ImportRow = {
        product_id: product?.id || 0,
        product_name: product?.name || `Unknown (${resolvedBy})`,
        sku: product?.sku || null,
        wholesale_price: price,
        notes,
        rowIndex: i,
        existingPriceId: existing?.id,
        currentPrice: existing?.wholesale_price,
      };

      if (!product) {
        row.error = `Product not found (${resolvedBy || 'no identifier'})`;
      } else if (priceStr === '' || isNaN(price) || price < 0) {
        row.error = 'Invalid price';
      }

      rows.push(row);
    }

    if (rows.length === 0) throw new Error('No valid rows found in CSV.');
    return rows;
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file.');
      return;
    }
    setFileName(file.name);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSVText(text);
        setParsedRows(rows);
        setStep('preview');
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse CSV.');
      }
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

  const validRows = parsedRows.filter((r) => !r.error);
  const newRows = validRows.filter((r) => !r.existingPriceId);
  const updateRows = validRows.filter((r) => r.existingPriceId);

  const handleImport = async () => {
    setStep('importing');
    setProgress({ current: 0, total: validRows.length });
    const errors: string[] = [];
    let successCount = 0;

    // Batch upsert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      const payload = chunk.map((r) => ({
        distributor_id: distributorId,
        product_id: r.product_id,
        wholesale_price: r.wholesale_price,
        notes: r.notes,
        is_active: true,
      }));

      const { error: upsertError } = await supabase
        .from('distributor_product_pricing')
        .upsert(payload, { onConflict: 'distributor_id,product_id' });

      if (upsertError) {
        chunk.forEach((r) => {
          errors.push(`Product ${r.product_id} (${r.product_name}): ${upsertError.message}`);
        });
      } else {
        successCount += chunk.length;
      }

      setProgress({ current: Math.min(i + chunkSize, validRows.length), total: validRows.length });
    }

    setImportedCount(successCount);
    setImportErrors(errors);
    setStep('complete');
    onImportComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Import Wholesale Pricing</h3>
              <p className="text-xs text-gray-500">{distributorName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload a CSV with columns <code className="bg-gray-100 px-1 rounded">sku</code> (or{' '}
                <code className="bg-gray-100 px-1 rounded">product_id</code>) and{' '}
                <code className="bg-gray-100 px-1 rounded">wholesale_price</code>. Optional:{' '}
                <code className="bg-gray-100 px-1 rounded">notes</code>.
              </p>

              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Template
              </button>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
                }`}
              >
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">Drop CSV here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">.csv files only</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{fileName}</span> — {parsedRows.length} rows found,{' '}
                  <span className="text-green-600 font-medium">{validRows.length} valid</span>
                  {parsedRows.length - validRows.length > 0 && (
                    <span className="text-red-600 font-medium">, {parsedRows.length - validRows.length} with errors</span>
                  )}
                </p>
              </div>

              <div className="flex gap-3 text-xs">
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium">{newRows.length} new</span>
                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md font-medium">{updateRows.length} updates</span>
                {parsedRows.length - validRows.length > 0 && (
                  <span className="px-2 py-1 bg-red-50 text-red-700 rounded-md font-medium">{parsedRows.length - validRows.length} errors</span>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Current</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">New Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRows.map((row) => (
                      <tr key={row.rowIndex} className={row.error ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 text-gray-800">{row.product_name}</td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{row.sku || '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {row.currentPrice != null ? `$${row.currentPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">
                          {!row.error ? `$${row.wholesale_price.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-2">
                          {row.error ? (
                            <span className="text-xs text-red-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {row.error}
                            </span>
                          ) : row.existingPriceId ? (
                            <span className="text-xs text-amber-600">Update</span>
                          ) : (
                            <span className="text-xs text-green-600">New</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validRows.length === 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  No valid rows to import. Please fix your CSV and try again.
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader className="h-8 w-8 text-emerald-600 animate-spin" />
              <p className="text-sm font-medium text-gray-700">
                Importing {progress.current} / {progress.total}...
              </p>
              <div className="w-64 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">Import complete</p>
                  <p className="text-sm text-gray-500">
                    {importedCount} of {validRows.length} wholesale prices saved successfully.
                  </p>
                </div>
              </div>
              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-red-700">{importErrors.length} errors:</p>
                  {importErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          {step === 'upload' && (
            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={reset} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import {validRows.length} Prices
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          {step === 'complete' && (
            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DistributorPricingImport;
