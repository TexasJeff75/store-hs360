import React from 'react';
import { Eye, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonation, stopImpersonation } = useAuth();

  if (!isImpersonating || !impersonation) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-center relative z-[60]">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <Eye className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          Viewing as: <strong>{impersonation.profile.email}</strong>
          <span className="ml-2 opacity-80">
            ({impersonation.profile.role || 'no role'})
          </span>
        </span>
        <button
          onClick={stopImpersonation}
          className="ml-4 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
        >
          <X className="w-3 h-3" />
          Stop Impersonating
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
