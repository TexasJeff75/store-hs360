import React, { useState, useEffect } from 'react';
import { Building2, Check, Search, Users, MapPin, X } from 'lucide-react';
import { multiTenantService } from '@/services/multiTenant';
import type { Organization } from '@/services/supabase';

interface OrganizationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrganization: (org: Organization) => void;
  selectedOrganization: Organization | null;
}

const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({
  isOpen,
  onClose,
  onSelectOrganization,
  selectedOrganization
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const data = await multiTenantService.getOrganizations();
      setOrganizations(data.filter(org => org.is_active));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Select Organization</h2>
              <p className="text-sm text-gray-600 mt-1">Choose which organization you're ordering for</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Organizations List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-16"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOrganizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        onSelectOrganization(org);
                        onClose();
                      }}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        selectedOrganization?.id === org.id
                          ? 'bg-pink-50 border-pink-300 text-pink-900'
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Building2 className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{org.name}</h3>
                            <p className="text-sm text-gray-500">Code: {org.code}</p>
                            {org.contact_email && (
                              <p className="text-xs text-gray-500">{org.contact_email}</p>
                            )}
                          </div>
                        </div>
                        {selectedOrganization?.id === org.id && (
                          <Check className="h-5 w-5 text-pink-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredOrganizations.length === 0 && !loading && (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {searchTerm ? 'No organizations match your search.' : 'No active organizations found.'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {selectedOrganization ? (
                  <>Currently ordering for: <strong>{selectedOrganization.name}</strong></>
                ) : (
                  'Select an organization to see contract pricing'
                )}
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSelector;