import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileSpreadsheet, Download, AlertTriangle, CheckCircle, Loader, Info } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { contractPricingService } from '@/services/contractPricing';

interface ContractPricingImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'complete';

interface ImportRow {
  rowNum: number;
  pricing_type: 'organization' | 'individual';
  entity_identifier: string; // name, code, or email
  entity_id?: string; // resolved after lookup
  entity_display?: string; // resolved display name
  product_id: number;
  contract_price?: number;
  markup_price?: number;
  min_quantity: number;
  max_quantity?: number;
  effective_date?: string;
  expiry_date?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ValidationError[];
}

type EntityMap = Map<string, { id: string; display: string }>;

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function normalizeHeader(h: string): string {
  const map: Record<string, string> = {
    type: 'pricing_type',
    pricing_type: 'pricing_type',
    entity: 'entity',
    entity_name: 'entity',
    entity_identifier: 'entity',
    organization: 'entity',
    user: 'entity',
    email: 'entity',
    product_id: 'product_id',
    product: 'product_id',
    contract_price: 'contract_price',
    price: 'contract_price',
    markup_price: 'markup_price',
    markup: 'markup_price',
    min_qty: 'min_quantity',
    min_quantity: 'min_quantity',
    max_qty: 'max_quantity',
    max_quantity: 'max_quantity',
    effective_date: 'effective_date',
    start_date: 'effective_date',
    expiry_date: 'expiry_date',
    end_date: 'expiry_date',
  };
  return map[h] || h;
}

