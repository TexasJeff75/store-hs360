import React, { useState, useEffect } from 'react';
import { Users, Building, Plus, Edit2, Trash2, X, Save, TrendingUp, DollarSign } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Distributor {
  id: string;
  profile_id: string;
  name: string;
  code: string;
  commission_rate: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  profiles?: {
    email: string;
  };
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
  profiles?: {
    email: string;
  };
}

const DistributorManagement: React.FC = () => {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [distributorSalesReps, setDistributorSalesReps] = useState<DistributorSalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDistributor, setShowAddDistributor] = useState(false);
  const [showAddSalesRep, setShowAddSalesRep] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<string | null>(null);
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states for new distributor
  const [newDistributor, setNewDistributor] = useState({
    profile_id: '',
    name: '',
    code: '',
    commission_rate: 45,
    notes: ''
  });

  // Form states for adding sales rep to distributor
  const [newDistributorSalesRep, setNewDistributorSalesRep] = useState({
    sales_rep_id: '',
    commission_split_type: 'percentage_of_distributor' as 'percentage_of_distributor' | 'fixed_with_override',
    sales_rep_rate: 50,
    distributor_override_rate: 0,
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [distributorsRes, salesRepsRes, distSalesRepsRes] = await Promise.all([
        supabase
          .from('distributors')
          .select('*, profiles!distributors_profile_id_fkey(email)')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, email, role')
          .eq('role', 'sales_rep')
          .order('email'),
        supabase
          .from('distributor_sales_reps')
          .select('*, profiles!distributor_sales_reps_sales_rep_id_fkey(email)')
          .order('created_at', { ascending: false })
      ]);

      if (distributorsRes.error) throw distributorsRes.error;
      if (salesRepsRes.error) throw salesRepsRes.error;
      if (distSalesRepsRes.error) throw distSalesRepsRes.error;

      setDistributors(distributorsRes.data || []);
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
      const { error: insertError } = await supabase
        .from('distributors')
        .insert([newDistributor]);

      if (insertError) throw insertError;

      setSuccess('Distributor created successfully');
      setShowAddDistributor(false);
      setNewDistributor({
        profile_id: '',
        name: '',
        code: '',
        commission_rate: 45,
        notes: ''
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
          is_active: editingDistributor.is_active,
          notes: editingDistributor.notes,
          updated_at: new Date().toISOString()
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
    if (!confirm('Are you sure you want to delete this distributor? This will remove all associated sales rep relationships.')) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('distributors')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Distributor deleted successfully');
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
      const { error: insertError } = await supabase
        .from('distributor_sales_reps')
        .insert([{
          distributor_id: selectedDistributor,
          ...newDistributorSalesRep,
          distributor_override_rate: newDistributorSalesRep.commission_split_type === 'fixed_with_override'
            ? newDistributorSalesRep.distributor_override_rate
            : null
        }]);

      if (insertError) throw insertError;

      setSuccess('Sales rep added to distributor successfully');
      setShowAddSalesRep(false);
      setNewDistributorSalesRep({
        sales_rep_id: '',
        commission_split_type: 'percentage_of_distributor',
        sales_rep_rate: 50,
        distributor_override_rate: 0,
        notes: ''
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sales rep');
    }
  };

  const handleRemoveSalesRepFromDistributor = async (id: string) => {
    if (!confirm('Are you sure you want to remove this sales rep from the distributor?')) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('distributor_sales_reps')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Sales rep removed successfully');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove sales rep');
    }
  };

  const getDistributorSalesReps = (distributorId: string) => {
    return distributorSalesReps.filter(dsr => dsr.distributor_id === distributorId && dsr.is_active);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Distributor Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage distributors and their hierarchical commission structure with sales reps
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

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Distributors List */}
      <div className="grid gap-6">
        {distributors.map(distributor => (
          <div key={distributor.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {editingDistributor?.id === distributor.id ? (
              /* Edit Mode */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Distributor Name
                    </label>
                    <input
                      type="text"
                      value={editingDistributor.name}
                      onChange={(e) => setEditingDistributor({ ...editingDistributor, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code
                    </label>
                    <input
                      type="text"
                      value={editingDistributor.code}
                      onChange={(e) => setEditingDistributor({ ...editingDistributor, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={editingDistributor.commission_rate}
                      onChange={(e) => setEditingDistributor({ ...editingDistributor, commission_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editingDistributor.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setEditingDistributor({ ...editingDistributor, is_active: e.target.value === 'active' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={editingDistributor.notes || ''}
                    onChange={(e) => setEditingDistributor({ ...editingDistributor, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateDistributor}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    onClick={() => setEditingDistributor(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-pink-500 to-orange-500 rounded-lg">
                      <Building className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{distributor.name}</h3>
                      <p className="text-sm text-gray-600">Code: {distributor.code}</p>
                      <p className="text-sm text-gray-600">User: {distributor.profiles?.email || 'N/A'}</p>
                      {distributor.notes && (
                        <p className="text-sm text-gray-500 mt-1">{distributor.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      distributor.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {distributor.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">{distributor.commission_rate}%</span>
                    </div>
                    <button
                      onClick={() => setEditingDistributor(distributor)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteDistributor(distributor.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>

                {/* Sales Reps under this Distributor */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Sales Representatives ({getDistributorSalesReps(distributor.id).length})
                    </h4>
                    <button
                      onClick={() => {
                        setSelectedDistributor(distributor.id);
                        setShowAddSalesRep(true);
                      }}
                      className="text-sm px-3 py-1 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition-colors"
                    >
                      Add Sales Rep
                    </button>
                  </div>

                  {getDistributorSalesReps(distributor.id).length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No sales representatives assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {getDistributorSalesReps(distributor.id).map(dsr => (
                        <div key={dsr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{dsr.profiles?.email}</p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs text-gray-600">
                                Split: <span className="font-medium">{
                                  dsr.commission_split_type === 'percentage_of_distributor'
                                    ? `${dsr.sales_rep_rate}% of Distributor`
                                    : `Fixed ${dsr.sales_rep_rate}% + ${dsr.distributor_override_rate}% Override`
                                }</span>
                              </span>
                              {dsr.notes && (
                                <span className="text-xs text-gray-500">{dsr.notes}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveSalesRepFromDistributor(dsr.id)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add Distributor Modal */}
      {showAddDistributor && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowAddDistributor(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreateDistributor}>
                <div className="bg-white px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add New Distributor</h3>
                    <button
                      type="button"
                      onClick={() => setShowAddDistributor(false)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Distributor User *
                      </label>
                      <select
                        required
                        value={newDistributor.profile_id}
                        onChange={(e) => setNewDistributor({ ...newDistributor, profile_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      >
                        <option value="">Select a user</option>
                        {salesReps.map(rep => (
                          <option key={rep.id} value={rep.id}>{rep.email}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Distributor Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDistributor.name}
                        onChange={(e) => setNewDistributor({ ...newDistributor, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        placeholder="e.g., ABC Distribution"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={newDistributor.code}
                        onChange={(e) => setNewDistributor({ ...newDistributor, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        placeholder="e.g., DIST001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Base Commission Rate (%) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        step="0.01"
                        value={newDistributor.commission_rate}
                        onChange={(e) => setNewDistributor({ ...newDistributor, commission_rate: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={newDistributor.notes}
                        onChange={(e) => setNewDistributor({ ...newDistributor, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        rows={3}
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddDistributor(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:shadow-lg"
                  >
                    Create Distributor
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Sales Rep to Distributor Modal */}
      {showAddSalesRep && selectedDistributor && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowAddSalesRep(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleAddSalesRepToDistributor}>
                <div className="bg-white px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add Sales Rep to Distributor</h3>
                    <button
                      type="button"
                      onClick={() => setShowAddSalesRep(false)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sales Representative *
                      </label>
                      <select
                        required
                        value={newDistributorSalesRep.sales_rep_id}
                        onChange={(e) => setNewDistributorSalesRep({ ...newDistributorSalesRep, sales_rep_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      >
                        <option value="">Select a sales rep</option>
                        {salesReps
                          .filter(rep => !getDistributorSalesReps(selectedDistributor).find(dsr => dsr.sales_rep_id === rep.id))
                          .map(rep => (
                            <option key={rep.id} value={rep.id}>{rep.email}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commission Split Type *
                      </label>
                      <select
                        required
                        value={newDistributorSalesRep.commission_split_type}
                        onChange={(e) => setNewDistributorSalesRep({
                          ...newDistributorSalesRep,
                          commission_split_type: e.target.value as 'percentage_of_distributor' | 'fixed_with_override'
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      >
                        <option value="percentage_of_distributor">Percentage of Distributor Commission</option>
                        <option value="fixed_with_override">Fixed Rate with Distributor Override</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {newDistributorSalesRep.commission_split_type === 'percentage_of_distributor'
                          ? 'Sales rep gets a percentage of the distributor\'s total commission'
                          : 'Sales rep gets a fixed commission rate, distributor gets an override'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sales Rep Rate (%) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        step="0.01"
                        value={newDistributorSalesRep.sales_rep_rate}
                        onChange={(e) => setNewDistributorSalesRep({ ...newDistributorSalesRep, sales_rep_rate: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {newDistributorSalesRep.commission_split_type === 'percentage_of_distributor'
                          ? 'Percentage of distributor commission (e.g., 50 = sales rep gets 50% of distributor\'s commission)'
                          : 'Fixed commission rate for sales rep (e.g., 40 = 40% commission on margin)'}
                      </p>
                    </div>
                    {newDistributorSalesRep.commission_split_type === 'fixed_with_override' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Distributor Override Rate (%) *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          max="100"
                          step="0.01"
                          value={newDistributorSalesRep.distributor_override_rate}
                          onChange={(e) => setNewDistributorSalesRep({ ...newDistributorSalesRep, distributor_override_rate: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Additional commission for distributor on top of sales rep commission
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={newDistributorSalesRep.notes}
                        onChange={(e) => setNewDistributorSalesRep({ ...newDistributorSalesRep, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                        rows={2}
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddSalesRep(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:shadow-lg"
                  >
                    Add Sales Rep
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorManagement;
