import React, { useState } from 'react';
import { DollarSign, Plus, RefreshCw, Download, Upload } from 'lucide-react';
import { usePricingData, EnrichedPricingEntry } from './pricing/usePricingData';
import PricingTable from './pricing/PricingTable';
import PricingForm from './pricing/PricingForm';
import ContractPricingImport from './pricing/ContractPricingImport';

interface PricingManagementProps {
  organizationId?: string;
}

const PricingManagement: React.FC<PricingManagementProps> = () => {
  const {
    entries,
    loading,
    error,
    saving,
    organizations,
    locations,
    users,
    fetchPricingData,
    savePricing,
    deletePricing,
  } = usePricingData();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<EnrichedPricingEntry | null>(null);

  const handleAdd = () => {
    setEditEntry(null);
    setIsFormOpen(true);
  };

  const handleEdit = (entry: EnrichedPricingEntry) => {
    setEditEntry(entry);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditEntry(null);
  };

  const handleExportCSV = () => {
    if (entries.length === 0) return;

    const headers = [
      'Type',
      'Entity',
      'Product ID',
      'Contract Price',
      'Markup Price',
      'Min Qty',
      'Max Qty',
      'Effective Date',
      'Expiry Date',
    ];

    const rows = entries.map((e) => [
      e.pricing_type,
      e.entity_name,
      e.product_id,
      e.contract_price || '',
      (e as any).markup_price || '',
      e.min_quantity || '',
      e.max_quantity || '',
      e.effective_date ? new Date(e.effective_date).toLocaleDateString() : '',
      e.expiry_date ? new Date(e.expiry_date).toLocaleDateString() : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-pricing-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-teal-50 rounded-xl">
            <DollarSign className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Contract Pricing</h2>
            <p className="text-sm text-gray-500">
              Manage pricing rules for organizations, locations, and individual users
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Import
          </button>
          <button
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </button>
          <button
            onClick={fetchPricingData}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Price
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Total Rules
          </div>
          <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Organizations
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {entries.filter((e) => e.pricing_type === 'organization').length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Products Covered
          </div>
          <div className="text-2xl font-bold text-sky-600">
            {new Set(entries.map((e) => e.product_id)).size}
          </div>
        </div>
      </div>

      <PricingTable
        entries={entries}
        loading={loading}
        onEdit={handleEdit}
        onDelete={deletePricing}
        deleting={saving}
      />

      <PricingForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSave={savePricing}
        saving={saving}
        organizations={organizations}
        locations={locations}
        users={users}
        editEntry={editEntry}
      />

      <ContractPricingImport
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={fetchPricingData}
      />
    </div>
  );
};

export default PricingManagement;
