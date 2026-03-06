import React, { useState, useEffect } from 'react';
import {
  Users, Building, Plus, CreditCard as Edit2, Trash2, X, Save,
  TrendingUp, DollarSign, Building2, Percent, Package,
} from 'lucide-react';
import { supabase } from '@/services/supabase';

// ── Commission type config ───────────────────────────────────────────────────

export type CommissionType =
  | 'percent_gross_sales'
  | 'percent_margin'
  | 'percent_net_sales'
  | 'flat_per_order'
  | 'flat_per_unit';

const COMMISSION_TYPES: {
  value: CommissionType;
  label: string;
  description: string;
  rateLabel: string;
  rateUnit: string;
  isFlat: boolean;
}[] = [
  {
    value: 'percent_margin',
    label: '% of Margin',
    description: 'Percentage of (contracted price − product cost)',
    rateLabel: 'Rate',
    rateUnit: '%',
    isFlat: false,
  },
  {
    value: 'percent_gross_sales',
    label: '% of Gross Sales',
    description: 'Percentage of the total order value before any deductions',
    rateLabel: 'Rate',
    rateUnit: '%',
    isFlat: false,
  },
  {
    value: 'percent_net_sales',
    label: '% of Net Sales',
    description: 'Percentage of order value after discounts / credits',
    rateLabel: 'Rate',
    rateUnit: '%',
    isFlat: false,
  },
  {
    value: 'flat_per_order',
    label: 'Flat per Order',
    description: 'Fixed dollar amount earned for each order placed',
    rateLabel: 'Amount',
    rateUnit: '$',
    isFlat: true,
  },
  {
    value: 'flat_per_unit',
    label: 'Flat per Unit',
    description: 'Fixed dollar amount earned for each unit sold',
    rateLabel: 'Amount',
    rateUnit: '$',
    isFlat: true,
  },
];

function getCommissionTypeConfig(value: CommissionType) {
  return COMMISSION_TYPES.find((t) => t.value === value) ?? COMMISSION_TYPES[0];
}

function commissionRateLabel(type: CommissionType, rate: number) {
  const cfg = getCommissionTypeConfig(type);
  return cfg.isFlat ? `$${Number(rate).toFixed(2)}` : `${rate}%`;
}

// ── Interfaces ───────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface Distributor {
  id: string;
  profile_id: string;
  name: string;
  code: string;
  commission_rate: number;
  commission_type: CommissionType;
  organization_id?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  profiles?: { email: string };
  organizations?: { name: string; code: string } | null;
}

interface SalesRep {
  id: string;
  email: string;
  role: string;
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
  profiles?: { email: string };
}

// ── Component ────────────────────────────────────────────────────────────────

