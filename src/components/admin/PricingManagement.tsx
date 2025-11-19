import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface PricingManagementProps {
  organizationId?: string;
}

const PricingManagement: React.FC<PricingManagementProps> = ({ organizationId }) => {
  return (
    <div className="p-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">Pricing Management Temporarily Unavailable</h3>
            <p className="text-yellow-800 mb-4">
              The Pricing Management component is being rebuilt after removing the Secret Costs feature.
            </p>
            <div className="text-sm text-yellow-700 space-y-2">
              <p><strong>What was removed:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Secret cost tracking system</li>
                <li>Cost admin permissions and audit logging</li>
                <li>Separate product_costs table</li>
                <li>All secret cost UI elements</li>
              </ul>
              <p className="mt-4"><strong>What remains:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Contract pricing database tables and functions</li>
                <li>BigCommerce product cost integration</li>
                <li>Multi-tenant organization/location pricing structure</li>
              </ul>
              <p className="mt-4 text-yellow-900 font-medium">
                The component needs to be rebuilt to restore contract pricing management functionality.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingManagement;
