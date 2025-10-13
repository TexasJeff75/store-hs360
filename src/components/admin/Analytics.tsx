import React, { useState } from 'react';
import { BarChart3, Shield, TrendingUp, Users } from 'lucide-react';
import LoginAuditLog from './LoginAuditLog';

type AnalyticsTab = 'login-audit' | 'sales' | 'users';

const Analytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('login-audit');

  const tabs = [
    { id: 'login-audit' as AnalyticsTab, label: 'Login Audit', icon: Shield },
    { id: 'sales' as AnalyticsTab, label: 'Sales Analytics', icon: TrendingUp },
    { id: 'users' as AnalyticsTab, label: 'User Analytics', icon: Users },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'login-audit':
        return <LoginAuditLog />;
      case 'sales':
        return (
          <div className="p-6 text-center text-gray-500">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Sales Analytics</h3>
            <p>Sales analytics dashboard coming soon...</p>
          </div>
        );
      case 'users':
        return (
          <div className="p-6 text-center text-gray-500">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">User Analytics</h3>
            <p>User analytics dashboard coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-6 w-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          </div>
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Analytics;
