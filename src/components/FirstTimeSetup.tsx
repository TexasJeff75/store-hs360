import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Search, CreditCard } from 'lucide-react';
import { multiTenantService } from '@/services/multiTenant';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import type { Organization } from '@/services/supabase';

interface FirstTimeSetupProps {
  onComplete: () => void;
}

const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'welcome' | 'select-org' | 'location' | 'payment'>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const [locationData, setLocationData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    zip_code: ''
  });

  useEffect(() => {
    if (step === 'select-org') {
      loadOrganizations();
    }
  }, [step]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const data = await multiTenantService.getOrganizations();
      setOrganizations(data);
    } catch (err) {
      console.error('Error loading organizations:', err);
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrganization = async (org: Organization) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await multiTenantService.assignUserToOrganization({
        user_id: user.id,
        organization_id: org.id,
        role: 'customer',
        is_primary: true
      });

      setSelectedOrg(org);
      setStep('location');
    } catch (err) {
      console.error('Error assigning to organization:', err);
      setError(err instanceof Error ? err.message : 'Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipLocation = () => {
    setStep('payment');
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    setLoading(true);
    setError(null);

    try {
      await multiTenantService.createLocation({
        organization_id: selectedOrg.id,
        name: locationData.name,
        code: locationData.code || undefined,
        address: locationData.address || undefined,
        city: locationData.city || undefined,
        state: locationData.state || undefined,
        zip_code: locationData.zip_code || undefined,
        is_active: true
      });

      setStep('payment');
    } catch (err) {
      console.error('Error creating location:', err);
      setError(err instanceof Error ? err.message : 'Failed to create location');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPayment = () => {
    onComplete();
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to HealthSpan360!</h2>
            <p className="text-gray-600">
              Let's connect you to your organization
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Getting Started</h3>
            <p className="text-sm text-blue-700 mb-3">
              To place orders and access contract pricing, you'll need to select your organization.
            </p>
            <p className="text-sm text-blue-700">
              Once connected, you can:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-blue-700">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Add locations for delivery</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Set up payment methods</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>View and place orders</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => setStep('select-org')}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 px-6 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 font-semibold"
          >
            Select My Organization
          </button>
        </div>
      </div>
    );
  }

  if (step === 'select-org') {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Your Organization</h2>
            <p className="text-gray-600">
              Find and join your company or practice
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading organizations...</p>
              </div>
            ) : filteredOrganizations.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {searchTerm ? 'No organizations match your search.' : 'No organizations found.'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Contact an administrator to have your organization added.
                </p>
              </div>
            ) : (
              filteredOrganizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrganization(org)}
                  disabled={loading}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-pink-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-pink-100 to-orange-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{org.name}</h3>
                      <p className="text-sm text-gray-500">Code: {org.code}</p>
                      {org.contact_email && (
                        <p className="text-xs text-gray-500">{org.contact_email}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('welcome')}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'location') {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8 my-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Add a Location</h2>
            <p className="text-gray-600">
              Set up your first delivery location (optional)
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleCreateLocation} className="space-y-6">
            <div>
              <label htmlFor="location-name" className="block text-sm font-medium text-gray-700 mb-2">
                Location Name <span className="text-red-500">*</span>
              </label>
              <input
                id="location-name"
                type="text"
                required
                value={locationData.name}
                onChange={(e) => setLocationData({ ...locationData, name: e.target.value })}
                placeholder="e.g., Main Office, Downtown Clinic"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="location-code" className="block text-sm font-medium text-gray-700 mb-2">
                Location Code
              </label>
              <input
                id="location-code"
                type="text"
                value={locationData.code}
                onChange={(e) => setLocationData({ ...locationData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., MAIN, DTC"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent uppercase"
              />
            </div>

            <div>
              <label htmlFor="location-address" className="block text-sm font-medium text-gray-700 mb-2">
                Street Address
              </label>
              <input
                id="location-address"
                type="text"
                value={locationData.address}
                onChange={(e) => setLocationData({ ...locationData, address: e.target.value })}
                placeholder="123 Main Street"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="location-city" className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  id="location-city"
                  type="text"
                  value={locationData.city}
                  onChange={(e) => setLocationData({ ...locationData, city: e.target.value })}
                  placeholder="City"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="location-state" className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  id="location-state"
                  type="text"
                  value={locationData.state}
                  onChange={(e) => setLocationData({ ...locationData, state: e.target.value.toUpperCase() })}
                  placeholder="CA"
                  maxLength={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent uppercase"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location-zip" className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              <input
                id="location-zip"
                type="text"
                value={locationData.zip_code}
                onChange={(e) => setLocationData({ ...locationData, zip_code: e.target.value })}
                placeholder="90210"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleSkipLocation}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 px-6 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Add Location'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'payment') {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Payment Methods</h2>
            <p className="text-gray-600">
              You can add payment methods later from your profile
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">All Set!</h3>
            <p className="text-sm text-blue-700">
              Your account is ready. You can add payment methods and additional locations from your profile settings at any time.
            </p>
          </div>

          <button
            onClick={handleSkipPayment}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 px-6 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 font-semibold"
          >
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default FirstTimeSetup;
