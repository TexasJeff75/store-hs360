import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Search, User, Mail, Shield, Clock, CheckCircle, AlertCircle, Key } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { multiTenantService } from '@/services/multiTenant';
import type { Profile, UserOrganizationRole } from '@/services/supabase';

interface UserWithRole extends Profile {
  user_organization_roles?: UserOrganizationRole[];
  organizationRole?: string;
  locationName?: string;
}

interface UserOrganizationManagementProps {
  organizationId: string;
}

const UserOrganizationManagement: React.FC<UserOrganizationManagementProps> = ({ organizationId }) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newUserData, setNewUserData] = useState({ email: '', password: '', role: 'member' as string });
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users assigned to this organization
      const userRoles = await multiTenantService.getUserOrganizationRoles();
      const orgUserRoles = userRoles.filter(role => role.organization_id === organizationId);
      
      // Get unique user IDs
      const userIds = [...new Set(orgUserRoles.map(role => role.user_id))];
      
      // Fetch user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Fetch all users for the "add user" functionality
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (allProfilesError) throw allProfilesError;
      
      // Fetch locations for this organization
      const locationsData = await multiTenantService.getLocations(organizationId);
      
      // Combine user data with their organization roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = orgUserRoles.find(role => role.user_id === profile.id);
        const location = userRole?.location_id 
          ? locationsData.find(loc => loc.id === userRole.location_id)
          : null;
        
        return {
          ...profile,
          user_organization_roles: orgUserRoles.filter(role => role.user_id === profile.id),
          organizationRole: userRole?.role || 'member',
          locationName: location?.name || 'All Locations'
        };
      });
      
      setUsers(usersWithRoles);
      setAllUsers(allProfiles || []);
      setLocations(locationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setModalMessage(null);
      
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserData.email,
        password: newUserData.password,
      });
      
      if (authError) throw authError;
      
      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              email: authData.user.email,
              role: 'approved',
              is_approved: true,
            },
          ]);
        
        if (profileError) throw profileError;
        
        // Assign user to organization
        await multiTenantService.assignUserToOrganization({
          user_id: authData.user.id,
          organization_id: organizationId,
          location_id: null,
          role: newUserData.role as any,
          is_primary: false
        });
        
        setModalMessage({ type: 'success', text: 'User created and assigned to organization successfully!' });
        
        // Reset form
        setNewUserData({ email: '', password: '', role: 'member' });
        
        // Refresh data
        fetchData();
        
        // Auto-close modal after success
        setTimeout(() => {
          setIsCreateUserModalOpen(false);
          setModalMessage(null);
        }, 2000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setModalMessage({ type: 'error', text: errorMessage });
    }
  };

  const handleAssignExistingUser = async (userId: string, role: string, locationId?: string) => {
    try {
      await multiTenantService.assignUserToOrganization({
        user_id: userId,
        organization_id: organizationId,
        location_id: locationId || null,
        role: role as any,
        is_primary: false
      });
      
      fetchData(); // Refresh data
      setIsModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign user');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string, locationId?: string) => {
    try {
      const userRole = users.find(u => u.id === userId)?.user_organization_roles?.[0];
      if (userRole) {
        await multiTenantService.updateUserOrganizationRole(userRole.id, {
          role: newRole as any,
          location_id: locationId || null
        });
        
        fetchData(); // Refresh data
        setIsModalOpen(false);
        setSelectedUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user role');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user from the organization?')) {
      return;
    }

    try {
      const userRole = users.find(u => u.id === userId)?.user_organization_roles?.[0];
      if (userRole) {
        await multiTenantService.removeUserFromOrganization(userRole.id);
        fetchData(); // Refresh data
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    }
  };

  const handleSendPasswordReset = async () => {
    if (!selectedUser?.email) return;
    
    try {
      setSendingPasswordReset(true);
      setModalMessage(null);
      
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
      
      setModalMessage({ 
        type: 'success', 
        text: `Password reset email sent to ${selectedUser.email}` 
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send password reset email';
      setModalMessage({ type: 'error', text: errorMessage });
    } finally {
      setSendingPasswordReset(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-green-100 text-green-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Shield;
      case 'manager': return CheckCircle;
      case 'member': return User;
      case 'viewer': return Clock;
      default: return User;
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableUsers = allUsers.filter(user => 
    !users.some(orgUser => orgUser.id === user.id)
  );

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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization Users</h2>
          <p className="text-gray-600">Manage users assigned to this organization</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsCreateUserModalOpen(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Create User</span>
          </button>
          <button
            onClick={() => {
              setSelectedUser(null);
              setIsEditing(false);
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Assign Existing User</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
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
                  Organization Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const RoleIcon = getRoleIcon(user.organizationRole || 'member');
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          <div className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <RoleIcon className="h-4 w-4 mr-2 text-gray-500" />
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.organizationRole || 'member')}`}>
                          {user.organizationRole || 'member'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.locationName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_approved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditing(true);
                            setIsModalOpen(true);
                          }}
                          className="text-purple-600 hover:text-purple-900 p-1 rounded"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveUser(user.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm 
                ? 'Try adjusting your search criteria.'
                : 'No users are assigned to this organization yet.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsCreateUserModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Create New User
                    </h3>
                    
                    {/* Modal Message */}
                    {modalMessage && (
                      <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
                        modalMessage.type === 'success' 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        {modalMessage.type === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className={`text-sm ${
                          modalMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {modalMessage.text}
                        </span>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={newUserData.email}
                          onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="user@example.com"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Temporary Password *
                        </label>
                        <input
                          type="password"
                          value={newUserData.password}
                          onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Temporary password"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          User will be able to change this password after first login
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Organization Role *
                        </label>
                        <select
                          value={newUserData.role}
                          onChange={(e) => setNewUserData({...newUserData, role: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="member">Member</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateUser}
                  disabled={!newUserData.email || !newUserData.password}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateUserModalOpen(false);
                    setNewUserData({ email: '', password: '', role: 'member' });
                    setModalMessage(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {isEditing ? `Edit User: ${selectedUser?.email}` : 'Assign Existing User'}
                    </h3>
                    
                    {/* Modal Message */}
                    {modalMessage && (
                      <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
                        modalMessage.type === 'success' 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        {modalMessage.type === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className={`text-sm ${
                          modalMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {modalMessage.text}
                        </span>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {!isEditing && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select User *
                          </label>
                          <select
                            value={selectedUser?.id || ''}
                            onChange={(e) => {
                              const user = availableUsers.find(u => u.id === e.target.value);
                              setSelectedUser(user ? { ...user, organizationRole: 'member' } : null);
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            <option value="">Select a user...</option>
                            {availableUsers.map(user => (
                              <option key={user.id} value={user.id}>{user.email}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Organization Role *
                        </label>
                        <select
                          value={selectedUser?.organizationRole || 'member'}
                          onChange={(e) => setSelectedUser(selectedUser ? {...selectedUser, organizationRole: e.target.value} : null)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="member">Member</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Location (Optional)
                        </label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="">All Locations</option>
                          {locations.map(location => (
                            <option key={location.id} value={location.id}>{location.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Password Reset Section for editing */}
                      {isEditing && selectedUser && (
                        <div className="pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Password Reset
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={handleSendPasswordReset}
                            disabled={sendingPasswordReset || !selectedUser.email}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingPasswordReset ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                            ) : (
                              <Key className="h-4 w-4" />
                            )}
                            <span>
                              {sendingPasswordReset ? 'Sending...' : 'Send Password Reset Email'}
                            </span>
                          </button>
                          <p className="text-xs text-gray-500 mt-1">
                            This will send a password reset link to the user's email address.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    if (isEditing && selectedUser) {
                      handleUpdateUserRole(selectedUser.id, selectedUser.organizationRole || 'member');
                    } else if (selectedUser) {
                      handleAssignExistingUser(selectedUser.id, selectedUser.organizationRole || 'member');
                    }
                  }}
                  disabled={!selectedUser}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Update User' : 'Assign User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedUser(null);
                    setModalMessage(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserOrganizationManagement;