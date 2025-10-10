import React, { useEffect, useState } from 'react';
import { MapPin, Building2, Mail, Phone } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Location {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
}

interface LocationSelectorProps {
  organizationId: string;
  selectedLocationId: string | null;
  onLocationSelect: (locationId: string, location: Location) => void;
  error?: string;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  organizationId,
  selectedLocationId,
  onLocationSelect,
  error
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, [organizationId]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setLocations(data || []);

      if (data && data.length === 1 && !selectedLocationId) {
        onLocationSelect(data[0].id, data[0]);
      }
    } catch (err) {
      console.error('Error loading locations:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <MapPin className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-900">No Active Locations</h4>
            <p className="text-sm text-yellow-700 mt-1">
              This organization does not have any active shipping locations configured.
              Please contact an administrator to set up locations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Select Shipping Location *
      </label>

      <div className="grid gap-3">
        {locations.map((location) => (
          <button
            key={location.id}
            type="button"
            onClick={() => onLocationSelect(location.id, location)}
            className={`text-left p-4 rounded-lg border-2 transition-all ${
              selectedLocationId === location.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className={`p-2 rounded-lg ${
                  selectedLocationId === location.id
                    ? 'bg-blue-100'
                    : 'bg-gray-100'
                }`}>
                  <Building2 className={`h-5 w-5 ${
                    selectedLocationId === location.id
                      ? 'text-blue-600'
                      : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className={`text-sm font-semibold ${
                      selectedLocationId === location.id
                        ? 'text-blue-900'
                        : 'text-gray-900'
                    }`}>
                      {location.name}
                    </h4>
                    <span className="text-xs text-gray-500">
                      ({location.code})
                    </span>
                  </div>

                  {location.address && (
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      {location.address.address1 && (
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-3 w-3 text-gray-400 mt-1 flex-shrink-0" />
                          <div>
                            <div>{location.address.address1}</div>
                            {location.address.address2 && <div>{location.address.address2}</div>}
                            <div>
                              {location.address.city && `${location.address.city}, `}
                              {location.address.state && `${location.address.state} `}
                              {location.address.postalCode}
                            </div>
                            {location.address.country && <div>{location.address.country}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    {location.contact_email && (
                      <div className="flex items-center space-x-1">
                        <Mail className="h-3 w-3" />
                        <span>{location.contact_email}</span>
                      </div>
                    )}
                    {location.contact_phone && (
                      <div className="flex items-center space-x-1">
                        <Phone className="h-3 w-3" />
                        <span>{location.contact_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedLocationId === location.id && (
                <div className="ml-3">
                  <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
};

export default LocationSelector;
