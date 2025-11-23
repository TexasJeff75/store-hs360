import React, { useState } from 'react';
import { Building2, MapPin, Mail, Phone } from 'lucide-react';
import { multiTenantService } from '@/services/multiTenant';
import { useAuth } from '@/contexts/AuthContext';

interface FirstTimeSetupProps {
  onComplete: () => void;
}

const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'welcome' | 'organization'>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgData, setOrgData] = useState({
    name: '',
    code: '',
    contact_email: '',
    contact_phone: '',
    address: ''
  });

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const newOrg = await multiTenantService.createOrganization({
        ...orgData,
        is_active: true
      });

      await multiTenantService.assignUserToOrganization({
        user_id: user.id,
        organization_id: newOrg.id,
        role: 'owner',
        is_primary: true
      });

      onComplete();
    } catch (err) {
      console.error('Error creating organization:', err);
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

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
              Let's get you started by setting up your organization
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">What is an Organization?</h3>
            <p className="text-sm text-blue-700">
              An organization represents your company, business, or practice. It allows you to:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-blue-700">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Manage multiple team members and locations</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Access contract pricing specific to your organization</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Track orders and manage payment methods</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => setStep('organization')}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 px-6 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 font-semibold"
          >
            Set Up My Organization
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8 my-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Your Organization</h2>
          <p className="text-gray-600">
            Tell us about your business to get started
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleCreateOrganization} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="org-name" className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="org-name"
                  type="text"
                  required
                  value={orgData.name}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  placeholder="e.g., Acme Health Clinic"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="org-code" className="block text-sm font-medium text-gray-700 mb-2">
                Organization Code <span className="text-red-500">*</span>
              </label>
              <input
                id="org-code"
                type="text"
                required
                value={orgData.code}
                onChange={(e) => setOrgData({ ...orgData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., ACME"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">Unique identifier (letters and numbers only)</p>
            </div>
          </div>

          <div>
            <label htmlFor="org-email" className="block text-sm font-medium text-gray-700 mb-2">
              Contact Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="org-email"
                type="email"
                required
                value={orgData.contact_email}
                onChange={(e) => setOrgData({ ...orgData, contact_email: e.target.value })}
                placeholder="contact@acmehealth.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="org-phone" className="block text-sm font-medium text-gray-700 mb-2">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="org-phone"
                type="tel"
                value={orgData.contact_phone}
                onChange={(e) => setOrgData({ ...orgData, contact_phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="org-address" className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <textarea
                id="org-address"
                value={orgData.address}
                onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                placeholder="123 Main Street, City, State, ZIP"
                rows={3}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> You will be assigned as the owner of this organization and can add team members later.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setStep('welcome')}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 text-white py-3 px-6 rounded-lg hover:from-pink-600 hover:to-orange-600 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FirstTimeSetup;
