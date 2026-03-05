import React, { useState, useEffect } from 'react';
import { Package, Calendar, Play, Pause, X, Clock, CheckCircle, AlertCircle, Pencil, SkipForward, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { recurringOrderService, RecurringOrder, RecurringOrderHistory } from '../services/recurringOrderService';
import { productService } from '../services/productService';
import EditRecurringOrderModal from './EditRecurringOrderModal';

const MyRecurringOrders: React.FC = () => {
  const { user } = useAuth();
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<RecurringOrder | null>(null);
  const [orderHistory, setOrderHistory] = useState<RecurringOrderHistory[]>([]);
  const [productNames, setProductNames] = useState<{ [key: number]: string }>({});
  const [editingOrder, setEditingOrder] = useState<RecurringOrder | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadRecurringOrders();
    }
  }, [user]);

  const loadRecurringOrders = async () => {
    if (!user?.id) return;

    setLoading(true);
    const orders = await recurringOrderService.getUserRecurringOrders(user.id);
    setRecurringOrders(orders);

    const productIds = [...new Set(orders.map(o => o.product_id))];
    const names: { [key: number]: string } = {};

    for (const productId of productIds) {
      const product = await productService.getProductById(productId);
      if (product) {
        names[productId] = product.name;
      }
    }

    setProductNames(names);
    setLoading(false);
  };

  const handleViewHistory = async (recurringOrder: RecurringOrder) => {
    setSelectedOrder(recurringOrder);
    const history = await recurringOrderService.getRecurringOrderHistory(recurringOrder.id);
    setOrderHistory(history);
  };

  const handlePauseResume = async (recurringOrder: RecurringOrder) => {
    if (recurringOrder.status === 'active') {
      await recurringOrderService.pauseRecurringOrder(recurringOrder.id);
    } else if (recurringOrder.status === 'paused') {
      await recurringOrderService.resumeRecurringOrder(recurringOrder.id);
    }
    await loadRecurringOrders();
  };

  const handleCancel = async (recurringOrder: RecurringOrder) => {
    if (window.confirm('Are you sure you want to cancel this recurring order?')) {
      await recurringOrderService.cancelRecurringOrder(recurringOrder.id);
      await loadRecurringOrders();
    }
  };

  const handleSkip = async (recurringOrder: RecurringOrder) => {
    if (!window.confirm('Skip the next scheduled delivery? Your order will resume on the following date.')) return;
    setSkippingId(recurringOrder.id);
    await recurringOrderService.skipNextOrder(recurringOrder.id);
    await loadRecurringOrders();
    setSkippingId(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      paused: 'bg-amber-100 text-amber-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    const icons: Record<string, React.ReactNode> = {
      active: <CheckCircle className="h-3 w-3" />,
      paused: <Clock className="h-3 w-3" />,
      cancelled: <X className="h-3 w-3" />,
      expired: <AlertCircle className="h-3 w-3" />,
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getOrderStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-emerald-100 text-emerald-800',
      processing: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      skipped: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">My Recurring Orders</h2>
        <p className="text-gray-600">Manage your automatic recurring orders</p>
      </div>

      {recurringOrders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recurring Orders Yet</h3>
          <p className="text-gray-600 mb-4">You haven't set up any recurring orders.</p>
          <p className="text-sm text-gray-500">Look for the recurring order option when viewing products!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recurringOrders.map((recurringOrder) => (
            <div
              key={recurringOrder.id}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {productNames[recurringOrder.product_id] || `Product #${recurringOrder.product_id}`}
                    </h3>
                    {getStatusBadge(recurringOrder.status)}
                    {recurringOrder.discount_percentage > 0 && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        {recurringOrder.discount_percentage}% off
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Qty: {recurringOrder.quantity} &middot; {recurringOrderService.getFrequencyDisplay(recurringOrder.frequency, recurringOrder.frequency_interval)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {recurringOrder.status === 'active' && (
                    <>
                      <button
                        onClick={() => setEditingOrder(recurringOrder)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit order"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSkip(recurringOrder)}
                        disabled={skippingId === recurringOrder.id}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Skip next delivery"
                      >
                        <SkipForward className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePauseResume(recurringOrder)}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Pause"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {recurringOrder.status === 'paused' && (
                    <button
                      onClick={() => handlePauseResume(recurringOrder)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Resume"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {recurringOrder.status !== 'cancelled' && (
                    <button
                      onClick={() => handleCancel(recurringOrder)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Next Delivery</p>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(recurringOrder.next_order_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Started</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(recurringOrder.start_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                  <p className="text-sm font-medium text-gray-900">{recurringOrder.total_orders}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Order</p>
                  <p className="text-sm font-medium text-gray-900">
                    {recurringOrder.last_order_date
                      ? new Date(recurringOrder.last_order_date).toLocaleDateString()
                      : 'None yet'}
                  </p>
                </div>
              </div>

              {recurringOrder.notes && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">{recurringOrder.notes}</p>
                </div>
              )}

              <div className="mt-4">
                <button
                  onClick={() => handleViewHistory(recurringOrder)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <History className="h-4 w-4" />
                  View Order History
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingOrder && (
        <EditRecurringOrderModal
          order={editingOrder}
          productName={productNames[editingOrder.product_id] || `Product #${editingOrder.product_id}`}
          onClose={() => setEditingOrder(null)}
          onSaved={() => {
            setEditingOrder(null);
            loadRecurringOrders();
          }}
        />
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Order History</h3>
                <button
                  onClick={() => { setSelectedOrder(null); setOrderHistory([]); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {productNames[selectedOrder.product_id] || `Product #${selectedOrder.product_id}`}
              </p>
            </div>

            <div className="p-6">
              {orderHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">No orders yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your first order will be placed on {new Date(selectedOrder.next_order_date).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getOrderStatusBadge(entry.status)}
                          {entry.order_id && (
                            <span className="text-sm text-gray-600">Order #{entry.order_id.slice(0, 8)}</span>
                          )}
                        </div>
                        {entry.amount > 0 && (
                          <span className="text-sm font-medium text-gray-900">${entry.amount.toFixed(2)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Scheduled: {new Date(entry.scheduled_date).toLocaleDateString()}</span>
                        {entry.processed_date && (
                          <span>Processed: {new Date(entry.processed_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      {entry.error_message && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          {entry.error_message}
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

export default MyRecurringOrders;
