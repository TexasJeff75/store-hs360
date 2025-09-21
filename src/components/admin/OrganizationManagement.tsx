import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Search, MapPin, Users, Mail, Phone } from 'lucide-react';
import { multiTenantService } from '../../services/multiTenant';
import type { Organization } from '../../services/supabase';

const OrganizationManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const data = await multiTenantService.getOrganizations();
      setOrganizations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = () => {
    setSelectedOrg({
      id: '',
      name: '',
      code: '',
      description: '',
      billing_address: null,
      contact_email: '',
      contact_phone: '',
      is_active: true,
      created_at: '',
      updated_at: ''
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEditOrganization = (org: Organization) => {
    setSelectedOrg(org);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSaveOrganization = async () => {
    if (!selectedOrg) return;

    try {
      if (isEditing) {
        await multiTenantService.updateOrganization(selectedOrg.id, selectedOrg);
        setOrganizations(prev => prev.map(org => 
          org.id === selectedOrg.id ? selectedOrg : org
        ));
      } else {
        const newOrg = await multiTenantService.createOrganization(selectedOrg);
        setOrganizations(prev => [newOrg, ...prev]);
      }
      setIsModalOpen(false);
      setSelectedOrg(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save organization');
    }
  };

  const handleDeleteOrganization = async (orgId: string) => {
    if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      return;
    }

    try {
      await multiTenantService.updateOrganization(orgId, { is_active: false });
      setOrganizations(prev => prev.filter(org => org.id !== orgId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization Management</h2>
          <p className="text-gray-600">Manage organizations and their settings</p>
        </div>
        <button
          onClick={handleCreateOrganization}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add Organization</span>
        </button>
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
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrganizations.map((org) => (
          <div key={org.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-500">Code: {org.code}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleEditOrganization(org)}
                  className="p-1 text-gray-400 hover:text-purple-600 rounded"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteOrganization(org.id)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {org.description && (
              <p className="text-gray-600 text-sm mb-4">{org.description}</p>
            )}

            <div className="space-y-2">
              {org.contact_email && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{org.contact_email}</span>
                </div>
              )}
              {org.contact_phone && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{org.contact_phone}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Created: {new Date(org.created_at).toLocaleDateString()}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  org.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {org.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrganizations.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No organizations found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm 
              ? 'Try adjusting your search criteria.'
              : 'Get started by creating your first organization.'
            }
          </p>
        </div>
      )}

      {/* Organization Modal */}
      {isModalOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {isEditing ? 'Edit Organization' : 'Create Organization'}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Organization Name *
                        </label>
                        <input
                          type="text"
                          value={selectedOrg.name}
                          onChange={(e) => setSelectedOrg({...selectedOrg, name: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Enter organization name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Organization Code *
                        </label>
                        <input
                          type="text"
                          value={selectedOrg.code}
                          onChange={(e) => setSelectedOrg({...selectedOrg, code: e.target.value.toUpperCase()})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="ORG001"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={selectedOrg.description || ''}
                          onChange={(e) => setSelectedOrg({...selectedOrg, description: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={3}
                          placeholder="Organization description"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contact Email
                        </label>
                        <input
                          type="email"
                          value={selectedOrg.contact_email || ''}
                          onChange={(e) => setSelectedOrg({...selectedOrg, contact_email: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="contact@organization.com"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={selectedOrg.contact_phone || ''}
                          onChange={(e) => setSelectedOrg({...selectedOrg, contact_phone: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                      
                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedOrg.is_active}
                            onChange={(e) => setSelectedOrg({...selectedOrg, is_active: e.target.checked})}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active Organization</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveOrganization}
                  disabled={!selectedOrg.name || !selectedOrg.code}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Update' : 'Create'} Organization
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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

export default OrganizationManagement;