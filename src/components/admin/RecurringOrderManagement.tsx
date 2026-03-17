import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Calendar, Users, Filter, Search, TrendingUp, AlertCircle,
  Pause, Play, X, ChevronDown, ChevronUp, SkipForward, Pencil, Save, Loader2, History,
} from 'lucide-react';
import { recurringOrderService, RecurringOrder, RecurringOrderHistory } from '../../services/recurringOrderService';
import { supabase } from '../../services/supabase';

interface EnrichedRecurringOrder extends RecurringOrder {
  customer_email?: string;
  customer_name?: string;
  org_name?: string;
  product_name?: string;
}

const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;

const RecurringOrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<EnrichedRecurringOrder[]>([]);
  const [filtered, setFiltered] = useState<EnrichedRecurringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, RecurringOrderHistory[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    quantity: number;
    frequency: typeof FREQUENCIES[number];
    frequency_interval: number;
    next_order_date: string;
    discount_percentage: number;
    notes: string;
  } | null>(null);

  const stats = {
    total: orders.length,
    active: orders.filter(o => o.status === 'active').length,
    paused: orders.filter(o => o.status === 'paused').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    dueToday: orders.filter(o => o.status === 'active' && o.next_order_date === new Date().toISOString().split('T')[0]).length,
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await recurringOrderService.getAllRecurringOrders();
      if (!raw.length) { setOrders([]); setLoading(false); return; }

      const userIds = [...new Set(raw.map(o => o.user_id))];
      const orgIds = [...new Set(raw.map(o => o.organization_id).filter(Boolean))] as string[];
      const productIds = [...new Set(raw.map(o => o.product_id))];

      const [profilesRes, orgsRes, productsRes] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name').in('id', userIds),
        orgIds.length
          ? supabase.from('organizations').select('id, name').in('id', orgIds)
          : Promise.resolve({ data: [] }),
        supabase.from('products').select('id, name').in('id', productIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const orgMap = new Map((orgsRes.data || []).map(o => [o.id, o]));
      const productMap = new Map((productsRes.data || []).map(p => [p.id, p]));

      const enriched: EnrichedRecurringOrder[] = raw.map(o => ({
        ...o,
        customer_email: profileMap.get(o.user_id)?.email,
        customer_name: profileMap.get(o.user_id)?.full_name,
        org_name: o.organization_id ? orgMap.get(o.organization_id)?.name : undefined,
        product_name: productMap.get(o.product_id)?.name,
      }));

      setOrders(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    let result = orders;
    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.customer_email?.toLowerCase().includes(term) ||
        o.customer_name?.toLowerCase().includes(term) ||
        o.org_name?.toLowerCase().includes(term) ||
        o.product_name?.toLowerCase().includes(term)
      );
    }
    setFiltered(result);
  }, [orders, searchTerm, statusFilter]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handlePauseResume = async (order: EnrichedRecurringOrder) => {
    setActionLoading(order.id);
    const ok = order.status === 'active'
      ? await recurringOrderService.pauseRecurringOrder(order.id)
      : await recurringOrderService.resumeRecurringOrder(order.id);
    setActionLoading(null);
    if (ok) {
      showMessage('success', `Order ${order.status === 'active' ? 'paused' : 'resumed'}`);
      loadOrders();
    } else {
      showMessage('error', 'Action failed');
    }
  };

  const handleCancel = async (order: EnrichedRecurringOrder) => {
    if (!confirm(`Cancel recurring order for ${order.product_name || 'this product'} (${order.customer_email})? This cannot be undone.`)) return;
    setActionLoading(order.id + '-cancel');
    const ok = await recurringOrderService.cancelRecurringOrder(order.id);
    setActionLoading(null);
    if (ok) { showMessage('success', 'Order cancelled'); loadOrders(); }
    else showMessage('error', 'Cancel failed');
  };

  const handleSkip = async (order: EnrichedRecurringOrder) => {
    if (!confirm(`Skip the next scheduled order for ${order.customer_email}?`)) return;
    setActionLoading(order.id + '-skip');
    const ok = await recurringOrderService.skipNextOrder(order.id, 'Skipped by admin');
    setActionLoading(null);
    if (ok) { showMessage('success', 'Next order skipped'); loadOrders(); }
    else showMessage('error', 'Skip failed');
  };

  const openEdit = (order: EnrichedRecurringOrder) => {
    setEditingId(order.id);
    setEditForm({
      quantity: order.quantity,
      frequency: order.frequency,
      frequency_interval: order.frequency_interval,
      next_order_date: order.next_order_date,
      discount_percentage: order.discount_percentage,
      notes: order.notes || '',
    });
  };

  const handleSaveEdit = async (orderId: string) => {
    if (!editForm) return;
    setActionLoading(orderId + '-save');
    const updated = await recurringOrderService.updateRecurringOrder(orderId, editForm);
    setActionLoading(null);
    if (updated) {
      showMessage('success', 'Order updated');
      setEditingId(null);
      setEditForm(null);
      loadOrders();
    } else {
      showMessage('error', 'Update failed');
    }
  };

  const toggleHistory = async (orderId: string) => {
    if (expandedHistory === orderId) { setExpandedHistory(null); return; }
    setExpandedHistory(orderId);
    if (!history[orderId]) {
      const h = await recurringOrderService.getRecurringOrderHistory(orderId);
      setHistory(prev => ({ ...prev, [orderId]: h }));
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Recurring Order Management</h2>
        <p className="text-gray-600">Monitor and manage all customer recurring orders</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: Package, color: 'text-gray-600' },
          { label: 'Active', value: stats.active, icon: TrendingUp, color: 'text-green-600' },
          { label: 'Paused', value: stats.paused, icon: AlertCircle, color: 'text-yellow-600' },
          { label: 'Cancelled', value: stats.cancelled, icon: X, color: 'text-red-600' },
          { label: 'Due Today', value: stats.dueToday, icon: Calendar, color: 'text-blue-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">{label}</span>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg mb-4 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer, product, or org..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium">No recurring orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Customer', 'Product', 'Frequency', 'Qty', 'Next Order', 'Discount', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(order => (
                  <React.Fragment key={order.id}>
                    {/* Main row */}
                    <tr className={editingId === order.id ? 'bg-purple-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{order.customer_email || order.user_id.slice(0, 8)}</div>
                        {order.customer_name && <div className="text-xs text-gray-500">{order.customer_name}</div>}
                        {order.org_name && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Users className="h-3 w-3" />{order.org_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">{order.product_name || `#${order.product_id}`}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {recurringOrderService.getFrequencyDisplay(order.frequency, order.frequency_interval)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.quantity}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          order.status === 'active' && order.next_order_date < today ? 'text-red-600' :
                          order.status === 'active' && order.next_order_date === today ? 'text-blue-600' :
                          'text-gray-900'
                        }`}>
                          {new Date(order.next_order_date + 'T00:00:00').toLocaleDateString()}
                        </div>
                        {order.status === 'active' && order.next_order_date < today && <div className="text-xs text-red-500">Overdue</div>}
                        {order.status === 'active' && order.next_order_date === today && <div className="text-xs text-blue-500">Due today</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {order.discount_percentage > 0 ? `${order.discount_percentage}%` : '—'}
                      </td>
                      <td className="px-4 py-3">{statusBadge(order.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Pause / Resume */}
                          {(order.status === 'active' || order.status === 'paused') && (
                            <button
                              title={order.status === 'active' ? 'Pause' : 'Resume'}
                              onClick={() => handlePauseResume(order)}
                              disabled={!!actionLoading}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            >
                              {actionLoading === order.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : order.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                          )}
                          {/* Skip */}
                          {order.status === 'active' && (
                            <button
                              title="Skip next order"
                              onClick={() => handleSkip(order)}
                              disabled={!!actionLoading}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            >
                              {actionLoading === order.id + '-skip'
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <SkipForward className="h-4 w-4" />}
                            </button>
                          )}
                          {/* Edit */}
                          {order.status !== 'cancelled' && (
                            <button
                              title="Edit"
                              onClick={() => editingId === order.id ? (setEditingId(null), setEditForm(null)) : openEdit(order)}
                              disabled={!!actionLoading}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {/* Cancel */}
                          {order.status !== 'cancelled' && order.status !== 'expired' && (
                            <button
                              title="Cancel"
                              onClick={() => handleCancel(order)}
                              disabled={!!actionLoading}
                              className="p-1.5 rounded hover:bg-gray-100 text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              {actionLoading === order.id + '-cancel'
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <X className="h-4 w-4" />}
                            </button>
                          )}
                          {/* History */}
                          <button
                            title="Order history"
                            onClick={() => toggleHistory(order.id)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          >
                            {expandedHistory === order.id ? <ChevronUp className="h-4 w-4" /> : <History className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit row */}
                    {editingId === order.id && editForm && (
                      <tr className="bg-purple-50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                              <input
                                type="number" min={1}
                                value={editForm.quantity}
                                onChange={e => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 1 })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                              <select
                                value={editForm.frequency}
                                onChange={e => setEditForm({ ...editForm, frequency: e.target.value as typeof FREQUENCIES[number] })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              >
                                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Interval</label>
                              <input
                                type="number" min={1}
                                value={editForm.frequency_interval}
                                onChange={e => setEditForm({ ...editForm, frequency_interval: parseInt(e.target.value) || 1 })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Next Order Date</label>
                              <input
                                type="date"
                                value={editForm.next_order_date}
                                onChange={e => setEditForm({ ...editForm, next_order_date: e.target.value })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Discount %</label>
                              <input
                                type="number" min={0} max={100} step={0.01}
                                value={editForm.discount_percentage}
                                onChange={e => setEditForm({ ...editForm, discount_percentage: parseFloat(e.target.value) || 0 })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                              <input
                                type="text"
                                value={editForm.notes}
                                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                placeholder="Optional notes"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleSaveEdit(order.id)}
                              disabled={actionLoading === order.id + '-save'}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                            >
                              {actionLoading === order.id + '-save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditForm(null); }}
                              className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* History row */}
                    {expandedHistory === order.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
                            <History className="h-4 w-4" />
                            Order History
                          </div>
                          {!history[order.id] ? (
                            <div className="text-sm text-gray-500">Loading...</div>
                          ) : history[order.id].length === 0 ? (
                            <div className="text-sm text-gray-500">No history yet.</div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-gray-500 uppercase">
                                  <th className="text-left pb-2 pr-4">Scheduled</th>
                                  <th className="text-left pb-2 pr-4">Processed</th>
                                  <th className="text-left pb-2 pr-4">Status</th>
                                  <th className="text-left pb-2 pr-4">Amount</th>
                                  <th className="text-left pb-2">Note</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {history[order.id].map(h => (
                                  <tr key={h.id}>
                                    <td className="py-1.5 pr-4">{new Date(h.scheduled_date + 'T00:00:00').toLocaleDateString()}</td>
                                    <td className="py-1.5 pr-4">{h.processed_date ? new Date(h.processed_date).toLocaleDateString() : '—'}</td>
                                    <td className="py-1.5 pr-4">
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                        h.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        h.status === 'failed' ? 'bg-red-100 text-red-700' :
                                        h.status === 'skipped' ? 'bg-gray-100 text-gray-600' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>{h.status}</span>
                                    </td>
                                    <td className="py-1.5 pr-4">{h.amount ? `$${h.amount.toFixed(2)}` : '—'}</td>
                                    <td className="py-1.5 text-gray-500">{h.error_message || ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecurringOrderManagement;
