import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit, Building2 } from 'lucide-react';
import { multiTenantService, Location, Organization } from '../../services/multiTenant';

const LocationManagement: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchLocations();
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      const orgs = await multiTenantService.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const fetchLocations = async () => {
    if (!selectedOrgId) return;
    
    try {
      setLoading(true);
      const locs = await multiTenantService.getLocationsByOrganization(selectedOrgId);
      setLocations(locs);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (location?: Location) => {
    setSelectedLocation(location || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedLocation(null);
    setShowModal(false);
  };

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Location Management</h2>
          <p className="text-gray-600">Manage locations within organizations</p>
        </div>
        <button
          onClick={() => openModal()}
          disabled={!selectedOrgId}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          <span>Add Location</span>
        </button>
      </div>

      {/* Organization Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Organization
        </label>
        <select
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">Select an organization...</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name} ({org.code})
            </option>
          ))}
        </select>
      </div>

      {selectedOrgId && (
        <>
          {/* Organization Info */}
          {selectedOrg && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <Building2 className="h-6 w-6 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-purple-900">{selectedOrg.name}</h3>
                  <p className="text-sm text-purple-700">Managing locations for this organization</p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          ) : (
            /* Locations Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {locations.map((location) => (
                <div key={location.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{location.name}</h3>
                        <p className="text-sm text-gray-500">{location.code}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openModal(location)}
                      className="text-gray-400 hover:text-purple-600"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {location.contact_email && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>📧</span>
                        <span>{location.contact_email}</span>
                      </div>
                    )}
                    {location.contact_phone && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>📞</span>
                        <span>{location.contact_phone}</span>
                      </div>
                    )}
                    {location.address && (
                      <div className="flex items-start space-x-2 text-sm text-gray-600">
                        <span>📍</span>
                        <div>
                          {typeof location.address === 'string' 
                            ? location.address 
                            : JSON.stringify(location.address)
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        location.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {location.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {locations.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No locations found for this organization</p>
                  <button
                    onClick={() => openModal()}
                    className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Add the first location
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Location Modal */}
      {showModal && (
        <LocationModal
          location={selectedLocation}
          organizationId={selectedOrgId}
          onClose={closeModal}
          onSave={fetchLocations}
        />
      )}
    </div>
  );
};

// Location Modal Component
interface LocationModalProps {
  location: Location | null;
  organizationId: string;
  onClose: () => void;
  onSave: () => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ 
  location, 
  organizationId,
  onClose, 
  onSave 
}) => {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    code: location?.code || '',
    contact_email: location?.contact_email || '',
    contact_phone: location?.contact_phone || '',
    address: location?.address ? JSON.stringify(location.address, null, 2) : '',
    is_active: location?.is_active ?? true
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const locationData = {
        ...formData,
        organization_id: organizationId,
        address: formData.address ? JSON.parse(formData.address) : null
      };

      if (location) {
        await multiTenantService.updateLocation(location.id, locationData);
      } else {
        await multiTenantService.createLocation(locationData);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving location:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {location ? 'Edit Location' : 'Add Location'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Name
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
                  Location Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., NYC, LA, CHI"
                  required
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address (JSON format)
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  rows={4}
                  placeholder='{"street": "123 Main St", "city": "New York", "state": "NY", "zip": "10001"}'
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
                  Active Location
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

export default LocationManagement;