import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Check, CreditCard as Edit, Trash2 } from 'lucide-react';
import { customerAddressService, CustomerAddress } from '@/services/customerAddresses';

interface AddressSelectorProps {
  userId: string;
  organizationId?: string;
  locationId?: string;
  addressType: 'shipping' | 'billing';
  onSelect: (address: CustomerAddress | 'new') => void;
  onAddNew?: () => void;
}

const AddressSelector: React.FC<AddressSelectorProps> = ({
  userId,
  organizationId,
  locationId,
  addressType,
  onSelect,
  onAddNew
}) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAddresses();
  }, [userId, organizationId, locationId, addressType]);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      let addressList: CustomerAddress[] = [];

      console.log('AddressSelector - Fetching addresses:', {
        userId,
        organizationId,
        locationId,
        addressType
      });

      if (locationId) {
        addressList = await customerAddressService.getLocationAddresses(locationId, addressType);
      } else if (organizationId) {
        addressList = await customerAddressService.getOrganizationAddresses(organizationId, addressType);
      } else {
        addressList = await customerAddressService.getUserAddresses(userId, addressType);
      }

      console.log('AddressSelector - Fetched addresses:', addressList.length, addressList);

      setAddresses(addressList);

      const defaultAddr = addressList.find(addr => addr.is_default);
      if (defaultAddr) {
        setSelectedId(defaultAddr.id);
        onSelect(defaultAddr);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (address: CustomerAddress) => {
    setSelectedId(address.id);
    onSelect(address);
  };

  const handleAddNew = () => {
    setSelectedId('new');
    if (onAddNew) {
      onAddNew();
    } else {
      onSelect('new');
    }
  };

  const formatAddress = (address: CustomerAddress): string => {
    const parts = [
      address.address1,
      address.address2,
      address.city,
      address.state_or_province,
      address.postal_code
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          <span>
            {addressType === 'shipping' ? 'Select Shipping Address' : 'Select Billing Address'}
          </span>
        </h4>
        <button
          onClick={handleAddNew}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
        >
          <Plus className="h-4 w-4" />
          <span>Add New</span>
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">No saved addresses found</p>
          <button
            onClick={handleAddNew}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Your First Address</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {addresses.map((address) => (
            <div
              key={address.id}
              onClick={() => handleSelect(address)}
              className={`
                p-4 border-2 rounded-lg cursor-pointer transition-all
                ${selectedId === address.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="font-semibold text-gray-900">{address.label}</span>
                    {address.is_default && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div className="font-medium">
                      {address.first_name} {address.last_name}
                    </div>
                    {address.company && (
                      <div className="text-gray-600">{address.company}</div>
                    )}
                    <div className="text-gray-600">{formatAddress(address)}</div>
                    {address.phone && (
                      <div className="text-gray-600">{address.phone}</div>
                    )}
                  </div>
                </div>
                {selectedId === address.id && (
                  <div className="ml-3">
                    <div className="bg-blue-600 text-white rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div
            onClick={handleAddNew}
            className={`
              p-4 border-2 rounded-lg cursor-pointer transition-all
              ${selectedId === 'new'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
              }
            `}
          >
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 text-blue-600 rounded-full p-2">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Add New Address</div>
                <div className="text-sm text-gray-600">
                  Enter a new {addressType} address
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressSelector;
