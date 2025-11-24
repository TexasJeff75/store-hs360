import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { orderService } from '../../services/orderService';
import { Package, Search, Eye, X, Loader, Calendar, Mail, MapPin, CreditCard, Truck, Plus, Building2, ChevronDown, ChevronUp, Split, AlertTriangle } from 'lucide-react';

interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  brand?: string;
  backorder?: boolean;
  backorder_reason?: string;
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
  location_id?: string;
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
  order_type?: string;
  is_sub_order?: boolean;
  vendor_brand?: string;
  parent_order_id?: string;
  split_from_order_id?: string;
  viewed_by_admin?: boolean;
}

const OrderManagement: React.FC = () => {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'customer' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAddShipment, setShowAddShipment] = useState(false);
  const [canManageOrders, setCanManageOrders] = useState(false);
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showBackorderModal, setShowBackorderModal] = useState(false);
  const [selectedBackorderItems, setSelectedBackorderItems] = useState<Set<number>>(new Set());
  const [backorderQuantities, setBackorderQuantities] = useState<Record<number, number>>({});
  const [backorderReason, setBackorderReason] = useState('');
  const [processingBackorder, setProcessingBackorder] = useState(false);
  const [relatedOrders, setRelatedOrders] = useState<Order[]>([]);
  const [subOrders, setSubOrders] = useState<Order[]>([]);
  const [showSubOrders, setShowSubOrders] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugOrder, setDebugOrder] = useState<Order | null>(null);
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

  useEffect(() => {
    if (selectedOrder) {
      loadSubOrders(selectedOrder.id);
    } else {
      setSubOrders([]);
      setShowSubOrders(false);
    }
  }, [selectedOrder]);

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

      let query = supabase
        .from('orders')
        .select('*');

      if (profile?.role === 'sales_rep' && user) {
        query = query.eq('sales_rep_id', user.id);
      } else if (profile?.role === 'distributor' && user) {
        // First get the distributor record for this user
        const { data: distributorData } = await supabase
          .from('distributors')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (distributorData) {
          // Get all sales reps under this distributor
          const { data: salesReps } = await supabase
            .from('distributor_sales_reps')
            .select('sales_rep_id')
            .eq('distributor_id', distributorData.id)
            .eq('is_active', true);

          if (salesReps && salesReps.length > 0) {
            const salesRepIds = salesReps.map(sr => sr.sales_rep_id);
            // Include distributor's own ID in case they also have direct orders
            salesRepIds.push(user.id);
            query = query.in('sales_rep_id', salesRepIds);
          } else {
            // If no sales reps, only show distributor's own orders
            query = query.eq('sales_rep_id', user.id);
          }
        } else {
          // If distributor record not found, only show their own orders
          query = query.eq('sales_rep_id', user.id);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);

      const locationIds = [...new Set(data?.map(o => o.location_id).filter(Boolean))];
      if (locationIds.length > 0) {
        const { data: locations } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', locationIds);

        if (locations) {
          const names: Record<string, string> = {};
          locations.forEach(loc => {
            names[loc.id] = loc.name;
          });
          setLocationNames(names);
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'shipped') {
        const captureResult = await orderService.capturePaymentOnShipment(orderId);
        if (!captureResult.success) {
          alert(`Warning: Payment capture failed: ${captureResult.error}`);
        }
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
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

  const handleOpenBackorderModal = (order: Order) => {
    setSelectedOrder(order);
    setSelectedBackorderItems(new Set());
    setBackorderQuantities({});
    setBackorderReason('');
    setShowBackorderModal(true);
  };

  const toggleBackorderItem = (productId: number, maxQuantity: number) => {
    const newSet = new Set(selectedBackorderItems);
    const newQuantities = { ...backorderQuantities };

    if (newSet.has(productId)) {
      newSet.delete(productId);
      delete newQuantities[productId];
    } else {
      newSet.add(productId);
      newQuantities[productId] = maxQuantity;
    }

    setSelectedBackorderItems(newSet);
    setBackorderQuantities(newQuantities);
  };

  const updateBackorderQuantity = (productId: number, quantity: number, maxQuantity: number) => {
    const clampedQuantity = Math.min(Math.max(1, quantity), maxQuantity);
    setBackorderQuantities(prev => ({
      ...prev,
      [productId]: clampedQuantity
    }));
  };

  const handleSplitBackorder = async () => {
    if (!selectedOrder || selectedBackorderItems.size === 0) {
      alert('Please select at least one item to backorder');
      return;
    }

    if (!backorderReason.trim()) {
      alert('Please provide a reason for the backorder');
      return;
    }

    setProcessingBackorder(true);
    try {
      const backorderItemsData = Array.from(selectedBackorderItems).map(productId => ({
        productId,
        quantity: backorderQuantities[productId] || 0
      }));

      const result = await orderService.splitOrderByBackorderWithQuantities(
        selectedOrder.id,
        backorderItemsData
      );

      if (result.error) {
        alert(`Error splitting order: ${result.error}`);
        return;
      }

      if (result.backorder) {
        await supabase
          .from('orders')
          .update({ backorder_reason: backorderReason })
          .eq('id', result.backorder.id);
      }

      alert('Order successfully split! Back-ordered items moved to a new order.');
      setShowBackorderModal(false);
      setSelectedBackorderItems(new Set());
      setBackorderQuantities({});
      setBackorderReason('');
      await fetchOrders();
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error processing backorder:', error);
      alert('Failed to process backorder');
    } finally {
      setProcessingBackorder(false);
    }
  };

  const loadRelatedOrders = async (orderId: string) => {
    try {
      const result = await orderService.getRelatedOrders(orderId);
      if (!result.error) {
        setRelatedOrders(result.orders);
      }
    } catch (error) {
      console.error('Error loading related orders:', error);
    }
  };

  const loadSubOrders = async (orderId: string) => {
    try {
      const result = await orderService.getSubOrders(orderId);
      if (!result.error) {
        setSubOrders(result.subOrders);
        setShowSubOrders(result.subOrders.length > 0);
      }
    } catch (error) {
      console.error('Error loading sub-orders:', error);
    }
  };

  const handleSplitByVendor = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setDebugOrder(order);
      setShowDebugModal(true);
    }
  };

  const confirmSplitByVendor = async () => {
    if (!debugOrder) return;

    setShowDebugModal(false);

    try {
      const result = await orderService.splitOrderByVendor(debugOrder.id);

      if (result.error) {
        alert(result.error);
        return;
      }

      alert(`Order split successfully into ${result.subOrders.length} vendor orders`);
      await fetchOrders();

      if (selectedOrder?.id === debugOrder.id) {
        await loadSubOrders(debugOrder.id);
      }
    } catch (error) {
      console.error('Error splitting order by vendor:', error);
      alert('Failed to split order by vendor');
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

  const filteredOrders = React.useMemo(() => {
    let filtered = orders.filter(order => {
      const matchesSearch =
        order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      let matchesDate = true;
      const orderDate = new Date(order.created_at);

      if (dateFilter === 'today') {
        const today = new Date();
        matchesDate = orderDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        matchesDate = orderDate.toDateString() === yesterday.toDateString();
      } else if (dateFilter === 'last7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        matchesDate = orderDate >= sevenDaysAgo;
      } else if (dateFilter === 'last30days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchesDate = orderDate >= thirtyDaysAgo;
      } else if (dateFilter === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = orderDate >= start && orderDate <= end;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });

    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'date') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'customer') {
        comparison = a.customer_email.localeCompare(b.customer_email);
      } else if (sortBy === 'total') {
        comparison = a.total - b.total;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [orders, searchTerm, statusFilter, dateFilter, startDate, endDate, sortBy, sortOrder]);

  // Group orders: parent orders with their sub-orders
  const groupedOrders = React.useMemo(() => {
    const groups: Array<{ parent: Order; subOrders: Order[] }> = [];
    const processedIds = new Set<string>();

    filteredOrders.forEach(order => {
      if (processedIds.has(order.id)) return;

      // If this is a parent order (has split children)
      if (order.order_type === 'split_parent' || order.parent_order_id === null &&
          filteredOrders.some(o => o.parent_order_id === order.id)) {
        const subOrders = filteredOrders.filter(o => o.parent_order_id === order.id);
        groups.push({ parent: order, subOrders });
        processedIds.add(order.id);
        subOrders.forEach(sub => processedIds.add(sub.id));
      }
      // If this is a standalone order (not a parent, not a sub-order)
      else if (!order.is_sub_order && !order.parent_order_id) {
        groups.push({ parent: order, subOrders: [] });
        processedIds.add(order.id);
      }
      // If this is an orphaned sub-order (parent not in filtered list)
      else if (order.is_sub_order && !filteredOrders.some(o => o.id === order.parent_order_id)) {
        groups.push({ parent: order, subOrders: [] });
        processedIds.add(order.id);
      }
    });

    return groups;
  }, [filteredOrders]);

  const toggleRowExpansion = (orderId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

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

  const getShipmentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'out_for_delivery':
        return 'bg-yellow-100 text-yellow-800';
      case 'exception':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
                  {order.location_id && (
                    <div>
                      <span className="text-gray-600">Shipping Location:</span>
                      <p className="font-medium flex items-center mt-1">
                        <Building2 className="h-3 w-3 mr-1 text-blue-600" />
                        {locationNames[order.location_id] || 'Unknown Location'}
                      </p>
                    </div>
                  )}
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

            {canManageOrders && order.status !== 'completed' && order.status !== 'cancelled' && order.order_type !== 'backorder' && (
              <div className="space-y-3">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <div>
                        <h4 className="font-semibold text-orange-900">Back-Order Management</h4>
                        <p className="text-sm text-orange-700">Split items that are out of stock into a separate back-order</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenBackorderModal(order)}
                      className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      <Split className="h-4 w-4" />
                      <span>Split Back-Order</span>
                    </button>
                  </div>
                </div>

                {!order.is_sub_order && order.order_type !== 'split_parent' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Package className="h-5 w-5 text-purple-600" />
                        <div>
                          <h4 className="font-semibold text-purple-900">Vendor Fulfillment</h4>
                          <p className="text-sm text-purple-700">Split order by vendor/brand for separate fulfillment</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSplitByVendor(order.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Split className="h-4 w-4" />
                        <span>Split by Vendor</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showSubOrders && subOrders.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h4 className="font-semibold text-indigo-900 mb-3 flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Vendor Sub-Orders ({subOrders.length})
                </h4>
                <div className="space-y-2">
                  {subOrders.map((subOrder) => (
                    <div key={subOrder.id} className="bg-white border border-indigo-200 rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{subOrder.vendor_brand || 'Unknown Vendor'}</p>
                          <p className="text-xs text-gray-500">ID: {subOrder.id.slice(0, 8)}...</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          subOrder.status === 'completed' ? 'bg-green-100 text-green-800' :
                          subOrder.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          subOrder.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {subOrder.status}
                        </span>
                      </div>
                      <div className="text-sm space-y-1">
                        <p className="text-gray-600">{subOrder.items.length} items - ${Number(subOrder.total).toFixed(2)}</p>
                        {subOrder.items.map((item, idx) => (
                          <p key={idx} className="text-xs text-gray-500 pl-2">
                            • {item.name} (x{item.quantity})
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Order Items</h4>
                {order.payment_status && (
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    order.payment_status === 'captured' ? 'bg-green-100 text-green-800' :
                    order.payment_status === 'authorized' ? 'bg-yellow-100 text-yellow-800' :
                    order.payment_status === 'pending' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    Payment: {order.payment_status}
                  </span>
                )}
              </div>
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

        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px] relative">
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

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <label className="text-sm text-gray-700">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="flex gap-4 items-center">
            <span className="text-sm text-gray-700 font-medium">Sort by:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('date')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'date'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Date
              </button>
              <button
                onClick={() => setSortBy('customer')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'customer'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Customer
              </button>
              <button
                onClick={() => setSortBy('total')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'total'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Total
              </button>
            </div>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1 text-sm font-medium"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Ascending
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Descending
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {groupedOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 text-lg">No orders found</p>
          </div>
        ) : (
          groupedOrders.map(({ parent, subOrders }) => {
            const isExpanded = expandedRows.has(parent.id);
            const hasSubOrders = subOrders.length > 0;
            const isParentOrder = parent.order_type === 'split_parent';
            const isSubOrder = parent.is_sub_order;

            return (
              <div key={parent.id} className="space-y-2">
                {/* Parent/Main Order */}
                <div className={`rounded-lg shadow-sm border overflow-hidden ${
                  isParentOrder ? 'border-purple-300 bg-purple-50/30' :
                  isSubOrder ? 'border-blue-300 bg-blue-50/30' :
                  'border-gray-200 bg-white'
                }`}>
                  <div className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Visual Indicator Badge */}
                      {isParentOrder && (
                        <div className="flex-shrink-0">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 border border-purple-300 rounded-full">
                            <Split className="h-3.5 w-3.5 text-purple-700" />
                            <span className="text-xs font-semibold text-purple-900">SPLIT ORDER</span>
                            <span className="text-xs font-medium text-purple-700 bg-purple-200 px-1.5 py-0.5 rounded">
                              {subOrders.length} vendors
                            </span>
                          </div>
                        </div>
                      )}
                      {isSubOrder && (
                        <div className="flex-shrink-0">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-full">
                            <Package className="h-3.5 w-3.5 text-blue-700" />
                            <span className="text-xs font-semibold text-blue-900">VENDOR ORDER</span>
                            {parent.vendor_brand && (
                              <span className="text-xs font-medium text-blue-700 bg-blue-200 px-1.5 py-0.5 rounded">
                                {parent.vendor_brand}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={async () => {
                            setSelectedOrder(parent);
                            await orderService.markOrderAsViewed(parent.id);
                            await fetchOrders();
                          }}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          title="View Full Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleRowExpansion(parent.id)}
                          className="p-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Order ID</p>
                          <p className="text-sm font-mono font-medium text-gray-900">{parent.id.slice(0, 8)}...</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Customer</p>
                          <p className="text-sm text-gray-900">{parent.customer_email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Location</p>
                          {parent.location_id ? (
                            <p className="text-sm text-gray-900 flex items-center">
                              <Building2 className="h-3 w-3 mr-1 text-blue-600" />
                              {locationNames[parent.location_id] || 'Unknown'}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">—</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Date</p>
                          <p className="text-sm text-gray-900">{new Date(parent.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tracking</p>
                          {parent.shipments && parent.shipments.length > 0 ? (
                            <div className="space-y-1">
                              {parent.shipments.slice(0, 2).map((shipment, idx) => (
                                <div key={idx} className="flex items-center space-x-2">
                                  <Truck className="h-3 w-3 text-blue-600" />
                                  <span className="text-xs font-mono text-gray-900">{shipment.tracking_number}</span>
                                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getShipmentStatusColor(shipment.status)}`}>
                                    {shipment.status.replace('_', ' ')}
                                  </span>
                                </div>
                              ))}
                              {parent.shipments.length > 2 && (
                                <p className="text-xs text-gray-500">+{parent.shipments.length - 2} more</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">No tracking</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Total</p>
                          <p className="text-sm font-semibold text-gray-900">${Number(parent.total).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Status</p>
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(parent.status)}`}>
                            {parent.status}
                          </span>
                        </div>
                      </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                          <Package className="h-4 w-4 mr-2 text-gray-600" />
                          Order Items ({parent.items.length})
                        </h4>
                        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {parent.items.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-center">{item.quantity}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900 text-right">${Number(item.price).toFixed(2)}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                    ${(item.quantity * Number(item.price)).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {parent.shipments && parent.shipments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <Truck className="h-4 w-4 mr-2 text-gray-600" />
                            Shipment Tracking ({parent.shipments.length})
                          </h4>
                          <div className="space-y-2">
                            {parent.shipments.map((shipment, index) => (
                              <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <span className="font-semibold text-gray-900 text-sm">{shipment.carrier}</span>
                                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getShipmentStatusColor(shipment.status)}`}>
                                        {shipment.status.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700">
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
                                      <p className="text-xs text-gray-600 mt-2 italic">{shipment.notes}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {parent.shipping_address && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-gray-600" />
                            Shipping Address
                          </h4>
                          <div className="bg-white rounded-lg p-3 border border-gray-200 text-xs text-gray-700">
                            <p className="font-medium">{parent.shipping_address.firstName} {parent.shipping_address.lastName}</p>
                            {parent.shipping_address.company && <p>{parent.shipping_address.company}</p>}
                            <p>{parent.shipping_address.address1}</p>
                            {parent.shipping_address.address2 && <p>{parent.shipping_address.address2}</p>}
                            <p>{parent.shipping_address.city}, {parent.shipping_address.state} {parent.shipping_address.postalCode}</p>
                            {parent.shipping_address.phone && <p className="mt-1">Phone: {parent.shipping_address.phone}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-Orders (Vendor Split Orders) */}
              {subOrders.length > 0 && (
                <div className="ml-12 space-y-2">
                  {subOrders.map((subOrder) => (
                    <div key={subOrder.id} className="bg-blue-50/50 border-l-4 border-blue-400 rounded-r-lg shadow-sm overflow-hidden">
                      <div className="p-3 hover:bg-blue-100/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-200 border border-blue-400 rounded-md">
                              <Package className="h-3 w-3 text-blue-800" />
                              <span className="text-xs font-bold text-blue-900">{subOrder.vendor_brand || 'Unknown Vendor'}</span>
                            </div>
                          </div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-xs">
                            <div>
                              <p className="text-[10px] text-gray-500 mb-0.5">Sub-Order ID</p>
                              <p className="font-mono font-medium text-gray-900">{subOrder.id.slice(0, 8)}...</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 mb-0.5">Items</p>
                              <p className="text-gray-900">{subOrder.items.length} item(s)</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 mb-0.5">Total</p>
                              <p className="font-semibold text-gray-900">${Number(subOrder.total).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 mb-0.5">Tracking</p>
                              {subOrder.shipments && subOrder.shipments.length > 0 ? (
                                <span className="text-[10px] font-mono text-blue-700">{subOrder.shipments[0].tracking_number}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                            <div>
                              <span className={`px-2 py-0.5 inline-flex text-[10px] font-semibold rounded-full border ${getStatusColor(subOrder.status)}`}>
                                {subOrder.status}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              setSelectedOrder(subOrder);
                              await orderService.markOrderAsViewed(subOrder.id);
                              await fetchOrders();
                            }}
                            className="p-1.5 text-blue-600 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                            title="View Sub-Order Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })
        )}
      </div>

      {selectedOrder && <OrderDetailsModal order={selectedOrder} />}

      {showBackorderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Split className="h-5 w-5 mr-2 text-orange-600" />
                Split Order - Create Back-Order
              </h3>
              <button
                onClick={() => setShowBackorderModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">
                  Select items that are out of stock or need to be back-ordered. These items will be moved to a new separate order.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Back-Order Reason *
                </label>
                <textarea
                  value={backorderReason}
                  onChange={(e) => setBackorderReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={2}
                  placeholder="e.g., Out of stock, Supplier delay, Discontinued item..."
                />
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Select Items to Back-Order</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.productId}
                      className={`p-3 border-2 rounded-lg transition-colors ${
                        selectedBackorderItems.has(item.productId)
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedBackorderItems.has(item.productId)}
                            onChange={() => toggleBackorderItem(item.productId, item.quantity)}
                            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded mt-1"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Available Qty: {item.quantity} × ${item.price.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {selectedBackorderItems.has(item.productId) && (
                          <div className="ml-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Backorder Qty
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              value={backorderQuantities[item.productId] || item.quantity}
                              onChange={(e) => updateBackorderQuantity(
                                item.productId,
                                parseInt(e.target.value) || 1,
                                item.quantity
                              )}
                              onClick={(e) => e.stopPropagation()}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              of {item.quantity}
                            </p>
                          </div>
                        )}
                      </div>

                      {selectedBackorderItems.has(item.productId) && (
                        <div className="mt-2 pt-2 border-t border-orange-200">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white rounded px-2 py-1">
                              <span className="text-gray-600">Backorder:</span>
                              <span className="font-medium text-orange-700 ml-1">
                                {backorderQuantities[item.productId] || item.quantity} units
                              </span>
                            </div>
                            <div className="bg-white rounded px-2 py-1">
                              <span className="text-gray-600">Keep in order:</span>
                              <span className="font-medium text-green-700 ml-1">
                                {item.quantity - (backorderQuantities[item.productId] || item.quantity)} units
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                <div className="text-sm space-y-1">
                  <p className="text-gray-600">
                    Total units to backorder: <span className="font-medium text-orange-700">
                      {Object.values(backorderQuantities).reduce((sum, qty) => sum + qty, 0)} units
                    </span>
                  </p>
                  <p className="text-gray-600">
                    Line items selected: <span className="font-medium text-gray-900">{selectedBackorderItems.size}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowBackorderModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSplitBackorder}
                disabled={processingBackorder || selectedBackorderItems.size === 0 || !backorderReason.trim()}
                className="flex items-center space-x-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingBackorder ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Split className="h-4 w-4" />
                    <span>Split Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Modal for Vendor Split */}
      {showDebugModal && debugOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Split Order by Vendor - Debug Info</h2>
              <button
                onClick={() => setShowDebugModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Order Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">Order ID:</span> {debugOrder.id}</div>
                  <div><span className="font-medium">Order Number:</span> {debugOrder.order_number || 'N/A'}</div>
                  <div><span className="font-medium">Total Items:</span> {debugOrder.items.length}</div>
                  <div><span className="font-medium">Status:</span> {debugOrder.status}</div>
                </div>
              </div>

              {/* Items Debug */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Line Items with Brand Information</h3>
                <div className="space-y-3">
                  {debugOrder.items.map((item, index) => (
                    <div key={index} className="bg-white border border-gray-300 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Product ID:</span> {item.productId}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Quantity:</span> {item.quantity}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Price:</span> ${item.price}
                          </div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${item.brand ? 'text-green-600' : 'text-red-600'}`}>
                            Brand: {item.brand || '❌ NO BRAND DATA'}
                          </div>
                          {!item.brand && (
                            <div className="text-xs text-red-500 mt-1">
                              This item has no brand information. It will be grouped as "Unknown".
                            </div>
                          )}
                          {item.brand && (
                            <div className="text-xs text-green-600 mt-1">
                              ✓ Brand data available
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand Summary */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">Brand Analysis</h3>
                <div className="text-sm space-y-2">
                  {(() => {
                    const brandGroups = new Map<string, number>();
                    debugOrder.items.forEach(item => {
                      const brand = item.brand || 'Unknown';
                      brandGroups.set(brand, (brandGroups.get(brand) || 0) + 1);
                    });

                    return (
                      <div>
                        <div className="font-medium mb-2">Brands found in this order:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {Array.from(brandGroups.entries()).map(([brand, count]) => (
                            <li key={brand} className={brand === 'Unknown' ? 'text-red-600' : 'text-green-600'}>
                              <span className="font-semibold">{brand}</span>: {count} item(s)
                            </li>
                          ))}
                        </ul>
                        {brandGroups.size <= 1 && (
                          <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded text-red-800">
                            <strong>⚠️ Cannot split:</strong> This order only contains items from {brandGroups.size === 1 ? 'one brand' : 'no brands'}.
                            You need items from at least 2 different brands to split.
                          </div>
                        )}
                        {brandGroups.size > 1 && (
                          <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded text-green-800">
                            <strong>✓ Can split:</strong> This order will be split into {brandGroups.size} separate orders.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowDebugModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSplitByVendor}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  disabled={(() => {
                    const brandGroups = new Set(debugOrder.items.map(item => item.brand || 'Unknown'));
                    return brandGroups.size <= 1;
                  })()}
                >
                  Proceed with Split
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;
