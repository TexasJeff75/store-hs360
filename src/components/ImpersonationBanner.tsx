import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Company Admin',
  sales_rep: 'Sales Rep',
  distributor: 'Distributor',
  customer: 'Customer',
};

const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonation, stopImpersonation } = useAuth();

  if (!isImpersonating || !impersonation) return null;

  const name = impersonation.profile.full_name || impersonation.profile.email;
  const role = impersonation.profile.role;

  return (
    <div className="bg-amber-400 text-amber-900 px-4 py-2 relative z-[60]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-semibold truncate">
            Viewing as <span className="underline underline-offset-2">{name}</span>
            {role && (
              <span className="ml-1.5 font-normal opacity-80">
                — {ROLE_LABELS[role] || role}
              </span>
            )}
          </span>
        </div>
        <button
          onClick={stopImpersonation}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-amber-900 text-amber-50 hover:bg-amber-800 px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Stop Impersonating
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
