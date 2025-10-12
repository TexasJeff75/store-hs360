import React, { useState, useEffect } from 'react';
import { Users, Building2, Plus, Trash2, DollarSign } from 'lucide-react';
import { commissionService } from '../../services/commissionService';
import { supabase } from '../../services/supabase';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface SalesRep {
  id: string;
  email: string;
}

interface Assignment {
  id: string;
  organization_id: string;
  sales_rep_id: string;
  commission_rate: number;
  sales_rep: { email: string };
}

const SalesRepAssignment: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [assignments, setAssignments] = useState<{ [orgId: string]: Assignment[] }>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedRep, setSelectedRep] = useState<string>('');
  const [commissionRate, setCommissionRate] = useState<number>(5.0);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [orgsData, repsData] = await Promise.all([
        supabase.from('organizations').select('id, name, code').eq('is_active', true),
        supabase.from('profiles').select('id, email').eq('role', 'sales_rep')
      ]);

      if (orgsData.data) setOrganizations(orgsData.data);
      if (repsData.data) setSalesReps(repsData.data);

      if (orgsData.data) {
        const assignmentsMap: { [orgId: string]: Assignment[] } = {};

        for (const org of orgsData.data) {
          const { reps } = await commissionService.getOrganizationSalesReps(org.id);
          assignmentsMap[org.id] = reps;
        }

        setAssignments(assignmentsMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedOrg || !selectedRep) {
      alert('Please select both organization and sales rep');
      return;
    }

    const result = await commissionService.assignSalesRepToOrganization(
      selectedOrg,
      selectedRep,
      commissionRate
    );

    if (result.success) {
      alert('Sales rep assigned successfully');
      setShowAddForm(false);
      setSelectedOrg('');
      setSelectedRep('');
      setCommissionRate(5.0);
      fetchData();
    } else {
      alert(`Failed to assign: ${result.error}`);
    }
  };

  const handleRemove = async (orgId: string, repId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return;

    const result = await commissionService.removeSalesRepFromOrganization(orgId, repId);

    if (result.success) {
      alert('Assignment removed');
      fetchData();
    } else {
      alert(`Failed to remove: ${result.error}`);
    }
  };

  const handleUpdateRate = async (orgId: string, repId: string) => {
    const newRate = prompt('Enter new commission rate (0-100):');
    if (!newRate) return;

    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      alert('Invalid rate. Must be between 0 and 100');
      return;
    }

    const result = await commissionService.updateCommissionRate(orgId, repId, rate);

    if (result.success) {
      alert('Commission rate updated');
      fetchData();
    } else {
      alert(`Failed to update rate: ${result.error}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sales Rep Assignments</h2>
            <p className="text-gray-600">Assign sales reps to organizations and set commission rates</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Assign Sales Rep</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">New Assignment</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization *
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select organization...</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sales Rep *
              </label>
              <select
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select sales rep...</option>
                {salesReps.map(rep => (
                  <option key={rep.id} value={rep.id}>
                    {rep.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission Rate (%) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedOrg('');
                setSelectedRep('');
                setCommissionRate(5.0);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Assign
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Rep</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No organizations found</p>
                </td>
              </tr>
            ) : (
              organizations.map(org => {
                const orgAssignments = assignments[org.id] || [];
                if (orgAssignments.length === 0) {
                  return (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{org.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500" colSpan={2}>
                        No sales rep assigned
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  );
                }
                return orgAssignments.map((assignment, index) => (
                  <tr key={`${org.id}-${assignment.sales_rep_id}`} className="hover:bg-gray-50">
                    {index === 0 && (
                      <td className="px-6 py-4 text-sm font-medium text-gray-900" rowSpan={orgAssignments.length}>
                        {org.name}
                        <div className="text-xs text-gray-500">{org.code}</div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{assignment.sales_rep.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">{Number(assignment.commission_rate).toFixed(2)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => handleUpdateRate(org.id, assignment.sales_rep_id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Edit Rate
                      </button>
                      <button
                        onClick={() => handleRemove(org.id, assignment.sales_rep_id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>
      </div>

      {salesReps.length === 0 && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            No sales reps found. Users must have the role 'sales_rep' to be assigned to organizations.
          </p>
        </div>
      )}
    </div>
  );
};

export default SalesRepAssignment;
