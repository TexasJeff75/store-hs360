import React, { useState, useEffect } from 'react';
import { Building2, Users, DollarSign, Package, TrendingUp, Settings } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CustomerUserManagement from './CustomerUserManagement';
import PricingManagement from './PricingManagement';
import LocationManagement from './LocationManagement';

interface AssignedOrganization {
  id: string;
  name: string;
  code: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  commission_rate: number;
  is_active: boolean;
}

type SubTab = 'customers' | 'pricing' | 'locations';

const SalesRepDashboard: React.FC = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<AssignedOrganization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<AssignedOrganization | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('customers');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrgs: 0,
    activeOrgs: 0,
    totalCustomers: 0,
    pendingCommissions: 0
  });

  useEffect(() => {
    if (user) {
      fetchAssignedOrganizations();
      fetchStats();
    }
  }, [user]);

  const fetchAssignedOrganizations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organization_sales_reps')
        .select(`
          id,
          commission_rate,
          organizations:organization_id (
            id,
            name,
            code,
            description,
            contact_email,
            contact_phone,
            is_active
          )
        `)
        .eq('sales_rep_id', user?.id)
        .eq('is_active', true);

      if (error) throw error;

      const orgs = data?.map((item: any) => ({
        id: item.organizations.id,
        name: item.organizations.name,
        code: item.organizations.code,
        description: item.organizations.description,
        contact_email: item.organizations.contact_email,
        contact_phone: item.organizations.contact_phone,
        commission_rate: item.commission_rate,
        is_active: item.organizations.is_active
      })) || [];

      setOrganizations(orgs);
    } catch (err) {
      console.error('Error fetching assigned organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: orgData } = await supabase
        .from('organization_sales_reps')
        .select('organization_id')
        .eq('sales_rep_id', user?.id)
        .eq('is_active', true);

      const orgIds = orgData?.map(o => o.organization_id) || [];

      const [customerCount, commissionsData] = await Promise.all([
        supabase
          .from('user_organization_roles')
          .select('id', { count: 'exact', head: true })
          .in('organization_id', orgIds),
        supabase
          .from('commissions')
          .select('commission_amount')
          .eq('sales_rep_id', user?.id)
          .in('status', ['pending', 'approved'])
      ]);

      const totalCommissions = commissionsData.data?.reduce(
        (sum, c) => sum + Number(c.commission_amount),
        0
      ) || 0;

      setStats({
        totalOrgs: orgIds.length,
        activeOrgs: orgIds.length,
        totalCustomers: customerCount.count || 0,
        pendingCommissions: totalCommissions
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  if (selectedOrg) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSelectedOrg(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ←
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedOrg.name}</h2>
              <p className="text-sm text-gray-500">Code: {selectedOrg.code}</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {selectedOrg.commission_rate}% Commission
          </span>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveSubTab('customers')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeSubTab === 'customers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="inline h-4 w-4 mr-2" />
                Customer Users
              </button>
              <button
                onClick={() => setActiveSubTab('pricing')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeSubTab === 'pricing'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DollarSign className="inline h-4 w-4 mr-2" />
                Pricing
              </button>
              <button
                onClick={() => setActiveSubTab('locations')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeSubTab === 'locations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Building2 className="inline h-4 w-4 mr-2" />
                Locations
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeSubTab === 'customers' && (
              <CustomerUserManagement organizationId={selectedOrg.id} />
            )}
            {activeSubTab === 'pricing' && (
              <PricingManagement organizationId={selectedOrg.id} />
            )}
            {activeSubTab === 'locations' && (
              <LocationManagement organizationId={selectedOrg.id} />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Organizations</h2>
        <p className="text-gray-600 mt-1">Manage your assigned customer accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Organizations</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalOrgs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Customer Users</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCustomers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active Accounts</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeOrgs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Pending Commission</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${stats.pendingCommissions.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Assigned Organizations</h3>
        </div>

        {organizations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No organizations assigned yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedOrg(org)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{org.name}</h4>
                      <p className="text-sm text-gray-500">Code: {org.code}</p>
                      {org.description && (
                        <p className="text-sm text-gray-600 mt-1">{org.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {org.commission_rate}% Commission
                      </p>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        org.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <Settings className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesRepDashboard;
