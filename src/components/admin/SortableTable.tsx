import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (item: T) => React.ReactNode;
  sortFn?: (a: T, b: T) => number;
  filterFn?: (item: T, filterValue: string) => boolean;
  className?: string;
  headerClassName?: string;
}

interface SortableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  searchPlaceholder?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

function SortableTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data found',
  emptyIcon,
  searchPlaceholder = 'Search...',
  className = ''
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortKey(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply global search
    if (searchTerm) {
      result = result.filter(item => {
        return columns.some(column => {
          const value = (item as any)[column.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        const column = columns.find(c => c.key === key);
        if (column) {
          if (column.filterFn) {
            result = result.filter(item => column.filterFn!(item, filterValue));
          } else {
            result = result.filter(item => {
              const value = (item as any)[key];
              if (value === null || value === undefined) return false;
              return String(value).toLowerCase().includes(filterValue.toLowerCase());
            });
          }
        }
      }
    });

    // Apply sorting
    if (sortKey && sortDirection) {
      const column = columns.find(c => c.key === sortKey);
      result.sort((a, b) => {
        if (column?.sortFn) {
          return sortDirection === 'asc' ? column.sortFn(a, b) : column.sortFn(b, a);
        }

        const aValue = (a as any)[sortKey];
        const bValue = (b as any)[sortKey];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });
    }

    return result;
  }, [data, columns, searchTerm, columnFilters, sortKey, sortDirection]);

  const getSortIcon = (columnKey: string) => {
    if (sortKey !== columnKey || !sortDirection) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-blue-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-blue-600" />
    );
  };

  return (
    <div className={className}>
      {/* Global Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.headerClassName || ''}`}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{column.label}</span>
                      {column.sortable !== false && (
                        <button
                          onClick={() => handleSort(column.key)}
                          className="hover:bg-gray-200 rounded p-1 transition-colors"
                          title="Sort"
                        >
                          {getSortIcon(column.key)}
                        </button>
                      )}
                    </div>
                    {column.filterable && (
                      <div className="mt-2">
                        <div className="relative">
                          <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={columnFilters[column.key] || ''}
                            onChange={(e) => handleColumnFilter(column.key, e.target.value)}
                            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 ${column.className || ''}`}
                    >
                      {column.render
                        ? column.render(item)
                        : String((item as any)[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-12">
            {emptyIcon || <Search className="mx-auto h-12 w-12 text-gray-400" />}
            <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || Object.values(columnFilters).some(v => v)
                ? 'Try adjusting your search or filters.'
                : emptyMessage}
            </p>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {data.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredAndSortedData.length} of {data.length} items
        </div>
      )}
    </div>
  );
}

export default SortableTable;
