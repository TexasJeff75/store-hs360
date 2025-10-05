import React, { useState } from 'react';
import { Users, Building2, MapPin, DollarSign, Settings, BarChart3, Package, ShoppingCart } from 'lucide-react';
import UserManagement from './UserManagement';
import OrganizationManagement from './OrganizationManagement';
import LocationManagement from './LocationManagement';
import PricingManagement from './PricingManagement';
import ProductsManagement from './ProductsManagement';
import OrderManagement from './OrderManagement';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTab = 'users' | 'organizations' | 'locations' | 'pricing' | 'products' | 'orders' | 'analytics';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('organizations');

  if (!isOpen) return null;

  const tabs = [
    { id: 'organizations' as AdminTab, label: 'Organizations', icon: Building2 },
    { id: 'users' as AdminTab, label: 'Users', icon: Users },
    { id: 'orders' as AdminTab, label: 'Orders', icon: ShoppingCart },
    { id: 'products' as AdminTab, label: 'Products', icon: Package },
    { id: 'analytics' as AdminTab, label: 'Analytics', icon: BarChart3 },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'organizations':
        return <OrganizationManagement />;
      case 'users':
        return <UserManagement />;
      case 'orders':
        return <OrderManagement />;
      case 'products':
        return <ProductsManagement />;
      case 'analytics':
        return (
          <div className="p-6 text-center text-gray-500">
            <BarChart3 className="h-16 w-16 mx-auto mb-4" />
            <p>Analytics dashboard coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-purple-100">Manage users, organizations, and pricing</p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-purple-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 border-r border-gray-200">
              <nav className="p-4 space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              {renderTabContent()}
            </div>
          </div>
    </div>
  );
};

export default AdminDashboard;