const ContractPricingImport: React.FC<ContractPricingImportProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [resolving, setResolving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setValidationErrors([]);
    setImportResult(null);
    setProgress({ current: 0, total: 0 });
    setDragOver(false);
    setResolving(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const buildEntityMaps = async (): Promise<{
    orgMap: EntityMap;
    userMap: EntityMap;
  }> => {
    const [orgsRes, usersRes] = await Promise.all([
      supabase.from('organizations').select('id, name, code').eq('is_active', true),
      supabase.from('profiles').select('id, email, full_name').eq('approved', true),
    ]);

    const orgMap: EntityMap = new Map();
    for (const o of orgsRes.data || []) {
      orgMap.set(o.name.toLowerCase(), { id: o.id, display: o.name });
      if (o.code) orgMap.set(o.code.toLowerCase(), { id: o.id, display: o.name });
      orgMap.set(o.id.toLowerCase(), { id: o.id, display: o.name });
    }

    const userMap: EntityMap = new Map();
    for (const u of usersRes.data || []) {
      userMap.set(u.email.toLowerCase(), { id: u.id, display: u.email });
      if (u.full_name) userMap.set(u.full_name.toLowerCase(), { id: u.id, display: u.email });
      userMap.set(u.id.toLowerCase(), { id: u.id, display: u.email });
    }

    return { orgMap, userMap };
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setValidationErrors([{ row: 0, field: 'file', message: 'Please upload a CSV file.' }]);
      return;
    }
    setFileName(file.name);
    setResolving(true);

    const text = await file.text();
    const { headers, rows: rawRows } = parseCSV(text);

    if (headers.length === 0) {
      setValidationErrors([{ row: 0, field: 'file', message: 'File is empty.' }]);
      setResolving(false);
      return;
    }

    const normalized = headers.map(normalizeHeader);
    const colIdx = (name: string) => normalized.indexOf(name);

    const typeIdx = colIdx('pricing_type');
    const entityIdx = colIdx('entity');
    const productIdx = colIdx('product_id');
    const priceIdx = colIdx('contract_price');
    const markupIdx = colIdx('markup_price');
    const minQtyIdx = colIdx('min_quantity');
    const maxQtyIdx = colIdx('max_quantity');
    const effDateIdx = colIdx('effective_date');
    const expDateIdx = colIdx('expiry_date');

    const errors: ValidationError[] = [];

    if (typeIdx === -1) errors.push({ row: 0, field: 'header', message: 'Missing required column: pricing_type (or "Type")' });
    if (entityIdx === -1) errors.push({ row: 0, field: 'header', message: 'Missing required column: entity (or "Entity", "Organization", "Email")' });
    if (productIdx === -1) errors.push({ row: 0, field: 'header', message: 'Missing required column: product_id (or "Product ID")' });
    if (priceIdx === -1 && markupIdx === -1) errors.push({ row: 0, field: 'header', message: 'Must have at least one of: contract_price, markup_price' });

    if (errors.length > 0) {
      setValidationErrors(errors);
      setResolving(false);
      setStep('preview');
      return;
    }

    // Build entity lookup maps
    const { orgMap, userMap } = await buildEntityMaps();

    const parsed: ImportRow[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // 1-based, skip header

      const rawType = (row[typeIdx] || '').toLowerCase().trim();
      const pricingType = rawType === 'org' ? 'organization' : rawType as ImportRow['pricing_type'];
      if (!['organization', 'individual'].includes(pricingType)) {
        errors.push({ row: rowNum, field: 'pricing_type', message: `Invalid type "${row[typeIdx]}". Must be organization or individual.` });
        continue;
      }

      const entityVal = (row[entityIdx] || '').trim();
      if (!entityVal) {
        errors.push({ row: rowNum, field: 'entity', message: 'Entity is required.' });
        continue;
      }

      const productIdRaw = row[productIdx];
      const productId = parseInt(productIdRaw, 10);
      if (isNaN(productId) || productId <= 0) {
        errors.push({ row: rowNum, field: 'product_id', message: `Invalid product ID "${productIdRaw}".` });
        continue;
      }

      const contractPrice = priceIdx !== -1 && row[priceIdx] ? parseFloat(row[priceIdx]) : undefined;
      const markupPrice = markupIdx !== -1 && row[markupIdx] ? parseFloat(row[markupIdx]) : undefined;

      if (contractPrice === undefined && markupPrice === undefined) {
        errors.push({ row: rowNum, field: 'price', message: 'Either contract_price or markup_price is required.' });
        continue;
      }
      if (contractPrice !== undefined && isNaN(contractPrice)) {
        errors.push({ row: rowNum, field: 'contract_price', message: `Invalid contract price "${row[priceIdx]}".` });
        continue;
      }
      if (markupPrice !== undefined && isNaN(markupPrice)) {
        errors.push({ row: rowNum, field: 'markup_price', message: `Invalid markup price "${row[markupIdx]}".` });
        continue;
      }

      const minQty = minQtyIdx !== -1 && row[minQtyIdx] ? parseInt(row[minQtyIdx], 10) : 1;
      const maxQty = maxQtyIdx !== -1 && row[maxQtyIdx] ? parseInt(row[maxQtyIdx], 10) : undefined;

      const effectiveDate = effDateIdx !== -1 && row[effDateIdx] ? row[effDateIdx] : undefined;
      const expiryDate = expDateIdx !== -1 && row[expDateIdx] ? row[expDateIdx] : undefined;

      // Resolve entity
      const lookupKey = entityVal.toLowerCase();
      let resolved: { id: string; display: string } | undefined;
      if (pricingType === 'organization') resolved = orgMap.get(lookupKey);
      else resolved = userMap.get(lookupKey);

      if (!resolved) {
        errors.push({ row: rowNum, field: 'entity', message: `Could not find ${pricingType} "${entityVal}". Check name, code, or ID.` });
        continue;
      }

      parsed.push({
        rowNum,
        pricing_type: pricingType,
        entity_identifier: entityVal,
        entity_id: resolved.id,
        entity_display: resolved.display,
        product_id: productId,
        contract_price: contractPrice,
        markup_price: markupPrice,
        min_quantity: minQty,
        max_quantity: maxQty,
        effective_date: effectiveDate,
        expiry_date: expiryDate,
      });
    }

    setParsedRows(parsed);
    setValidationErrors(errors);
    setResolving(false);
    setStep('preview');
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
    const total = parsedRows.length;
    let created = 0;
    let skipped = 0;
    const importErrors: ValidationError[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      setProgress({ current: i + 1, total });

      const result = await contractPricingService.setContractPrice(
        row.entity_id!,
        row.product_id,
        row.contract_price,
        row.pricing_type,
        row.min_quantity,
        row.max_quantity,
        row.effective_date ? new Date(row.effective_date).toISOString() : undefined,
        row.expiry_date ? new Date(row.expiry_date).toISOString() : undefined,
        row.markup_price
      );

      if (result.success) {
        created++;
      } else {
        importErrors.push({
          row: row.rowNum,
          field: 'import',
          message: result.error || 'Failed to save',
        });
        skipped++;
      }
    }

    setImportResult({ totalRows: total, created, updated: 0, skipped, errors: importErrors });
    setStep('complete');
    if (created > 0) onImportComplete();
  };

  const handleDownloadTemplate = () => {
    const headers = ['Type', 'Entity', 'Product ID', 'Contract Price', 'Markup Price', 'Min Qty', 'Max Qty', 'Effective Date', 'Expiry Date'];
    const example1 = ['organization', 'Acme Corp', '1001', '49.99', '', '1', '', '', ''];
    const example2 = ['individual', 'user@example.com', '1002', '', '59.99', '1', '', '2026-01-01', '2026-12-31'];

    const csv = [headers, example1, example2]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contract-pricing-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const hasBlockingErrors = validationErrors.some(e => e.row === 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={e => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">Import Contract Pricing</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {(step === 'upload' || resolving) && (
            <div className="space-y-6">
              <div className="flex items-start space-x-3 bg-teal-50 rounded-lg p-4">
                <Info className="h-5 w-5 text-teal-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-teal-800">
                  <p className="font-medium mb-1">CSV Format</p>
                  <p>
                    Required columns: <span className="font-medium">Type</span> (organization, individual),{' '}
                    <span className="font-medium">Entity</span> (name, code, or email),{' '}
                    <span className="font-medium">Product ID</span>, and at least one of{' '}
                    <span className="font-medium">Contract Price</span> or <span className="font-medium">Markup Price</span>.
                  </p>
                  <p className="mt-1">
                    Optional: Min Qty, Max Qty, Effective Date, Expiry Date.
                  </p>
                  <p className="mt-1">
                    Entities are matched by name, code, or UUID. Use the <span className="font-medium">Export</span> button
                    on the pricing page to get a CSV of existing entries as a starting point.
                  </p>
                </div>
              </div>

              {resolving ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <Loader className="h-8 w-8 text-teal-600 animate-spin" />
                  <p className="text-sm text-gray-600">Reading file and resolving entities...</p>
                </div>
              ) : (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <Upload className={`mx-auto h-10 w-10 mb-3 ${dragOver ? 'text-teal-500' : 'text-gray-400'}`} />
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

                  <button
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{fileName}</span> — {parsedRows.length} pricing rule{parsedRows.length !== 1 ? 's' : ''} found
                </p>
                <button
                  onClick={reset}
                  className="text-sm text-teal-600 hover:text-teal-800 font-medium"
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
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Entity</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Product ID</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Contract $</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Markup $</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Min Qty</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Max Qty</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Effective</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Expiry</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.slice(0, 100).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500">{row.rowNum}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                row.pricing_type === 'organization'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {row.pricing_type}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate">
                              {row.entity_display || row.entity_identifier}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-900">{row.product_id}</td>
                            <td className="px-3 py-2 text-right text-gray-900">
                              {row.contract_price !== undefined ? `$${row.contract_price.toFixed(2)}` : '--'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {row.markup_price !== undefined ? `$${row.markup_price.toFixed(2)}` : '--'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">{row.min_quantity}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{row.max_quantity ?? '--'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.effective_date || '--'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.expiry_date || '--'}</td>
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
              <Loader className="h-10 w-10 text-teal-600 animate-spin" />
              <p className="text-sm font-medium text-gray-700">
                Importing pricing rules... {progress.current} / {progress.total}
              </p>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                <div
                  className="bg-teal-600 h-2 rounded-full transition-all duration-300"
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

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
                  <p className="text-xs text-green-600 font-medium">Saved</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{importResult.skipped}</p>
                  <p className="text-xs text-gray-600 font-medium">Skipped</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{importResult.errors.length}</p>
                  <p className="text-xs text-red-600 font-medium">Errors</p>
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
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {step === 'upload' && !resolving && (
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
                className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import {parsedRows.length} Rule{parsedRows.length !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              onClick={handleClose}
              className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractPricingImport;
