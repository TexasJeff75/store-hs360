import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Clock, CheckCircle, CreditCard as Edit, Trash2, Search, Filter, Key, AlertCircle, Save, RotateCcw, Plus, XCircle } from 'lucide-react';
import { supabase } from '@/services/supabase';
import type { Profile } from '@/services/supabase';

interface UserManagementProps {
  onUserApproved?: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onUserApproved }) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'sales_rep' | 'customer'>('customer');
  const [newUserApproved, setNewUserApproved] = useState(true);
  const [newUserOrganizationId, setNewUserOrganizationId] = useState<string>('');
  const [newUserOrganizationRole, setNewUserOrganizationRole] = useState<string>('member');
  const [createNewOrganization, setCreateNewOrganization] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{ [key: string]: Partial<Profile> }>({});
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string, isApproved: boolean) => {
    try {
      setModalMessage(null);

      // Check if email was changed
      const originalUser = users.find(u => u.id === userId);
      const emailChanged = originalUser && selectedUser && originalUser.email !== selectedUser.email;

      // Update profile in our database
      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          approval_status: selectedUser?.approval_status,
          email: selectedUser?.email || originalUser?.email
        })
        .eq('id', userId);

      if (error) throw error;

      // If email changed, update it in Supabase Auth (admin only operation)
      if (emailChanged && selectedUser?.email) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          userId,
          { email: selectedUser.email }
        );

        if (authError) {
          console.warn('Could not update email in auth system:', authError.message);
          setModalMessage({
            type: 'error',
            text: 'Role updated but email change failed. User may need to update email manually.'
          });
        } else {
          setModalMessage({
            type: 'success',
            text: 'User updated successfully including email change.'
          });
        }
      } else {
        setModalMessage({
          type: 'success',
          text: 'User updated successfully.'
        });
      }

      // Update local state
      setUsers(prev => prev.map(user =>
        user.id === userId
          ? {
              ...user,
              role: newRole as any,
              approval_status: selectedUser?.approval_status || user.approval_status,
              approved: selectedUser?.approval_status === 'approved',
              email: selectedUser?.email || user.email
            }
          : user
      ));

      // Refresh the pending users count
      onUserApproved?.();

      // Don't close modal immediately if there was an error, let user see the message
      if (!emailChanged || !authError) {
        setTimeout(() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
          setModalMessage(null);
        }, 2000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user';
      setError(errorMessage);
      setModalMessage({ type: 'error', text: errorMessage });
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

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      setUsers(prev => prev.filter(user => user.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleBulkSave = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      
      const updatePromises = Object.entries(pendingChanges).map(async ([userId, changes]) => {
        const { error } = await supabase
          .from('profiles')
          .update(changes)
          .eq('id', userId);
        
        if (error) throw error;
        
        // Update local state
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, ...changes } : user
        ));
      });
      
      await Promise.all(updatePromises);

      setPendingChanges({});
      onUserApproved?.();
      setSaveMessage({ type: 'success', text: 'All changes saved successfully!' });
      
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
    } catch (err) {
      setSaveMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to save changes' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setPendingChanges({});
    setSaveMessage({ type: 'success', text: 'Changes discarded successfully!' });

    setTimeout(() => {
      setSaveMessage(null);
    }, 2000);
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      setModalMessage({ type: 'error', text: 'Email and password are required' });
      return;
    }

    if (newUserPassword.length < 6) {
      setModalMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    try {
      setIsCreatingUser(true);
      setModalMessage(null);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

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
            role: newUserRole,
            is_approved: newUserApproved,
            organizationId: newUserOrganizationId || undefined,
            organizationRole: newUserOrganizationRole,
            createOrganization: createNewOrganization,
            newOrgName: createNewOrganization ? newOrgName : undefined,
            newOrgCode: createNewOrganization ? newOrgCode : undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'User creation failed');
      }

      setModalMessage({
        type: 'success',
        text: 'User created successfully!'
      });

      await fetchUsers();

      setTimeout(() => {
        setIsCreateModalOpen(false);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('customer');
        setNewUserApproved(true);
        setNewUserOrganizationId('');
        setNewUserOrganizationRole('member');
        setCreateNewOrganization(false);
        setNewOrgName('');
        setNewOrgCode('');
        setModalMessage(null);
        fetchOrganizations();
      }, 2000);

    } catch (err) {
      console.error('Error creating user:', err);
      let errorMessage = 'Failed to create user';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMessage = String((err as any).message);
      }

      setModalMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const getRoleColor = (role: string | null) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'distributor': return 'bg-orange-100 text-orange-800';
      case 'sales_rep': return 'bg-blue-100 text-blue-800';
      case 'customer': return 'bg-green-100 text-green-800';
      case null: return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string | null) => {
    switch (role) {
      case 'admin': return Shield;
      case 'distributor': return Mail;
      case 'sales_rep': return Mail;
      case 'customer': return User;
      case null: return Clock;
      default: return User;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">User Management</h2>
          <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-5 w-5" />
          <span>Create User</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Save Message */}
      {saveMessage && (
        <div className={`mb-4 p-4 rounded-lg flex items-center space-x-2 ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {saveMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className={`text-sm ${
            saveMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
          }`}>
            {saveMessage.text}
          </span>
        </div>
      )}

      {/* Save/Discard Actions */}
      {hasPendingChanges && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                You have unsaved changes ({Object.keys(pendingChanges).length} user{Object.keys(pendingChanges).length !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDiscardChanges}
                disabled={isSaving}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Discard Changes</span>
              </button>
              <button
                onClick={handleBulkSave}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save All Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Users Section */}
      {users.filter(u => u.approval_status === 'pending').length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-900">
              Pending Approval ({users.filter(u => u.approval_status === 'pending').length})
            </h3>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            These users have registered but need to be approved and assigned a role before they can access the system.
          </p>
          <div className="space-y-2">
            {users.filter(u => u.approval_status === 'pending').map((user) => (
              <div key={user.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{user.email}</p>
                  <p className="text-sm text-gray-500">
                    Registered: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    onChange={async (e) => {
                      const role = e.target.value;
                      if (role && confirm(`Approve ${user.email} as ${role}?`)) {
                        try {
                          const { error } = await supabase
                            .from('profiles')
                            .update({ role, approval_status: 'approved' })
                            .eq('id', user.id);

                          if (error) throw error;
                          await fetchUsers();
                          onUserApproved?.();
                          setSaveMessage({ type: 'success', text: `User approved as ${role}!` });
                        } catch (err) {
                          setSaveMessage({ type: 'error', text: 'Failed to approve user' });
                        }
                      }
                      e.target.value = '';
                    }}
                    defaultValue=""
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="" disabled>Approve as...</option>
                    <option value="customer">Customer</option>
                    <option value="sales_rep">Sales Rep</option>
                    <option value="distributor">Distributor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={async () => {
                      if (confirm(`Deny access for ${user.email}? They will not be able to log in.`)) {
                        try {
                          const { error } = await supabase
                            .from('profiles')
                            .update({ approval_status: 'denied' })
                            .eq('id', user.id);

                          if (error) throw error;
                          await fetchUsers();
                          onUserApproved?.();
                          setSaveMessage({ type: 'success', text: 'User denied!' });
                        } catch (err) {
                          setSaveMessage({ type: 'error', text: 'Failed to deny user' });
                        }
                      }
                    }}
                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-md"
                    title="Deny user"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete user ${user.email}?`)) {
                        try {
                          const { error } = await supabase
                            .from('profiles')
                            .delete()
                            .eq('id', user.id);

                          if (error) throw error;
                          await fetchUsers();
                          onUserApproved?.();
                          setSaveMessage({ type: 'success', text: 'User deleted!' });
                        } catch (err) {
                          setSaveMessage({ type: 'error', text: 'Failed to delete user' });
                        }
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    title="Delete user"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Denied Users Section */}
      {users.filter(u => u.approval_status === 'denied').length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <XCircle className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">
              Denied Users ({users.filter(u => u.approval_status === 'denied').length})
            </h3>
          </div>
          <p className="text-sm text-red-700 mb-4">
            These users have been denied access and cannot log in to the system.
          </p>
          <div className="space-y-2">
            {users.filter(u => u.approval_status === 'denied').map((user) => (
              <div key={user.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{user.email}</p>
                  <p className="text-sm text-gray-500">
                    Registered: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    onChange={async (e) => {
                      const role = e.target.value;
                      if (role && confirm(`Approve ${user.email} as ${role}?`)) {
                        try {
                          const { error } = await supabase
                            .from('profiles')
                            .update({ role, approval_status: 'approved' })
                            .eq('id', user.id);

                          if (error) throw error;
                          await fetchUsers();
                          onUserApproved?.();
                          setSaveMessage({ type: 'success', text: `User approved as ${role}!` });
                        } catch (err) {
                          setSaveMessage({ type: 'error', text: 'Failed to approve user' });
                        }
                      }
                      e.target.value = '';
                    }}
                    defaultValue=""
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="" disabled>Approve as...</option>
                    <option value="customer">Customer</option>
                    <option value="sales_rep">Sales Rep</option>
                    <option value="distributor">Distributor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete user ${user.email}?`)) {
                        try {
                          const { error } = await supabase
                            .from('profiles')
                            .delete()
                            .eq('id', user.id);

                          if (error) throw error;
                          await fetchUsers();
                          onUserApproved?.();
                          setSaveMessage({ type: 'success', text: 'User deleted!' });
                        } catch (err) {
                          setSaveMessage({ type: 'error', text: 'Failed to delete user' });
                        }
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    title="Delete user"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            <option value="customer">Customer</option>
            <option value="sales_rep">Sales Rep</option>
            <option value="distributor">Distributor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const RoleIcon = getRoleIcon(user.role);
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.email}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {user.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <RoleIcon className="h-4 w-4 mr-2 text-gray-500" />
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-full ${
                        user.approval_status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : user.approval_status === 'denied'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.approval_status === 'approved' && <CheckCircle className="h-3 w-3" />}
                        {user.approval_status === 'denied' && <XCircle className="h-3 w-3" />}
                        {user.approval_status === 'pending' && <Clock className="h-3 w-3" />}
                        <span className="capitalize">{user.approval_status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || roleFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'No users have been created yet.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsEditModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Edit User: {selectedUser.email}
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={selectedUser.email}
                          onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="user@example.com"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Changing the email will update both the profile and authentication system.
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Role
                        </label>
                        <select
                          value={selectedUser.role || ''}
                          onChange={(e) => setSelectedUser({...selectedUser, role: e.target.value as any})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="customer">Customer</option>
                          <option value="sales_rep">Sales Rep</option>
                          <option value="distributor">Distributor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Approval Status
                        </label>
                        <select
                          value={selectedUser.approval_status}
                          onChange={(e) => setSelectedUser({...selectedUser, approval_status: e.target.value as any})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="denied">Denied</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Denied users cannot log in to the system.
                        </p>
                      </div>
                      
                      {/* Password Reset Section */}
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
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => updateUserRole(selectedUser.id, selectedUser.role, selectedUser.approval_status === 'approved')}
                  disabled={!selectedUser.email.trim()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
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

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsCreateModalOpen(false)}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Create New User
                    </h3>

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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="user@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Password *
                        </label>
                        <input
                          type="password"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Minimum 6 characters"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Password must be at least 6 characters long
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Role
                        </label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as any)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="customer">Customer</option>
                          <option value="sales_rep">Sales Rep</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newUserApproved}
                            onChange={(e) => setNewUserApproved(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Account Approved</span>
                        </label>
                      </div>

                      {(newUserRole === 'customer' || newUserRole === 'sales_rep') && (
                        <>
                          <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Organization Assignment</h4>

                            <div className="mb-4">
                              <label className="flex items-center mb-2">
                                <input
                                  type="checkbox"
                                  checked={createNewOrganization}
                                  onChange={(e) => {
                                    setCreateNewOrganization(e.target.checked);
                                    if (e.target.checked) {
                                      setNewUserOrganizationId('');
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Create New Organization</span>
                              </label>
                            </div>

                            {createNewOrganization ? (
                              <>
                                <div className="mb-3">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Organization Name *
                                  </label>
                                  <input
                                    type="text"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., Acme Corporation"
                                  />
                                </div>
                                <div className="mb-3">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Organization Code *
                                  </label>
                                  <input
                                    type="text"
                                    value={newOrgCode}
                                    onChange={(e) => setNewOrgCode(e.target.value.toUpperCase())}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., ACME"
                                    maxLength={10}
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Short unique identifier for the organization
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div className="mb-3">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Select Organization
                                </label>
                                <select
                                  value={newUserOrganizationId}
                                  onChange={(e) => setNewUserOrganizationId(e.target.value)}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  disabled={loadingOrgs}
                                >
                                  <option value="">-- Optional --</option>
                                  {organizations.map(org => (
                                    <option key={org.id} value={org.id}>
                                      {org.name} ({org.code})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Organization Role
                              </label>
                              <select
                                value={newUserOrganizationRole}
                                onChange={(e) => setNewUserOrganizationRole(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="viewer">Viewer</option>
                                <option value="member">Member</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateUser}
                  disabled={isCreatingUser || !newUserEmail.trim() || !newUserPassword.trim()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingUser ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create User'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setNewUserEmail('');
                    setNewUserPassword('');
                    setNewUserRole('customer');
                    setNewUserApproved(true);
                    setNewUserOrganizationId('');
                    setNewUserOrganizationRole('member');
                    setCreateNewOrganization(false);
                    setNewOrgName('');
                    setNewOrgCode('');
                    setModalMessage(null);
                  }}
                  disabled={isCreatingUser}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

export default UserManagement;