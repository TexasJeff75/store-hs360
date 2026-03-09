import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  DollarSign,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number;
}

interface WholesalePrice {
  id: string;
  distributor_id: string;
  product_id: number;
  wholesale_price: number;
  is_active: boolean;
  notes?: string;
}

interface WholesalePricingGridProps {
  products: Product[];
  pricing: WholesalePrice[];
  distributorId: string;
  onRefresh: () => void;
}

const PAGE_SIZE = 50;

const WholesalePricingGrid: React.FC<WholesalePricingGridProps> = ({
  products,
  pricing,
  distributorId,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ productId: number; msg: string } | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pricingMap = useMemo(() => {
    const map = new Map<number, WholesalePrice>();
    pricing.forEach((p) => map.set(p.product_id, p));
    return map;
  }, [pricing]);

  const filtered = useMemo(() => {
    if (!search) return products;
    const term = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        String(p.id).includes(term),
    );
  }, [products, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (editingProductId !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingProductId]);

  const startEdit = (productId: number) => {
    const existing = pricingMap.get(productId);
    setEditValue(existing ? String(existing.wholesale_price) : '');
    setEditingProductId(productId);
    setRowError(null);
  };

  const cancelEdit = () => {
    setEditingProductId(null);
    setEditValue('');
    setRowError(null);
  };

  const saveEdit = async (productId: number) => {
    const trimmed = editValue.trim();
    if (trimmed === '') {
      const existing = pricingMap.get(productId);
      if (existing) {
        setConfirmDeleteId(existing.id);
      }
      cancelEdit();
      return;
    }

    const price = parseFloat(trimmed);
    if (isNaN(price) || price < 0) {
      setRowError({ productId, msg: 'Enter a valid price' });
      return;
    }

    setSavingRow(productId);
    const { error } = await supabase
      .from('distributor_product_pricing')
      .upsert(
        {
          distributor_id: distributorId,
          product_id: productId,
          wholesale_price: price,
          is_active: true,
        },
        { onConflict: 'distributor_id,product_id' },
      );
    setSavingRow(null);

    if (!error) {
      cancelEdit();
      onRefresh();
    } else {
      setRowError({ productId, msg: error.message || 'Save failed' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, productId: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(productId);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId === id) {
      await supabase.from('distributor_product_pricing').delete().eq('id', id);
      setConfirmDeleteId(null);
      onRefresh();
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <DollarSign className="mx-auto h-8 w-8 text-gray-300 mb-2" />
        <p className="text-sm">No products found.</p>
      </div>
    );
  }

  const coveredCount = filtered.filter((p) => pricingMap.has(p.id)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or product ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {coveredCount} / {filtered.length} priced
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Retail</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Wholesale Price</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((product) => {
                const existing = pricingMap.get(product.id);
                const isEditing = editingProductId === product.id;
                const isSavingThis = savingRow === product.id;
                const hasPrice = existing != null;
                const err = rowError?.productId === product.id ? rowError.msg : null;

                return (
                  <tr
                    key={product.id}
                    className={`transition-colors ${isEditing ? 'bg-emerald-50' : hasPrice ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-80'}`}
                  >
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{product.id}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{product.sku || '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-sm font-medium text-gray-900">{product.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-gray-500">
                      ${product.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 text-sm">$</span>
                          <input
                            ref={inputRef}
                            type="number"
                            step="0.01"
                            min="0"
                            value={editValue}
                            onChange={(e) => { setEditValue(e.target.value); setRowError(null); }}
                            onKeyDown={(e) => handleKeyDown(e, product.id)}
                            onBlur={() => saveEdit(product.id)}
                            className={`w-24 px-2 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${err ? 'border-red-400' : 'border-emerald-400'}`}
                            placeholder="0.00"
                          />
                          {isSavingThis ? (
                            <div className="h-4 w-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin ml-1" />
                          ) : (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); saveEdit(product.id); }}
                              className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(product.id)}
                          className={`group flex items-center justify-end gap-1.5 w-full text-right px-2 py-1 rounded hover:bg-emerald-50 transition-colors ${hasPrice ? 'text-gray-900 font-semibold' : 'text-gray-300 italic'}`}
                          title="Click to set price"
                        >
                          {hasPrice ? (
                            <>
                              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-sm">{existing!.wholesale_price.toFixed(2)}</span>
                              <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 group-hover:text-emerald-600">+ set price</span>
                          )}
                        </button>
                      )}
                      {err && (
                        <p className="text-xs text-red-500 text-right mt-0.5">{err}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {existing && (
                        <button
                          onClick={() => handleDelete(existing.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            confirmDeleteId === existing.id
                              ? 'text-white bg-red-500 hover:bg-red-600'
                              : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={confirmDeleteId === existing.id ? 'Click again to confirm' : 'Remove price'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} products
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-gray-700 font-medium">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WholesalePricingGrid;
