import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Package, Search, Eye, X, Loader, Calendar, Mail, MapPin, CreditCard, Truck, Plus } from 'lucide-react';

interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
}

interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

interface Shipment {
  carrier: string;
  tracking_number: string;
  shipped_date?: string;
  estimated_delivery?: string;
  status: string;
  notes?: string;
}

interface Order {
  id: string;
  user_id: string;
  organization_id?: string;
  bigcommerce_order_id?: string;
  bigcommerce_cart_id?: string;
  order_number?: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  items: OrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
  customer_email: string;
  notes?: string;
  shipments?: Shipment[];
  created_at: string;
  updated_at: string;
}

const OrderManagement: React.FC = () => {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddShipment, setShowAddShipment] = useState(false);
  const [canManageOrders, setCanManageOrders] = useState(false);
  const [newShipment, setNewShipment] = useState<Shipment>({
    carrier: '',
    tracking_number: '',
    shipped_date: '',
    estimated_delivery: '',
    status: 'in_transit',
    notes: ''
  });

  useEffect(() => {
    fetchOrders();
    checkManagementPermissions();
  }, [user, profile]);

  const checkManagementPermissions = async () => {
    if (!user) {
      setCanManageOrders(false);
      return;
    }

    if (profile?.role === 'admin' || profile?.role === 'sales_rep') {
      setCanManageOrders(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_organization_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'manager']);

      if (error) throw error;

      setCanManageOrders(data && data.length > 0);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setCanManageOrders(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      await fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const addShipment = async (orderId: string) => {
    if (!newShipment.carrier || !newShipment.tracking_number) {
      alert('Carrier and tracking number are required');
      return;
    }

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const existingShipments = order.shipments || [];
      const updatedShipments = [...existingShipments, newShipment];

      const { error } = await supabase
        .from('orders')
        .update({
          shipments: updatedShipments,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      await fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, shipments: updatedShipments });
      }

      setNewShipment({
        carrier: '',
        tracking_number: '',
        shipped_date: '',
        estimated_delivery: '',
        status: 'in_transit',
        notes: ''
      });
      setShowAddShipment(false);
    } catch (error) {
      console.error('Error adding shipment:', error);
      alert('Failed to add shipment tracking');
    }
  };

  const removeShipment = async (orderId: string, trackingNumber: string) => {
    if (!confirm('Are you sure you want to remove this shipment tracking?')) {
      return;
    }

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedShipments = (order.shipments || []).filter(
        s => s.tracking_number !== trackingNumber
      );

      const { error } = await supabase
        .from('orders')
        .update({
          shipments: updatedShipments,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      await fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, shipments: updatedShipments });
      }
    } catch (error) {
      console.error('Error removing shipment:', error);
      alert('Failed to remove shipment tracking');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'refunded':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const OrderDetailsModal = ({ order }: { order: Order }) => (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelectedOrder(null)}></div>

        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Order Details</h3>
              <p className="text-sm text-gray-500">ID: {order.id.slice(0, 8)}...</p>
            </div>
            <button
              onClick={() => setSelectedOrder(null)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Customer Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-medium">{order.customer_email}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Order Date:</span>
                    <p className="font-medium">
                      {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <div className="mt-1">
                      {canManageOrders ? (
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Order Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">${Number(order.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">${Number(order.tax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping:</span>
                    <span className="font-medium">${Number(order.shipping).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold text-base">
                    <span>Total:</span>
                    <span>${Number(order.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Notes</h4>
                <p className="text-sm text-blue-800">{order.notes}</p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">${Number(item.price).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                          ${(item.quantity * Number(item.price)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {order.shipping_address && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Shipping Address
                  </h4>
                  <div className="text-sm text-gray-700">
                    <p className="font-medium">{order.shipping_address.firstName} {order.shipping_address.lastName}</p>
                    {order.shipping_address.company && <p>{order.shipping_address.company}</p>}
                    <p>{order.shipping_address.address1}</p>
                    {order.shipping_address.address2 && <p>{order.shipping_address.address2}</p>}
                    <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postalCode}</p>
                    <p>{order.shipping_address.country}</p>
                    {order.shipping_address.phone && <p className="mt-2">Phone: {order.shipping_address.phone}</p>}
                  </div>
                </div>
              )}

              {order.billing_address && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Billing Address
                  </h4>
                  <div className="text-sm text-gray-700">
                    <p className="font-medium">{order.billing_address.firstName} {order.billing_address.lastName}</p>
                    {order.billing_address.company && <p>{order.billing_address.company}</p>}
                    <p>{order.billing_address.address1}</p>
                    {order.billing_address.address2 && <p>{order.billing_address.address2}</p>}
                    <p>{order.billing_address.city}, {order.billing_address.state} {order.billing_address.postalCode}</p>
                    <p>{order.billing_address.country}</p>
                    {order.billing_address.phone && <p className="mt-2">Phone: {order.billing_address.phone}</p>}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <Truck className="h-4 w-4 mr-2" />
                  Shipment Tracking
                </h4>
                {canManageOrders && !showAddShipment && (
                  <button
                    onClick={() => setShowAddShipment(true)}
                    className="flex items-center space-x-1 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Tracking</span>
                  </button>
                )}
              </div>

              {showAddShipment && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carrier *</label>
                      <input
                        type="text"
                        placeholder="e.g., FedEx, UPS, USPS"
                        value={newShipment.carrier}
                        onChange={(e) => setNewShipment({ ...newShipment, carrier: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number *</label>
                      <input
                        type="text"
                        placeholder="Enter tracking number"
                        value={newShipment.tracking_number}
                        onChange={(e) => setNewShipment({ ...newShipment, tracking_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Shipped Date</label>
                      <input
                        type="date"
                        value={newShipment.shipped_date}
                        onChange={(e) => setNewShipment({ ...newShipment, shipped_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery</label>
                      <input
                        type="date"
                        value={newShipment.estimated_delivery}
                        onChange={(e) => setNewShipment({ ...newShipment, estimated_delivery: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={newShipment.status}
                        onChange={(e) => setNewShipment({ ...newShipment, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_transit">In Transit</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="exception">Exception</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <input
                        type="text"
                        placeholder="Optional notes"
                        value={newShipment.notes}
                        onChange={(e) => setNewShipment({ ...newShipment, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setShowAddShipment(false);
                        setNewShipment({
                          carrier: '',
                          tracking_number: '',
                          shipped_date: '',
                          estimated_delivery: '',
                          status: 'in_transit',
                          notes: ''
                        });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => addShipment(order.id)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Add Tracking
                    </button>
                  </div>
                </div>
              )}

              {(!order.shipments || order.shipments.length === 0) && !showAddShipment ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Truck className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500 text-sm">No shipment tracking added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {order.shipments?.map((shipment, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="font-semibold text-gray-900">{shipment.carrier}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              shipment.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              shipment.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                              shipment.status === 'out_for_delivery' ? 'bg-yellow-100 text-yellow-800' :
                              shipment.status === 'exception' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {shipment.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                            <div>
                              <span className="text-gray-500">Tracking:</span>
                              <span className="ml-2 font-mono font-medium">{shipment.tracking_number}</span>
                            </div>
                            {shipment.shipped_date && (
                              <div>
                                <span className="text-gray-500">Shipped:</span>
                                <span className="ml-2">{new Date(shipment.shipped_date).toLocaleDateString()}</span>
                              </div>
                            )}
                            {shipment.estimated_delivery && (
                              <div>
                                <span className="text-gray-500">Est. Delivery:</span>
                                <span className="ml-2">{new Date(shipment.estimated_delivery).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                          {shipment.notes && (
                            <p className="text-sm text-gray-600 mt-2 italic">{shipment.notes}</p>
                          )}
                        </div>
                        {canManageOrders && (
                          <button
                            onClick={() => removeShipment(order.id, shipment.tracking_number)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Remove tracking"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
            <p className="text-gray-600">Manage and view all customer orders</p>
          </div>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email, order ID, or order number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No orders found</p>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {order.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.customer_email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${Number(order.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-purple-600 hover:text-purple-900 flex items-center justify-end space-x-1 ml-auto"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedOrder && <OrderDetailsModal order={selectedOrder} />}
    </div>
  );
};

export default OrderManagement;
