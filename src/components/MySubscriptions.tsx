import React, { useState, useEffect } from 'react';
import { Package, Calendar, Play, Pause, X, Edit2, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService, Subscription, SubscriptionOrder } from '../services/subscriptionService';
import { bigCommerceService } from '../services/bigcommerce';

const MySubscriptions: React.FC = () => {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [orders, setOrders] = useState<SubscriptionOrder[]>([]);
  const [productNames, setProductNames] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    if (user?.id) {
      loadSubscriptions();
    }
  }, [user]);

  const loadSubscriptions = async () => {
    if (!user?.id) return;

    setLoading(true);
    const subs = await subscriptionService.getUserSubscriptions(user.id);
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
    setLoading(false);
  };

  const handleViewOrders = async (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    const orderHistory = await subscriptionService.getSubscriptionOrders(subscription.id);
    setOrders(orderHistory);
  };

  const handlePauseResume = async (subscription: Subscription) => {
    if (subscription.status === 'active') {
      await subscriptionService.pauseSubscription(subscription.id);
    } else if (subscription.status === 'paused') {
      await subscriptionService.resumeSubscription(subscription.id);
    }
    await loadSubscriptions();
  };

  const handleCancel = async (subscription: Subscription) => {
    if (window.confirm('Are you sure you want to cancel this subscription?')) {
      await subscriptionService.cancelSubscription(subscription.id);
      await loadSubscriptions();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Active
        </span>;
      case 'paused':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Paused
        </span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full flex items-center gap-1">
          <X className="h-3 w-3" />
          Cancelled
        </span>;
      case 'expired':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Expired
        </span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">{status}</span>;
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Completed</span>;
      case 'processing':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Processing</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Failed</span>;
      case 'skipped':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Skipped</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">{status}</span>;
    }
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">My Subscriptions</h2>
        <p className="text-gray-600">Manage your recurring orders and subscriptions</p>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscriptions Yet</h3>
          <p className="text-gray-600 mb-4">You haven't set up any recurring orders.</p>
          <p className="text-sm text-gray-500">Look for the subscription option when viewing products!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {productNames[subscription.product_id] || `Product #${subscription.product_id}`}
                    </h3>
                    {getStatusBadge(subscription.status)}
                  </div>
                  <p className="text-sm text-gray-600">
                    Quantity: {subscription.quantity} • {subscriptionService.getFrequencyDisplay(subscription.frequency, subscription.frequency_interval)}
                  </p>
                  {subscription.discount_percentage > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-1">
                      {subscription.discount_percentage}% subscription discount applied
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {subscription.status === 'active' && (
                    <button
                      onClick={() => handlePauseResume(subscription)}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      title="Pause subscription"
                    >
                      <Pause className="h-5 w-5" />
                    </button>
                  )}
                  {subscription.status === 'paused' && (
                    <button
                      onClick={() => handlePauseResume(subscription)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Resume subscription"
                    >
                      <Play className="h-5 w-5" />
                    </button>
                  )}
                  {subscription.status !== 'cancelled' && (
                    <button
                      onClick={() => handleCancel(subscription)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel subscription"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Next Delivery</p>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(subscription.next_order_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Started</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(subscription.start_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                  <p className="text-sm font-medium text-gray-900">{subscription.total_orders}</p>
                </div>
              </div>

              {subscription.notes && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">{subscription.notes}</p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleViewOrders(subscription)}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  View Order History
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Order History</h3>
                <button
                  onClick={() => {
                    setSelectedSubscription(null);
                    setOrders([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {productNames[selectedSubscription.product_id] || `Product #${selectedSubscription.product_id}`}
              </p>
            </div>

            <div className="p-6">
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">No orders yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your first order will be placed on {new Date(selectedSubscription.next_order_date).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getOrderStatusBadge(order.status)}
                          {order.order_id && (
                            <span className="text-sm text-gray-600">Order #{order.order_id}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          ${order.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Scheduled: {new Date(order.scheduled_date).toLocaleDateString()}</span>
                        {order.processed_date && (
                          <span>Processed: {new Date(order.processed_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      {order.error_message && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          {order.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySubscriptions;
