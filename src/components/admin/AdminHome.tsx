import React, { useState } from 'react';
import {
  ShoppingCart, Users, Building2, Package, BarChart3, MessageSquare,
  Clock, CheckCircle, XCircle,
} from 'lucide-react';

export type ActiveTab =
  | 'home' | 'users' | 'orders' | 'commissions' | 'help'
  | 'my-orgs' | 'my-recurring-orders' | 'locations' | 'payments'
  | 'quickbooks' | 'support'
  | 'organizations' | 'pricing' | 'products' | 'categories'
  | 'recurring-orders' | 'distributors' | 'salesreps'
  | 'analytics' | 'profit-report' | 'cost-admins' | 'login-audit' | 'site-settings';

export interface PendingUser {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
}

interface AdminHomeProps {
  pendingUsers: PendingUser[];
  pendingCount: number;
  onNavigate: (tab: ActiveTab) => void;
  onApprove: (userId: string) => void;
  onDeny: (userId: string) => void;
}

const AdminHome: React.FC<AdminHomeProps> = ({ pendingUsers, pendingCount, onNavigate, onApprove, onDeny }) => {
  const [actioning, setActioning] = useState<Record<string, boolean>>({});

  const handleAction = async (userId: string, action: 'approve' | 'deny') => {
    setActioning(prev => ({ ...prev, [userId]: true }));
    try {
      if (action === 'approve') await onApprove(userId);
      else await onDeny(userId);
    } finally {
      setActioning(prev => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>

      {/* Pending Approvals — high priority, shown first */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-900">
                {pendingCount} Pending Approval{pendingCount !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => onNavigate('users')}
              className="text-sm text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
            >
              View all in Users
            </button>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingUsers.slice(0, 5).map(u => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.full_name || u.email}</p>
                  {u.full_name && <p className="text-xs text-gray-500">{u.email}</p>}
                  <p className="text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(u.id, 'approve')}
                    disabled={actioning[u.id]}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(u.id, 'deny')}
                    disabled={actioning[u.id]}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Deny
                  </button>
                </div>
              </div>
            ))}
            {pendingCount > 5 && (
              <div className="px-5 py-3 text-center">
                <button
                  onClick={() => onNavigate('users')}
                  className="text-sm text-amber-700 hover:text-amber-900 font-medium"
                >
                  + {pendingCount - 5} more — view all
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {pendingCount === 0 && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <span className="text-sm font-medium">All users approved — no pending requests</span>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { id: 'orders' as ActiveTab, label: 'View Orders', icon: ShoppingCart, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-100' },
            { id: 'users' as ActiveTab, label: 'Manage Users', icon: Users, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-100' },
            { id: 'organizations' as ActiveTab, label: 'Organizations', icon: Building2, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100' },
            { id: 'products' as ActiveTab, label: 'Products', icon: Package, color: 'text-teal-600 bg-teal-50 hover:bg-teal-100 border-teal-100' },
            { id: 'analytics' as ActiveTab, label: 'Analytics', icon: BarChart3, color: 'text-pink-600 bg-pink-50 hover:bg-pink-100 border-pink-100' },
            { id: 'support' as ActiveTab, label: 'Support', icon: MessageSquare, color: 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-100' },
          ].map(action => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.id)}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border font-medium text-sm transition-colors ${action.color}`}
            >
              <action.icon className="h-6 w-6" />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
