import React, { useState, useEffect } from 'react';
import {
  Building2, Users, Plus, Trash2, X, UserPlus, UserCheck,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { ENV } from '@/config/env';

// Secondary client for signUp calls — avoids replacing the current user's session
const signUpClient = createClient(
  ENV.SUPABASE_URL.replace(/\/$/, ''),
  ENV.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

// ── Interfaces ───────────────────────────────────────────────────────────────

interface Distributor {
  id: string;
  profile_id: string;
  name: string;
  code: string;
}

interface DistributorCustomer {
  id: string;
  distributor_id: string;
  organization_id: string;
  is_active: boolean;
  notes?: string;
  organizations: { name: string; code: string; contact_name?: string; contact_email?: string; contact_phone?: string; city?: string; state?: string };
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

interface DistributorDelegate {
  id: string;
  distributor_id: string;
  user_id: string;
  is_active: boolean;
  notes?: string;
  profiles?: { email: string; full_name?: string };
}

interface DistributorPortalProps {
  view: 'customers' | 'sales-reps' | 'delegates';
}

// ── Shared Tailwind classes ──────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent';
const selectCls = inputCls;
const primaryBtnCls =
  'px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:shadow-lg text-sm font-medium transition-all';
const cancelBtnCls =
  'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors';

// ── Auto-generate org code from name ─────────────────────────────────────────

function generateOrgCode(name: string, existingCodes: string[]): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'ORG';
  let code = base;
  let i = 1;
  while (existingCodes.includes(code)) {
    code = `${base}${i}`;
    i++;
  }
  return code;
}

// ── Component ────────────────────────────────────────────────────────────────

const DistributorPortal: React.FC<DistributorPortalProps> = ({ view }) => {
  const { user, profile, isImpersonating, effectiveProfile } = useAuth();
  const activeUserId = isImpersonating ? effectiveProfile?.id : user?.id;

  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [customers, setCustomers] = useState<DistributorCustomer[]>([]);
  const [salesReps, setSalesReps] = useState<DistributorSalesRep[]>([]);
  const [delegates, setDelegates] = useState<DistributorDelegate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Add Customer (create new org) ──────────────────────────────────────────
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '', code: '', contact_name: '', contact_email: '', contact_phone: '',
    address: '', city: '', state: '', zip: '', description: '',
  });
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  // ── Add Sales Rep ──────────────────────────────────────────────────────────
  const [showAddSalesRep, setShowAddSalesRep] = useState(false);
  const [showCreateRepUser, setShowCreateRepUser] = useState(false);
  const [newRepEmail, setNewRepEmail] = useState('');
  const [newRepPassword, setNewRepPassword] = useState('');
  const [newRepFullName, setNewRepFullName] = useState('');
  const [newRepPhone, setNewRepPhone] = useState('');
  const [isCreatingRepUser, setIsCreatingRepUser] = useState(false);
  const [newSalesRep, setNewSalesRep] = useState({
    sales_rep_id: '',
    commission_split_type: 'percentage_of_distributor' as 'percentage_of_distributor' | 'fixed_with_override',
    sales_rep_rate: 50,
    distributor_override_rate: 0,
    notes: '',
  });

  // ── Add Delegate ───────────────────────────────────────────────────────────
  const [showAddDelegate, setShowAddDelegate] = useState(false);
  const [showCreateDelegateUser, setShowCreateDelegateUser] = useState(false);
  const [newDelegateEmail, setNewDelegateEmail] = useState('');
  const [newDelegatePassword, setNewDelegatePassword] = useState('');
  const [newDelegateFullName, setNewDelegateFullName] = useState('');
  const [isCreatingDelegateUser, setIsCreatingDelegateUser] = useState(false);
  const [selectedDelegateUserId, setSelectedDelegateUserId] = useState('');
  const [delegateNotes, setDelegateNotes] = useState('');

  useEffect(() => { fetchData(); }, [activeUserId]);

  const fetchData = async () => {
    if (!activeUserId) return;
    try {
      setLoading(true);
      setError(null);

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

      const [custRes, repsRes, delegatesRes] = await Promise.all([
        supabase
          .from('distributor_customers')
          .select('*, organizations(name, code, contact_name, contact_email, contact_phone, city, state)')
          .eq('distributor_id', distData.id)
          .eq('is_active', true),
        supabase
          .from('distributor_sales_reps')
          .select('*, profiles!distributor_sales_reps_sales_rep_id_fkey(email, full_name, phone)')
          .eq('distributor_id', distData.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('distributor_delegates')
          .select('*, profiles!distributor_delegates_user_id_fkey(email, full_name)')
          .eq('distributor_id', distData.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);

      if (!custRes.error) setCustomers((custRes.data as DistributorCustomer[]) || []);
      if (!repsRes.error) setSalesReps((repsRes.data as DistributorSalesRep[]) || []);
      if (!delegatesRes.error) setDelegates((delegatesRes.data as DistributorDelegate[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ── Customer handlers ──────────────────────────────────────────────────────

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributor) return;
    try {
      setError(null);
      // 1. Create the organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert([{
          name: newCustomer.name,
          code: newCustomer.code,
          contact_name: newCustomer.contact_name || null,
          contact_email: newCustomer.contact_email || null,
          contact_phone: newCustomer.contact_phone || null,
          address: newCustomer.address || null,
          city: newCustomer.city || null,
          state: newCustomer.state || null,
          zip: newCustomer.zip || null,
          description: newCustomer.description || null,
          is_active: true,
        }])
        .select('id')
        .single();
      if (orgError) throw orgError;

      // 2. Link it as a distributor customer
      const { error: linkError } = await supabase
        .from('distributor_customers')
        .insert([{ distributor_id: distributor.id, organization_id: orgData.id, is_active: true }]);
      if (linkError) throw linkError;

      setSuccess('Customer created and added');
      setShowAddCustomer(false);
      resetNewCustomer();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    }
  };

  const resetNewCustomer = () => {
    setNewCustomer({ name: '', code: '', contact_name: '', contact_email: '', contact_phone: '', address: '', city: '', state: '', zip: '', description: '' });
    setCodeManuallyEdited(false);
  };

  const handleRemoveCustomer = async (id: string) => {
    if (!confirm('Remove this customer?')) return;
    try {
      setError(null);
      await supabase.from('distributor_customers').update({ is_active: false }).eq('id', id);
      setSuccess('Customer removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove customer');
    }
  };

  // ── Sales Rep handlers ─────────────────────────────────────────────────────

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
        sales_rep_id: '', commission_split_type: 'percentage_of_distributor',
        sales_rep_rate: 50, distributor_override_rate: 0, notes: '',
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
      await supabase.from('distributor_sales_reps').update({ is_active: false }).eq('id', id);
      setSuccess('Sales rep removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sales rep');
    }
  };

  const handleCreateSalesRepUser = async () => {
    if (!newRepEmail.trim() || !newRepPassword.trim()) {
      setError('Email and password are required');
      return;
    }
    if (newRepPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!distributor) return;
    try {
      setIsCreatingRepUser(true);
      setError(null);

      // 1. Create auth user via signUp on a disposable client (won't affect current session)
      const { data: signUpData, error: signUpError } = await signUpClient.auth.signUp({
        email: newRepEmail,
        password: newRepPassword,
      });
      if (signUpError) throw new Error(signUpError.message);
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error('User creation failed — no user ID returned');
      // Supabase returns identities:[] when the email already exists (no error thrown)
      if (!signUpData.user?.identities?.length) {
        throw new Error('A user with this email already exists');
      }

      // 2. Brief wait to ensure the handle_new_user trigger has committed the profile
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Call DB function to set role, name, phone (SECURITY DEFINER, bypasses RLS)
      const { data: setupResult, error: setupError } = await supabase.rpc('distributor_setup_user', {
        p_user_id: newUserId,
        p_role: 'sales_rep',
        p_full_name: newRepFullName || null,
        p_phone: newRepPhone || null,
      });
      if (setupError) throw new Error(setupError.message);
      if (setupResult && !setupResult.success) throw new Error(setupResult.error || 'Failed to set up user profile');

      // 3. Auto-assign this new rep to the distributorship
      await supabase.from('distributor_sales_reps').insert([{
        distributor_id: distributor.id,
        sales_rep_id: newUserId,
        commission_split_type: newSalesRep.commission_split_type,
        sales_rep_rate: newSalesRep.sales_rep_rate,
        distributor_override_rate: newSalesRep.commission_split_type === 'fixed_with_override'
          ? newSalesRep.distributor_override_rate : null,
        is_active: true,
        notes: newSalesRep.notes || null,
      }]);

      setNewRepEmail('');
      setNewRepPassword('');
      setNewRepFullName('');
      setNewRepPhone('');
      setShowCreateRepUser(false);
      setShowAddSalesRep(false);
      setNewSalesRep({
        sales_rep_id: '', commission_split_type: 'percentage_of_distributor',
        sales_rep_rate: 50, distributor_override_rate: 0, notes: '',
      });
      setSuccess('Sales rep created and added');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsCreatingRepUser(false);
    }
  };

  // ── Delegate handlers ──────────────────────────────────────────────────────

  const handleAddDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributor || !selectedDelegateUserId) return;
    try {
      setError(null);
      const { error: insertError } = await supabase
        .from('distributor_delegates')
        .insert([{
          distributor_id: distributor.id,
          user_id: selectedDelegateUserId,
          is_active: true,
          notes: delegateNotes || null,
        }]);
      if (insertError) throw insertError;
      setSuccess('Delegate added');
      setShowAddDelegate(false);
      setSelectedDelegateUserId('');
      setDelegateNotes('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add delegate');
    }
  };

  const handleRemoveDelegate = async (id: string) => {
    if (!confirm('Remove this delegate?')) return;
    try {
      setError(null);
      await supabase.from('distributor_delegates').update({ is_active: false }).eq('id', id);
      setSuccess('Delegate removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove delegate');
    }
  };

  const handleCreateDelegateUser = async () => {
    if (!newDelegateEmail.trim() || !newDelegatePassword.trim()) {
      setError('Email and password are required');
      return;
    }
    if (newDelegatePassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!distributor) return;
    try {
      setIsCreatingDelegateUser(true);
      setError(null);

      // 1. Create auth user via signUp on a disposable client
      const { data: signUpData, error: signUpError } = await signUpClient.auth.signUp({
        email: newDelegateEmail,
        password: newDelegatePassword,
      });
      if (signUpError) throw new Error(signUpError.message);
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error('User creation failed — no user ID returned');
      if (!signUpData.user?.identities?.length) {
        throw new Error('A user with this email already exists');
      }

      // 2. Brief wait to ensure the handle_new_user trigger has committed the profile
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Set role to distributor via DB function
      const { data: setupResult, error: setupError } = await supabase.rpc('distributor_setup_user', {
        p_user_id: newUserId,
        p_role: 'distributor',
        p_full_name: newDelegateFullName || null,
        p_phone: null,
      });
      if (setupError) throw new Error(setupError.message);
      if (setupResult && !setupResult.success) throw new Error(setupResult.error || 'Failed to set up user profile');

      // 3. Auto-assign as delegate
      await supabase.from('distributor_delegates').insert([{
        distributor_id: distributor.id,
        user_id: newUserId,
        is_active: true,
        notes: delegateNotes || null,
      }]);

      setNewDelegateEmail('');
      setNewDelegatePassword('');
      setNewDelegateFullName('');
      setShowCreateDelegateUser(false);
      setShowAddDelegate(false);
      setDelegateNotes('');
      setSelectedDelegateUserId('');
      setSuccess('Delegate user created and added');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create delegate user');
    } finally {
      setIsCreatingDelegateUser(false);
    }
  };

  // Clear success message
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

  // For the sales rep selector, only show reps already in this distributorship
  const existingRepIds = new Set(salesReps.map((r) => r.sales_rep_id));
  // For delegate selector, show reps from this distributorship who aren't already delegates
  const existingDelegateIds = new Set(delegates.map((d) => d.user_id));
  // Build list of existing org codes for auto-code generation
  const existingOrgCodes = customers.map((c) => c.organizations?.code).filter(Boolean);

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
              New Customer
            </button>
          </div>

          {customers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              <Building2 className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm">No customers yet.</p>
              <p className="text-xs text-gray-400 mt-1">Create new customer organizations to start tracking orders and commissions.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
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
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {cust.organizations?.contact_name && (
                            <div className="text-xs font-medium text-gray-900">{cust.organizations.contact_name}</div>
                          )}
                          <span className="text-xs text-gray-500">
                            {cust.organizations?.contact_email || cust.organizations?.contact_phone || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {[cust.organizations?.city, cust.organizations?.state].filter(Boolean).join(', ') || '—'}
                        </span>
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

          {/* Create New Customer Modal */}
          {showAddCustomer && (
            <Modal title="New Customer" onClose={() => { setShowAddCustomer(false); resetNewCustomer(); }}>
              <form onSubmit={handleCreateCustomer}>
                <div className="space-y-4">
                  <Field label="Organization Name *">
                    <input
                      type="text"
                      required
                      value={newCustomer.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const updates: { name: string; code?: string } = { name };
                        if (!codeManuallyEdited) {
                          updates.code = generateOrgCode(name, existingOrgCodes);
                        }
                        setNewCustomer({ ...newCustomer, ...updates });
                      }}
                      className={inputCls}
                      placeholder="e.g. Smith Medical Clinic"
                    />
                  </Field>

                  <Field label="Code *">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={newCustomer.code}
                        onChange={(e) => {
                          setNewCustomer({ ...newCustomer, code: e.target.value.toUpperCase() });
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
                            setNewCustomer({
                              ...newCustomer,
                              code: generateOrgCode(newCustomer.name, existingOrgCodes),
                            });
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
                  </Field>

                  <Field label="Contact Name">
                    <input
                      type="text"
                      value={newCustomer.contact_name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, contact_name: e.target.value })}
                      className={inputCls}
                      placeholder="Primary contact person"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Contact Email">
                      <input
                        type="email"
                        value={newCustomer.contact_email}
                        onChange={(e) => setNewCustomer({ ...newCustomer, contact_email: e.target.value })}
                        className={inputCls}
                        placeholder="contact@example.com"
                      />
                    </Field>
                    <Field label="Contact Phone">
                      <input
                        type="tel"
                        value={newCustomer.contact_phone}
                        onChange={(e) => setNewCustomer({ ...newCustomer, contact_phone: e.target.value })}
                        className={inputCls}
                        placeholder="(555) 555-1234"
                      />
                    </Field>
                  </div>

                  <Field label="Address">
                    <input
                      type="text"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      className={inputCls}
                      placeholder="Street address"
                    />
                  </Field>

                  <div className="grid grid-cols-3 gap-4">
                    <Field label="City">
                      <input
                        type="text"
                        value={newCustomer.city}
                        onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                        className={inputCls}
                        placeholder="City"
                      />
                    </Field>
                    <Field label="State">
                      <input
                        type="text"
                        value={newCustomer.state}
                        onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
                        className={inputCls}
                        placeholder="State"
                      />
                    </Field>
                    <Field label="Zip">
                      <input
                        type="text"
                        value={newCustomer.zip}
                        onChange={(e) => setNewCustomer({ ...newCustomer, zip: e.target.value })}
                        className={inputCls}
                        placeholder="Zip"
                      />
                    </Field>
                  </div>

                  <Field label="Description">
                    <textarea
                      value={newCustomer.description}
                      onChange={(e) => setNewCustomer({ ...newCustomer, description: e.target.value })}
                      className={inputCls}
                      rows={2}
                      placeholder="Optional description..."
                    />
                  </Field>
                </div>

                <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => { setShowAddCustomer(false); resetNewCustomer(); }} className={cancelBtnCls}>
                    Cancel
                  </button>
                  <button type="submit" className={primaryBtnCls} disabled={!newCustomer.name || !newCustomer.code}>
                    Create Customer
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
              <p className="text-sm">No sales representatives yet.</p>
              <p className="text-xs text-gray-400 mt-1">Create sales reps who sell on behalf of your distributorship.</p>
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

          {/* Add Sales Rep Modal — only creates new users for this distributorship */}
          {showAddSalesRep && (
            <Modal title="Add Sales Rep" onClose={() => { setShowAddSalesRep(false); setShowCreateRepUser(false); }}>
              {!showCreateRepUser ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Create a new sales rep user to add to your distributorship.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateRepUser(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create New Sales Rep
                  </button>
                  <div className="mt-4 flex justify-end">
                    <button type="button" onClick={() => setShowAddSalesRep(false)} className={cancelBtnCls}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-medium text-purple-700">New Sales Rep Details</h4>
                    <Field label="Full Name *">
                      <input
                        type="text"
                        required
                        value={newRepFullName}
                        onChange={(e) => setNewRepFullName(e.target.value)}
                        className={inputCls}
                        placeholder="John Smith"
                      />
                    </Field>
                    <Field label="Email *">
                      <input
                        type="email"
                        required
                        value={newRepEmail}
                        onChange={(e) => setNewRepEmail(e.target.value)}
                        className={inputCls}
                        placeholder="john@example.com"
                      />
                    </Field>
                    <Field label="Phone">
                      <input
                        type="tel"
                        value={newRepPhone}
                        onChange={(e) => setNewRepPhone(e.target.value)}
                        className={inputCls}
                        placeholder="(555) 555-1234"
                      />
                    </Field>
                    <Field label="Password *">
                      <input
                        type="password"
                        required
                        value={newRepPassword}
                        onChange={(e) => setNewRepPassword(e.target.value)}
                        className={inputCls}
                        placeholder="Min 6 characters"
                      />
                    </Field>
                  </div>

                  <Field label="Commission Split Type">
                    <select
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
                  </Field>

                  <Field
                    label={
                      newSalesRep.commission_split_type === 'percentage_of_distributor'
                        ? "Rep's Share (%)" : "Rep's Rate (%)"
                    }
                  >
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={newSalesRep.sales_rep_rate}
                      onChange={(e) => setNewSalesRep({ ...newSalesRep, sales_rep_rate: parseFloat(e.target.value) })}
                      className={inputCls}
                    />
                  </Field>

                  {newSalesRep.commission_split_type === 'fixed_with_override' && (
                    <Field label="Your Override Rate (%)">
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={newSalesRep.distributor_override_rate}
                        onChange={(e) => setNewSalesRep({ ...newSalesRep, distributor_override_rate: parseFloat(e.target.value) })}
                        className={inputCls}
                      />
                    </Field>
                  )}

                  <Field label="Notes">
                    <textarea
                      value={newSalesRep.notes}
                      onChange={(e) => setNewSalesRep({ ...newSalesRep, notes: e.target.value })}
                      className={inputCls} rows={2} placeholder="Optional notes..."
                    />
                  </Field>

                  <div className="flex gap-3 justify-end border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateRepUser(false);
                        setNewRepEmail(''); setNewRepPassword(''); setNewRepFullName(''); setNewRepPhone('');
                      }}
                      className={cancelBtnCls}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateSalesRepUser}
                      disabled={isCreatingRepUser || !newRepEmail || !newRepPassword || !newRepFullName}
                      className={`${primaryBtnCls} disabled:opacity-50`}
                    >
                      {isCreatingRepUser ? 'Creating...' : 'Create & Add Sales Rep'}
                    </button>
                  </div>
                </div>
              )}
            </Modal>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* DELEGATES VIEW                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {view === 'delegates' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-500" />
                Delegates
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Delegates can manage your customers, sales reps, and orders on your behalf.
              </p>
            </div>
            <button
              onClick={() => setShowAddDelegate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Delegate
            </button>
          </div>

          {delegates.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              <UserCheck className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm">No delegates yet.</p>
              <p className="text-xs text-gray-400 mt-1">Add users who can manage your distributorship on your behalf.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {delegates.map((del) => (
                <div key={del.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {del.profiles?.full_name || del.profiles?.email}
                    </p>
                    {del.profiles?.full_name && (
                      <p className="text-xs text-gray-500">{del.profiles.email}</p>
                    )}
                    {del.notes && (
                      <p className="text-xs text-gray-400 mt-0.5">{del.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveDelegate(del.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove delegate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Delegate Modal */}
          {showAddDelegate && (
            <Modal title="Add Delegate" onClose={() => { setShowAddDelegate(false); setShowCreateDelegateUser(false); }}>
              {!showCreateDelegateUser ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Create a new user who can manage your distributorship — they'll be able to add customers, manage sales reps, and view orders.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateDelegateUser(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create New Delegate User
                  </button>
                  <div className="mt-4 flex justify-end">
                    <button type="button" onClick={() => setShowAddDelegate(false)} className={cancelBtnCls}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleCreateDelegateUser(); }}>
                  <div className="space-y-4">
                    <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4 space-y-3">
                      <h4 className="text-sm font-medium text-indigo-700">New Delegate Details</h4>
                      <Field label="Full Name *">
                        <input
                          type="text"
                          required
                          value={newDelegateFullName}
                          onChange={(e) => setNewDelegateFullName(e.target.value)}
                          className={inputCls}
                          placeholder="Jane Doe"
                        />
                      </Field>
                      <Field label="Email *">
                        <input
                          type="email"
                          required
                          value={newDelegateEmail}
                          onChange={(e) => setNewDelegateEmail(e.target.value)}
                          className={inputCls}
                          placeholder="jane@example.com"
                        />
                      </Field>
                      <Field label="Password *">
                        <input
                          type="password"
                          required
                          value={newDelegatePassword}
                          onChange={(e) => setNewDelegatePassword(e.target.value)}
                          className={inputCls}
                          placeholder="Min 6 characters"
                        />
                      </Field>
                    </div>

                    <Field label="Notes">
                      <textarea
                        value={delegateNotes}
                        onChange={(e) => setDelegateNotes(e.target.value)}
                        className={inputCls} rows={2} placeholder="e.g. Office manager, handles daily operations"
                      />
                    </Field>
                  </div>

                  <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateDelegateUser(false);
                        setNewDelegateEmail(''); setNewDelegatePassword(''); setNewDelegateFullName('');
                      }}
                      className={cancelBtnCls}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingDelegateUser || !newDelegateEmail || !newDelegatePassword || !newDelegateFullName}
                      className={`${primaryBtnCls} disabled:opacity-50`}
                    >
                      {isCreatingDelegateUser ? 'Creating...' : 'Create & Add Delegate'}
                    </button>
                  </div>
                </form>
              )}
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
