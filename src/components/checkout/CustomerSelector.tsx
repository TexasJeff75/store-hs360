import React, { useState, useEffect } from 'react';
import { Search, Building2, User, MapPin } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface Location {
  id: string;
  name: string;
  code: string;
  organization_id: string;
}

interface Customer {
  id: string;
  email: string;
  role: string;
}

interface CustomerSelectorProps {
  onSelect: (selection: {
    customerId: string;
    organizationId?: string;
    locationId?: string;
    customerEmail: string;
  }) => void;
  currentUserId: string;
  preSelectedOrganizationId?: string;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({ onSelect, currentUserId, preSelectedOrganizationId }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderingFor, setOrderingFor] = useState<'self' | 'organization' | 'customer'>('self');

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (preSelectedOrganizationId && organizations.length > 0) {
      setSelectedOrg(preSelectedOrganizationId);
      setOrderingFor('organization');
    }
  }, [preSelectedOrganizationId, organizations]);

  useEffect(() => {
    if (selectedOrg) {
      fetchLocations(selectedOrg);
      fetchOrganizationCustomers(selectedOrg);
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (orderingFor === 'self') {
      handleSelfOrder();
    }
  }, [orderingFor]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_organization_roles')
        .select(`
          organization_id,
          organizations!inner(id, name, code)
        `)
        .eq('user_id', currentUserId)
        .in('role', ['admin', 'manager']);

      if (error) throw error;

      const orgs = data?.map((item: any) => item.organizations) || [];
      setOrganizations(orgs);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const fetchLocations = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true);

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchOrganizationCustomers = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_organization_roles')
        .select(`
          user_id,
          role,
          profiles!inner(id, email)
        `)
        .eq('organization_id', orgId);

      if (error) throw error;

      const customerList = data?.map((item: any) => ({
        id: item.profiles.id,
        email: item.profiles.email,
        role: item.role
      })) || [];

      setCustomers(customerList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSelfOrder = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', currentUserId)
      .single();

    if (profile) {
      onSelect({
        customerId: currentUserId,
        customerEmail: profile.email
      });
    }
  };

  const handleOrganizationOrder = () => {
    if (!selectedOrg) return;

    const org = organizations.find(o => o.id === selectedOrg);
    if (!org) return;

    onSelect({
      customerId: currentUserId,
      organizationId: selectedOrg,
      locationId: selectedLocation || undefined,
      customerEmail: `${org.code}@organization.local`
    });
  };

  const handleCustomerOrder = () => {
    if (!selectedCustomer) return;

    const customer = customers.find(c => c.id === selectedCustomer);
    if (!customer) return;

    onSelect({
      customerId: selectedCustomer,
      organizationId: selectedOrg,
      locationId: selectedLocation || undefined,
      customerEmail: customer.email
    });
  };

  const filteredCustomers = customers.filter(c =>
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <User className="h-5 w-5 text-blue-600" />
          <span>Who are you ordering for?</span>
        </h3>

        <div className="space-y-3">
          <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
            <input
              type="radio"
              name="orderingFor"
              value="self"
              checked={orderingFor === 'self'}
              onChange={(e) => setOrderingFor(e.target.value as 'self')}
              className="mr-3"
            />
            <div>
              <div className="font-medium">Myself</div>
              <div className="text-sm text-gray-500">Place an order for my own account</div>
            </div>
          </label>

          {organizations.length > 0 && (
            <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
              <input
                type="radio"
                name="orderingFor"
                value="organization"
                checked={orderingFor === 'organization'}
                onChange={(e) => setOrderingFor(e.target.value as 'organization')}
                className="mr-3"
              />
              <div>
                <div className="font-medium">Organization</div>
                <div className="text-sm text-gray-500">Place an order for an organization</div>
              </div>
            </label>
          )}

          {organizations.length > 0 && (
            <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
              <input
                type="radio"
                name="orderingFor"
                value="customer"
                checked={orderingFor === 'customer'}
                onChange={(e) => setOrderingFor(e.target.value as 'customer')}
                className="mr-3"
              />
              <div>
                <div className="font-medium">Another Customer</div>
                <div className="text-sm text-gray-500">Place an order on behalf of a customer</div>
              </div>
            </label>
          )}
        </div>
      </div>

      {orderingFor === 'organization' && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Select Organization</span>
            </label>
            <select
              value={selectedOrg}
              onChange={(e) => {
                setSelectedOrg(e.target.value);
                setSelectedLocation('');
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose an organization...</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.code})
                </option>
              ))}
            </select>
          </div>

          {selectedOrg && locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Shipping Destination *</span>
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select shipping location...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                The location's stored address will be used for shipping
              </p>
            </div>
          )}

          {selectedOrg && (
            <button
              onClick={handleOrganizationOrder}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue with Organization Order
            </button>
          )}
        </div>
      )}

      {orderingFor === 'customer' && (
        <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Select Organization</span>
            </label>
            <select
              value={selectedOrg}
              onChange={(e) => {
                setSelectedOrg(e.target.value);
                setSelectedLocation('');
                setSelectedCustomer('');
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Choose an organization...</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.code})
                </option>
              ))}
            </select>
          </div>

          {selectedOrg && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <span>Search Customer</span>
              </label>
              <input
                type="text"
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 mb-2"
              />
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                size={5}
              >
                {filteredCustomers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.email} ({customer.role})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                The location's stored address will be used for shipping
              </p>
            </div>
          )}

          {selectedOrg && locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Select Location (Optional)</span>
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">No specific location</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                The location's stored address will be used for shipping
              </p>
            </div>
          )}

          {selectedCustomer && (
            <button
              onClick={handleCustomerOrder}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              Continue with Customer Order
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSelector;