const DistributorManagement: React.FC = () => {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [availableUsers, setAvailableUsers] = useState<SalesRep[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [distributorSalesReps, setDistributorSalesReps] = useState<DistributorSalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDistributor, setShowAddDistributor] = useState(false);
  const [showAddSalesRep, setShowAddSalesRep] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<string | null>(null);
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newDistributor, setNewDistributor] = useState({
    profile_id: '',
    name: '',
    code: '',
    commission_rate: 45,
    commission_type: 'percent_margin' as CommissionType,
    organization_id: '',
    notes: '',
  });

  const [newDistributorSalesRep, setNewDistributorSalesRep] = useState({
    sales_rep_id: '',
    commission_split_type: 'percentage_of_distributor' as 'percentage_of_distributor' | 'fixed_with_override',
    sales_rep_rate: 50,
    distributor_override_rate: 0,
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [distributorsRes, orgsRes, allUsersRes, salesRepsRes, distSalesRepsRes] = await Promise.all([
        supabase
          .from('distributors')
          .select('*, profiles!distributors_profile_id_fkey(email), organizations(name, code)')
          .order('created_at', { ascending: false }),
        supabase
          .from('organizations')
          .select('id, name, code')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, email, role')
          .eq('approved', true)
          .neq('role', 'admin')
          .order('email'),
        supabase
          .from('profiles')
          .select('id, email, role')
          .in('role', ['sales_rep', 'distributor'])
          .order('email'),
        supabase
          .from('distributor_sales_reps')
          .select('*, profiles!distributor_sales_reps_sales_rep_id_fkey(email)')
          .order('created_at', { ascending: false }),
      ]);

      if (distributorsRes.error) throw distributorsRes.error;
      if (orgsRes.error) throw orgsRes.error;
      if (allUsersRes.error) throw allUsersRes.error;
      if (salesRepsRes.error) throw salesRepsRes.error;
      if (distSalesRepsRes.error) throw distSalesRepsRes.error;

      const distData = (distributorsRes.data as Distributor[]) || [];
      setDistributors(distData);
      setOrganizations(orgsRes.data || []);

      // Filter out users who already have a distributor record
      const existingProfileIds = new Set(distData.map(d => d.profile_id));
      setAvailableUsers((allUsersRes.data || []).filter(u => !existingProfileIds.has(u.id)));

      setSalesReps(salesRepsRes.data || []);
      setDistributorSalesReps(distSalesRepsRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const payload = {
        ...newDistributor,
        user_id: newDistributor.profile_id,
        organization_id: newDistributor.organization_id || null,
      };
      const { error: insertError } = await supabase.from('distributors').insert([payload]);
      if (insertError) throw insertError;

      setSuccess('Distributor created successfully');
      setShowAddDistributor(false);
      setNewDistributor({
        profile_id: '',
        name: '',
        code: '',
        commission_rate: 45,
        commission_type: 'percent_margin',
        organization_id: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create distributor');
    }
  };

  const handleUpdateDistributor = async () => {
    if (!editingDistributor) return;
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('distributors')
        .update({
          name: editingDistributor.name,
          code: editingDistributor.code,
          commission_rate: editingDistributor.commission_rate,
          commission_type: editingDistributor.commission_type,
          organization_id: editingDistributor.organization_id || null,
          is_active: editingDistributor.is_active,
          notes: editingDistributor.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDistributor.id);

      if (updateError) throw updateError;

      setSuccess('Distributor updated successfully');
      setEditingDistributor(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update distributor');
    }
  };

  const handleDeleteDistributor = async (id: string) => {
    if (!confirm('Delete this distributor? All associated sales rep relationships will also be removed.')) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('distributors').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSuccess('Distributor deleted');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete distributor');
    }
  };

  const handleAddSalesRepToDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistributor) return;
    try {
      setError(null);
      const { error: insertError } = await supabase.from('distributor_sales_reps').insert([{
        distributor_id: selectedDistributor,
        ...newDistributorSalesRep,
        distributor_override_rate:
          newDistributorSalesRep.commission_split_type === 'fixed_with_override'
            ? newDistributorSalesRep.distributor_override_rate
            : null,
      }]);

      if (insertError) throw insertError;

      setSuccess('Sales rep added to distributor');
      setShowAddSalesRep(false);
      setNewDistributorSalesRep({
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

  const handleRemoveSalesRepFromDistributor = async (id: string) => {
    if (!confirm('Remove this sales rep from the distributor?')) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase.from('distributor_sales_reps').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setSuccess('Sales rep removed');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sales rep');
    }
  };

  const getDistributorSalesReps = (distributorId: string) =>
    distributorSalesReps.filter((dsr) => dsr.distributor_id === distributorId && dsr.is_active);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Distributor Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage distributors, their customer accounts, commission structures, and sales rep hierarchies
          </p>
        </div>
        <button
          onClick={() => setShowAddDistributor(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all"
        >
          <Plus className="h-5 w-5" />
          Add Distributor
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>
      )}

      {/* Empty state */}
      {distributors.length === 0 && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl py-16 text-center">
          <Building className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No distributors yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Distributor" to create one</p>
        </div>
      )}

      {/* Distributors list */}
      <div className="grid gap-6">
        {distributors.map((distributor) => {
          const typeConfig = getCommissionTypeConfig(distributor.commission_type ?? 'percent_margin');
          const rateDisplay = commissionRateLabel(distributor.commission_type ?? 'percent_margin', distributor.commission_rate);
          const reps = getDistributorSalesReps(distributor.id);

          return (
            <div key={distributor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {editingDistributor?.id === distributor.id ? (
                /* ── Edit mode ─────────────────────────────────────────── */
                <EditDistributorForm
                  distributor={editingDistributor}
                  organizations={organizations}
                  onChange={setEditingDistributor}
                  onSave={handleUpdateDistributor}
                  onCancel={() => setEditingDistributor(null)}
                />
              ) : (
                /* ── View mode ─────────────────────────────────────────── */
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg shrink-0">
                        <Building className="h-6 w-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold text-gray-900">{distributor.name}</h3>
                        <p className="text-sm text-gray-500">Code: {distributor.code}</p>
                        <p className="text-sm text-gray-500">User: {distributor.profiles?.email ?? 'N/A'}</p>

                        {/* Organization badge */}
                        {distributor.organizations ? (
                          <div className="flex items-center gap-1.5 mt-1.5 text-sm text-indigo-700">
                            <Building2 className="h-4 w-4 shrink-0" />
                            <span className="font-medium">{distributor.organizations.name}</span>
                            <span className="text-indigo-400">({distributor.organizations.code})</span>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-gray-400 italic">No organization linked</p>
                        )}

                        {distributor.notes && (
                          <p className="text-sm text-gray-500 mt-1">{distributor.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Right-side badges + actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        distributor.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {distributor.is_active ? 'Active' : 'Inactive'}
                      </span>

                      {/* Commission type badge */}
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                        {typeConfig.isFlat
                          ? <Package className="h-3.5 w-3.5" />
                          : <Percent className="h-3.5 w-3.5" />}
                        {typeConfig.label}
                      </span>

                      {/* Rate badge */}
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {rateDisplay}
                      </span>

                      <button
                        onClick={() => setEditingDistributor(distributor)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDeleteDistributor(distributor.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Commission explanation */}
                  <div className="mb-4 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                    <strong>Commission basis:</strong> {typeConfig.description}
                    {' · '}
                    <strong>Distributor earns:</strong> {rateDisplay}
                    {reps.length > 0 && (
                      <>
                        {' · '}
                        <strong>Sales rep splits:</strong>{' '}
                        {reps.map((dsr) => {
                          const repEarns =
                            dsr.commission_split_type === 'percentage_of_distributor'
                              ? `${dsr.sales_rep_rate}% of dist. commission`
                              : typeConfig.isFlat
                                ? `$${dsr.sales_rep_rate} per ${distributor.commission_type === 'flat_per_unit' ? 'unit' : 'order'}`
                                : `${dsr.sales_rep_rate}% rate`;
                          return `${dsr.profiles?.email?.split('@')[0]} → ${repEarns}`;
                        }).join(', ')}
                      </>
                    )}
                  </div>

                  {/* Sales reps */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Sales Representatives ({reps.length})
                      </h4>
                      <button
                        onClick={() => { setSelectedDistributor(distributor.id); setShowAddSalesRep(true); }}
                        className="text-sm px-3 py-1 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition-colors"
                      >
                        Add Sales Rep
                      </button>
                    </div>

                    {reps.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No sales representatives assigned</p>
                    ) : (
                      <div className="space-y-2">
                        {reps.map((dsr) => {
                          const splitLabel =
                            dsr.commission_split_type === 'percentage_of_distributor'
                              ? `${dsr.sales_rep_rate}% of distributor commission`
                              : `Fixed ${dsr.sales_rep_rate}${typeConfig.isFlat ? '$' : '%'} + ${dsr.distributor_override_rate ?? 0}${typeConfig.isFlat ? '$' : '%'} override`;
                          return (
                            <div key={dsr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{dsr.profiles?.email}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Split: <span className="font-medium text-gray-700">{splitLabel}</span>
                                  {dsr.notes && <span className="ml-2 text-gray-400">{dsr.notes}</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveSalesRepFromDistributor(dsr.id)}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add Distributor Modal ────────────────────────────────────────────── */}
      {showAddDistributor && (
        <Modal title="Add New Distributor" onClose={() => setShowAddDistributor(false)}>
          <form onSubmit={handleCreateDistributor}>
            <div className="space-y-4">
              <Field label="Distributor User *">
                <select
                  required
                  value={newDistributor.profile_id}
                  onChange={(e) => setNewDistributor({ ...newDistributor, profile_id: e.target.value })}
                  className={selectCls}
                >
                  <option value="">Select a user</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.email} ({u.role || 'no role'})</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Distributor Name *">
                  <input
                    type="text"
                    required
                    value={newDistributor.name}
                    onChange={(e) => setNewDistributor({ ...newDistributor, name: e.target.value })}
                    className={inputCls}
                    placeholder="ABC Distribution"
                  />
                </Field>
                <Field label="Code *">
                  <input
                    type="text"
                    required
                    value={newDistributor.code}
                    onChange={(e) => setNewDistributor({ ...newDistributor, code: e.target.value.toUpperCase() })}
                    className={inputCls}
                    placeholder="DIST001"
                  />
                </Field>
              </div>

              <Field label="Customer Organization">
                <select
                  value={newDistributor.organization_id}
                  onChange={(e) => setNewDistributor({ ...newDistributor, organization_id: e.target.value })}
                  className={selectCls}
                >
                  <option value="">— Unlinked —</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name} ({org.code})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">The primary account this distributor serves</p>
              </Field>

              <Field label="Commission Basis *">
                <select
                  required
                  value={newDistributor.commission_type}
                  onChange={(e) =>
                    setNewDistributor({ ...newDistributor, commission_type: e.target.value as CommissionType })
                  }
                  className={selectCls}
                >
                  {COMMISSION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {getCommissionTypeConfig(newDistributor.commission_type).description}
                </p>
              </Field>

              <Field
                label={`${getCommissionTypeConfig(newDistributor.commission_type).rateLabel} (${getCommissionTypeConfig(newDistributor.commission_type).rateUnit}) *`}
              >
                <input
                  type="number"
                  required
                  min="0"
                  max={getCommissionTypeConfig(newDistributor.commission_type).isFlat ? undefined : 100}
                  step="0.01"
                  value={newDistributor.commission_rate}
                  onChange={(e) =>
                    setNewDistributor({ ...newDistributor, commission_rate: parseFloat(e.target.value) })
                  }
                  className={inputCls}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={newDistributor.notes}
                  onChange={(e) => setNewDistributor({ ...newDistributor, notes: e.target.value })}
                  className={inputCls}
                  rows={3}
                  placeholder="Optional notes..."
                />
              </Field>
            </div>

            <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowAddDistributor(false)}
                className={cancelBtnCls}
              >
                Cancel
              </button>
              <button type="submit" className={primaryBtnCls}>
                Create Distributor
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Sales Rep Modal ──────────────────────────────────────────────── */}
      {showAddSalesRep && selectedDistributor && (() => {
        const dist = distributors.find((d) => d.id === selectedDistributor);
        const typeConfig = dist ? getCommissionTypeConfig(dist.commission_type ?? 'percent_margin') : COMMISSION_TYPES[0];
        return (
          <Modal
            title={`Add Sales Rep — ${dist?.name ?? ''}`}
            onClose={() => setShowAddSalesRep(false)}
          >
            {dist && (
              <div className="mb-4 px-3 py-2 bg-violet-50 border border-violet-100 rounded-lg text-xs text-violet-700">
                <strong>Distributor commission:</strong> {commissionRateLabel(dist.commission_type, dist.commission_rate)}
                {' · '}
                <strong>Basis:</strong> {typeConfig.label}
              </div>
            )}
            <form onSubmit={handleAddSalesRepToDistributor}>
              <div className="space-y-4">
                <Field label="Sales Representative *">
                  <select
                    required
                    value={newDistributorSalesRep.sales_rep_id}
                    onChange={(e) =>
                      setNewDistributorSalesRep({ ...newDistributorSalesRep, sales_rep_id: e.target.value })
                    }
                    className={selectCls}
                  >
                    <option value="">Select a sales rep</option>
                    {salesReps
                      .filter(
                        (rep) =>
                          !getDistributorSalesReps(selectedDistributor).find(
                            (dsr) => dsr.sales_rep_id === rep.id,
                          ),
                      )
                      .map((rep) => (
                        <option key={rep.id} value={rep.id}>{rep.email}</option>
                      ))}
                  </select>
                </Field>

                <Field label="Commission Split Type *">
                  <select
                    required
                    value={newDistributorSalesRep.commission_split_type}
                    onChange={(e) =>
                      setNewDistributorSalesRep({
                        ...newDistributorSalesRep,
                        commission_split_type: e.target.value as 'percentage_of_distributor' | 'fixed_with_override',
                      })
                    }
                    className={selectCls}
                  >
                    <option value="percentage_of_distributor">% of Distributor Commission</option>
                    <option value="fixed_with_override">Fixed Rate with Distributor Override</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {newDistributorSalesRep.commission_split_type === 'percentage_of_distributor'
                      ? "Sales rep receives a percentage of the distributor's earned commission amount"
                      : "Sales rep earns their own fixed rate; distributor earns an additional override rate"}
                  </p>
                </Field>

                <Field
                  label={
                    newDistributorSalesRep.commission_split_type === 'percentage_of_distributor'
                      ? "Rep's Share of Distributor Commission (%)"
                      : `Rep's Fixed ${typeConfig.rateLabel} (${typeConfig.rateUnit}) *`
                  }
                >
                  <input
                    type="number"
                    required
                    min="0"
                    max={
                      newDistributorSalesRep.commission_split_type === 'percentage_of_distributor' || !typeConfig.isFlat
                        ? 100
                        : undefined
                    }
                    step="0.01"
                    value={newDistributorSalesRep.sales_rep_rate}
                    onChange={(e) =>
                      setNewDistributorSalesRep({
                        ...newDistributorSalesRep,
                        sales_rep_rate: parseFloat(e.target.value),
                      })
                    }
                    className={inputCls}
                  />
                  {newDistributorSalesRep.commission_split_type === 'percentage_of_distributor' && dist && (
                    <p className="text-xs text-gray-400 mt-1">
                      At {newDistributorSalesRep.sales_rep_rate}%: rep gets{' '}
                      {typeConfig.isFlat
                        ? `$${((dist.commission_rate * newDistributorSalesRep.sales_rep_rate) / 100).toFixed(2)}`
                        : `${((dist.commission_rate * newDistributorSalesRep.sales_rep_rate) / 100).toFixed(2)}%`}
                      {' '}of {typeConfig.label.toLowerCase()}
                    </p>
                  )}
                </Field>

                {newDistributorSalesRep.commission_split_type === 'fixed_with_override' && (
                  <Field label={`Distributor Override ${typeConfig.rateLabel} (${typeConfig.rateUnit})`}>
                    <input
                      type="number"
                      required
                      min="0"
                      max={typeConfig.isFlat ? undefined : 100}
                      step="0.01"
                      value={newDistributorSalesRep.distributor_override_rate}
                      onChange={(e) =>
                        setNewDistributorSalesRep({
                          ...newDistributorSalesRep,
                          distributor_override_rate: parseFloat(e.target.value),
                        })
                      }
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Additional commission the distributor earns on top of the rep's rate
                    </p>
                  </Field>
                )}

                <Field label="Notes">
                  <textarea
                    value={newDistributorSalesRep.notes}
                    onChange={(e) =>
                      setNewDistributorSalesRep({ ...newDistributorSalesRep, notes: e.target.value })
                    }
                    className={inputCls}
                    rows={2}
                    placeholder="Optional notes..."
                  />
                </Field>
              </div>

              <div className="mt-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSalesRep(false)}
                  className={cancelBtnCls}
                >
                  Cancel
                </button>
                <button type="submit" className={primaryBtnCls}>
                  Add Sales Rep
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface EditDistributorFormProps {
  distributor: Distributor;
  organizations: Organization[];
  onChange: (d: Distributor) => void;
  onSave: () => void;
  onCancel: () => void;
}

const EditDistributorForm: React.FC<EditDistributorFormProps> = ({
  distributor, organizations, onChange, onSave, onCancel,
}) => {
  const typeConfig = getCommissionTypeConfig(distributor.commission_type);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name">
          <input
            type="text"
            value={distributor.name}
            onChange={(e) => onChange({ ...distributor, name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Code">
          <input
            type="text"
            value={distributor.code}
            onChange={(e) => onChange({ ...distributor, code: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Customer Organization">
        <select
          value={distributor.organization_id ?? ''}
          onChange={(e) => onChange({ ...distributor, organization_id: e.target.value || undefined })}
          className={selectCls}
        >
          <option value="">— Unlinked —</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name} ({org.code})</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Commission Basis">
          <select
            value={distributor.commission_type}
            onChange={(e) => onChange({ ...distributor, commission_type: e.target.value as CommissionType })}
            className={selectCls}
          >
            {COMMISSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
        <Field label={`${typeConfig.rateLabel} (${typeConfig.rateUnit})`}>
          <input
            type="number"
            min="0"
            max={typeConfig.isFlat ? undefined : 100}
            step="0.01"
            value={distributor.commission_rate}
            onChange={(e) => onChange({ ...distributor, commission_rate: parseFloat(e.target.value) })}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <select
            value={distributor.is_active ? 'active' : 'inactive'}
            onChange={(e) => onChange({ ...distributor, is_active: e.target.value === 'active' })}
            className={selectCls}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Notes">
          <input
            type="text"
            value={distributor.notes ?? ''}
            onChange={(e) => onChange({ ...distributor, notes: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
          <Save className="h-4 w-4" /> Save
        </button>
        <button onClick={onCancel} className={cancelBtnCls}>Cancel</button>
      </div>
    </div>
  );
};

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

// Shared Tailwind class strings
const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent';
const selectCls = inputCls;
const primaryBtnCls =
  'px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:shadow-lg text-sm font-medium transition-all';
const cancelBtnCls =
  'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors';

export default DistributorManagement;
