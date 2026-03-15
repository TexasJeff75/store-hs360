import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Users, Building2, Package, BarChart3, MessageSquare,
  Clock, CheckCircle, XCircle, DollarSign, TrendingUp, ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { supabase } from '@/services/supabase';

export type ActiveTab =
  | 'home' | 'users' | 'orders' | 'commissions' | 'help'
  | 'my-orgs' | 'my-recurring-orders' | 'locations' | 'payments'
  | 'my-customers' | 'my-sales-reps' | 'my-delegates'
  | 'quickbooks' | 'support'
  | 'organizations' | 'pricing' | 'products' | 'categories'
  | 'recurring-orders' | 'distributors' | 'salesreps'
  | 'analytics' | 'profit-report' | 'cost-admins' | 'login-audit' | 'site-settings' | 'email-templates';

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

// ── Simple bar chart component ────────────────────────────────────────────
const BarChart: React.FC<{ data: { label: string; value: number; color: string }[]; title: string }> = ({ data, title }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h4 className="text-sm font-semibold text-gray-700 mb-4">{title}</h4>
      <div className="space-y-3">
        {data.map((d, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{d.label}</span>
              <span className="font-medium text-gray-700">{d.value}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${d.color}`}
                style={{ width: `${(d.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: number;
  onClick?: () => void;
}> = ({ label, value, icon: Icon, color, trend, onClick }) => (
  <button
    onClick={onClick}
    className={`bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow w-full ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    <p className="text-xs text-gray-500 mt-1">{label}</p>
  </button>
);

const AdminHome: React.FC<AdminHomeProps> = ({ pendingUsers, pendingCount, onNavigate, onApprove, onDeny }) => {
  const [actioning, setActioning] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalProducts: 0,
    totalOrgs: 0,
    pendingOrders: 0,
    completedOrders: 0,
    recentOrdersByDay: [] as { label: string; value: number; color: string }[],
    topProducts: [] as { label: string; value: number; color: string }[],
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [ordersRes, usersRes, productsRes, orgsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, total, status, created_at, items')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      const orders = ordersRes.data || [];
      const totalRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const completedOrders = orders.filter(o => o.status === 'completed').length;

      // Orders per day (last 7 days)
      const dayColors = ['bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-teal-500', 'bg-orange-500', 'bg-indigo-500', 'bg-rose-500'];
      const recentOrdersByDay: { label: string; value: number; color: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStr = day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        const count = orders.filter(o => {
          const d = new Date(o.created_at);
          return d >= dayStart && d <= dayEnd;
        }).length;
        recentOrdersByDay.push({ label: dayStr, value: count, color: dayColors[6 - i] });
      }

      // Top products (by frequency in order items)
      const productCounts: Record<string, number> = {};
      for (const order of orders) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items as { name?: string; quantity?: number }[]) {
            const name = item.name || 'Unknown';
            productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
          }
        }
      }
      const topProductColors = ['bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-teal-500', 'bg-orange-500'];
      const topProducts = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count], i) => ({ label: name, value: count, color: topProductColors[i] || 'bg-gray-400' }));

      setStats({
        totalOrders: orders.length,
        totalRevenue,
        totalUsers: usersRes.count || 0,
        totalProducts: productsRes.count || 0,
        totalOrgs: orgsRes.count || 0,
        pendingOrders,
        completedOrders,
        recentOrdersByDay,
        topProducts,
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>

      {/* Pending Approvals */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue (30d)"
          value={`$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="bg-green-500"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          label="Orders (30d)"
          value={stats.totalOrders}
          icon={ShoppingCart}
          color="bg-blue-500"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          label="Active Users"
          value={stats.totalUsers}
          icon={Users}
          color="bg-purple-500"
          onClick={() => onNavigate('users')}
        />
        <StatCard
          label="Customers"
          value={stats.totalOrgs}
          icon={Building2}
          color="bg-indigo-500"
          onClick={() => onNavigate('organizations')}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart data={stats.recentOrdersByDay} title="Orders — Last 7 Days" />
        <BarChart data={stats.topProducts.length > 0 ? stats.topProducts : [{ label: 'No data yet', value: 0, color: 'bg-gray-300' }]} title="Top Products (30d)" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Products"
          value={stats.totalProducts}
          icon={Package}
          color="bg-teal-500"
          onClick={() => onNavigate('products')}
        />
        <StatCard
          label="Pending Orders"
          value={stats.pendingOrders}
          icon={Clock}
          color="bg-amber-500"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          label="Completed Orders (30d)"
          value={stats.completedOrders}
          icon={CheckCircle}
          color="bg-emerald-500"
          onClick={() => onNavigate('orders')}
        />
        <StatCard
          label="Analytics"
          value="View"
          icon={BarChart3}
          color="bg-pink-500"
          onClick={() => onNavigate('analytics')}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { id: 'orders' as ActiveTab, label: 'View Orders', icon: ShoppingCart, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-100' },
            { id: 'users' as ActiveTab, label: 'Manage Users', icon: Users, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-100' },
            { id: 'organizations' as ActiveTab, label: 'Customers', icon: Building2, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100' },
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
