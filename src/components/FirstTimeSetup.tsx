import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Search, CreditCard } from 'lucide-react';
import { multiTenantService } from '@/services/multiTenant';
import { customerAddressService } from '@/services/customerAddresses';
import { useAuth } from '@/contexts/AuthContext';
import type { Organization } from '@/services/supabase';

interface FirstTimeSetupProps {
  onComplete: () => void;
}

const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'welcome' | 'select-org' | 'address' | 'payment'>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const [addressData, setAddressData] = useState({
    label: '',
    first_name: '',
    last_name: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postal_code: ''
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
      setStep('address');
    } catch (err) {
      console.error('Error assigning to organization:', err);
      setError(err instanceof Error ? err.message : 'Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipAddress = () => {
    setStep('payment');
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg || !user) return;

    setLoading(true);
    setError(null);

    try {
      await customerAddressService.createAddress({
        user_id: user.id,
        organization_id: selectedOrg.id,
        address_type: 'shipping',
        label: addressData.label || `${addressData.city} Office`,
        first_name: addressData.first_name,
        last_name: addressData.last_name,
        company: addressData.company || selectedOrg.name,
        address1: addressData.address1,
        address2: addressData.address2,
        city: addressData.city,
        state_or_province: addressData.state,
        postal_code: addressData.postal_code,
        country_code: 'US',
        is_default: true,
      });

      setStep('payment');
    } catch (err) {
      console.error('Error creating address:', err);
      setError(err instanceof Error ? err.message : 'Failed to create address');
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
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
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
                <span>Add shipping addresses</span>
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
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
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

  if (step === 'address') {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8 my-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Add a Shipping Address</h2>
            <p className="text-gray-600">
              Set up your first delivery address (optional)
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleCreateAddress} className="space-y-6">
            <div>
              <label htmlFor="address-label" className="block text-sm font-medium text-gray-700 mb-2">
                Address Label <span className="text-red-500">*</span>
              </label>
              <input
                id="address-label"
                type="text"
                required
                value={addressData.label}
                onChange={(e) => setAddressData({ ...addressData, label: e.target.value })}
                placeholder="e.g., Main Office, Downtown Clinic"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="first-name"
                  type="text"
                  required
                  value={addressData.first_name}
                  onChange={(e) => setAddressData({ ...addressData, first_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="last-name"
                  type="text"
                  required
                  value={addressData.last_name}
                  onChange={(e) => setAddressData({ ...addressData, last_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <input
                id="company"
                type="text"
                value={addressData.company}
                onChange={(e) => setAddressData({ ...addressData, company: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="address1" className="block text-sm font-medium text-gray-700 mb-2">
                Street Address <span className="text-red-500">*</span>
              </label>
              <input
                id="address1"
                type="text"
                required
                value={addressData.address1}
                onChange={(e) => setAddressData({ ...addressData, address1: e.target.value })}
                placeholder="123 Main Street"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="address2" className="block text-sm font-medium text-gray-700 mb-2">
                Address Line 2
              </label>
              <input
                id="address2"
                type="text"
                value={addressData.address2}
                onChange={(e) => setAddressData({ ...addressData, address2: e.target.value })}
                placeholder="Suite, Unit, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={addressData.city}
                  onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  id="state"
                  type="text"
                  required
                  value={addressData.state}
                  onChange={(e) => setAddressData({ ...addressData, state: e.target.value.toUpperCase() })}
                  placeholder="CA"
                  maxLength={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent uppercase"
                />
              </div>

              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="zip"
                  type="text"
                  required
                  value={addressData.postal_code}
                  onChange={(e) => setAddressData({ ...addressData, postal_code: e.target.value })}
                  placeholder="90210"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleSkipAddress}
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
                {loading ? 'Saving...' : 'Add Address'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'payment') {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
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
              Your account is ready. You can add payment methods and additional addresses from your profile settings at any time.
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
