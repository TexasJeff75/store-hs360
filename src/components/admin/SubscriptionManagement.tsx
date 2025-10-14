import React, { useState, useEffect } from 'react';
import { Package, Calendar, Users, Filter, Search, TrendingUp, AlertCircle } from 'lucide-react';
import { subscriptionService, Subscription } from '../../services/subscriptionService';
import { bigCommerceService } from '../../services/bigcommerce';

const SubscriptionManagement: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productNames, setProductNames] = useState<{ [key: number]: string }>({});
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    paused: 0,
    cancelled: 0,
    dueToday: 0
  });

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [subscriptions, searchTerm, statusFilter]);

  const loadSubscriptions = async () => {
    setLoading(true);
    const subs = await subscriptionService.getAllSubscriptions();
    setSubscriptions(subs);

    const productIds = [...new Set(subs.map(s => s.product_id))];
    const names: { [key: number]: string } = {};

    for (const productId of productIds) {
      const product = await bigCommerceService.getProductById(productId);
      if (product) {
        names[productId] = product.name;
      }
    }

    setProductNames(names);

    const today = new Date().toISOString().split('T')[0];
    setStats({
      total: subs.length,
      active: subs.filter(s => s.status === 'active').length,
      paused: subs.filter(s => s.status === 'paused').length,
      cancelled: subs.filter(s => s.status === 'cancelled').length,
      dueToday: subs.filter(s => s.status === 'active' && s.next_order_date === today).length
    });

    setLoading(false);
  };

  const filterSubscriptions = () => {
    let filtered = subscriptions;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(s => {
        const productName = productNames[s.product_id]?.toLowerCase() || '';
        const term = searchTerm.toLowerCase();
        return (
          productName.includes(term) ||
          s.product_id.toString().includes(term) ||
          s.user_id.toLowerCase().includes(term)
        );
      });
    }

    setFilteredSubscriptions(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>;
      case 'paused':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Paused</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Cancelled</span>;
      case 'expired':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Expired</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">{status}</span>;
    }
  };

  const isDueToday = (date: string) => {
    const today = new Date().toISOString().split('T')[0];
    return date === today;
  };

  const isOverdue = (date: string) => {
    const today = new Date().toISOString().split('T')[0];
    return date < today;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Management</h2>
        <p className="text-gray-600">Monitor and manage all customer subscriptions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Subscriptions</span>
            <Package className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Active</span>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Paused</span>
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-yellow-600">{stats.paused}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Cancelled</span>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Due Today</span>
            <Calendar className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{stats.dueToday}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by product name or user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredSubscriptions.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscriptions Found</h3>
              <p className="text-gray-600">No subscriptions match your current filters.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orders
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {productNames[subscription.product_id] || `Product #${subscription.product_id}`}
                      </div>
                      {subscription.discount_percentage > 0 && (
                        <div className="text-xs text-green-600">
                          {subscription.discount_percentage}% discount
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {subscription.user_id.substring(0, 8)}...
                      </div>
                      {subscription.organization_id && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Organization
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {subscriptionService.getFrequencyDisplay(subscription.frequency, subscription.frequency_interval)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{subscription.quantity}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${
                        subscription.status === 'active' && isOverdue(subscription.next_order_date)
                          ? 'text-red-600 font-semibold'
                          : subscription.status === 'active' && isDueToday(subscription.next_order_date)
                          ? 'text-blue-600 font-semibold'
                          : 'text-gray-900'
                      }`}>
                        {new Date(subscription.next_order_date).toLocaleDateString()}
                      </div>
                      {subscription.status === 'active' && isOverdue(subscription.next_order_date) && (
                        <div className="text-xs text-red-600">Overdue</div>
                      )}
                      {subscription.status === 'active' && isDueToday(subscription.next_order_date) && (
                        <div className="text-xs text-blue-600">Due today</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(subscription.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {subscription.total_orders}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Automated Order Processing</h4>
            <p className="text-sm text-blue-700">
              Active subscriptions are automatically processed daily. Orders due today will be placed automatically.
              Set up the edge function to enable automated processing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;
