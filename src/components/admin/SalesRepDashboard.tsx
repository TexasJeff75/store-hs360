import React, { useState, useEffect } from 'react';
import { Building2, Users, DollarSign, TrendingUp, Plus, Pencil, X, MapPin, Mail, Phone, ArrowLeft, Save, Search, Eye, Settings, CheckCircle, Archive } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CustomerUserManagement from './CustomerUserManagement';
import PricingManagement from './PricingManagement';
import AddressManagement from './AddressManagement';

interface AssignedOrganization {
  id: string;
  name: string;
  code: string;
  contact_name?: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  commission_rate: number;
  is_active: boolean;
}

type SubTab = 'customers' | 'pricing' | 'addresses';

const emptyOrg = {
  name: '', code: '', contact_name: '', contact_email: '', contact_phone: '',
  address: '', city: '', state: '', zip: '', description: '',
};

const SalesRepDashboard: React.FC = () => {
  const { effectiveUserId } = useAuth();
  const [organizations, setOrganizations] = useState<AssignedOrganization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<AssignedOrganization | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('customers');
  const [loading, setLoading] = useState(true);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [editingOrg, setEditingOrg] = useState<AssignedOrganization | null>(null);
  const [newOrg, setNewOrg] = useState({ ...emptyOrg });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [orgStats, setOrgStats] = useState<{ [key: string]: { addresses: number; users: number } }>({});
  const [stats, setStats] = useState({
    totalOrgs: 0,
    activeOrgs: 0,
    totalCustomers: 0,
    pendingCommissions: 0
  });

  useEffect(() => {
    if (effectiveUserId) {
      fetchAssignedOrganizations();
      fetchStats();
    }
  }, [effectiveUserId]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const generateOrgCode = (name: string): string => {
    if (!name.trim()) return '';
    const words = name.trim().split(/\s+/);
    let code = '';
    if (words.length === 1) {
      code = words[0].substring(0, Math.min(6, words[0].length)).toUpperCase();
    } else {
      code = words.slice(0, 3).map(w => w.substring(0, w.length >= 4 ? 3 : 2)).join('').toUpperCase();
    }
    if (code.length < 3) code = code.padEnd(3, 'X');
    const existing = organizations.map(o => o.code.toUpperCase());
    let finalCode = code;
    let counter = 1;
    while (existing.includes(finalCode)) {
      finalCode = code + counter.toString().padStart(2, '0');
      counter++;
    }
    return finalCode;
  };

  const fetchAssignedOrganizations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organization_sales_reps')
        .select(`
          id,
          commission_rate,
          organizations:organization_id (
            id, name, code, contact_name, description,
            contact_email, contact_phone,
            address, city, state, zip, is_active
          )
        `)
        .eq('sales_rep_id', effectiveUserId!)
        .eq('is_active', true);

      if (error) throw error;

      const orgs = data?.map((item: any) => ({
        id: item.organizations.id,
        name: item.organizations.name,
        code: item.organizations.code,
        contact_name: item.organizations.contact_name,
        description: item.organizations.description,
        contact_email: item.organizations.contact_email,
        contact_phone: item.organizations.contact_phone,
        address: item.organizations.address,
        city: item.organizations.city,
        state: item.organizations.state,
        zip: item.organizations.zip,
        commission_rate: item.commission_rate,
        is_active: item.organizations.is_active
      })) || [];

      setOrganizations(orgs);

      // Fetch per-org stats
      if (orgs.length > 0) {
        const orgIds = orgs.map((o: AssignedOrganization) => o.id);
        const [userRolesRes, addressesRes] = await Promise.all([
          supabase
            .from('user_organization_roles')
            .select('organization_id')
            .in('organization_id', orgIds),
          supabase
            .from('customer_addresses')
            .select('organization_id')
            .in('organization_id', orgIds),
        ]);
        const perOrgStats: { [key: string]: { addresses: number; users: number } } = {};
        orgIds.forEach((id: string) => { perOrgStats[id] = { addresses: 0, users: 0 }; });
        userRolesRes.data?.forEach((r: any) => {
          if (perOrgStats[r.organization_id]) perOrgStats[r.organization_id].users++;
        });
        addressesRes.data?.forEach((a: any) => {
          if (perOrgStats[a.organization_id]) perOrgStats[a.organization_id].addresses++;
        });
        setOrgStats(perOrgStats);
      }
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
        .eq('sales_rep_id', effectiveUserId!)
        .eq('is_active', true);

      const orgIds = orgData?.map(o => o.organization_id) || [];

      const [customerCount, commissionsData] = await Promise.all([
        supabase
          .from('user_organization_roles')
          .select('id', { count: 'exact', head: true })
          .in('organization_id', orgIds.length ? orgIds : ['none']),
        supabase
          .from('commissions')
          .select('commission_amount')
          .eq('sales_rep_id', effectiveUserId!)
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

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUserId) return;
    try {
      setError(null);
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert([{
          name: newOrg.name,
          code: newOrg.code,
          contact_name: newOrg.contact_name || null,
          contact_email: newOrg.contact_email || null,
          contact_phone: newOrg.contact_phone || null,
          address: newOrg.address || null,
          city: newOrg.city || null,
          state: newOrg.state || null,
          zip: newOrg.zip || null,
          description: newOrg.description || null,
          org_type: 'customer',
          is_active: true,
        }])
        .select('id')
        .single();
      if (orgError) throw orgError;

      // Look up this sales rep's distributor
      const { data: repDist } = await supabase
        .from('distributor_sales_reps')
        .select('distributor_id')
        .eq('sales_rep_id', effectiveUserId)
        .eq('is_active', true)
        .limit(1)
        .single();

      const distributorId = repDist?.distributor_id || null;

      // Link to this sales rep
      const { error: linkError } = await supabase
        .from('organization_sales_reps')
        .insert([{
          organization_id: orgData.id,
          sales_rep_id: effectiveUserId,
          distributor_id: distributorId,
          is_active: true,
        }]);
      if (linkError) throw linkError;

      // Auto-link customer org to distributor
      if (distributorId) {
        await supabase
          .from('distributor_customers')
          .upsert({
            distributor_id: distributorId,
            organization_id: orgData.id,
            is_active: true,
          }, { onConflict: 'distributor_id,organization_id' });
      }

      setSuccess('Customer organization created');
      setShowCreateOrg(false);
      setNewOrg({ ...emptyOrg });
      setCodeManuallyEdited(false);
      fetchAssignedOrganizations();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg) return;
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: editingOrg.name,
          contact_name: editingOrg.contact_name || null,
          contact_email: editingOrg.contact_email || null,
          contact_phone: editingOrg.contact_phone || null,
          address: editingOrg.address || null,
          city: editingOrg.city || null,
          state: editingOrg.state || null,
          zip: editingOrg.zip || null,
          description: editingOrg.description || null,
        })
        .eq('id', editingOrg.id);
      if (updateError) throw updateError;

      setSuccess('Customer updated');
      setEditingOrg(null);
      fetchAssignedOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  // ── Org detail view with sub-tabs ───────────────────────────────────────
  if (selectedOrg) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSelectedOrg(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedOrg.name}</h2>
              <p className="text-sm text-gray-500">
                Code: {selectedOrg.code}
                {selectedOrg.contact_name && <> &middot; {selectedOrg.contact_name}</>}
                {(selectedOrg.city || selectedOrg.state) && (
                  <> &middot; {[selectedOrg.city, selectedOrg.state].filter(Boolean).join(', ')}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setEditingOrg(selectedOrg)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {selectedOrg.commission_rate}% Commission
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
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
                onClick={() => setActiveSubTab('addresses')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeSubTab === 'addresses'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MapPin className="inline h-4 w-4 mr-2" />
                Addresses
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
            {activeSubTab === 'addresses' && (
              <AddressManagement organizationId={selectedOrg.id} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ── Org form fields (shared by create & edit) ───────────────────────────
  const renderOrgForm = (
    values: typeof emptyOrg,
    onChange: (updates: Partial<typeof emptyOrg>) => void,
    opts?: { showCode?: boolean }
  ) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
        <input
          type="text"
          required
          value={values.name}
          onChange={(e) => {
            const name = e.target.value;
            const updates: Partial<typeof emptyOrg> = { name };
            if (opts?.showCode && !codeManuallyEdited) {
              updates.code = generateOrgCode(name);
            }
            onChange(updates);
          }}
          className={inputCls}
          placeholder="e.g. Smith Medical Clinic"
        />
      </div>

      {opts?.showCode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              value={values.code}
              onChange={(e) => {
                onChange({ code: e.target.value.toUpperCase() });
                setCodeManuallyEdited(true);
              }}
              className={`${inputCls} font-mono uppercase`}
              placeholder="SMITH"
            />
            {codeManuallyEdited && (
              <button
                type="button"
                onClick={() => {
                  setCodeManuallyEdited(false);
                  onChange({ code: generateOrgCode(values.name) });
                }}
                className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
              >
                Auto
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {codeManuallyEdited ? 'Manually edited' : 'Auto-generated from name'}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
        <input
          type="text"
          value={values.contact_name}
          onChange={(e) => onChange({ contact_name: e.target.value })}
          className={inputCls}
          placeholder="Primary contact person"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
          <input
            type="email"
            value={values.contact_email}
            onChange={(e) => onChange({ contact_email: e.target.value })}
            className={inputCls}
            placeholder="contact@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
          <input
            type="tel"
            value={values.contact_phone}
            onChange={(e) => onChange({ contact_phone: e.target.value })}
            className={inputCls}
            placeholder="(555) 555-1234"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input
          type="text"
          value={values.address}
          onChange={(e) => onChange({ address: e.target.value })}
          className={inputCls}
          placeholder="Street address"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            value={values.city}
            onChange={(e) => onChange({ city: e.target.value })}
            className={inputCls}
            placeholder="City"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input
            type="text"
            value={values.state}
            onChange={(e) => onChange({ state: e.target.value })}
            className={inputCls}
            placeholder="State"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
          <input
            type="text"
            value={values.zip}
            onChange={(e) => onChange({ zip: e.target.value })}
            className={inputCls}
            placeholder="Zip"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={inputCls}
          rows={2}
          placeholder="Optional description..."
        />
      </div>
    </div>
  );

  // ── Main list view ──────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Customers</h2>
          <p className="text-gray-600 mt-1">Manage your assigned customer accounts</p>
        </div>
        <button
          onClick={() => setShowCreateOrg(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, code, or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Customers</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalOrgs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeOrgs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Customer Users</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCustomers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
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

      {/* Organizations Table */}
      {(() => {
        const filteredOrgs = organizations.filter((org) => {
          if (!searchTerm) return true;
          const term = searchTerm.toLowerCase();
          return (
            org.name?.toLowerCase().includes(term) ||
            org.code?.toLowerCase().includes(term) ||
            org.description?.toLowerCase().includes(term) ||
            org.contact_name?.toLowerCase().includes(term) ||
            org.contact_email?.toLowerCase().includes(term)
          );
        });

        return (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {filteredOrgs.length === 0 && organizations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">No customers assigned yet</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Add Customer" to create your first customer organization.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOrgs.map((org) => (
                        <tr key={org.id} className={org.is_active ? 'hover:bg-gray-50' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => { setSelectedOrg(org); setActiveSubTab('customers'); }}
                                className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingOrg(org)}
                                className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                                title="Edit Customer"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedOrg(org); setActiveSubTab('addresses'); }}
                                className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                title="Manage Addresses & Pricing"
                              >
                                <Settings className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={`p-2 rounded-lg ${org.is_active ? 'bg-blue-100' : 'bg-gray-200'}`}>
                                <Building2 className={`h-5 w-5 ${org.is_active ? 'text-blue-600' : 'text-gray-500'}`} />
                              </div>
                              <div className="ml-3">
                                <div className={`text-sm font-semibold ${org.is_active ? 'text-gray-900' : 'text-gray-600'}`}>
                                  {org.name}
                                </div>
                                <div className="text-sm text-gray-500">Code: {org.code}</div>
                                {org.description && (
                                  <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">{org.description}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {org.contact_name && (
                                <div className="text-sm font-medium text-gray-900">{org.contact_name}</div>
                              )}
                              {org.contact_email && (
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Mail className="h-3 w-3 text-gray-400" />
                                  <span className="truncate max-w-xs">{org.contact_email}</span>
                                </div>
                              )}
                              {org.contact_phone && (
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Phone className="h-3 w-3 text-gray-400" />
                                  <span>{org.contact_phone}</span>
                                </div>
                              )}
                              {(org.city || org.state) && (
                                <div className="flex items-center space-x-2 text-sm text-gray-500">
                                  <MapPin className="h-3 w-3 text-gray-400" />
                                  <span>{[org.city, org.state].filter(Boolean).join(', ')}</span>
                                </div>
                              )}
                              {!org.contact_name && !org.contact_email && !org.contact_phone && (
                                <span className="text-sm text-gray-400">No contact info</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-1">
                                <MapPin className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-900">
                                  {orgStats[org.id]?.addresses || 0}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Users className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-gray-900">
                                  {orgStats[org.id]?.users || 0}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-1">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                org.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {org.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-xs text-gray-500">{org.commission_rate}% Commission</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {filteredOrgs.length === 0 && organizations.length > 0 && (
              <div className="text-center py-12">
                <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria.</p>
              </div>
            )}
          </>
        );
      })()}

      {/* Create Org Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={e => e.stopPropagation()}>
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">New Customer Organization</h3>
              <button onClick={() => { setShowCreateOrg(false); setNewOrg({ ...emptyOrg }); setCodeManuallyEdited(false); setError(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateOrg} className="p-6">
              {renderOrgForm(newOrg, (updates) => setNewOrg(prev => ({ ...prev, ...updates })), { showCode: true })}
              <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                <button type="button" onClick={() => { setShowCreateOrg(false); setNewOrg({ ...emptyOrg }); setCodeManuallyEdited(false); setError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={!newOrg.name || !newOrg.code}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Org Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={e => e.stopPropagation()}>
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit {editingOrg.name}</h3>
              <button onClick={() => { setEditingOrg(null); setError(null); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              {renderOrgForm(
                {
                  name: editingOrg.name,
                  code: editingOrg.code,
                  contact_name: editingOrg.contact_name || '',
                  contact_email: editingOrg.contact_email || '',
                  contact_phone: editingOrg.contact_phone || '',
                  address: editingOrg.address || '',
                  city: editingOrg.city || '',
                  state: editingOrg.state || '',
                  zip: editingOrg.zip || '',
                  description: editingOrg.description || '',
                },
                (updates) => setEditingOrg(prev => prev ? { ...prev, ...updates } : prev)
              )}
              <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                <button onClick={() => { setEditingOrg(null); setError(null); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleUpdateOrg}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesRepDashboard;
