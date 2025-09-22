import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Search, MapPin, Users, Mail, Phone, AlertCircle, CheckCircle, Eye, Archive, ArrowLeft, Settings } from 'lucide-react';
import { multiTenantService } from '@/services/multiTenant';
import LocationManagement from './LocationManagement';
import PricingManagement from './PricingManagement';
import type { Organization } from '@/services/supabase';

type SubManagementTab = 'locations' | 'pricing';

const OrganizationManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orgStats, setOrgStats] = useState<{ [key: string]: { locations: number; users: number } }>({});
  const [selectedOrgForSubManagement, setSelectedOrgForSubManagement] = useState<Organization | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubManagementTab>('locations');

  useEffect(() => {
    fetchOrganizations();
    fetchOrgStats();
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

  const fetchOrgStats = async () => {
    try {
      const [locations, userRoles] = await Promise.all([
        multiTenantService.getLocations(),
        multiTenantService.getUserOrganizationRoles()
      ]);

      const stats: { [key: string]: { locations: number; users: number } } = {};
      
      // Count locations per organization
      locations.forEach(location => {
        if (!stats[location.organization_id]) {
          stats[location.organization_id] = { locations: 0, users: 0 };
        }
        stats[location.organization_id].locations++;
      });

      // Count users per organization
      userRoles.forEach(role => {
        if (!stats[role.organization_id]) {
          stats[role.organization_id] = { locations: 0, users: 0 };
        }
        stats[role.organization_id].users++;
      });

      setOrgStats(stats);
    } catch (err) {
      console.error('Failed to fetch organization stats:', err);
    }
  };

  const handleCreateOrganization = () => {
    setSelectedOrg({
      name: '',
      code: generateOrgCode(''),
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

  const generateOrgCode = (name: string) => {
    if (!name.trim()) return '';
    
    // Take first 3 letters of each word, uppercase
    const words = name.trim().split(/\s+/);
    let code = '';
    
    if (words.length === 1) {
      // Single word: take first 3-6 characters
      code = words[0].substring(0, Math.min(6, words[0].length)).toUpperCase();
    } else {
      // Multiple words: take first 2-3 characters from each word
      code = words
        .slice(0, 3) // Max 3 words
        .map(word => word.substring(0, word.length >= 4 ? 3 : 2))
        .join('')
        .toUpperCase();
    }
    
    // Ensure minimum length of 3
    if (code.length < 3) {
      code = code.padEnd(3, 'X');
    }
    
    // Check if code already exists and add number suffix if needed
    const existingCodes = organizations.map(org => org.code.toUpperCase());
    let finalCode = code;
    let counter = 1;
    
    while (existingCodes.includes(finalCode)) {
      finalCode = code + counter.toString().padStart(2, '0');
      counter++;
    }
    
    return finalCode;
  };
  const handleEditOrganization = (org: Organization) => {
    setSelectedOrg(org);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleViewOrganization = (org: Organization) => {
    setSelectedOrg(org);
    setIsViewModalOpen(true);
  };

  const handleSaveOrganization = async () => {
    if (!selectedOrg) return;

    try {
      setModalMessage(null);
      
      if (isEditing) {
        await multiTenantService.updateOrganization(selectedOrg.id, selectedOrg);
        setOrganizations(prev => prev.map(org => 
          org.id === selectedOrg.id ? selectedOrg : org
        ));
        setModalMessage({ type: 'success', text: 'Organization updated successfully!' });
      } else {
        // Remove id property to let Supabase auto-generate UUID
        const { id, ...orgData } = selectedOrg;
        const newOrg = await multiTenantService.createOrganization(orgData);
        setOrganizations(prev => [newOrg, ...prev]);
        setModalMessage({ type: 'success', text: 'Organization created successfully!' });
      }
      
      // Refresh stats
      fetchOrgStats();
      
      // Auto-close modal after success
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedOrg(null);
        setModalMessage(null);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save organization';
      setModalMessage({ type: 'error', text: errorMessage });
    }
  };

  const handleArchiveOrganization = async (orgId: string, isActive: boolean) => {
    const action = isActive ? 'archive' : 'restore';
    if (!confirm(`Are you sure you want to ${action} this organization?`)) {
      return;
    }

    try {
      await multiTenantService.updateOrganization(orgId, { is_active: !isActive });
      setOrganizations(prev => prev.map(org => 
        org.id === orgId ? { ...org, is_active: !isActive } : org
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} organization`);
    }
  };

  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = 
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (org.description && org.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && org.is_active) ||
      (statusFilter === 'inactive' && !org.is_active);
    
    return matchesSearch && matchesStatus;
  });

  // If we're in sub-management mode, render that instead
  if (selectedOrgForSubManagement) {
    const subTabs = [
      { id: 'locations' as SubManagementTab, label: 'Locations', icon: MapPin },
      { id: 'pricing' as SubManagementTab, label: 'Pricing', icon: DollarSign },
    ];

    return (
      <div className="p-6">
        {/* Sub-management header */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => {
                setSelectedOrgForSubManagement(null);
                setActiveSubTab('locations');
              }}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Organizations</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Building2 className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedOrgForSubManagement.name}</h2>
              <p className="text-gray-600">Code: {selectedOrgForSubManagement.code}</p>
              <p className="text-gray-600">Manage locations and pricing for this organization</p>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeSubTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sub-tab content */}
        <div>
          {activeSubTab === 'locations' && (
            <LocationManagement organizationId={selectedOrgForSubManagement.id} />
          )}
          {activeSubTab === 'pricing' && (
            <PricingManagement organizationId={selectedOrgForSubManagement.id} />
          )}
        </div>
      </div>
    );
  }

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
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search organizations by name, code, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Organizations</p>
              <p className="text-2xl font-semibold text-gray-900">{organizations.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-2xl font-semibold text-gray-900">
                {organizations.filter(org => org.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Archive className="h-8 w-8 text-gray-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Inactive</p>
              <p className="text-2xl font-semibold text-gray-900">
                {organizations.filter(org => !org.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <MapPin className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Locations</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Object.values(orgStats).reduce((sum, stat) => sum + stat.locations, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrganizations.map((org) => (
          <div key={org.id} className={`bg-white rounded-lg shadow-sm border p-6 ${
            org.is_active ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  org.is_active ? 'bg-purple-100' : 'bg-gray-200'
                }`}>
                  <Building2 className={`h-6 w-6 ${
                    org.is_active ? 'text-purple-600' : 'text-gray-500'
                  }`} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${
                    org.is_active ? 'text-gray-900' : 'text-gray-600'
                  }`}>{org.name}</h3>
                  <p className="text-sm text-gray-500">Code: {org.code}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleViewOrganization(org)}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEditOrganization(org)}
                  className="p-1 text-gray-400 hover:text-purple-600 rounded"
                  title="Edit Organization"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSelectedOrgForSubManagement(org)}
                  className="p-1 text-gray-400 hover:text-purple-600 rounded"
                  title="Manage Locations & Pricing"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleArchiveOrganization(org.id, org.is_active)}
                  className={`p-1 text-gray-400 rounded ${
                    org.is_active ? 'hover:text-orange-600' : 'hover:text-green-600'
                  }`}
                  title={org.is_active ? 'Archive Organization' : 'Restore Organization'}
                >
                  <Archive className="h-4 w-4" />
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

            {/* Organization Stats */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="flex items-center justify-center space-x-1">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {orgStats[org.id]?.locations || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Locations</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="flex items-center justify-center space-x-1">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {orgStats[org.id]?.users || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Users</p>
              </div>
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
                          Organization Name *
                        </label>
                        <input
                          type="text"
                          value={selectedOrg.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setSelectedOrg({
                              ...selectedOrg, 
                              name: newName,
                              code: isEditing ? selectedOrg.code : generateOrgCode(newName)
                            });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Enter organization name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Organization Code * {!isEditing && <span className="text-xs text-gray-500">(Auto-generated)</span>}
                        </label>
                        <input
                          type="text"
                          value={selectedOrg.code}
                          onChange={(e) => setSelectedOrg({...selectedOrg, code: e.target.value.toUpperCase()})}
                          readOnly={!isEditing}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="ORG001"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {isEditing 
                            ? 'You can modify the code when editing existing organizations'
                            : 'Code is automatically generated from the organization name'
                          }
                        </p>
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

      {/* View Organization Modal */}
      {isViewModalOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsViewModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl leading-6 font-medium text-gray-900">
                        Organization Details
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedOrg.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedOrg.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Organization Name
                          </label>
                          <p className="text-lg font-semibold text-gray-900">{selectedOrg.name}</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Organization Code
                          </label>
                          <p className="text-lg font-mono text-gray-900">{selectedOrg.code}</p>
                        </div>
                        
                        {selectedOrg.description && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                              Description
                            </label>
                            <p className="text-gray-900">{selectedOrg.description}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        {selectedOrg.contact_email && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                              Contact Email
                            </label>
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <p className="text-gray-900">{selectedOrg.contact_email}</p>
                            </div>
                          </div>
                        )}
                        
                        {selectedOrg.contact_phone && (
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                              Contact Phone
                            </label>
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <p className="text-gray-900">{selectedOrg.contact_phone}</p>
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Created
                          </label>
                          <p className="text-gray-900">
                            {new Date(selectedOrg.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Statistics */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Statistics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <MapPin className="h-5 w-5 text-blue-600" />
                            <span className="text-2xl font-bold text-gray-900">
                              {orgStats[selectedOrg.id]?.locations || 0}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Locations</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <Users className="h-5 w-5 text-green-600" />
                            <span className="text-2xl font-bold text-gray-900">
                              {orgStats[selectedOrg.id]?.users || 0}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Users</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setIsViewModalOpen(false);
                    handleEditOrganization(selectedOrg);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Edit Organization
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
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