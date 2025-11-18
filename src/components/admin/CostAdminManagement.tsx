import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield, Search, Check, X } from 'lucide-react';
import { supabase } from '@/services/supabase';
import type { Profile } from '@/services/supabase';

const CostAdminManagement: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .order('email');

      if (fetchError) throw fetchError;

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const toggleCostAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      setError(null);
      setSuccessMessage(null);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ can_view_secret_cost: !currentStatus })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Update local state
      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, can_view_secret_cost: !currentStatus }
          : user
      ));

      setSuccessMessage(`Cost admin access ${!currentStatus ? 'granted' : 'revoked'} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating cost admin status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Cost Admin Management</h2>
        <p className="text-sm text-gray-600">
          Manage which admins can view secret costs and true profit margins. Cost admins have access to confidential acquisition cost data.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center">
          <Check className="w-5 h-5 mr-2" />
          {successMessage}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search admins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">What is a Cost Admin?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Can view <strong>secret_cost</strong> - your true acquisition cost from suppliers</li>
              <li>• Can access the <strong>Profit Report</strong> with real margin calculations</li>
              <li>• Regular admins only see <strong>cost_price</strong> (public cost for validation)</li>
              <li>• All cost admin access is audited for security</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost Admin Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.can_view_secret_cost ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        <Eye className="w-3 h-3 mr-1" />
                        Cost Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Regular Admin
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {user.can_view_secret_cost ? (
                      <button
                        onClick={() => toggleCostAdmin(user.id, true)}
                        className="inline-flex items-center px-3 py-1 border border-red-300 rounded-lg text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Revoke Access
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleCostAdmin(user.id, false)}
                        className="inline-flex items-center px-3 py-1 border border-green-300 rounded-lg text-green-700 hover:bg-green-50 transition-colors"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Grant Access
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No admins found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search criteria.' : 'No admin users available.'}
            </p>
          </div>
        )}
      </div>

      {/* Current Cost Admins Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Current Cost Admins ({users.filter(u => u.can_view_secret_cost).length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {users
            .filter(u => u.can_view_secret_cost)
            .map(user => (
              <span
                key={user.id}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
              >
                <Eye className="w-3 h-3 mr-1" />
                {user.email}
              </span>
            ))}
          {users.filter(u => u.can_view_secret_cost).length === 0 && (
            <span className="text-sm text-gray-500">No cost admins assigned yet</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CostAdminManagement;
