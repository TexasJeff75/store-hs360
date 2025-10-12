import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit, Trash2, Search, User, Building2, MapPin } from 'lucide-react';
import { contractPricingService, type PricingType } from '@/services/contractPricing';
import { multiTenantService } from '@/services/multiTenant';
import { bigCommerceService } from '@/services/bigcommerce';
import { supabase } from '@/services/supabase';
import type { Organization, Location, Profile } from '@/services/supabase';

interface PricingEntry {
  id: string;
  type: PricingType;
  entityId: string;
  entityName: string;
  productId: number;
  productName: string;
  contractPrice: number;
  markupPrice?: number;
  regularPrice: number;
  savings: number;
  minQuantity: number;
  maxQuantity?: number;
  effectiveDate: string;
  expiryDate?: string;
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
    type: 'individual' as PricingType,
    entityId: '',
    productId: 0,
    contractPrice: 0,
    markupPrice: undefined as number | undefined,
    minQuantity: 1,
    maxQuantity: undefined as number | undefined,
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: undefined as string | undefined
  });
  const [productSettings, setProductSettings] = useState<Map<number, { allowMarkup: boolean }>>(new Map());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchPricingEntries = async () => {
    try {
      console.log('Fetching pricing entries...');
      
      let pricingData;
      if (organizationId) {
        // Fetch pricing for specific organization and its locations
        pricingData = await contractPricingService.getOrganizationPricingEntries(organizationId);
      } else {
        // Fetch all pricing entries
        pricingData = await contractPricingService.getAllPricingEntries();
      }
      
      console.log('Raw pricing data:', pricingData);
      
      // Transform the data into PricingEntry format
      const entries: PricingEntry[] = pricingData.map(price => {
        const product = products.find(p => p.id === price.product_id);
        
        // Get entity name based on pricing type
        let entityName = 'Unknown';
        if (price.pricing_type === 'individual' && price.profiles) {
          entityName = price.profiles.email;
        } else if (price.pricing_type === 'organization' && price.organizations) {
          entityName = price.organizations.name;
        } else if (price.pricing_type === 'location' && price.locations) {
          entityName = price.locations.name;
        }
        
        return {
          id: price.id,
          type: price.pricing_type,
          entityId: price.entity_id,
          entityName,
          productId: price.product_id,
          productName: product?.name || `Product ${price.product_id}`,
          contractPrice: price.contract_price,
          markupPrice: price.markup_price,
          regularPrice: product?.price || 0,
          savings: price.contract_price ? (product?.price || 0) - price.contract_price : 0,
          minQuantity: price.min_quantity || 1,
          maxQuantity: price.max_quantity,
          effectiveDate: price.effective_date || price.created_at,
          expiryDate: price.expiry_date,
          createdAt: price.created_at
        };
      }).filter(entry => entry.productName !== `Product ${entry.productId}`); // Filter out entries without valid products
      
      console.log('Processed entries:', entries);
      setPricingEntries(entries);
    } catch (err) {
      console.error('Error fetching pricing entries:', err);
      setError('Failed to load pricing entries: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Re-fetch pricing entries when products are loaded
  useEffect(() => {
    console.log('Products changed, refetching pricing entries. Products length:', products.length);
    if (products.length > 0) {
      fetchPricingEntries();
    }
  }, [products, organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all required data
      const [productsData, orgsData, settingsData] = await Promise.all([
        bigCommerceService.getProducts(),
        multiTenantService.getOrganizations(),
        supabase.from('product_settings').select('product_id, allow_markup')
      ]);

      setProducts(productsData.products);

      // Build product settings map
      const settingsMap = new Map();
      if (settingsData.data) {
        settingsData.data.forEach((setting: any) => {
          settingsMap.set(setting.product_id, { allowMarkup: setting.allow_markup });
        });
      }
      setProductSettings(settingsMap);
      
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
      minQuantity: 1,
      maxQuantity: undefined,
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: undefined,
    };
    setSelectedEntry(defaultEntry);
    setNewEntryData({
      type: defaultEntry.type as PricingType,
      entityId: '',
      productId: defaultEntry.productId,
      contractPrice: 0,
      minQuantity: 1,
      maxQuantity: undefined,
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: undefined
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
    setNewEntryData({
      type: entry.type,
      entityId: entry.entityId,
      productId: entry.productId,
      contractPrice: entry.contractPrice,
      minQuantity: entry.minQuantity,
      maxQuantity: entry.maxQuantity,
      effectiveDate: entry.effectiveDate.split('T')[0],
      expiryDate: entry.expiryDate?.split('T')[0]
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const checkForConflicts = () => {
    if (!selectedEntry) return null;

    const newMin = newEntryData.minQuantity;
    const newMax = newEntryData.maxQuantity || 999999999;

    const conflicts = pricingEntries.filter(entry => {
      if (entry.id === selectedEntry.id) return false;
      if (entry.productId !== selectedEntry.productId) return false;
      if (entry.entityId !== selectedEntry.entityId) return false;
      if (entry.type !== selectedEntry.type) return false;

      const existingMin = entry.minQuantity;
      const existingMax = entry.maxQuantity || 999999999;

      return newMin <= existingMax && newMax >= existingMin;
    });

    return conflicts.length > 0 ? conflicts : null;
  };

  const handleSavePricing = async () => {
    if (!selectedEntry) return;

    try {
      setModalMessage(null);

      const conflicts = checkForConflicts();
      if (conflicts) {
        const conflictDetails = conflicts.map(c => {
          const price = c.contractPrice ? `$${c.contractPrice.toFixed(2)}` : c.markupPrice ? `$${c.markupPrice.toFixed(2)} (markup)` : 'N/A';
          return `${price} (qty ${c.minQuantity}${c.maxQuantity ? `-${c.maxQuantity}` : '+'})`;
        }).join(', ');
        setModalMessage({
          type: 'error',
          text: `Quantity range conflict! This range overlaps with existing tiers: ${conflictDetails}. Please adjust min/max quantities.`
        });
        return;
      }

      const result = await contractPricingService.setContractPrice(
        selectedEntry.entityId!,
        selectedEntry.productId!,
        selectedEntry.contractPrice,
        selectedEntry.type as PricingType,
        newEntryData.minQuantity,
        newEntryData.maxQuantity,
        newEntryData.effectiveDate,
        newEntryData.expiryDate,
        selectedEntry.markupPrice
      );

      if (result.success) {
        setModalMessage({ type: 'success', text: 'Pricing saved successfully!' });
        setIsModalOpen(false);
        setSelectedEntry(null);

        setTimeout(async () => {
          await fetchPricingEntries();
        }, 500);
      } else {
        setModalMessage({ type: 'error', text: result.error || 'Failed to save pricing' });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save pricing';
      setModalMessage({ type: 'error', text: errorMessage });
      setError(errorMessage);
    }
  };

  const handleDeletePricing = async (entry: PricingEntry) => {
    if (!confirm('Are you sure you want to delete this pricing entry?')) {
      return;
    }

    try {
      const result = await contractPricingService.removeContractPriceById(entry.id);

      if (result.success) {
        // Refresh pricing data after a short delay
        setTimeout(async () => {
          await fetchPricingEntries();
        }, 500);
      } else {
        setError(result.error || 'Failed to delete pricing');
      }
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
                  Markup Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Savings/Markup
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity Range
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => {
                const TypeIcon = getTypeIcon(entry.type);

                const hasConflict = pricingEntries.some(other => {
                  if (other.id === entry.id) return false;
                  if (other.productId !== entry.productId) return false;
                  if (other.entityId !== entry.entityId) return false;
                  if (other.type !== entry.type) return false;

                  const entryMin = entry.minQuantity;
                  const entryMax = entry.maxQuantity || 999999999;
                  const otherMin = other.minQuantity;
                  const otherMax = other.maxQuantity || 999999999;

                  return entryMin <= otherMax && entryMax >= otherMin;
                });

                return (
                  <tr key={entry.id} className={hasConflict ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}>
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
                      {entry.contractPrice ? (
                        <div className="text-sm font-medium text-green-600">${entry.contractPrice.toFixed(2)}</div>
                      ) : (
                        <div className="text-sm text-gray-400">—</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.markupPrice ? (
                        <div className="text-sm font-medium text-blue-600">${entry.markupPrice.toFixed(2)}</div>
                      ) : (
                        <div className="text-sm text-gray-400">—</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.contractPrice && entry.savings > 0 ? (
                        <div className="text-sm text-green-600">-${entry.savings.toFixed(2)}</div>
                      ) : entry.markupPrice && entry.markupPrice > entry.regularPrice ? (
                        <div className="text-sm text-blue-600">+${(entry.markupPrice - entry.regularPrice).toFixed(2)}</div>
                      ) : (
                        <div className="text-sm text-gray-400">—</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="text-sm text-gray-900">
                          {entry.minQuantity}
                          {entry.maxQuantity ? ` - ${entry.maxQuantity}` : '+'}
                        </div>
                        {hasConflict && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Conflict
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(entry.effectiveDate).toLocaleDateString()}
                        {entry.expiryDate && (
                          <div className="text-xs text-gray-500">
                            Expires: {new Date(entry.expiryDate).toLocaleDateString()}
                          </div>
                        )}
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
                    
                    {/* Modal Message */}
                    {modalMessage && (
                      <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
                        modalMessage.type === 'success' 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <span className={`text-sm ${
                          modalMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {modalMessage.text}
                        </span>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {!organizationId && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pricing Type *
                          </label>
                          <select
                            value={selectedEntry.type}
                            onChange={(e) => {
                              const newType = e.target.value as PricingType;
                              setSelectedEntry({
                                ...selectedEntry, 
                                type: newType,
                                entityId: '',
                                entityName: ''
                              });
                              setNewEntryData({
                                ...newEntryData,
                                type: newType,
                                entityId: ''
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
                              setNewEntryData({
                                ...newEntryData,
                                entityId: e.target.value
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
                              setNewEntryData({
                                ...newEntryData,
                                entityId: e.target.value
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
                              setNewEntryData({
                                ...newEntryData,
                                entityId: e.target.value
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
                              regularPrice: product?.price || 0,
                              savings: (product?.price || 0) - selectedEntry.contractPrice
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
                          Contract Price (Discounted) {!productSettings.get(selectedEntry.productId || 0)?.allowMarkup && '*'}
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          {productSettings.get(selectedEntry.productId || 0)?.allowMarkup
                            ? 'Optional when markup price is set. Set a price BELOW retail for standard discounted pricing.'
                            : 'Required. Set a price BELOW retail. This is the standard discounted price.'
                          }
                        </p>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedEntry.contractPrice || ''}
                          onChange={(e) => {
                            const contractPrice = e.target.value ? parseFloat(e.target.value) : undefined;
                            setSelectedEntry({
                              ...selectedEntry,
                              contractPrice,
                              savings: contractPrice ? (selectedEntry.regularPrice || 0) - contractPrice : 0
                            });
                            setNewEntryData({
                              ...newEntryData,
                              contractPrice: contractPrice || 0
                            });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={productSettings.get(selectedEntry.productId || 0)?.allowMarkup ? 'Optional if markup is set' : 'Required'}
                        />
                      </div>

                      {productSettings.get(selectedEntry.productId || 0)?.allowMarkup && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Markup Price (Optional)
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                              Set a price ABOVE retail. Sales rep gets 100% of the markup.
                            </p>
                            <input
                              type="number"
                              step="0.01"
                              value={selectedEntry.markupPrice || ''}
                              onChange={(e) => {
                                const markupPrice = e.target.value ? parseFloat(e.target.value) : undefined;
                                setSelectedEntry({
                                  ...selectedEntry,
                                  markupPrice
                                });
                                setNewEntryData({
                                  ...newEntryData,
                                  markupPrice
                                });
                              }}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              placeholder="Leave empty for normal retail price"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Markup Amount (Rep keeps 100%)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={selectedEntry.markupPrice ? (selectedEntry.markupPrice - (selectedEntry.regularPrice || 0)).toFixed(2) : '0.00'}
                              readOnly
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                            />
                          </div>
                        </>
                      )}
                      
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

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Effective Date *
                          </label>
                          <input
                            type="date"
                            value={newEntryData.effectiveDate}
                            onChange={(e) => {
                              setNewEntryData({
                                ...newEntryData,
                                effectiveDate: e.target.value
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            value={newEntryData.expiryDate || ''}
                            onChange={(e) => {
                              setNewEntryData({
                                ...newEntryData,
                                expiryDate: e.target.value || undefined
                              });
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800 font-medium mb-1">Pricing Information</p>
                        <p className="text-xs text-blue-700">
                          This price will apply when ordering between {newEntryData.minQuantity} and {newEntryData.maxQuantity || '∞'} units
                          from {newEntryData.effectiveDate} {newEntryData.expiryDate ? `until ${newEntryData.expiryDate}` : 'indefinitely'}.
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
                  disabled={
                    (!selectedEntry.contractPrice && !selectedEntry.markupPrice) ||
                    !selectedEntry.productId ||
                    !selectedEntry.entityId ||
                    !newEntryData.minQuantity ||
                    !newEntryData.effectiveDate
                  }
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