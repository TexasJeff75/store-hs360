import React, { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface Shipment {
  carrier: string;
  tracking_number: string;
  shipped_date?: string;
  estimated_delivery?: string;
  status?: string;
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  items: OrderItem[];
  shipping_address?: any;
  billing_address?: any;
  shipments?: Shipment[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

const OrderHistory: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'cancelled':
      case 'refunded':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Package className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h3>
        <p className="text-gray-600">When you place orders, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Order History</h1>
        <p className="text-gray-600">View and track your orders</p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(order.status)}
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Order #{order.order_number || order.id.slice(0, 8)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Placed on {formatDate(order.created_at)}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    order.status
                  )}`}
                >
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(order.total, order.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Items</p>
                  <p className="font-semibold text-gray-900">{order.items.length} item(s)</p>
                </div>
                {order.completed_at && (
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="font-semibold text-gray-900">
                      {formatDate(order.completed_at)}
                    </p>
                  </div>
                )}
              </div>

              {order.shipments && order.shipments.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Tracking Information</h4>
                  </div>
                  {order.shipments.map((shipment, index) => (
                    <div key={index} className="mt-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            {shipment.carrier}
                          </p>
                          <p className="text-sm text-blue-700">
                            Tracking: {shipment.tracking_number}
                          </p>
                          {shipment.estimated_delivery && (
                            <p className="text-xs text-blue-600">
                              Est. Delivery: {formatDate(shipment.estimated_delivery)}
                            </p>
                          )}
                        </div>
                        {shipment.status && (
                          <span className="text-sm font-medium text-blue-800">
                            {shipment.status}
                          </span>
                        )}
                      </div>
                      {shipment.notes && (
                        <p className="text-xs text-blue-600 mt-1">{shipment.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() =>
                  setExpandedOrder(expandedOrder === order.id ? null : order.id)
                }
                className="flex items-center space-x-2 text-pink-600 hover:text-pink-700 font-medium"
              >
                <span>
                  {expandedOrder === order.id ? 'Hide Details' : 'View Details'}
                </span>
                {expandedOrder === order.id ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {expandedOrder === order.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {order.shipping_address && (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <MapPin className="h-4 w-4 text-gray-600" />
                          <h4 className="font-semibold text-gray-900">Shipping Address</h4>
                        </div>
                        <div className="text-sm text-gray-700">
                          <p>
                            {order.shipping_address.firstName}{' '}
                            {order.shipping_address.lastName}
                          </p>
                          <p>{order.shipping_address.address1}</p>
                          {order.shipping_address.address2 && (
                            <p>{order.shipping_address.address2}</p>
                          )}
                          <p>
                            {order.shipping_address.city}, {order.shipping_address.state}{' '}
                            {order.shipping_address.postalCode}
                          </p>
                          <p>{order.shipping_address.country}</p>
                        </div>
                      </div>
                    )}
                    {order.billing_address && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Billing Address</h4>
                        <div className="text-sm text-gray-700">
                          <p>
                            {order.billing_address.firstName}{' '}
                            {order.billing_address.lastName}
                          </p>
                          <p>{order.billing_address.address1}</p>
                          {order.billing_address.address2 && (
                            <p>{order.billing_address.address2}</p>
                          )}
                          <p>
                            {order.billing_address.city}, {order.billing_address.state}{' '}
                            {order.billing_address.postalCode}
                          </p>
                          <p>{order.billing_address.country}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
                    <div className="space-y-3">
                      {order.items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-4 bg-gray-50 rounded-lg p-3"
                        >
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                          </div>
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(item.price * item.quantity, order.currency)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="text-gray-900">
                            {formatCurrency(order.subtotal, order.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax</span>
                          <span className="text-gray-900">
                            {formatCurrency(order.tax, order.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Shipping</span>
                          <span className="text-gray-900">
                            {formatCurrency(order.shipping, order.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-base pt-2 border-t">
                          <span className="text-gray-900">Total</span>
                          <span className="text-gray-900">
                            {formatCurrency(order.total, order.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderHistory;
