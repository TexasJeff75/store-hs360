import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Users, MapPin } from 'lucide-react';
import { multiTenantService, Organization } from '../../services/multiTenant';

const OrganizationManagement: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const orgs = await multiTenantService.getOrganizations();
      setOrganizations(orgs);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (org?: Organization) => {
    setSelectedOrg(org || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedOrg(null);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organization Management</h2>
          <p className="text-gray-600">Manage organizations and their settings</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Organization</span>
        </button>
      </div>

      {/* Organizations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <div key={org.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-500">{org.code}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => openModal(org)}
                  className="text-gray-400 hover:text-purple-600"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>

            {org.description && (
              <p className="text-sm text-gray-600 mb-4">{org.description}</p>
            )}

            <div className="space-y-2">
              {org.contact_email && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>📧</span>
                  <span>{org.contact_email}</span>
                </div>
              )}
              {org.contact_phone && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>📞</span>
                  <span>{org.contact_phone}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Status</span>
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

      {/* Organization Modal */}
      {showModal && (
        <OrganizationModal
          organization={selectedOrg}
          onClose={closeModal}
          onSave={fetchOrganizations}
        />
      )}
    </div>
  );
};

// Organization Modal Component
interface OrganizationModalProps {
  organization: Organization | null;
  onClose: () => void;
  onSave: () => void;
}

const OrganizationModal: React.FC<OrganizationModalProps> = ({ 
  organization, 
  onClose, 
  onSave 
}) => {
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    code: organization?.code || '',
    description: organization?.description || '',
    contact_email: organization?.contact_email || '',
    contact_phone: organization?.contact_phone || '',
    is_active: organization?.is_active ?? true
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (organization) {
        await multiTenantService.updateOrganization(organization.id, formData);
      } else {
        await multiTenantService.createOrganization(formData);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving organization:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {organization ? 'Edit Organization' : 'Add Organization'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., ACME, HS360"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Active Organization
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationManagement;