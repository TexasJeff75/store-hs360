import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Clock, CheckCircle, Building2, MapPin, Edit, Trash2, Plus } from 'lucide-react';
import { supabase, Profile } from '../../services/supabase';
import { multiTenantService, UserOrganizationRole } from '../../services/multiTenant';

interface ExtendedProfile extends Profile {
  organizations?: UserOrganizationRole[];
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<ExtendedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<ExtendedProfile | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get all users
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get organization roles for each user
      const usersWithOrgs = await Promise.all(
        (profiles || []).map(async (user) => {
          const organizations = await multiTenantService.getUserOrganizations(user.id);
          return { ...user, organizations };
        })
      );

      setUsers(usersWithOrgs);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role, is_approved: role !== 'pending' })
        .eq('id', userId);

      if (error) throw error;
      
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin':
        return { text: 'Admin', color: 'text-purple-700 bg-purple-100', icon: Shield };
      case 'approved':
        return { text: 'Approved', color: 'text-green-700 bg-green-100', icon: CheckCircle };
      case 'pending':
      default:
        return { text: 'Pending', color: 'text-yellow-700 bg-yellow-100', icon: Clock };
    }
  };

  const openUserModal = (user: ExtendedProfile) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600">Manage user accounts, roles, and organization assignments</p>
        </div>
        <div className="text-sm text-gray-500">
          Total Users: {users.length}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organizations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => {
                const roleInfo = getRoleDisplay(user.role);
                const RoleIcon = roleInfo.icon;
                
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.email}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {user.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {roleInfo.text}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {user.organizations?.length ? (
                          user.organizations.map((org) => (
                            <div key={org.id} className="flex items-center space-x-2 text-sm">
                              <Building2 className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-900">{org.organization?.name}</span>
                              <span className="text-xs text-gray-500">({org.role})</span>
                              {org.location && (
                                <>
                                  <MapPin className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{org.location.name}</span>
                                </>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No organizations</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => openUserModal(user)}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      {user.role === 'pending' && (
                        <button
                          onClick={() => updateUserRole(user.id, 'approved')}
                          className="text-green-600 hover:text-green-900"
                          title="Approve User"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setShowUserModal(false)}
          onUpdate={fetchUsers}
        />
      )}
    </div>
  );
};

// User Detail Modal Component
interface UserDetailModalProps {
  user: ExtendedProfile;
  onClose: () => void;
  onUpdate: () => void;
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose, onUpdate }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">User Details</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{user.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="mt-1 text-sm text-gray-900">{user.role}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {user.is_approved ? 'Approved' : 'Pending'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Joined</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Organizations */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Organization Memberships</h4>
                {user.organizations?.length ? (
                  <div className="space-y-3">
                    {user.organizations.map((org) => (
                      <div key={org.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">
                              {org.organization?.name}
                            </h5>
                            <p className="text-sm text-gray-600">
                              Role: {org.role}
                              {org.is_primary && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Primary
                                </span>
                              )}
                            </p>
                            {org.location && (
                              <p className="text-sm text-gray-600">
                                Location: {org.location.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No organization memberships</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;