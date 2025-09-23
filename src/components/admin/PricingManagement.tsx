import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit, Trash2, Search, User, Building2, MapPin } from 'lucide-react';
import { supabase } from '@/services/supabase';
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
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newEntryData, setNewEntryData] = useState({
    type: 'individual' as 'individual' | 'organization' | 'location',
    entityId: '',
    productId: 0,
    contractPrice: 0,
    minQuantity: 1,
    maxQuantity: undefined as number | undefined
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchPricingEntries = async () => {
    try {
      const entries: PricingEntry[] = [];
      
      // Fetch individual contract pricing
      if (!organizationId) {
        const { data: contractPrices, error: contractError } = await supabase
          .from('contract_pricing')
          .select(`
            *,
            profiles:user_id (email)
          `);
        
        if (!contractError && contractPrices) {
          contractPrices.forEach(price => {
            const product = products.find(p => p.id === price.product_id);
            if (product && price.profiles) {
              entries.push({
                id: price.id,
                type: 'individual',
                entityId: price.user_id,
                entityName: price.profiles.email,
                productId: price.product_id,
                productName: product.name,
                contractPrice: price.contract_price,
                regularPrice: product.price,
                savings: product.price - price.contract_price,
                createdAt: price.created_at
              });
            }
          });
        }
      }
      
      // Fetch organization pricing
      const { data: orgPrices, error: orgError } = await supabase
        .from('organization_pricing')
        .select(`
          *,
          organizations (name)
        `)
        .eq(organizationId ? 'organization_id' : 'id', organizationId || 'all');
      
      if (!orgError && orgPrices) {
        orgPrices.forEach(price => {
          const product = products.find(p => p.id === price.product_id);
          if (product && price.organizations) {
            entries.push({
              id: price.id,
              type: 'organization',
              entityId: price.organization_id,
              entityName: price.organizations.name,
              productId: price.product_id,
              productName: product.name,
              contractPrice: price.contract_price,
              regularPrice: product.price,
              savings: product.price - price.contract_price,
              createdAt: price.created_at
            });
          }
        });
      }
      
      // Fetch location pricing
      const locationQuery = organizationId 
        ? supabase
            .from('location_pricing')
            .select(`
              *,
              locations!inner (
                name,
                organization_id
              )
            `)
            .eq('locations.organization_id', organizationId)
        : supabase
            .from('location_pricing')
            .select(`
              *,
              locations (name)
            `);
      
      const { data: locationPrices, error: locationError } = await locationQuery;
      
      if (!locationError && locationPrices) {
        locationPrices.forEach(price => {
          const product = products.find(p => p.id === price.product_id);
          if (product && price.locations) {
            entries.push({
              id: price.id,
              type: 'location',
              entityId: price.location_id,
              entityName: price.locations.name,
              productId: price.product_id,
              productName: product.name,
              contractPrice: price.contract_price,
              regularPrice: product.price,
              savings: product.price - price.contract_price,
              createdAt: price.created_at
            });
          }
        });
      }
      
      setPricingEntries(entries);
    } catch (err) {
      console.error('Error fetching pricing entries:', err);
    }
  };

  // Re-fetch pricing entries when products are loaded
  useEffect(() => {
    if (products.length > 0) {
      fetchPricingEntries();
    }
  }, [products, organizationId]);
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
        
        // Fetch users for individual pricing
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_approved', true)
          .order('email');
        
        if (!usersError) {
          setUsers(usersData || []);
        }
      }

      // Fetch existing pricing entries
      await fetchPricingEntries();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePricing = () => {
    const defaultEntry = {
      type: organizationId ? 'organization' : 'individual',
      entityId: '',
      entityName: '',
      productId: products[0]?.id || 0,
      productName: products[0]?.name || '',
      contractPrice: 0,
      regularPrice: products[0]?.price || 0,
      savings: 0,
    };
    setSelectedEntry(defaultEntry);
    setNewEntryData({
      type: defaultEntry.type,
      entityId: '',
      productId: defaultEntry.productId,
      contractPrice: 0,
      minQuantity: 1,
      maxQuantity: undefined
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleBulkPricing = () => {
    setBulkPricingData({
      organizationId: organizationId || '',
      discountPercentage: 10,
    });
  };

  const handleEditPricing = (entry: PricingEntry) => {
    setSelectedEntry(entry);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSavePricing = async () => {
    if (!selectedEntry) return;

    try {
      setModalMessage(null);
      
      if (selectedEntry.type === 'individual') {
        await contractPricingService.setContractPrice(
          selectedEntry.entityId!,
          selectedEntry.productId!,
          selectedEntry.contractPrice!
        );
      } else if (selectedEntry.type === 'organization') {
        await contractPricingService.setOrganizationPrice(
          selectedEntry.entityId!,
          selectedEntry.productId!,
          selectedEntry.contractPrice!,
          newEntryData.minQuantity,
          newEntryData.maxQuantity
        );
      } else if (selectedEntry.type === 'location') {
        await contractPricingService.setLocationPrice(
          selectedEntry.entityId!,
          selectedEntry.productId!,
          selectedEntry.contractPrice!,
          newEntryData.minQuantity,
          newEntryData.maxQuantity
        );
      }

      setModalMessage({ type: 'success', text: 'Pricing saved successfully!' });
      setIsModalOpen(false);
      setSelectedEntry(null);
      await fetchPricingEntries(); // Refresh pricing data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save pricing';
      setModalMessage({ type: 'error', text: errorMessage });
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
      } else if (entry.type === 'organization') {
        await contractPricingService.removeOrganizationPrice(entry.entityId, entry.productId);
      } else if (entry.type === 'location') {
        await contractPricingService.removeLocationPrice(entry.entityId, entry.productId);
      }

      await fetchPricingEntries(); // Refresh pricing data
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contract Pricing</h2>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity Range
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {entry.minQuantity || 1}
                        {entry.maxQuantity ? ` - ${entry.maxQuantity}` : '+'}
                      </div>
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
                          {selectedEntry.type === 'individual' ? 'User *' : 
                           selectedEntry.type === 'organization' ? 'Organization *' : 
                           'Location *'}
                        </label>
                        {selectedEntry.type === 'individual' ? (
                          <select
                            value={selectedEntry.entityId}
                            onChange={(e) => {
                              const user = users.find(u => u.id === e.target.value);
                              setSelectedEntry({
                                ...selectedEntry,
                                entityId: e.target.value,
                                entityName: user?.email || ''
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select a user...</option>
                            {users.map(user => (
                              <option key={user.id} value={user.id}>{user.email}</option>
                            ))}
                          </select>
                        ) : selectedEntry.type === 'organization' ? (
                          <select
                            value={selectedEntry.entityId}
                            onChange={(e) => {
                              const org = organizations.find(o => o.id === e.target.value);
                              setSelectedEntry({
                                ...selectedEntry,
                                entityId: e.target.value,
                                entityName: org?.name || ''
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select an organization...</option>
                            {organizations.map(org => (
                              <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={selectedEntry.entityId}
                            onChange={(e) => {
                              const location = locations.find(l => l.id === e.target.value);
                              setSelectedEntry({
                                ...selectedEntry,
                                entityId: e.target.value,
                                entityName: location?.name || ''
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select a location...</option>
                            {locations.map(location => (
                              <option key={location.id} value={location.id}>{location.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      
                      {!organizationId && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pricing Type *
                          </label>
                          <select
                            value={selectedEntry.type}
                            onChange={(e) => {
                              const newType = e.target.value as 'individual' | 'organization' | 'location';
                              setSelectedEntry({
                                ...selectedEntry, 
                                type: newType,
                                entityId: '',
                                entityName: ''
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="individual">Individual User</option>
                            <option value="organization">Organization</option>
                            <option value="location">Location</option>
                          </select>
                        </div>
                      )}
                      
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
                            setNewEntryData({
                              ...newEntryData,
                              productId
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
                            setNewEntryData({
                              ...newEntryData,
                              contractPrice
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
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Min Quantity *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={newEntryData.minQuantity}
                            onChange={(e) => {
                              const minQuantity = parseInt(e.target.value) || 1;
                              setNewEntryData({
                                ...newEntryData,
                                minQuantity
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="1"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={newEntryData.maxQuantity || ''}
                            onChange={(e) => {
                              const maxQuantity = e.target.value ? parseInt(e.target.value) : undefined;
                              setNewEntryData({
                                ...newEntryData,
                                maxQuantity
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Leave empty for unlimited"
                          />
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800 font-medium mb-1">Quantity Tier Information</p>
                        <p className="text-xs text-blue-700">
                          This price will apply when ordering between {selectedEntry.minQuantity || 1} and {selectedEntry.maxQuantity || '∞'} units.
                          {!selectedEntry.maxQuantity && ' Leave max quantity empty for unlimited quantities.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSavePricing}
                  disabled={!selectedEntry.contractPrice || !selectedEntry.productId || !selectedEntry.entityId || !newEntryData.minQuantity}
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