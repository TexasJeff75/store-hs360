import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Address {
  id: string;
  address_type: 'shipping' | 'billing';
  label: string;
  first_name: string;
  last_name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state_or_province: string;
  postal_code: string;
  country_code: string;
  phone?: string;
  email?: string;
  is_default: boolean;
  is_active: boolean;
}

const CustomerAddresses: React.FC = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Address>>({
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

  useEffect(() => {
    fetchUserOrganization();
  }, [user]);

  useEffect(() => {
    if (organizationId && locationId) {
      fetchAddresses();
    }
  }, [organizationId, locationId]);

  const fetchUserOrganization = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_organization_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.organization_id) {
        setOrganizationId(data.organization_id);

        // Get the first location for this organization
        const { data: locationData } = await supabase
          .from('locations')
          .select('id')
          .eq('organization_id', data.organization_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (locationData?.id) {
          setLocationId(locationData.id);
        }
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  const fetchAddresses = async () => {
    if (!organizationId || !locationId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('location_id', locationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
        throw error;
      }
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !organizationId || !locationId) return;

    if (!formData.label || !formData.first_name || !formData.last_name ||
        !formData.address1 || !formData.city || !formData.state_or_province ||
        !formData.postal_code) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const addressData = {
        ...formData,
        user_id: user.id,
        organization_id: organizationId,
        location_id: locationId,
      };

      if (editingId) {
        const { error } = await supabase
          .from('customer_addresses')
          .update(addressData)
          .eq('id', editingId);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('customer_addresses')
          .insert([addressData]);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }

      setEditingId(null);
      setIsAdding(false);
      setFormData({
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
      fetchAddresses();
    } catch (error) {
      console.error('Error saving address:', error);
      alert('Failed to save address. Please try again.');
    }
  };

  const handleEdit = (address: Address) => {
    setFormData(address);
    setEditingId(address.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const { error } = await supabase
        .from('customer_addresses')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      fetchAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Failed to delete address. Please try again.');
    }
  };

  const handleSetDefault = async (id: string, addressType: 'shipping' | 'billing') => {
    if (!organizationId || !locationId) return;

    try {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('organization_id', organizationId)
        .eq('location_id', locationId)
        .eq('address_type', addressType);

      const { error } = await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      fetchAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
      alert('Failed to set default address. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  const shippingAddresses = addresses.filter(a => a.address_type === 'shipping');
  const billingAddresses = addresses.filter(a => a.address_type === 'billing');

  if (!organizationId || !locationId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No organization found. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Organization Addresses</h2>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setFormData({
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
          }}
          className="flex items-center space-x-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Address</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Address' : 'Add New Address'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Type
              </label>
              <select
                value={formData.address_type}
                onChange={(e) =>
                  setFormData({ ...formData, address_type: e.target.value as 'shipping' | 'billing' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              >
                <option value="shipping">Shipping</option>
                <option value="billing">Billing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Home, Office"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company (Optional)
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                value={formData.address1}
                onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                value={formData.address2}
                onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State/Province
              </label>
              <input
                type="text"
                value={formData.state_or_province}
                onChange={(e) => setFormData({ ...formData, state_or_province: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={formData.country_code}
                onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (Optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">Set as default address</span>
              </label>
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-6">
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700"
            >
              <Check className="h-4 w-4" />
              <span>Save</span>
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
              className="flex items-center space-x-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-pink-600" />
            <span>Shipping Addresses</span>
          </h3>
          {shippingAddresses.length === 0 ? (
            <p className="text-gray-500">No shipping addresses yet.</p>
          ) : (
            <div className="space-y-4">
              {shippingAddresses.map((address) => (
                <div
                  key={address.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{address.label}</h4>
                      {address.is_default && (
                        <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded mt-1">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(address)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(address.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    <p>
                      {address.first_name} {address.last_name}
                    </p>
                    {address.company && <p>{address.company}</p>}
                    <p>{address.address1}</p>
                    {address.address2 && <p>{address.address2}</p>}
                    <p>
                      {address.city}, {address.state_or_province} {address.postal_code}
                    </p>
                    <p>{address.country_code}</p>
                    {address.phone && <p>Phone: {address.phone}</p>}
                  </div>
                  {!address.is_default && (
                    <button
                      onClick={() => handleSetDefault(address.id, 'shipping')}
                      className="mt-3 text-sm text-pink-600 hover:text-pink-700"
                    >
                      Set as default
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-pink-600" />
            <span>Billing Addresses</span>
          </h3>
          {billingAddresses.length === 0 ? (
            <p className="text-gray-500">No billing addresses yet.</p>
          ) : (
            <div className="space-y-4">
              {billingAddresses.map((address) => (
                <div
                  key={address.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{address.label}</h4>
                      {address.is_default && (
                        <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded mt-1">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(address)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(address.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    <p>
                      {address.first_name} {address.last_name}
                    </p>
                    {address.company && <p>{address.company}</p>}
                    <p>{address.address1}</p>
                    {address.address2 && <p>{address.address2}</p>}
                    <p>
                      {address.city}, {address.state_or_province} {address.postal_code}
                    </p>
                    <p>{address.country_code}</p>
                    {address.phone && <p>Phone: {address.phone}</p>}
                  </div>
                  {!address.is_default && (
                    <button
                      onClick={() => handleSetDefault(address.id, 'billing')}
                      className="mt-3 text-sm text-pink-600 hover:text-pink-700"
                    >
                      Set as default
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerAddresses;
