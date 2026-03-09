import React, { useState, useEffect } from 'react';
import { Building2, Users, DollarSign, TrendingUp, Plus, Pencil, X, MapPin, Mail, Phone, ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CustomerUserManagement from './CustomerUserManagement';
import PricingManagement from './PricingManagement';
import LocationManagement from './LocationManagement';

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

type SubTab = 'customers' | 'pricing' | 'locations';

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
          is_active: true,
        }])
        .select('id')
        .single();
      if (orgError) throw orgError;

      // Link to this sales rep
      const { error: linkError } = await supabase
        .from('organization_sales_reps')
        .insert([{
          organization_id: orgData.id,
          sales_rep_id: effectiveUserId,
          commission_rate: 10,
          is_active: true,
        }]);
      if (linkError) throw linkError;

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

      setSuccess('Organization updated');
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
      <div className="space-y-6">
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
                <MapPin className="inline h-4 w-4 mr-2" />
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Organizations</h2>
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

      {/* Stats */}
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

      {/* Org list */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Assigned Organizations</h3>
        </div>

        {organizations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No organizations assigned yet</p>
            <p className="text-sm text-gray-400 mt-1">Click "Add Customer" to create your first customer organization.</p>
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
                      {org.contact_name && (
                        <p className="text-sm text-gray-600">{org.contact_name}</p>
                      )}
                      {(org.contact_email || org.contact_phone) && (
                        <div className="flex items-center gap-3 mt-0.5">
                          {org.contact_email && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Mail className="h-3 w-3" />{org.contact_email}
                            </span>
                          )}
                          {org.contact_phone && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Phone className="h-3 w-3" />{org.contact_phone}
                            </span>
                          )}
                        </div>
                      )}
                      {(org.city || org.state) && (
                        <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {[org.city, org.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingOrg(org); }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit organization"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Org Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
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
