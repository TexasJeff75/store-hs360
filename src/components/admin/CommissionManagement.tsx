import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle, XCircle, Eye, Search, Filter, AlertTriangle, ChevronDown, ChevronRight, Printer, ExternalLink } from 'lucide-react';
import { commissionService, Commission } from '../../services/commissionService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';

interface DiagnosticData {
  totalOrders: number;
  completedOrders: number;
  completedWithSalesRep: number;
  completedWithOrg: number;
  completedWithBoth: number;
  orgSalesRepEntries: number;
  commissionRecords: number;
  ordersWithoutCommission: { id: string; status: string; sales_rep_id: string | null; organization_id: string | null; total: number; created_at: string }[];
}

interface CommissionManagementProps {
  onNavigate?: (tab: string) => void;
}

const CommissionManagement: React.FC<CommissionManagementProps> = ({ onNavigate }) => {
  const { user, profile, effectiveUserId, effectiveProfile, isImpersonating } = useAuth();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCommission, setSelectedCommission] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [groupByMonth, setGroupByMonth] = useState(true);
  const [isDistributor, setIsDistributor] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    paid: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Use effective identity for data fetching & display (supports impersonation)
  // Use real profile for admin-only actions (approve, pay, diagnostics)
  const viewRole = effectiveProfile?.role ?? profile?.role;
  const viewUserId = effectiveUserId ?? user?.id;

  useEffect(() => {
    fetchCommissions();
  }, [statusFilter, user, effectiveUserId]);

  const fetchCommissions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      if (viewRole === 'distributor') {
        // Get distributor ID for the effective user
        const { data: distributorData } = await supabase
          .from('distributors')
          .select('id')
          .eq('user_id', viewUserId!)
          .eq('is_active', true)
          .maybeSingle();

        if (distributorData) {
          setIsDistributor(true);
          const { commissions: data } = await commissionService.getDistributorCommissions(
            distributorData.id,
            statusFilter !== 'all' ? statusFilter : undefined
          );
          setCommissions(data);

          const { summary: summaryData } = await commissionService.getDistributorCommissionSummary(distributorData.id);
          if (summaryData) {
            setSummary({
              total: summaryData.total_commissions,
              pending: summaryData.pending_amount,
              approved: summaryData.approved_amount,
              paid: summaryData.paid_amount
            });
          }
        } else {
          setError('Distributor record not found');
        }
      } else if (viewRole === 'sales_rep') {
        setIsDistributor(false);
        const { commissions: data } = await commissionService.getSalesRepCommissions(
          viewUserId!,
          statusFilter !== 'all' ? statusFilter : undefined
        );
        setCommissions(data);

        const { summary: summaryData } = await commissionService.getSalesRepCommissionSummary(viewUserId!);
        if (summaryData) {
          setSummary({
            total: summaryData.total_commissions,
            pending: summaryData.pending_amount,
            approved: summaryData.approved_amount,
            paid: summaryData.paid_amount
          });
        }
      } else if (viewRole === 'admin') {
        const { commissions: data, error: fetchError } = await commissionService.getAllCommissions({
          status: statusFilter !== 'all' ? statusFilter : undefined
        });

        if (fetchError) {
          console.error('Error from service:', fetchError);
          setError(fetchError);
          return;
        }

        setCommissions(data);

        const totalSum = data.reduce((acc, c) => acc + Number(c.commission_amount), 0);
        const pendingSum = data.filter(c => c.status === 'pending').reduce((acc, c) => acc + Number(c.commission_amount), 0);
        const approvedSum = data.filter(c => c.status === 'approved').reduce((acc, c) => acc + Number(c.commission_amount), 0);
        const paidSum = data.filter(c => c.status === 'paid').reduce((acc, c) => acc + Number(c.commission_amount), 0);

        setSummary({
          total: totalSum,
          pending: pendingSum,
          approved: approvedSum,
          paid: paidSum
        });
      } else {
        setError('You do not have permission to view commissions');
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch commissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnostics = async () => {
    try {
      // Get all orders
      const { data: allOrders, count: totalOrders } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true });

      // Get completed orders with details
      const { data: completedOrdersData } = await supabase
        .from('orders')
        .select('id, status, sales_rep_id, organization_id, total, created_at')
        .eq('status', 'completed');

      const completed = completedOrdersData || [];
      const completedWithSalesRep = completed.filter(o => o.sales_rep_id);
      const completedWithOrg = completed.filter(o => o.organization_id);
      const completedWithBoth = completed.filter(o => o.sales_rep_id && o.organization_id);

      // Get organization_sales_reps count
      const { count: osrCount } = await supabase
        .from('organization_sales_reps')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get commission records count
      const { count: commCount } = await supabase
        .from('commissions')
        .select('id', { count: 'exact', head: true });

      // Find completed orders that DON'T have a commission record
      const { data: existingCommissions } = await supabase
        .from('commissions')
        .select('order_id');

      const commissionOrderIds = new Set((existingCommissions || []).map(c => c.order_id));
      const ordersWithoutCommission = completed.filter(o => !commissionOrderIds.has(o.id));

      setDiagnostics({
        totalOrders: totalOrders || 0,
        completedOrders: completed.length,
        completedWithSalesRep: completedWithSalesRep.length,
        completedWithOrg: completedWithOrg.length,
        completedWithBoth: completedWithBoth.length,
        orgSalesRepEntries: osrCount || 0,
        commissionRecords: commCount || 0,
        ordersWithoutCommission: ordersWithoutCommission.slice(0, 20), // limit to 20
      });
    } catch (err) {
      console.error('Error fetching diagnostics:', err);
    }
  };

  useEffect(() => {
    if (profile?.role === 'admin' && showDiagnostics && !diagnostics) {
      fetchDiagnostics();
    }
  }, [showDiagnostics, profile?.role]);

  const fetchOrderItems = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('items')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      if (data?.items) {
        setOrderItems(data.items);
      }
    } catch (error) {
      console.error('Error fetching order items:', error);
      setOrderItems([]);
    }
  };

  useEffect(() => {
    if (selectedCommission?.order_id) {
      fetchOrderItems(selectedCommission.order_id);
    } else {
      setOrderItems([]);
    }
  }, [selectedCommission?.order_id]);

  const handleApproveCommission = async (commissionId: string) => {
    if (!user) return;

    const notes = prompt('Add approval notes (optional):');
    const result = await commissionService.approveCommission(commissionId, user.id, notes || undefined);

    if (result.success) {
      alert('Commission approved successfully');
      fetchCommissions();
      setSelectedCommission(null);
    } else {
      alert(`Failed to approve commission: ${result.error}`);
    }
  };

  const handleMarkPaid = async (commissionId: string) => {
    const paymentRef = prompt('Enter payment reference:');
    if (!paymentRef) return;

    const result = await commissionService.markCommissionPaid(commissionId, paymentRef);

    if (result.success) {
      alert('Commission marked as paid');
      fetchCommissions();
      setSelectedCommission(null);
    } else {
      alert(`Failed to mark commission as paid: ${result.error}`);
    }
  };

  const filteredCommissions = commissions.filter(commission => {
    const matchesSearch =
      commission.sales_rep?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      commission.organization?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      commission.order_id.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const groupedCommissions = () => {
    if (!groupByMonth) {
      return [{ key: 'all', commissions: filteredCommissions }];
    }

    const groups: Record<string, any[]> = {};

    filteredCommissions.forEach(commission => {
      const date = new Date(commission.created_at);
      const salesRepId = commission.sales_rep_id || 'unknown';
      const salesRepName = commission.sales_rep?.email || 'Unknown';
      const monthYear = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      const key = viewRole === 'admin'
        ? `${salesRepName}|${monthYear}`
        : monthYear;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(commission);
    });

    return Object.entries(groups)
      .sort((a, b) => {
        const dateA = new Date(a[1][0].created_at);
        const dateB = new Date(b[1][0].created_at);
        return dateB.getTime() - dateA.getTime();
      })
      .map(([key, commissions]) => ({ key, commissions }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'paid':
        return <DollarSign className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {viewRole === 'sales_rep' ? 'My Commissions' : 'Commission Management'}
        </h2>
        <p className="text-gray-600">
          {viewRole === 'sales_rep'
            ? 'View your earnings from completed orders'
            : 'Track and manage sales commissions'
          }
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {profile?.role === 'admin' && (
        <div className="mb-4">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showDiagnostics ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <AlertTriangle className="h-4 w-4" />
            Commission Diagnostics
          </button>

          {showDiagnostics && diagnostics && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-900 mb-3 text-sm">Data Pipeline Diagnostics</h4>
              <p className="text-xs text-amber-700 mb-3">
                Commissions are created by a database trigger when an order is marked "completed" and has both a <code className="bg-amber-100 px-1 rounded">sales_rep_id</code> and a matching <code className="bg-amber-100 px-1 rounded">organization_sales_reps</code> entry.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white rounded p-3 border border-amber-200">
                  <p className="text-xs text-gray-500">Total Orders</p>
                  <p className="text-lg font-bold text-gray-900">{diagnostics.totalOrders}</p>
                </div>
                <div className="bg-white rounded p-3 border border-amber-200">
                  <p className="text-xs text-gray-500">Completed Orders</p>
                  <p className="text-lg font-bold text-gray-900">{diagnostics.completedOrders}</p>
                </div>
                <div className={`bg-white rounded p-3 border ${diagnostics.completedWithSalesRep < diagnostics.completedOrders ? 'border-red-300 bg-red-50' : 'border-amber-200'}`}>
                  <p className="text-xs text-gray-500">...with Sales Rep</p>
                  <p className="text-lg font-bold text-gray-900">{diagnostics.completedWithSalesRep}</p>
                  {diagnostics.completedWithSalesRep < diagnostics.completedOrders && (
                    <p className="text-xs text-red-600 mt-1">
                      {diagnostics.completedOrders - diagnostics.completedWithSalesRep} missing sales rep
                    </p>
                  )}
                </div>
                <div className={`bg-white rounded p-3 border ${diagnostics.completedWithBoth < diagnostics.completedWithSalesRep ? 'border-red-300 bg-red-50' : 'border-amber-200'}`}>
                  <p className="text-xs text-gray-500">...with Rep + Org</p>
                  <p className="text-lg font-bold text-gray-900">{diagnostics.completedWithBoth}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded p-3 border border-amber-200">
                  <p className="text-xs text-gray-500">Active Org-Rep Assignments</p>
                  <p className="text-lg font-bold text-gray-900">{diagnostics.orgSalesRepEntries}</p>
                  {diagnostics.orgSalesRepEntries === 0 && (
                    <p className="text-xs text-red-600 mt-1">No assignments! Go to Organizations to assign reps.</p>
                  )}
                </div>
                <div className="bg-white rounded p-3 border border-green-200">
                  <p className="text-xs text-gray-500">Commission Records</p>
                  <p className="text-lg font-bold text-green-700">{diagnostics.commissionRecords}</p>
                </div>
                <div className={`bg-white rounded p-3 border ${diagnostics.ordersWithoutCommission.length > 0 ? 'border-red-300 bg-red-50' : 'border-green-200'}`}>
                  <p className="text-xs text-gray-500">Completed Without Commission</p>
                  <p className="text-lg font-bold text-gray-900">{diagnostics.ordersWithoutCommission.length}</p>
                </div>
              </div>

              {diagnostics.ordersWithoutCommission.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-semibold text-amber-800 mb-2">Completed Orders Missing Commissions (up to 20):</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="pb-1 pr-3">Order ID</th>
                          <th className="pb-1 pr-3">Total</th>
                          <th className="pb-1 pr-3">Sales Rep ID</th>
                          <th className="pb-1 pr-3">Org ID</th>
                          <th className="pb-1 pr-3">Issue</th>
                          <th className="pb-1">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diagnostics.ordersWithoutCommission.map(order => (
                          <tr key={order.id} className="border-t border-amber-100">
                            <td className="py-1 pr-3 font-mono">{order.id.slice(0, 8)}...</td>
                            <td className="py-1 pr-3">${Number(order.total).toFixed(2)}</td>
                            <td className="py-1 pr-3 font-mono">
                              {order.sales_rep_id ? order.sales_rep_id.slice(0, 8) + '...' : <span className="text-red-600 font-semibold">NULL</span>}
                            </td>
                            <td className="py-1 pr-3 font-mono">
                              {order.organization_id ? order.organization_id.slice(0, 8) + '...' : <span className="text-red-600 font-semibold">NULL</span>}
                            </td>
                            <td className="py-1 pr-3">
                              {!order.sales_rep_id && !order.organization_id && <span className="text-red-600">No rep or org</span>}
                              {!order.sales_rep_id && order.organization_id && <span className="text-red-600">No sales rep</span>}
                              {order.sales_rep_id && !order.organization_id && <span className="text-red-600">No organization</span>}
                              {order.sales_rep_id && order.organization_id && <span className="text-orange-600">No org-rep assignment?</span>}
                            </td>
                            <td className="py-1">{new Date(order.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={fetchDiagnostics}
                  className="text-xs px-3 py-1 bg-amber-200 text-amber-800 rounded hover:bg-amber-300 transition-colors"
                >
                  Refresh Diagnostics
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && commissions.length === 0 && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          {viewRole === 'sales_rep' ? (
            <>
              <h3 className="font-semibold text-blue-900 mb-3">No Commissions Yet</h3>
              <div className="text-blue-800 text-sm space-y-2">
                <p>You don't have any commissions yet. Here's how commissions work:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>When you complete an order for your assigned organizations</li>
                  <li>The system automatically calculates your commission based on the profit margin</li>
                  <li>Your commissions appear here for tracking</li>
                  <li>Once approved, they'll be processed for payment</li>
                </ul>
                <p className="mt-3 font-medium">
                  Start by creating orders for your organizations to earn commissions!
                </p>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-blue-900 mb-3">How Commissions Work</h3>
              <ol className="text-blue-800 text-sm space-y-2 list-decimal list-inside">
                <li>Assign a sales rep to an organization (with commission rate)</li>
                <li>Sales rep creates an order for that organization</li>
                <li>When the order is marked as "completed", a commission is automatically calculated</li>
                <li>Review and approve commissions here</li>
                <li>Mark approved commissions as paid</li>
              </ol>
              <p className="text-blue-700 text-sm mt-4 italic">
                <strong>Get Started:</strong> Go to the "Sales Reps" tab to assign sales reps to organizations with commission rates.
              </p>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                {viewRole === 'sales_rep' ? 'Total Earned' : 'Total Commissions'}
              </p>
              <p className="text-2xl font-bold text-gray-900">${summary.total.toFixed(2)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg shadow p-6 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700">
                {viewRole === 'sales_rep' ? 'Under Review' : 'Pending'}
              </p>
              <p className="text-2xl font-bold text-yellow-900">${summary.pending.toFixed(2)}</p>
              {viewRole === 'sales_rep' && (
                <p className="text-xs text-yellow-600 mt-1">Awaiting approval</p>
              )}
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg shadow p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">
                {viewRole === 'sales_rep' ? 'Ready to Pay' : 'Approved'}
              </p>
              <p className="text-2xl font-bold text-blue-900">${summary.approved.toFixed(2)}</p>
              {viewRole === 'sales_rep' && (
                <p className="text-xs text-blue-600 mt-1">Payment pending</p>
              )}
            </div>
            <CheckCircle className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">
                {viewRole === 'sales_rep' ? 'Already Paid' : 'Paid'}
              </p>
              <p className="text-2xl font-bold text-green-900">${summary.paid.toFixed(2)}</p>
              {viewRole === 'sales_rep' && (
                <p className="text-xs text-green-600 mt-1">Received</p>
              )}
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by sales rep, organization, or order..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <button
              onClick={() => setGroupByMonth(!groupByMonth)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                groupByMonth
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {groupByMonth ? 'Group by Month' : 'Show All'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {(() => {
            const isAdmin = viewRole === 'admin';
            const isSalesRep = viewRole === 'sales_rep';
            const isDistributorRole = viewRole === 'distributor';
            const isRealAdmin = profile?.role === 'admin';
            // Column count per role: Order, [SalesRep], Org, [OrderTotal], [Margin], Commission, [CoRep], Status, Date, Actions
            const colCount = isAdmin ? 10 : isDistributorRole ? 7 : isSalesRep ? 5 : 7;

            // Helper to get the role-appropriate commission amount for a commission record
            const getMyAmount = (c: any) => {
              if (isSalesRep) return Number(c.sales_rep_commission ?? c.commission_amount);
              if (isDistributorRole) return Number(c.distributor_commission ?? c.commission_amount);
              return Number(c.commission_amount);
            };

            return (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                {!isSalesRep && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Rep</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                {!isSalesRep && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Total</th>
                )}
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Margin</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {isSalesRep ? 'My Commission' : isDistributorRole ? 'Commission' : 'Commission'}
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Co Rep</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{isRealAdmin ? 'Actions' : ''}</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-6 py-12 text-center text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No commissions found</p>
                  </td>
                </tr>
              ) : (
                groupedCommissions().map((group, groupIndex) => (
                  <React.Fragment key={group.key}>
                    {groupByMonth && (
                      <tr className="bg-gray-100 border-y-2 border-gray-300">
                        <td colSpan={colCount} className="px-6 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="font-bold text-gray-900 text-sm">
                                {isAdmin
                                  ? group.key.split('|')[0] + ' - ' + group.key.split('|')[1]
                                  : group.key
                                }
                              </span>
                              <span className="text-xs text-gray-600">
                                ({group.commissions.length} {group.commissions.length === 1 ? 'order' : 'orders'})
                              </span>
                            </div>
                            <div className="text-sm font-bold text-green-600">
                              Total: ${group.commissions.reduce((sum, c) => sum + getMyAmount(c), 0).toFixed(2)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {group.commissions.map((commission) => (
                      <tr key={commission.id} className="hover:bg-gray-50 border-b border-gray-200">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {onNavigate ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); onNavigate('orders'); }}
                              className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                              title="View order"
                            >
                              {commission.order_id.slice(0, 8)}...
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          ) : (
                            <>{commission.order_id.slice(0, 8)}...</>
                          )}
                        </td>
                        {!isSalesRep && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {commission.sales_rep?.email || 'N/A'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {commission.organization?.name || 'N/A'}
                        </td>
                        {!isSalesRep && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${Number(commission.order_total).toFixed(2)}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {commission.product_margin ? (
                              <span className="font-semibold text-blue-600">
                                ${Number(commission.product_margin).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">No cost data</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          {isSalesRep ? (
                            <div className="text-green-600">
                              ${Number(commission.sales_rep_commission ?? commission.commission_amount).toFixed(2)}
                            </div>
                          ) : isDistributorRole ? (
                            <div className="space-y-1">
                              <div className="text-blue-600">
                                ${Number(commission.distributor_commission || 0).toFixed(2)}
                              </div>
                              {commission.sales_rep_commission != null && (
                                <div className="text-xs text-gray-600">
                                  Rep: ${Number(commission.sales_rep_commission).toFixed(2)}
                                </div>
                              )}
                            </div>
                          ) : commission.distributor_id ? (
                            <div className="space-y-1">
                              <div className="text-green-600">
                                Total: ${Number(commission.commission_amount).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-600">
                                Rep: ${Number(commission.sales_rep_commission || 0).toFixed(2)}
                              </div>
                              <div className="text-xs text-blue-600">
                                Dist: ${Number(commission.distributor_commission || 0).toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-green-600">
                              ${Number(commission.commission_amount).toFixed(2)}
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                            {Number(commission.company_rep_commission || 0) > 0
                              ? `$${Number(commission.company_rep_commission).toFixed(2)}`
                              : <span className="text-gray-400">-</span>
                            }
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex items-center space-x-1 text-xs leading-5 font-semibold rounded-full border ${getStatusColor(commission.status)}`}>
                            {getStatusIcon(commission.status)}
                            <span>{commission.status}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(commission.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setSelectedCommission(commission)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {isRealAdmin && commission.status === 'pending' && (
                              <button
                                onClick={() => handleApproveCommission(commission.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            {isRealAdmin && commission.status === 'approved' && (
                              <button
                                onClick={() => handleMarkPaid(commission.id)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <DollarSign className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
            );
          })()}
        </div>
      </div>

      {selectedCommission && (() => {
        const isAdmin = viewRole === 'admin';
        const isRealAdmin = profile?.role === 'admin';
        const isCompanyRep = selectedCommission.company_rep_id === viewUserId;
        const isSalesRep = viewRole === 'sales_rep';
        const isDistributorUser = viewRole === 'distributor';
        const canSeeAll = isAdmin || isCompanyRep;
        const canSeeDistributor = canSeeAll || isDistributorUser;

        return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-black bg-opacity-50 print:hidden" onClick={() => setSelectedCommission(null)}></div>

            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 print:shadow-none print:max-w-none print:rounded-none">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Commission Details</h3>
                <button
                  onClick={() => window.print()}
                  className="print:hidden text-gray-500 hover:text-gray-700 flex items-center space-x-1 text-sm"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Order ID</label>
                    {onNavigate ? (
                      <button
                        onClick={() => { setSelectedCommission(null); onNavigate('orders'); }}
                        className="font-medium text-xs break-all text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        title="View order details"
                      >
                        {selectedCommission.order_id}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </button>
                    ) : (
                      <p className="font-medium text-xs break-all">{selectedCommission.order_id}</p>
                    )}
                  </div>
                  {canSeeAll && (
                    <div>
                      <label className="text-sm text-gray-600">Sales Rep</label>
                      <p className="font-medium">{selectedCommission.sales_rep?.email}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-600">Organization</label>
                    <p className="font-medium">{selectedCommission.organization?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Status</label>
                    <span className={`px-3 py-1 inline-flex items-center space-x-1 text-xs font-semibold rounded-full border ${getStatusColor(selectedCommission.status)}`}>
                      {getStatusIcon(selectedCommission.status)}
                      <span>{selectedCommission.status}</span>
                    </span>
                  </div>
                  {canSeeAll && (
                    <div>
                      <label className="text-sm text-gray-600">Order Total</label>
                      <p className="font-medium">${Number(selectedCommission.order_total).toFixed(2)}</p>
                    </div>
                  )}
                  {canSeeAll && (
                    <div>
                      <label className="text-sm text-gray-600">Product Margin</label>
                      <p className="font-medium text-blue-600">
                        {selectedCommission.product_margin
                          ? `$${Number(selectedCommission.product_margin).toFixed(2)}`
                          : 'No cost data'}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-600">
                      {isSalesRep ? 'Your Commission' : isDistributorUser ? 'Commission Amount' : 'Commission Amount'}
                    </label>
                    <div>
                      {isSalesRep ? (
                        <p className="font-bold text-green-600 text-lg">${Number(selectedCommission.sales_rep_commission || selectedCommission.commission_amount).toFixed(2)}</p>
                      ) : isDistributorUser ? (
                        <>
                          <p className="font-bold text-green-600 text-lg">${Number(selectedCommission.commission_amount).toFixed(2)}</p>
                          {selectedCommission.distributor_id && (
                            <div className="mt-2 text-sm space-y-1">
                              <p className="text-gray-700">
                                Sales Rep: <span className="font-semibold text-green-600">${Number(selectedCommission.sales_rep_commission || 0).toFixed(2)}</span>
                              </p>
                              <p className="text-gray-700">
                                Distributor: <span className="font-semibold text-blue-600">${Number(selectedCommission.distributor_commission || 0).toFixed(2)}</span>
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-green-600 text-lg">${Number(selectedCommission.commission_amount).toFixed(2)}</p>
                          {selectedCommission.distributor_id && (
                            <div className="mt-2 text-sm space-y-1">
                              <p className="text-gray-700">
                                Sales Rep: <span className="font-semibold text-green-600">${Number(selectedCommission.sales_rep_commission || 0).toFixed(2)}</span>
                              </p>
                              <p className="text-gray-700">
                                Distributor: <span className="font-semibold text-blue-600">${Number(selectedCommission.distributor_commission || 0).toFixed(2)}</span>
                              </p>
                              {Number(selectedCommission.company_rep_commission || 0) > 0 && (
                                <p className="text-gray-700">
                                  Company Rep: <span className="font-semibold text-indigo-600">${Number(selectedCommission.company_rep_commission).toFixed(2)}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Created Date</label>
                    <p className="font-medium">{new Date(selectedCommission.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Line Item Details — visible to admin, company rep, and distributor */}
                {canSeeDistributor && selectedCommission.margin_details && selectedCommission.margin_details.length > 0 && (
                  <div className="mt-4">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Line Item Commission Details</label>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 text-left text-xs text-gray-600">
                            <th className="px-3 py-2">Product</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            {canSeeAll && <th className="px-3 py-2 text-right">Cost</th>}
                            <th className="px-3 py-2 text-right">Price</th>
                            {canSeeAll && <th className="px-3 py-2 text-right">Margin</th>}
                            {selectedCommission.margin_details[0]?.wholesalePrice !== undefined && (
                              <th className="px-3 py-2 text-right">Wholesale</th>
                            )}
                            {selectedCommission.margin_details[0]?.wholesalePrice !== undefined && (
                              <th className="px-3 py-2 text-right">Spread</th>
                            )}
                            <th className="px-3 py-2 text-right">Commission</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedCommission.margin_details.map((item: any, index: number) => {
                            const isWholesale = item.wholesalePrice !== undefined;
                            const spread = isWholesale ? Number(item.spread || 0) : 0;
                            const itemCommission = Number(item.totalCommission || item.commission || item.margin || 0);
                            return (
                              <tr key={index} className="text-xs">
                                <td className="px-3 py-2 font-medium">{item.name}</td>
                                <td className="px-3 py-2 text-right">{item.quantity}</td>
                                {canSeeAll && <td className="px-3 py-2 text-right">${Number(item.cost).toFixed(2)}</td>}
                                <td className="px-3 py-2 text-right">${Number(item.price).toFixed(2)}</td>
                                {canSeeAll && <td className="px-3 py-2 text-right text-blue-600">${Number(item.margin).toFixed(2)}</td>}
                                {isWholesale && (
                                  <td className="px-3 py-2 text-right">${Number(item.wholesalePrice).toFixed(2)}</td>
                                )}
                                {isWholesale && (
                                  <td className="px-3 py-2 text-right text-orange-600">${spread.toFixed(2)}</td>
                                )}
                                <td className="px-3 py-2 text-right font-semibold text-green-600">${itemCommission.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-semibold text-xs">
                            <td className="px-3 py-2" colSpan={canSeeAll ? (selectedCommission.margin_details[0]?.wholesalePrice !== undefined ? 6 : 4) : (selectedCommission.margin_details[0]?.wholesalePrice !== undefined ? 4 : 2)}>
                              Totals
                            </td>
                            {canSeeAll && selectedCommission.margin_details[0]?.wholesalePrice === undefined && (
                              <td className="px-3 py-2 text-right text-blue-600">${Number(selectedCommission.product_margin).toFixed(2)}</td>
                            )}
                            {selectedCommission.margin_details[0]?.wholesalePrice !== undefined && (
                              <td className="px-3 py-2 text-right text-orange-600">
                                ${selectedCommission.margin_details.reduce((sum: number, i: any) => sum + Number(i.spread || 0), 0).toFixed(2)}
                              </td>
                            )}
                            <td className="px-3 py-2 text-right text-green-600">${Number(selectedCommission.commission_amount).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {selectedCommission.notes && (
                  <div>
                    <label className="text-sm text-gray-600">Notes</label>
                    <p className="font-medium">{selectedCommission.notes}</p>
                  </div>
                )}

                {selectedCommission.payment_reference && (
                  <div>
                    <label className="text-sm text-gray-600">Payment Reference</label>
                    <p className="font-medium">{selectedCommission.payment_reference}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 mt-6 print:hidden">
                  <button
                    onClick={() => setSelectedCommission(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                  {isRealAdmin && selectedCommission.status === 'pending' && (
                    <button
                      onClick={() => handleApproveCommission(selectedCommission.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Approve Commission
                    </button>
                  )}
                  {isRealAdmin && selectedCommission.status === 'approved' && (
                    <button
                      onClick={() => handleMarkPaid(selectedCommission.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Mark as Paid
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default CommissionManagement;
