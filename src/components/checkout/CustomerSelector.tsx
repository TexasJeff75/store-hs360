import React, { useState, useEffect } from 'react';
import { Search, Building2, User } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
  code: string;
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
    customerEmail: string;
  }) => void;
  currentUserId: string;
  preSelectedOrganizationId?: string;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({ onSelect, currentUserId, preSelectedOrganizationId }) => {
  const { profile } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
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
      const isSystemAdmin = profile?.role === 'admin';
      const isRepOrDistributor = profile?.role === 'sales_rep' || profile?.role === 'distributor';

      if (isSystemAdmin) {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name, code')
          .order('name');

        if (error) throw error;
        setOrganizations(data || []);
      } else if (isRepOrDistributor) {
        // Fetch organizations assigned to this rep via distributor_customers
        // First find distributor records where this user is the profile owner or a delegate
        const { data: distributorIds } = await supabase
          .from('distributors')
          .select('id')
          .eq('profile_id', currentUserId);

        const { data: delegateIds } = await supabase
          .from('distributor_delegates')
          .select('distributor_id')
          .eq('user_id', currentUserId)
          .eq('is_active', true);

        const allDistributorIds = [
          ...(distributorIds?.map(d => d.id) || []),
          ...(delegateIds?.map(d => d.distributor_id) || []),
        ];

        // Also check if this user is a sales rep under a distributor
        const { data: salesRepLinks } = await supabase
          .from('distributor_sales_reps')
          .select('distributor_id')
          .eq('sales_rep_id', currentUserId)
          .eq('is_active', true);

        const repDistributorIds = salesRepLinks?.map(d => d.distributor_id) || [];
        const combinedIds = [...new Set([...allDistributorIds, ...repDistributorIds])];

        if (combinedIds.length > 0) {
          const { data: customers, error } = await supabase
            .from('distributor_customers')
            .select('organization_id, organizations!inner(id, name, code)')
            .in('distributor_id', combinedIds)
            .eq('is_active', true);

          if (error) throw error;

          const orgs = customers?.map((item: any) => item.organizations) || [];
          // Deduplicate by id
          const uniqueOrgs = orgs.filter((org: any, i: number, arr: any[]) =>
            arr.findIndex((o: any) => o.id === org.id) === i
          );
          setOrganizations(uniqueOrgs);
          console.log('[CustomerSelector] Rep/distributor orgs:', uniqueOrgs.length);
        } else {
          // Fallback: check organization_sales_reps for direct rep assignments
          const { data: repOrgs, error } = await supabase
            .from('organization_sales_reps')
            .select('organization_id, organizations!inner(id, name, code)')
            .eq('sales_rep_id', currentUserId)
            .eq('is_active', true);

          if (error) throw error;

          const orgs = repOrgs?.map((item: any) => item.organizations) || [];
          setOrganizations(orgs);
          console.log('[CustomerSelector] Sales rep direct orgs:', orgs.length);
        }
      } else {
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
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
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
    const { data: profileData } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', currentUserId)
      .single();

    if (profileData) {
      // Look up the user's organization so org addresses are found during checkout
      const { data: orgRole } = await supabase
        .from('user_organization_roles')
        .select('organization_id')
        .eq('user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      const resolvedOrgId = orgRole?.organization_id || preSelectedOrganizationId;
      console.log('[CustomerSelector] Self order - orgRole:', orgRole?.organization_id, 'preSelected:', preSelectedOrganizationId, 'resolved:', resolvedOrgId);

      onSelect({
        customerId: currentUserId,
        organizationId: resolvedOrgId,
        customerEmail: profileData.email
      });
    }
  };

  const handleOrganizationOrder = () => {
    if (!selectedOrg) {
      alert('Please select an organization');
      return;
    }

    const org = organizations.find(o => o.id === selectedOrg);
    if (!org) return;

    onSelect({
      customerId: currentUserId,
      organizationId: selectedOrg,
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
      customerEmail: customer.email
    });
  };

  const filteredCustomers = customers.filter(c =>
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center space-x-2">
          <User className="h-5 w-5 text-blue-600" />
          <span>Who are you ordering for?</span>
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Select whether you're ordering for yourself or on behalf of an organization
        </p>

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
              <span>Select Organization *</span>
            </label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Choose an organization...</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1">
              Required for organizational orders
            </p>
          </div>

          <button
            onClick={handleOrganizationOrder}
            disabled={!selectedOrg}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continue with Organization Order
          </button>
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
                Shipping address will be selected during checkout
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
