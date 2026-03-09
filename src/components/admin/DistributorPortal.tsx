import React, { useState, useEffect } from 'react';
import {
  Building2, Users, Plus, Trash2, X, UserPlus,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface Distributor {
  id: string;
  profile_id: string;
  name: string;
  code: string;
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface DistributorCustomer {
  id: string;
  distributor_id: string;
  organization_id: string;
  is_active: boolean;
  notes?: string;
  organizations: { name: string; code: string };
}

interface DistributorSalesRep {
  id: string;
  distributor_id: string;
  sales_rep_id: string;
  commission_split_type: 'percentage_of_distributor' | 'fixed_with_override';
  sales_rep_rate: number;
  distributor_override_rate?: number;
  is_active: boolean;
  notes?: string;
  profiles?: { email: string; full_name?: string; phone?: string };
}

interface SalesRepOption {
  id: string;
  email: string;
  full_name?: string;
}

interface DistributorPortalProps {
  view: 'customers' | 'sales-reps';
}

// ── Shared Tailwind classes ──────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent';
const selectCls = inputCls;
const primaryBtnCls =
  'px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:shadow-lg text-sm font-medium transition-all';
const cancelBtnCls =
  'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors';

// ── Component ────────────────────────────────────────────────────────────────

const DistributorPortal: React.FC<DistributorPortalProps> = ({ view }) => {
  const { user, profile, isImpersonating, effectiveProfile } = useAuth();
  const activeProfile = isImpersonating ? effectiveProfile : profile;
  const activeUserId = isImpersonating ? effectiveProfile?.id : user?.id;

  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [customers, setCustomers] = useState<DistributorCustomer[]>([]);
  const [salesReps, setSalesReps] = useState<DistributorSalesRep[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [availableSalesReps, setAvailableSalesReps] = useState<SalesRepOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add customer modal
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');

  // Add sales rep modal
  const [showAddSalesRep, setShowAddSalesRep] = useState(false);
  const [newSalesRep, setNewSalesRep] = useState({
    sales_rep_id: '',
    commission_split_type: 'percentage_of_distributor' as 'percentage_of_distributor' | 'fixed_with_override',
    sales_rep_rate: 50,
    distributor_override_rate: 0,
    notes: '',
  });

  // Inline sales rep user creation
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeUserId]);

  const fetchData = async () => {
    if (!activeUserId) return;
    try {
      setLoading(true);
      setError(null);

      // Get the distributor record for this user
      const { data: distData, error: distError } = await supabase
        .from('distributors')
        .select('id, profile_id, name, code')
        .eq('profile_id', activeUserId)
        .eq('is_active', true)
        .single();

      if (distError || !distData) {
        setError('No active distributor record found for your account.');
        setLoading(false);
        return;
      }

      setDistributor(distData);

      // Fetch customers, sales reps, orgs, and available reps in parallel
      const [custRes, repsRes, orgsRes, availRepsRes] = await Promise.all([
        supabase
          .from('distributor_customers')
          .select('*, organizations(name, code)')
          .eq('distributor_id', distData.id)
          .eq('is_active', true),
        supabase
          .from('distributor_sales_reps')
          .select('*, profiles!distributor_sales_reps_sales_rep_id_fkey(email, full_name, phone)')
          .eq('distributor_id', distData.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('organizations')
          .select('id, name, code')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('role', ['sales_rep'])
          .order('email'),
      ]);

      if (!custRes.error) setCustomers((custRes.data as DistributorCustomer[]) || []);
      if (!repsRes.error) setSalesReps((repsRes.data as DistributorSalesRep[]) || []);
      if (!orgsRes.error) setOrganizations(orgsRes.data || []);
      if (!availRepsRes.error) setAvailableSalesReps(availRepsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributor || !selectedOrgId) return;
    try {
      setError(null);
      const { error: insertError } = await supabase
        .from('distributor_customers')
        .insert([{ distributor_id: distributor.id, organization_id: selectedOrgId, is_active: true }]);
      if (insertError) throw insertError;
      setSuccess('Customer added');
      setShowAddCustomer(false);
      setSelectedOrgId('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add customer');
    }
  };

  const handleRemoveCustomer = async (id: string) => {
    if (!confirm('Remove this customer?')) return;
    try {
      setError(null);
      const { error: delError } = await supabase
        .from('distributor_customers')
        .update({ is_active: false })
        .eq('id', id);
      if (delError) throw delError;
      setSuccess('Customer removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove customer');
    }
  };

  const handleAddSalesRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributor || !newSalesRep.sales_rep_id) return;
    try {
      setError(null);
      const { error: insertError } = await supabase
        .from('distributor_sales_reps')
        .insert([{
          distributor_id: distributor.id,
          sales_rep_id: newSalesRep.sales_rep_id,
          commission_split_type: newSalesRep.commission_split_type,
          sales_rep_rate: newSalesRep.sales_rep_rate,
          distributor_override_rate: newSalesRep.commission_split_type === 'fixed_with_override'
            ? newSalesRep.distributor_override_rate : null,
          is_active: true,
          notes: newSalesRep.notes || null,
        }]);
      if (insertError) throw insertError;
      setSuccess('Sales rep added');
      setShowAddSalesRep(false);
      setNewSalesRep({
        sales_rep_id: '',
        commission_split_type: 'percentage_of_distributor',
        sales_rep_rate: 50,
        distributor_override_rate: 0,
        notes: '',
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sales rep');
    }
  };

  const handleRemoveSalesRep = async (id: string) => {
    if (!confirm('Remove this sales rep?')) return;
    try {
      setError(null);
      const { error: delError } = await supabase
        .from('distributor_sales_reps')
        .update({ is_active: false })
        .eq('id', id);
      if (delError) throw delError;
      setSuccess('Sales rep removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sales rep');
    }
  };

  const handleCreateSalesRepUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      setError('Email and password are required');
      return;
    }
    if (newUserPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      setIsCreatingUser(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            role: 'sales_rep',
            is_approved: true,
            full_name: newUserFullName || undefined,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'User creation failed');

      const createdEmail = newUserEmail.trim().toLowerCase();
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setShowCreateUser(false);

      // Re-fetch available sales reps and auto-select
      const { data: refreshed } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('role', ['sales_rep'])
        .order('email');

      if (refreshed) {
        setAvailableSalesReps(refreshed);
        const newUser = refreshed.find((u: SalesRepOption) => u.email.toLowerCase() === createdEmail);
        if (newUser) {
          setNewSalesRep((prev) => ({ ...prev, sales_rep_id: newUser.id }));
        }
      }

      setSuccess('Sales rep user created and selected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Clear success message after a delay
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 rounded-full border-2 border-pink-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!distributor) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Building2 className="mx-auto h-10 w-10 text-gray-300 mb-2" />
        <p>No distributor record found for your account.</p>
        <p className="text-sm text-gray-400 mt-1">Contact your administrator to set up your distributor account.</p>
      </div>
    );
  }

  const existingOrgIds = new Set(customers.map((c) => c.organization_id));
  const availableOrgs = organizations.filter((o) => !existingOrgIds.has(o.id));
  const existingRepIds = new Set(salesReps.map((r) => r.sales_rep_id));
  const filteredReps = availableSalesReps.filter((r) => !existingRepIds.has(r.id));

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* CUSTOMERS VIEW                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {view === 'customers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-500" />
              My Customers
            </h2>
            <button
              onClick={() => setShowAddCustomer(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
          </div>

          {customers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              <Building2 className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm">No customers assigned yet.</p>
              <p className="text-xs text-gray-400 mt-1">Add organizations as your customers to track orders and commissions.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Code</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{cust.organizations?.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-gray-500">{cust.organizations?.code}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemoveCustomer(cust.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove customer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Customer Modal */}
          {showAddCustomer && (
            <Modal title="Add Customer" onClose={() => { setShowAddCustomer(false); setSelectedOrgId(''); }}>
              <form onSubmit={handleAddCustomer}>
                <div className="space-y-4">
                  <Field label="Organization *">
                    <select
                      required
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select an organization</option>
                      {availableOrgs.map((o) => (
                        <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => { setShowAddCustomer(false); setSelectedOrgId(''); }} className={cancelBtnCls}>
                    Cancel
                  </button>
                  <button type="submit" className={primaryBtnCls}>
                    Add Customer
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SALES REPS VIEW                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {view === 'sales-reps' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-pink-500" />
              My Sales Representatives
            </h2>
            <button
              onClick={() => setShowAddSalesRep(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Sales Rep
            </button>
          </div>

          {salesReps.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              <Users className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm">No sales representatives assigned yet.</p>
              <p className="text-xs text-gray-400 mt-1">Add sales reps who sell on behalf of your distributorship.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {salesReps.map((dsr) => {
                const splitLabel =
                  dsr.commission_split_type === 'percentage_of_distributor'
                    ? `${dsr.sales_rep_rate}% of distributor commission`
                    : `Fixed ${dsr.sales_rep_rate}% + ${dsr.distributor_override_rate ?? 0}% override`;
                return (
                  <div key={dsr.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dsr.profiles?.full_name || dsr.profiles?.email}
                      </p>
                      {dsr.profiles?.full_name && (
                        <p className="text-xs text-gray-500">{dsr.profiles.email}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Split: <span className="font-medium text-gray-700">{splitLabel}</span>
                        {dsr.notes && <span className="ml-2 text-gray-400">{dsr.notes}</span>}
                      </p>
                      {dsr.profiles?.phone && (
                        <p className="text-xs text-gray-400 mt-0.5">Phone: {dsr.profiles.phone}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSalesRep(dsr.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Sales Rep Modal */}
          {showAddSalesRep && (
            <Modal title="Add Sales Rep" onClose={() => { setShowAddSalesRep(false); setShowCreateUser(false); }}>
              <form onSubmit={handleAddSalesRep}>
                <div className="space-y-4">
                  <Field label="Sales Representative *">
                    {!showCreateUser ? (
                      <div className="flex gap-2">
                        <select
                          required
                          value={newSalesRep.sales_rep_id}
                          onChange={(e) => setNewSalesRep({ ...newSalesRep, sales_rep_id: e.target.value })}
                          className={`${selectCls} flex-1`}
                        >
                          <option value="">Select a sales rep</option>
                          {filteredReps.map((rep) => (
                            <option key={rep.id} value={rep.id}>
                              {rep.full_name ? `${rep.full_name} (${rep.email})` : rep.email}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowCreateUser(true)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg whitespace-nowrap"
                        >
                          <UserPlus className="h-4 w-4" />
                          New
                        </button>
                      </div>
                    ) : (
                      <div className="border border-purple-200 bg-purple-50 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-purple-700">Create New Sales Rep</span>
                          <button
                            type="button"
                            onClick={() => { setShowCreateUser(false); setNewUserEmail(''); setNewUserPassword(''); setNewUserFullName(''); }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={newUserFullName}
                          onChange={(e) => setNewUserFullName(e.target.value)}
                          className={inputCls}
                          placeholder="Full name"
                        />
                        <input
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className={inputCls}
                          placeholder="Email address"
                        />
                        <input
                          type="password"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className={inputCls}
                          placeholder="Password (min 6 characters)"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleCreateSalesRepUser}
                            disabled={isCreatingUser}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
                          >
                            {isCreatingUser ? 'Creating...' : 'Create & Select'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowCreateUser(false); setNewUserEmail(''); setNewUserPassword(''); setNewUserFullName(''); }}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">
                          User will be created with the <strong>sales_rep</strong> role.
                        </p>
                      </div>
                    )}
                  </Field>

                  <Field label="Commission Split Type *">
                    <select
                      required
                      value={newSalesRep.commission_split_type}
                      onChange={(e) =>
                        setNewSalesRep({
                          ...newSalesRep,
                          commission_split_type: e.target.value as 'percentage_of_distributor' | 'fixed_with_override',
                        })
                      }
                      className={selectCls}
                    >
                      <option value="percentage_of_distributor">% of Distributor Commission</option>
                      <option value="fixed_with_override">Fixed Rate with Override</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {newSalesRep.commission_split_type === 'percentage_of_distributor'
                        ? "Sales rep receives a percentage of your commission"
                        : "Sales rep earns their own rate; you earn an additional override"}
                    </p>
                  </Field>

                  <Field
                    label={
                      newSalesRep.commission_split_type === 'percentage_of_distributor'
                        ? "Rep's Share (%)"
                        : "Rep's Rate (%)"
                    }
                  >
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="0.01"
                      value={newSalesRep.sales_rep_rate}
                      onChange={(e) =>
                        setNewSalesRep({ ...newSalesRep, sales_rep_rate: parseFloat(e.target.value) })
                      }
                      className={inputCls}
                    />
                  </Field>

                  {newSalesRep.commission_split_type === 'fixed_with_override' && (
                    <Field label="Your Override Rate (%)">
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        step="0.01"
                        value={newSalesRep.distributor_override_rate}
                        onChange={(e) =>
                          setNewSalesRep({ ...newSalesRep, distributor_override_rate: parseFloat(e.target.value) })
                        }
                        className={inputCls}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Additional commission you earn on top of the rep's rate
                      </p>
                    </Field>
                  )}

                  <Field label="Notes">
                    <textarea
                      value={newSalesRep.notes}
                      onChange={(e) => setNewSalesRep({ ...newSalesRep, notes: e.target.value })}
                      className={inputCls}
                      rows={2}
                      placeholder="Optional notes..."
                    />
                  </Field>
                </div>

                <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => setShowAddSalesRep(false)} className={cancelBtnCls}>
                    Cancel
                  </button>
                  <button type="submit" className={primaryBtnCls}>
                    Add Sales Rep
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────────

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title, onClose, children,
}) => (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex items-center justify-center min-h-screen px-4 py-8">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

export default DistributorPortal;
