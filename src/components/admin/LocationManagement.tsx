import React, { useState, useEffect } from 'react';
import { MapPin, Plus, CreditCard as Edit, Trash2, Search, Building2, Mail, Phone } from 'lucide-react';
import { multiTenantService } from '@/services/multiTenant';
import type { Location, Organization } from '@/services/supabase';

interface LocationWithOrg extends Location {
  organizations?: { name: string };
}

interface LocationManagementProps {
  organizationId?: string;
}

const LocationManagement: React.FC<LocationManagementProps> = ({ organizationId }) => {
  const [locations, setLocations] = useState<LocationWithOrg[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationWithOrg | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      let locationsData;
      if (organizationId) {
        locationsData = await multiTenantService.getLocations(organizationId);
      } else {
        locationsData = await multiTenantService.getLocations();
      }
      
      const orgsData = await multiTenantService.getOrganizations();
      
      setLocations(locationsData);
      setOrganizations(orgsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = () => {
    setSelectedLocation({
      id: '',
      organization_id: organizationId || organizations[0]?.id || '',
      name: '',
      code: '',
      address: null,
      contact_email: '',
      contact_phone: '',
      is_active: true,
      created_at: '',
      updated_at: ''
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEditLocation = (location: LocationWithOrg) => {
    setSelectedLocation(location);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSaveLocation = async () => {
    if (!selectedLocation) return;

    try {
      setError(null);
      if (isEditing) {
        const { id, created_at, updated_at, ...updates } = selectedLocation;
        await multiTenantService.updateLocation(id, updates);
        setLocations(prev => prev.map(loc =>
          loc.id === selectedLocation.id ? selectedLocation : loc
        ));
      } else {
        const { id, created_at, updated_at, ...locationData } = selectedLocation;
        const newLocation = await multiTenantService.createLocation(locationData);
        setLocations(prev => [newLocation, ...prev]);
      }
      setIsModalOpen(false);
      setSelectedLocation(null);
    } catch (err) {
      console.error('Error saving location:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save location';
      setError(errorMessage);
      alert(`Failed to save location: ${errorMessage}`);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location? This action cannot be undone.')) {
      return;
    }

    try {
      await multiTenantService.updateLocation(locationId, { is_active: false });
      setLocations(prev => prev.filter(loc => loc.id !== locationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete location');
    }
  };

  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (!organizationId && location.organizations?.name.toLowerCase().includes(searchTerm.toLowerCase()))
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {organizationId ? 'Locations' : 'Location Management'}
          </h2>
          <p className="text-gray-600">
            {organizationId 
              ? 'Manage locations for this organization' 
              : 'Manage locations within organizations'
            }
          </p>
        </div>
        <button
          onClick={handleCreateLocation}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add Location</span>
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
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLocations.map((location) => (
          <div key={location.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MapPin className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{location.name}</h3>
                  <p className="text-sm text-gray-500">Code: {location.code}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEditLocation(location)}
                  className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  title="Edit Location"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteLocation(location.id)}
                  className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete Location"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Building2 className="h-4 w-4" />
                <span>{location.organizations?.name || 'Unknown Organization'}</span>
              </div>
            </div>

            <div className="space-y-2">
              {location.address && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-semibold text-gray-700 mb-1">Shipping Address:</div>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <div>{(location.address as any)?.firstName} {(location.address as any)?.lastName}</div>
                    {(location.address as any)?.company && <div>{(location.address as any)?.company}</div>}
                    <div>{(location.address as any)?.address1}</div>
                    {(location.address as any)?.address2 && <div>{(location.address as any)?.address2}</div>}
                    <div>
                      {(location.address as any)?.city}, {(location.address as any)?.state} {(location.address as any)?.postalCode}
                    </div>
                  </div>
                </div>
              )}
              {location.contact_email && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{location.contact_email}</span>
                </div>
              )}
              {location.contact_phone && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{location.contact_phone}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Created: {new Date(location.created_at).toLocaleDateString()}
                </span>
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
      </div>

      {filteredLocations.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No locations found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm 
              ? 'Try adjusting your search criteria.'
              : 'Get started by creating your first location.'
            }
          </p>
        </div>
      )}

      {/* Location Modal */}
      {isModalOpen && selectedLocation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {isEditing ? 'Edit Location' : 'Create Location'}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Organization *
                        </label>
                        {organizationId ? (
                          <input
                            type="text"
                            value={organizations.find(org => org.id === organizationId)?.name || 'Unknown Organization'}
                            readOnly
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                          />
                        ) : (
                          <select
                            value={selectedLocation.organization_id}
                            onChange={(e) => setSelectedLocation({...selectedLocation, organization_id: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          >
                            {[...organizations]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                              ))}
                          </select>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Location Name *
                        </label>
                        <input
                          type="text"
                          value={selectedLocation.name}
                          onChange={(e) => setSelectedLocation({...selectedLocation, name: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Enter location name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Location Code
                        </label>
                        <input
                          type="text"
                          value={selectedLocation.code || ''}
                          onChange={(e) => setSelectedLocation({...selectedLocation, code: e.target.value.toUpperCase()})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="LOC001 (optional)"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contact Email
                        </label>
                        <input
                          type="email"
                          value={selectedLocation.contact_email || ''}
                          onChange={(e) => setSelectedLocation({...selectedLocation, contact_email: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="location@organization.com"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={selectedLocation.contact_phone || ''}
                          onChange={(e) => setSelectedLocation({...selectedLocation, contact_phone: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>

                      {/* Shipping Address Section */}
                      <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                          <MapPin className="h-4 w-4" />
                          <span>Shipping Address</span>
                        </h4>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                First Name *
                              </label>
                              <input
                                type="text"
                                value={(selectedLocation.address as any)?.firstName || ''}
                                onChange={(e) => setSelectedLocation({
                                  ...selectedLocation,
                                  address: {...(selectedLocation.address as any || {}), firstName: e.target.value}
                                })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Last Name *
                              </label>
                              <input
                                type="text"
                                value={(selectedLocation.address as any)?.lastName || ''}
                                onChange={(e) => setSelectedLocation({
                                  ...selectedLocation,
                                  address: {...(selectedLocation.address as any || {}), lastName: e.target.value}
                                })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Company
                            </label>
                            <input
                              type="text"
                              value={(selectedLocation.address as any)?.company || ''}
                              onChange={(e) => setSelectedLocation({
                                ...selectedLocation,
                                address: {...(selectedLocation.address as any || {}), company: e.target.value}
                              })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Street Address *
                            </label>
                            <input
                              type="text"
                              value={(selectedLocation.address as any)?.address1 || ''}
                              onChange={(e) => setSelectedLocation({
                                ...selectedLocation,
                                address: {...(selectedLocation.address as any || {}), address1: e.target.value}
                              })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="123 Main St"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Address Line 2
                            </label>
                            <input
                              type="text"
                              value={(selectedLocation.address as any)?.address2 || ''}
                              onChange={(e) => setSelectedLocation({
                                ...selectedLocation,
                                address: {...(selectedLocation.address as any || {}), address2: e.target.value}
                              })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="Suite, Unit, etc."
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                City *
                              </label>
                              <input
                                type="text"
                                value={(selectedLocation.address as any)?.city || ''}
                                onChange={(e) => setSelectedLocation({
                                  ...selectedLocation,
                                  address: {...(selectedLocation.address as any || {}), city: e.target.value}
                                })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                State *
                              </label>
                              <input
                                type="text"
                                value={(selectedLocation.address as any)?.state || ''}
                                onChange={(e) => setSelectedLocation({
                                  ...selectedLocation,
                                  address: {...(selectedLocation.address as any || {}), state: e.target.value}
                                })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                ZIP *
                              </label>
                              <input
                                type="text"
                                value={(selectedLocation.address as any)?.postalCode || ''}
                                onChange={(e) => setSelectedLocation({
                                  ...selectedLocation,
                                  address: {...(selectedLocation.address as any || {}), postalCode: e.target.value}
                                })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Country *
                            </label>
                            <input
                              type="text"
                              value={(selectedLocation.address as any)?.country || 'US'}
                              onChange={(e) => setSelectedLocation({
                                ...selectedLocation,
                                address: {...(selectedLocation.address as any || {}), country: e.target.value}
                              })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Phone
                            </label>
                            <input
                              type="tel"
                              value={(selectedLocation.address as any)?.phone || ''}
                              onChange={(e) => setSelectedLocation({
                                ...selectedLocation,
                                address: {...(selectedLocation.address as any || {}), phone: e.target.value}
                              })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedLocation.is_active}
                            onChange={(e) => setSelectedLocation({...selectedLocation, is_active: e.target.checked})}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active Location</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  disabled={
                    !selectedLocation.name ||
                    !selectedLocation.organization_id ||
                    !(selectedLocation.address as any)?.firstName ||
                    !(selectedLocation.address as any)?.lastName ||
                    !(selectedLocation.address as any)?.address1 ||
                    !(selectedLocation.address as any)?.city ||
                    !(selectedLocation.address as any)?.state ||
                    !(selectedLocation.address as any)?.postalCode
                  }
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Update' : 'Create'} Location
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

export default LocationManagement;