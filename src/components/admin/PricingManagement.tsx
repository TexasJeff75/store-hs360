import React, { useState, useEffect } from 'react';
import { DollarSign, Building2, MapPin, User, Plus, Edit, Trash2 } from 'lucide-react';
import { multiTenantService, Organization, Location } from '../../services/multiTenant';
import { bigCommerceService, Product } from '../../services/bigcommerce';

interface PricingEntry {
  id: string;
  product_id: number;
  contract_price: number;
  type: 'individual' | 'organization' | 'location';
  target_id: string;
  target_name: string;
  effective_date: string;
  expiry_date?: string;
}

const PricingManagement: React.FC = () => {
  const [pricingEntries, setPricingEntries] = useState<PricingEntry[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PricingEntry | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'organization' | 'location'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [orgsData, productsData] = await Promise.all([
        multiTenantService.getOrganizations(),
        bigCommerceService.getProducts()
      ]);
      
      setOrganizations(orgsData);
      setProducts(productsData.products);
      
      // Fetch all pricing entries
      await fetchPricingEntries();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingEntries = async () => {
    // This would need to be implemented to fetch all pricing from different tables
    // For now, we'll show a placeholder
    setPricingEntries([]);
  };

  const openModal = (entry?: PricingEntry) => {
    setSelectedEntry(entry || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedEntry(null);
    setShowModal(false);
  };

  const filteredEntries = pricingEntries.filter(entry => 
    filterType === 'all' || entry.type === filterType
  );

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pricing Management</h2>
          <p className="text-gray-600">Manage contract pricing for users, organizations, and locations</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Pricing Rule</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'all', label: 'All Pricing', icon: DollarSign },
              { id: 'individual', label: 'Individual', icon: User },
              { id: 'organization', label: 'Organization', icon: Building2 },
              { id: 'location', label: 'Location', icon: MapPin }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    filterType === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Pricing Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Individual Pricing</p>
              <p className="text-2xl font-bold text-gray-900">
                {pricingEntries.filter(e => e.type === 'individual').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Organization Pricing</p>
              <p className="text-2xl font-bold text-gray-900">
                {pricingEntries.filter(e => e.type === 'organization').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <MapPin className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Location Pricing</p>
              <p className="text-2xl font-bold text-gray-900">
                {pricingEntries.filter(e => e.type === 'location').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No pricing rules found</p>
            <p className="text-gray-400 mb-6">Create your first pricing rule to get started</p>
            <button
              onClick={() => openModal()}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Add Pricing Rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Effective Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries.map((entry) => {
                  const product = products.find(p => p.id === entry.product_id);
                  const getTypeIcon = () => {
                    switch (entry.type) {
                      case 'individual': return <User className="h-4 w-4" />;
                      case 'organization': return <Building2 className="h-4 w-4" />;
                      case 'location': return <MapPin className="h-4 w-4" />;
                    }
                  };

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {product?.name || `Product #${entry.product_id}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon()}
                          <span className="text-sm text-gray-900 capitalize">{entry.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{entry.target_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-green-600">
                          ${entry.contract_price.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(entry.effective_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => openModal(entry)}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-900">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pricing Modal */}
      {showModal && (
        <PricingModal
          entry={selectedEntry}
          organizations={organizations}
          products={products}
          onClose={closeModal}
          onSave={fetchPricingEntries}
        />
      )}
    </div>
  );
};

// Pricing Modal Component
interface PricingModalProps {
  entry: PricingEntry | null;
  organizations: Organization[];
  products: Product[];
  onClose: () => void;
  onSave: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ 
  entry, 
  organizations,
  products,
  onClose, 
  onSave 
}) => {
  const [formData, setFormData] = useState({
    product_id: entry?.product_id || 0,
    contract_price: entry?.contract_price || 0,
    type: entry?.type || 'individual' as 'individual' | 'organization' | 'location',
    target_id: entry?.target_id || '',
    effective_date: entry?.effective_date || new Date().toISOString().split('T')[0],
    expiry_date: entry?.expiry_date || ''
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (formData.type === 'location' && formData.target_id) {
      // Fetch locations for selected organization
      // This would need to be implemented
    }
  }, [formData.type, formData.target_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Implementation would depend on the pricing type
      // This is a placeholder for the actual implementation
      console.log('Saving pricing:', formData);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {entry ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value={0}>Select a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any, target_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                >
                  <option value="individual">Individual User</option>
                  <option value="organization">Organization</option>
                  <option value="location">Location</option>
                </select>
              </div>

              {formData.type === 'organization' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <select
                    value={formData.target_id}
                    onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select an organization...</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contract Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.contract_price}
                  onChange={(e) => setFormData({ ...formData, contract_price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingManagement;