import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Pencil, Trash2, Search, Mail, Phone, Star } from 'lucide-react';
import { customerAddressService, CustomerAddress } from '@/services/customerAddresses';
import { useAuth } from '@/contexts/AuthContext';

interface AddressManagementProps {
  organizationId: string;
}

const AddressManagement: React.FC<AddressManagementProps> = ({ organizationId }) => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<Partial<CustomerAddress> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, [organizationId]);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const data = await customerAddressService.getOrganizationAddresses(organizationId);
      setAddresses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAddress = () => {
    setSelectedAddress({
      user_id: user?.id || '',
      organization_id: organizationId,
      address_type: 'shipping',
      label: '',
      first_name: '',
      last_name: '',
      company: '',
      address1: '',
      address2: '',
      city: '',
      state_or_province: '',
      postal_code: '',
      country_code: 'US',
      phone: '',
      email: '',
      is_default: false,
      is_active: true,
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setSelectedAddress(address);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!selectedAddress) return;

    try {
      setError(null);
      if (isEditing && selectedAddress.id) {
        const { id, created_at, updated_at, is_active, ...updates } = selectedAddress as CustomerAddress;
        await customerAddressService.updateAddress(id, updates);
      } else {
        await customerAddressService.createAddress({
          user_id: selectedAddress.user_id || user?.id || '',
          organization_id: organizationId,
          address_type: (selectedAddress.address_type as 'shipping' | 'billing') || 'shipping',
          label: selectedAddress.label || '',
          first_name: selectedAddress.first_name || '',
          last_name: selectedAddress.last_name || '',
          company: selectedAddress.company,
          address1: selectedAddress.address1 || '',
          address2: selectedAddress.address2,
          city: selectedAddress.city || '',
          state_or_province: selectedAddress.state_or_province || '',
          postal_code: selectedAddress.postal_code || '',
          country_code: selectedAddress.country_code || 'US',
          phone: selectedAddress.phone,
          email: selectedAddress.email,
          is_default: selectedAddress.is_default,
        });
      }
      setIsModalOpen(false);
      setSelectedAddress(null);
      fetchAddresses();
    } catch (err) {
      console.error('Error saving address:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save address';
      setError(errorMessage);
      alert(`Failed to save address: ${errorMessage}`);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      await customerAddressService.deleteAddress(addressId);
      setAddresses(prev => prev.filter(a => a.id !== addressId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete address');
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await customerAddressService.setDefaultAddress(addressId);
      fetchAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    }
  };

  const filteredAddresses = addresses.filter(address =>
    address.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    address.address1.toLowerCase().includes(searchTerm.toLowerCase()) ||
    address.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Addresses</h2>
          <p className="text-gray-600">Manage shipping and billing addresses for this organization</p>
        </div>
        <button
          onClick={handleCreateAddress}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add Address</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search addresses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAddresses.map((address) => (
          <div key={address.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MapPin className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{address.label}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    address.address_type === 'shipping'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {address.address_type}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {!address.is_default && (
                  <button
                    onClick={() => handleSetDefault(address.id)}
                    className="p-2 text-gray-400 hover:text-yellow-500 rounded-lg transition-colors"
                    title="Set as Default"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleEditAddress(address)}
                  className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  title="Edit Address"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteAddress(address.id)}
                  className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete Address"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 space-y-0.5">
                  <div className="font-medium">{address.first_name} {address.last_name}</div>
                  {address.company && <div>{address.company}</div>}
                  <div>{address.address1}</div>
                  {address.address2 && <div>{address.address2}</div>}
                  <div>{address.city}, {address.state_or_province} {address.postal_code}</div>
                </div>
              </div>
              {address.phone && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{address.phone}</span>
                </div>
              )}
              {address.email && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{address.email}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Created: {new Date(address.created_at).toLocaleDateString()}
                </span>
                {address.is_default && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center space-x-1">
                    <Star className="h-3 w-3" />
                    <span>Default</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAddresses.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No addresses found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm
              ? 'Try adjusting your search criteria.'
              : 'Get started by creating your first address.'
            }
          </p>
        </div>
      )}

      {/* Address Modal */}
      {isModalOpen && selectedAddress && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {isEditing ? 'Edit Address' : 'Add Address'}
                    </h3>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Address Label *</label>
                          <input
                            type="text"
                            value={selectedAddress.label || ''}
                            onChange={(e) => setSelectedAddress({...selectedAddress, label: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="e.g., Main Office, Warehouse"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                          <select
                            value={selectedAddress.address_type || 'shipping'}
                            onChange={(e) => setSelectedAddress({...selectedAddress, address_type: e.target.value as 'shipping' | 'billing'})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="shipping">Shipping</option>
                            <option value="billing">Billing</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                          <MapPin className="h-4 w-4" />
                          <span>Address Details</span>
                        </h4>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                              <input
                                type="text"
                                value={selectedAddress.first_name || ''}
                                onChange={(e) => setSelectedAddress({...selectedAddress, first_name: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                              <input
                                type="text"
                                value={selectedAddress.last_name || ''}
                                onChange={(e) => setSelectedAddress({...selectedAddress, last_name: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                            <input
                              type="text"
                              value={selectedAddress.company || ''}
                              onChange={(e) => setSelectedAddress({...selectedAddress, company: e.target.value})}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Street Address *</label>
                            <input
                              type="text"
                              value={selectedAddress.address1 || ''}
                              onChange={(e) => setSelectedAddress({...selectedAddress, address1: e.target.value})}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="123 Main St"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 2</label>
                            <input
                              type="text"
                              value={selectedAddress.address2 || ''}
                              onChange={(e) => setSelectedAddress({...selectedAddress, address2: e.target.value})}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="Suite, Unit, etc."
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">City *</label>
                              <input
                                type="text"
                                value={selectedAddress.city || ''}
                                onChange={(e) => setSelectedAddress({...selectedAddress, city: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">State *</label>
                              <input
                                type="text"
                                value={selectedAddress.state_or_province || ''}
                                onChange={(e) => setSelectedAddress({...selectedAddress, state_or_province: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">ZIP *</label>
                              <input
                                type="text"
                                value={selectedAddress.postal_code || ''}
                                onChange={(e) => setSelectedAddress({...selectedAddress, postal_code: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
                            <input
                              type="text"
                              value={selectedAddress.country_code || 'US'}
                              onChange={(e) => setSelectedAddress({...selectedAddress, country_code: e.target.value})}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                              <input
                                type="tel"
                                value={selectedAddress.phone || ''}
                                onChange={(e) => setSelectedAddress({...selectedAddress, phone: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                              <input
                                type="email"
                                value={selectedAddress.email || ''}
                                onChange={(e) => setSelectedAddress({...selectedAddress, email: e.target.value})}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedAddress.is_default || false}
                            onChange={(e) => setSelectedAddress({...selectedAddress, is_default: e.target.checked})}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Set as default address</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveAddress}
                  disabled={
                    !selectedAddress.label ||
                    !selectedAddress.first_name ||
                    !selectedAddress.last_name ||
                    !selectedAddress.address1 ||
                    !selectedAddress.city ||
                    !selectedAddress.state_or_province ||
                    !selectedAddress.postal_code
                  }
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Update' : 'Create'} Address
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

export default AddressManagement;
