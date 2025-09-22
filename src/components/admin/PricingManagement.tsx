import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit, Trash2, Search, User, Building2, MapPin } from 'lucide-react';
import { contractPricingService } from '@/services/contractPricing';
import { multiTenantService } from '@/services/multiTenant';
import { bigCommerceService } from '@/services/bigcommerce';
import type { ContractPrice } from '@/services/contractPricing';
import type { Organization, Location, Profile } from '@/services/supabase';

interface PricingEntry {
  id: string;
  type: 'individual' | 'organization' | 'location';
  entityId: string;
  entityName: string;
  productId: number;
  productName: string;
  contractPrice: number;
  regularPrice: number;
  savings: number;
  createdAt: string;
}

interface PricingManagementProps {
  organizationId?: string;
}

const PricingManagement: React.FC<PricingManagementProps> = ({ organizationId }) => {
  const [pricingEntries, setPricingEntries] = useState<PricingEntry[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Partial<PricingEntry> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all required data
      const [productsData, orgsData] = await Promise.all([
        bigCommerceService.getProducts(),
        multiTenantService.getOrganizations()
      ]);

      setProducts(productsData.products);
      
      if (organizationId) {
        // Filter organizations to only the selected one
        setOrganizations(orgsData.filter(org => org.id === organizationId));
        // Fetch locations for this organization only
        const locationsData = await multiTenantService.getLocations(organizationId);
        setLocations(locationsData);
      } else {
        setOrganizations(orgsData);
        const locationsData = await multiTenantService.getLocations();
        setLocations(locationsData);
      }

      // For now, we'll focus on individual contract pricing
      // TODO: Implement organization and location pricing fetching
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePricing = () => {
    setSelectedEntry({
      type: organizationId ? 'organization' : 'individual',
      entityId: '',
      entityName: '',
      productId: products[0]?.id || 0,
      productName: products[0]?.name || '',
      contractPrice: 0,
      regularPrice: products[0]?.price || 0,
      savings: 0
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEditPricing = (entry: PricingEntry) => {
    setSelectedEntry(entry);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSavePricing = async () => {
    if (!selectedEntry) return;

    try {
      if (selectedEntry.type === 'individual') {
        if (isEditing) {
          // Update existing pricing
          await contractPricingService.setContractPrice(
            selectedEntry.entityId!,
            selectedEntry.productId!,
            selectedEntry.contractPrice!
          );
        } else {
          // Create new pricing
          await contractPricingService.setContractPrice(
            selectedEntry.entityId!,
            selectedEntry.productId!,
            selectedEntry.contractPrice!
          );
        }
      }
      // TODO: Handle organization and location pricing

      setIsModalOpen(false);
      setSelectedEntry(null);
      fetchData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing');
    }
  };

  const handleDeletePricing = async (entry: PricingEntry) => {
    if (!confirm('Are you sure you want to delete this pricing entry?')) {
      return;
    }

    try {
      if (entry.type === 'individual') {
        await contractPricingService.removeContractPrice(entry.entityId, entry.productId);
      }
      // TODO: Handle organization and location pricing deletion

      fetchData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pricing');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'individual': return User;
      case 'organization': return Building2;
      case 'location': return MapPin;
      default: return DollarSign;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'individual': return 'bg-blue-100 text-blue-800';
      case 'organization': return 'bg-green-100 text-green-800';
      case 'location': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEntries = pricingEntries.filter(entry => {
    const matchesSearch = 
      entry.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || entry.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {organizationId ? 'Pricing' : 'Pricing Management'}
          </h2>
          <p className="text-gray-600">
            {organizationId 
              ? 'Manage contract pricing for this organization and its locations'
              : 'Manage contract pricing for users, organizations, and locations'
            }
          </p>
        </div>
        <button
          onClick={handleCreatePricing}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add Pricing</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by entity or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="individual">Individual</option>
          <option value="organization">Organization</option>
          <option value="location">Location</option>
        </select>
      </div>

      {/* Pricing Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Regular Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Savings
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => {
                const TypeIcon = getTypeIcon(entry.type);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TypeIcon className="h-4 w-4 mr-2 text-gray-500" />
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(entry.type)}`}>
                          {entry.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{entry.entityName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{entry.productName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">${entry.regularPrice.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">${entry.contractPrice.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-green-600">${entry.savings.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditPricing(entry)}
                          className="text-purple-600 hover:text-purple-900 p-1 rounded"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePricing(entry)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
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

        {filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pricing entries found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || typeFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first pricing entry.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pricing Modal */}
      {isModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {isEditing ? 'Edit Pricing' : 'Create Pricing'}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pricing Type *
                        </label>
                        {organizationId ? (
                          <select
                            value={selectedEntry.type}
                            onChange={(e) => setSelectedEntry({...selectedEntry, type: e.target.value as any})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="organization">Organization Level</option>
                            <option value="location">Location Level</option>
                          </select>
                        ) : (
                          <select
                            value={selectedEntry.type}
                            onChange={(e) => setSelectedEntry({...selectedEntry, type: e.target.value as any})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="individual">Individual User</option>
                            <option value="organization">Organization</option>
                            <option value="location">Location</option>
                          </select>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product *
                        </label>
                        <select
                          value={selectedEntry.productId}
                          onChange={(e) => {
                            const productId = parseInt(e.target.value);
                            const product = products.find(p => p.id === productId);
                            setSelectedEntry({
                              ...selectedEntry, 
                              productId,
                              productName: product?.name || '',
                              regularPrice: product?.price || 0
                            });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} - ${product.price}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Regular Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedEntry.regularPrice}
                          readOnly
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contract Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedEntry.contractPrice}
                          onChange={(e) => {
                            const contractPrice = parseFloat(e.target.value);
                            setSelectedEntry({
                              ...selectedEntry, 
                              contractPrice,
                              savings: (selectedEntry.regularPrice || 0) - contractPrice
                            });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Savings
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedEntry.savings}
                          readOnly
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSavePricing}
                  disabled={!selectedEntry.contractPrice || !selectedEntry.productId}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Update' : 'Create'} Pricing
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingManagement;