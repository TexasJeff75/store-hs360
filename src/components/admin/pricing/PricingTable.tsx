import React, { useState, useMemo } from 'react';
import {
  Building2,
  MapPin,
  User,
  Edit2,
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { EnrichedPricingEntry } from './usePricingData';

type PricingTypeFilter = 'all' | 'organization' | 'individual';
type SortField = 'entity_name' | 'product_id' | 'contract_price' | 'pricing_type' | 'min_quantity' | 'effective_date';
type SortDir = 'asc' | 'desc';

interface PricingTableProps {
  entries: EnrichedPricingEntry[];
  loading: boolean;
  onEdit: (entry: EnrichedPricingEntry) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}

const PAGE_SIZE = 25;

const PricingTable: React.FC<PricingTableProps> = ({
  entries,
  loading,
  onEdit,
  onDelete,
  deleting,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PricingTypeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('entity_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-teal-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-teal-600" />
    );
  };

  const filtered = useMemo(() => {
    let result = [...entries];

    if (typeFilter !== 'all') {
      result = result.filter((e) => e.pricing_type === typeFilter);
    }

    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.entity_name.toLowerCase().includes(term) ||
          (e.entity_detail || '').toLowerCase().includes(term) ||
          String(e.product_id).includes(term)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      const fieldA = a[sortField];
      const fieldB = b[sortField];

      if (fieldA == null) return 1;
      if (fieldB == null) return -1;

      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        cmp = fieldA.localeCompare(fieldB);
      } else if (typeof fieldA === 'number' && typeof fieldB === 'number') {
        cmp = fieldA - fieldB;
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [entries, typeFilter, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const typeCounts = useMemo(() => {
    const counts = { all: entries.length, organization: 0, location: 0, individual: 0 };
    entries.forEach((e) => {
      counts[e.pricing_type]++;
    });
    return counts;
  }, [entries]);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'organization':
        return <Building2 className="h-3.5 w-3.5" />;
      case 'individual':
        return <User className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case 'organization':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'individual':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by entity name, code, or product ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex space-x-1.5">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'organization', label: 'Org' },
              { key: 'individual', label: 'User' },
            ] as { key: PricingTypeFilter; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setTypeFilter(opt.key);
                setPage(0);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                typeFilter === opt.key
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
              <span className="ml-1 text-gray-400">
                {typeCounts[opt.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('pricing_type')}
                    className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                  >
                    <span>Type</span>
                    {sortIcon('pricing_type')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('entity_name')}
                    className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                  >
                    <span>Entity</span>
                    {sortIcon('entity_name')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('product_id')}
                    className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                  >
                    <span>Product ID</span>
                    {sortIcon('product_id')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('contract_price')}
                    className="flex items-center justify-end space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                  >
                    <span>Price</span>
                    {sortIcon('contract_price')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSort('min_quantity')}
                    className="flex items-center justify-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 mx-auto"
                  >
                    <span>Qty Range</span>
                    {sortIcon('min_quantity')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSort('effective_date')}
                    className="flex items-center justify-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 mx-auto"
                  >
                    <span>Dates</span>
                    {sortIcon('effective_date')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((entry) => {
                const hasMarkup = !!(entry as any).markup_price;
                const displayPrice = hasMarkup
                  ? (entry as any).markup_price
                  : entry.contract_price;

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${typeBadgeColor(entry.pricing_type)}`}
                      >
                        {typeIcon(entry.pricing_type)}
                        <span className="capitalize">{entry.pricing_type}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {entry.entity_name}
                      </div>
                      {entry.entity_detail && (
                        <div className="text-xs text-gray-500">
                          {entry.entity_detail}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                      {entry.product_id}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-900">
                          {displayPrice != null ? displayPrice.toFixed(2) : '-'}
                        </span>
                      </div>
                      {hasMarkup && (
                        <span className="text-xs text-amber-600">markup</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {entry.min_quantity && entry.max_quantity
                        ? `${entry.min_quantity}-${entry.max_quantity}`
                        : entry.min_quantity
                        ? `${entry.min_quantity}+`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-xs text-gray-500">
                        {entry.effective_date
                          ? new Date(entry.effective_date).toLocaleDateString()
                          : '-'}
                      </div>
                      {entry.expiry_date && (
                        <div className="text-xs text-red-500">
                          Exp: {new Date(entry.expiry_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => onEdit(entry)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleting}
                          className={`p-1.5 rounded-lg transition-colors ${
                            confirmDeleteId === entry.id
                              ? 'text-white bg-red-500 hover:bg-red-600'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={
                            confirmDeleteId === entry.id
                              ? 'Click again to confirm'
                              : 'Delete'
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              No pricing entries found
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {search || typeFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Add your first contract price to get started.'}
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-gray-700 font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingTable;
