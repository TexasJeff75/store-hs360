import React, { useState } from 'react';
import { Users, Building2, MapPin, DollarSign, Settings, BarChart3, Package, ShoppingCart, TrendingUp, UserCheck, CreditCard, Repeat, Building, HelpCircle, PieChart, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
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
import RecurringOrderManagement from './RecurringOrderManagement';
import MyRecurringOrders from '../MyRecurringOrders';
import DistributorManagement from './DistributorManagement';
import HelpSection from './HelpSection';
import ProfitReport from './ProfitReport';
import CostAdminManagement from './CostAdminManagement';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AdminTab;
}

type AdminTab = 'users' | 'orders' | 'commissions' | 'help' | 'my-orgs' | 'my-recurring-orders' | 'locations' | 'payments' | 'admin-settings';
type AdminSettingsTab = 'organizations' | 'pricing' | 'products' | 'recurring-orders' | 'distributors' | 'salesreps' | 'analytics' | 'profit-report' | 'cost-admins';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, initialTab }) => {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isSalesRep = profile?.role === 'sales_rep';
  const isDistributor = profile?.role === 'distributor';
  const isCustomer = profile?.role === 'customer';
  const [userOrgId, setUserOrgId] = React.useState<string | undefined>();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  const getDefaultTab = (): AdminTab => {
    if (initialTab) return initialTab;
    if (isCustomer) return 'orders';
    if (isSalesRep) return 'my-orgs';
    if (isDistributor) return 'commissions';
    return 'organizations';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getDefaultTab());
  const [adminSettingsTab, setAdminSettingsTab] = useState<AdminSettingsTab>('organizations');
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);

  React.useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
      setIsAdminSettingsOpen(false);
    }
  }, [initialTab, isOpen]);

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

  React.useEffect(() => {
    if (isAdmin) {
      fetchPendingUsersCount();
    }
  }, [isAdmin]);

  const fetchPendingUsersCount = async () => {
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');

      if (error) throw error;
      setPendingUsersCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending users count:', err);
    }
  };

  if (!isOpen) return null;

  const adminTabs = [
    { id: 'users' as AdminTab, label: 'Users', icon: Users, roles: ['admin'] },
    { id: 'orders' as AdminTab, label: 'Orders', icon: ShoppingCart, roles: ['admin', 'sales_rep', 'customer'] },
    { id: 'commissions' as AdminTab, label: 'Commissions', icon: TrendingUp, roles: ['admin', 'sales_rep', 'distributor'] },
    { id: 'admin-settings' as AdminTab, label: 'Admin Settings', icon: Settings, roles: ['admin'] },
    { id: 'help' as AdminTab, label: 'Help', icon: HelpCircle, roles: ['admin', 'sales_rep', 'distributor', 'customer'] },

    // User-facing items (non-admin)
    { id: 'my-orgs' as AdminTab, label: 'My Organizations', icon: Building2, roles: ['sales_rep'] },
    { id: 'my-recurring-orders' as AdminTab, label: 'My Recurring Orders', icon: Repeat, roles: ['customer'] },
    { id: 'locations' as AdminTab, label: 'Locations', icon: MapPin, roles: ['customer'] },
    { id: 'payments' as AdminTab, label: 'Payment Methods', icon: CreditCard, roles: ['customer'] },
  ];

  const adminSettingsTabs = [
    { id: 'organizations' as AdminSettingsTab, label: 'Organizations', icon: Building2 },
    { id: 'products' as AdminSettingsTab, label: 'Products', icon: Package },
    { id: 'recurring-orders' as AdminSettingsTab, label: 'Recurring Orders', icon: Repeat },
    { id: 'distributors' as AdminSettingsTab, label: 'Distributors', icon: Building },
    { id: 'salesreps' as AdminSettingsTab, label: 'Sales Reps', icon: UserCheck },
    { id: 'analytics' as AdminSettingsTab, label: 'Analytics', icon: BarChart3 },
    { id: 'profit-report' as AdminSettingsTab, label: 'Profit Report', icon: PieChart },
    { id: 'cost-admins' as AdminSettingsTab, label: 'Cost Admins', icon: Shield },
  ];

  const tabs = adminTabs.filter(tab =>
    (isAdmin && tab.roles.includes('admin')) ||
    (isSalesRep && tab.roles.includes('sales_rep')) ||
    (isDistributor && tab.roles.includes('distributor')) ||
    (isCustomer && tab.roles.includes('customer'))
  );

  const renderAdminSettingsContent = () => {
    switch (adminSettingsTab) {
      case 'organizations':
        return <OrganizationManagement />;
      case 'products':
        return <ProductsManagement />;
      case 'recurring-orders':
        return <RecurringOrderManagement />;
      case 'distributors':
        return <DistributorManagement />;
      case 'salesreps':
        return <SalesRepAssignment />;
      case 'analytics':
        return <Analytics />;
      case 'profit-report':
        return <ProfitReport />;
      case 'cost-admins':
        return <CostAdminManagement />;
      default:
        return null;
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'admin-settings') {
      return (
        <div className="flex h-full">
          {/* Admin Settings Sidebar */}
          <div className="w-64 bg-gray-50 border-r border-gray-200">
            <div className="p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Admin Settings</h2>
              <nav className="space-y-2">
                {adminSettingsTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAdminSettingsTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        adminSettingsTab === tab.id
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Admin Settings Content */}
          <div className="flex-1 overflow-y-auto">
            {renderAdminSettingsContent()}
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'my-orgs':
        return <SalesRepDashboard />;
      case 'users':
        return <UserManagement onUserApproved={fetchPendingUsersCount} />;
      case 'orders':
        return <OrderManagement />;
      case 'commissions':
        return <CommissionManagement />;
      case 'locations':
        return <LocationManagement organizationId={isCustomer ? userOrgId : undefined} />;
      case 'payments':
        return <CustomerPaymentMethods organizationId={isCustomer ? userOrgId : undefined} />;
      case 'my-recurring-orders':
        return <MyRecurringOrders />;
      case 'help':
        return <HelpSection />;
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
            <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-50 border-r border-gray-200 transition-all duration-300 relative`}>
              {/* Collapse/Expand Button */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute -right-3 top-6 bg-white border border-gray-300 rounded-full p-1 shadow-md hover:bg-gray-100 z-10"
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                )}
              </button>

              <nav className="p-4 space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const showBadge = tab.id === 'users' && pendingUsersCount > 0;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-4 py-3 rounded-lg text-left transition-colors relative ${
                        activeTab === tab.id
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={isSidebarCollapsed ? tab.label : undefined}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span className="font-medium">{tab.label}</span>}
                      </div>
                      {showBadge && (
                        <span className={`${isSidebarCollapsed ? 'absolute -top-1 -right-1' : ''} flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full`}>
                          {pendingUsersCount}
                        </span>
                      )}
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