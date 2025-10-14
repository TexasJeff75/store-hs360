import React, { useState } from 'react';
import { Users, Building2, MapPin, DollarSign, Settings, BarChart3, Package, ShoppingCart, TrendingUp, UserCheck, CreditCard, Repeat } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UserManagement from './UserManagement';
import OrganizationManagement from './OrganizationManagement';
import LocationManagement from './LocationManagement';
import PricingManagement from './PricingManagement';
import ProductsManagement from './ProductsManagement';
import OrderManagement from './OrderManagement';
import CommissionManagement from './CommissionManagement';
import SalesRepAssignment from './SalesRepAssignment';
import SalesRepDashboard from './SalesRepDashboard';
import CustomerPaymentMethods from './CustomerPaymentMethods';
import Analytics from './Analytics';
import SubscriptionManagement from './SubscriptionManagement';
import MySubscriptions from '../MySubscriptions';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type AdminTab = 'users' | 'organizations' | 'locations' | 'pricing' | 'products' | 'orders' | 'commissions' | 'salesreps' | 'analytics' | 'my-orgs' | 'payments' | 'subscriptions' | 'my-subscriptions';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isSalesRep = profile?.role === 'sales_rep';
  const isCustomer = profile?.role === 'customer';
  const [userOrgId, setUserOrgId] = React.useState<string | undefined>();

  const [activeTab, setActiveTab] = useState<AdminTab>(
    isCustomer ? 'orders' : isSalesRep ? 'my-orgs' : 'organizations'
  );

  React.useEffect(() => {
    if (isCustomer && user?.id) {
      const fetchUserOrg = async () => {
        const { multiTenantService } = await import('@/services/multiTenant');
        const roles = await multiTenantService.getUserOrganizationRoles(user.id);
        if (roles.length > 0) {
          setUserOrgId(roles[0].organization_id);
        }
      };
      fetchUserOrg();
    }
  }, [isCustomer, user?.id]);

  if (!isOpen) return null;

  const adminTabs = [
    { id: 'my-orgs' as AdminTab, label: 'My Organizations', icon: Building2, roles: ['sales_rep'] },
    { id: 'organizations' as AdminTab, label: 'Organizations', icon: Building2, roles: ['admin'] },
    { id: 'users' as AdminTab, label: 'Users', icon: Users, roles: ['admin'] },
    { id: 'orders' as AdminTab, label: 'Orders', icon: ShoppingCart, roles: ['admin', 'sales_rep', 'customer'] },
    { id: 'my-subscriptions' as AdminTab, label: 'My Subscriptions', icon: Repeat, roles: ['customer'] },
    { id: 'subscriptions' as AdminTab, label: 'Subscriptions', icon: Repeat, roles: ['admin'] },
    { id: 'locations' as AdminTab, label: 'Locations', icon: MapPin, roles: ['customer'] },
    { id: 'payments' as AdminTab, label: 'Payment Methods', icon: CreditCard, roles: ['customer'] },
    { id: 'salesreps' as AdminTab, label: 'Sales Reps', icon: UserCheck, roles: ['admin'] },
    { id: 'commissions' as AdminTab, label: 'Commissions', icon: TrendingUp, roles: ['admin', 'sales_rep'] },
    { id: 'products' as AdminTab, label: 'Products', icon: Package, roles: ['admin'] },
    { id: 'analytics' as AdminTab, label: 'Analytics', icon: BarChart3, roles: ['admin'] },
  ];

  const tabs = adminTabs.filter(tab =>
    (isAdmin && tab.roles.includes('admin')) ||
    (isSalesRep && tab.roles.includes('sales_rep')) ||
    (isCustomer && tab.roles.includes('customer'))
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'my-orgs':
        return <SalesRepDashboard />;
      case 'organizations':
        return <OrganizationManagement />;
      case 'users':
        return <UserManagement />;
      case 'orders':
        return <OrderManagement />;
      case 'salesreps':
        return <SalesRepAssignment />;
      case 'commissions':
        return <CommissionManagement />;
      case 'products':
        return <ProductsManagement />;
      case 'locations':
        return <LocationManagement organizationId={isCustomer ? userOrgId : undefined} />;
      case 'payments':
        return <CustomerPaymentMethods organizationId={isCustomer ? userOrgId : undefined} />;
      case 'subscriptions':
        return <SubscriptionManagement />;
      case 'my-subscriptions':
        return <MySubscriptions />;
      case 'analytics':
        return <Analytics />;
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
                <h1 className="text-2xl font-bold">
                  {isCustomer ? 'My Account' : isSalesRep ? 'Sales Dashboard' : 'Admin Dashboard'}
                </h1>
                <p className="text-purple-100">
                  {isCustomer
                    ? 'Manage your orders, locations, and payment methods'
                    : isSalesRep
                    ? 'View your orders and commissions'
                    : 'Manage users, organizations, and pricing'
                  }
                </p>
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