import React, { useState, useEffect } from 'react';
import { Users, Building2, Plus, Trash2, DollarSign } from 'lucide-react';
import { commissionService } from '../../services/commissionService';
import { supabase } from '../../services/supabase';
import SortableTable, { Column } from './SortableTable';

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

interface FlatAssignment {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_code: string;
  sales_rep_id: string;
  sales_rep_email: string;
  commission_rate: number;
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

      <SortableTable
        data={(() => {
          const flatData: FlatAssignment[] = [];
          organizations.forEach(org => {
            const orgAssignments = assignments[org.id] || [];
            if (orgAssignments.length === 0) {
              flatData.push({
                id: `empty-${org.id}`,
                organization_id: org.id,
                organization_name: org.name,
                organization_code: org.code,
                sales_rep_id: '',
                sales_rep_email: 'No sales rep assigned',
                commission_rate: 0
              });
            } else {
              orgAssignments.forEach(assignment => {
                flatData.push({
                  id: assignment.id,
                  organization_id: org.id,
                  organization_name: org.name,
                  organization_code: org.code,
                  sales_rep_id: assignment.sales_rep_id,
                  sales_rep_email: assignment.sales_rep.email,
                  commission_rate: assignment.commission_rate
                });
              });
            }
          });
          return flatData;
        })()}
        columns={[
          {
            key: 'organization_name',
            label: 'Organization',
            sortable: true,
            filterable: true,
            render: (row) => (
              <div>
                <div className="text-sm font-medium text-gray-900">{row.organization_name}</div>
                <div className="text-xs text-gray-500">{row.organization_code}</div>
              </div>
            )
          },
          {
            key: 'sales_rep_email',
            label: 'Sales Rep',
            sortable: true,
            filterable: true,
            render: (row) => (
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span className={`text-sm ${row.sales_rep_id ? 'text-gray-900' : 'text-gray-500'}`}>
                  {row.sales_rep_email}
                </span>
              </div>
            )
          },
          {
            key: 'commission_rate',
            label: 'Commission Rate',
            sortable: true,
            render: (row) => (
              row.sales_rep_id ? (
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-sm">{Number(row.commission_rate).toFixed(2)}%</span>
                </div>
              ) : null
            )
          },
          {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            headerClassName: 'text-right',
            className: 'text-right',
            render: (row) => (
              row.sales_rep_id ? (
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateRate(row.organization_id, row.sales_rep_id);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Edit Rate
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(row.organization_id, row.sales_rep_id);
                    }}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4 inline" />
                  </button>
                </div>
              ) : null
            )
          }
        ]}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Search organizations or sales reps..."
        emptyMessage="No organizations found"
        emptyIcon={<Building2 className="h-12 w-12 mx-auto text-gray-400" />}
      />

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
