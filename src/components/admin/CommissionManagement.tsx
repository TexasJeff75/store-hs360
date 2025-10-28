import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Clock, CheckCircle, XCircle, Eye, Search, Filter } from 'lucide-react';
import { commissionService, Commission } from '../../services/commissionService';
import { useAuth } from '../../contexts/AuthContext';

const CommissionManagement: React.FC = () => {
  const { user, profile } = useAuth();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCommission, setSelectedCommission] = useState<any | null>(null);
  const [groupByMonth, setGroupByMonth] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    paid: 0
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCommissions();
  }, [statusFilter, user]);

  const fetchCommissions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      console.log('Fetching commissions for user:', user.id, 'role:', profile?.role);

      if (profile?.role === 'sales_rep') {
        const { commissions: data } = await commissionService.getSalesRepCommissions(
          user.id,
          statusFilter !== 'all' ? statusFilter : undefined
        );
        setCommissions(data);

        const { summary: summaryData } = await commissionService.getSalesRepCommissionSummary(user.id);
        if (summaryData) {
          setSummary({
            total: summaryData.total_commissions,
            pending: summaryData.pending_amount,
            approved: summaryData.approved_amount,
            paid: summaryData.paid_amount
          });
        }
      } else if (profile?.role === 'admin') {
        const { commissions: data, error: fetchError } = await commissionService.getAllCommissions({
          status: statusFilter !== 'all' ? statusFilter : undefined
        });

        if (fetchError) {
          console.error('Error from service:', fetchError);
          setError(fetchError);
          return;
        }

        console.log('Fetched commissions:', data);
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
        console.log('User role not admin or sales_rep:', profile?.role);
        setError('You do not have permission to view commissions');
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch commissions');
    } finally {
      setLoading(false);
    }
  };

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

      const key = profile?.role === 'admin'
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
          {profile?.role === 'sales_rep' ? 'My Commissions' : 'Commission Management'}
        </h2>
        <p className="text-gray-600">
          {profile?.role === 'sales_rep'
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

      {!loading && commissions.length === 0 && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          {profile?.role === 'sales_rep' ? (
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
                {profile?.role === 'sales_rep' ? 'Total Earned' : 'Total Commissions'}
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
                {profile?.role === 'sales_rep' ? 'Under Review' : 'Pending'}
              </p>
              <p className="text-2xl font-bold text-yellow-900">${summary.pending.toFixed(2)}</p>
              {profile?.role === 'sales_rep' && (
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
                {profile?.role === 'sales_rep' ? 'Ready to Pay' : 'Approved'}
              </p>
              <p className="text-2xl font-bold text-blue-900">${summary.approved.toFixed(2)}</p>
              {profile?.role === 'sales_rep' && (
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
                {profile?.role === 'sales_rep' ? 'Already Paid' : 'Paid'}
              </p>
              <p className="text-2xl font-bold text-green-900">${summary.paid.toFixed(2)}</p>
              {profile?.role === 'sales_rep' && (
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales Rep</th>
                {profile?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Margin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 10 : 9} className="px-6 py-12 text-center text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No commissions found</p>
                  </td>
                </tr>
              ) : (
                groupedCommissions().map((group, groupIndex) => (
                  <React.Fragment key={group.key}>
                    {groupByMonth && (
                      <tr className="bg-gray-100 border-y-2 border-gray-300">
                        <td colSpan={profile?.role === 'admin' ? 10 : 9} className="px-6 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="font-bold text-gray-900 text-sm">
                                {profile?.role === 'admin'
                                  ? group.key.split('|')[0] + ' - ' + group.key.split('|')[1]
                                  : group.key
                                }
                              </span>
                              <span className="text-xs text-gray-600">
                                ({group.commissions.length} {group.commissions.length === 1 ? 'order' : 'orders'})
                              </span>
                            </div>
                            <div className="text-sm font-bold text-green-600">
                              Total: ${group.commissions.reduce((sum, c) => sum + Number(c.commission_amount), 0).toFixed(2)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {group.commissions.map((commission) => (
                      <tr key={commission.id} className="hover:bg-gray-50 border-b border-gray-200">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {commission.order_id.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {commission.sales_rep?.email || 'N/A'}
                        </td>
                        {profile?.role === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {commission.organization?.name || 'N/A'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${Number(commission.order_total).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {commission.product_margin ? (
                            <span className="font-semibold text-blue-600">
                              ${Number(commission.product_margin).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">No cost data</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Number(commission.commission_rate).toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          {commission.distributor_id ? (
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
                            {profile?.role === 'admin' && commission.status === 'pending' && (
                              <button
                                onClick={() => handleApproveCommission(commission.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            {profile?.role === 'admin' && commission.status === 'approved' && (
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
        </div>
      </div>

      {selectedCommission && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelectedCommission(null)}></div>

            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Commission Details</h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Order ID</label>
                    <p className="font-medium">{selectedCommission.order_id}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Sales Rep</label>
                    <p className="font-medium">{selectedCommission.sales_rep?.email}</p>
                  </div>
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
                  <div>
                    <label className="text-sm text-gray-600">Order Total</label>
                    <p className="font-medium">${Number(selectedCommission.order_total).toFixed(2)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Product Margin</label>
                    <p className="font-medium text-blue-600">
                      {selectedCommission.product_margin
                        ? `$${Number(selectedCommission.product_margin).toFixed(2)}`
                        : 'No cost data'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Commission Rate</label>
                    <p className="font-medium">{Number(selectedCommission.commission_rate).toFixed(2)}%</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Commission Amount</label>
                    <div>
                      <p className="font-bold text-green-600 text-lg">${Number(selectedCommission.commission_amount).toFixed(2)}</p>
                      {selectedCommission.distributor_id && (
                        <div className="mt-2 text-sm space-y-1">
                          <p className="text-gray-700">
                            Sales Rep Commission: <span className="font-semibold text-green-600">${Number(selectedCommission.sales_rep_commission || 0).toFixed(2)}</span>
                          </p>
                          <p className="text-gray-700">
                            Distributor Commission: <span className="font-semibold text-blue-600">${Number(selectedCommission.distributor_commission || 0).toFixed(2)}</span>
                          </p>
                          <p className="text-xs text-gray-500 italic mt-1">
                            Split Type: {selectedCommission.commission_split_type === 'percentage_of_distributor' ? 'Percentage of Distributor' : 'Fixed with Override'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Created Date</label>
                    <p className="font-medium">{new Date(selectedCommission.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {selectedCommission.margin_details && selectedCommission.margin_details.length > 0 && (
                  <>
                    <div className="mt-4">
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">Margin Breakdown</label>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        {selectedCommission.margin_details.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <div className="flex-1">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-xs text-gray-500">
                                ${Number(item.price).toFixed(2)} - ${Number(item.cost).toFixed(2)} = ${(Number(item.price) - Number(item.cost)).toFixed(2)} × {item.quantity}
                              </p>
                            </div>
                            <p className="font-semibold text-blue-600">${Number(item.margin).toFixed(2)}</p>
                          </div>
                        ))}
                        <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                          <span>Total Product Margin:</span>
                          <span className="text-blue-600">${Number(selectedCommission.product_margin).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">Commission Breakdown</label>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        {selectedCommission.margin_details.map((item: any, index: number) => {
                          const hasMarkup = item.hasMarkup || false;
                          const baseCommission = Number(item.baseCommission || 0);
                          const markupCommission = Number(item.markupCommission || 0);
                          const totalCommission = Number(item.totalCommission || 0);
                          const baseMargin = Number(item.baseMargin || 0);
                          const markupAmount = Number(item.markupAmount || 0);

                          return (
                            <div key={index} className="text-sm border-b border-gray-200 pb-2 last:border-b-0 last:pb-0">
                              <div className="flex justify-between items-start mb-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="font-semibold text-green-600">${totalCommission.toFixed(2)}</p>
                              </div>
                              <div className="ml-2 space-y-0.5">
                                <div className="flex justify-between text-xs text-gray-600">
                                  <span>Base Commission ({Number(selectedCommission.commission_rate).toFixed(2)}% of ${baseMargin.toFixed(2)})</span>
                                  <span className="text-green-600">${baseCommission.toFixed(2)}</span>
                                </div>
                                {hasMarkup && markupCommission > 0 && (
                                  <div className="flex justify-between text-xs text-gray-600">
                                    <span>Markup Commission (100% of ${markupAmount.toFixed(2)})</span>
                                    <span className="text-green-600 font-semibold">${markupCommission.toFixed(2)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                          <span>Total Commission:</span>
                          <div>
                            <span className="text-green-600 font-semibold">${Number(selectedCommission.commission_amount).toFixed(2)}</span>
                            {selectedCommission.distributor_id && (
                              <div className="mt-1 text-xs text-gray-600">
                                (Rep: ${Number(selectedCommission.sales_rep_commission || 0).toFixed(2)} +
                                Dist: ${Number(selectedCommission.distributor_commission || 0).toFixed(2)})
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
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

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setSelectedCommission(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                  {profile?.role === 'admin' && selectedCommission.status === 'pending' && (
                    <button
                      onClick={() => handleApproveCommission(selectedCommission.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Approve Commission
                    </button>
                  )}
                  {profile?.role === 'admin' && selectedCommission.status === 'approved' && (
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
      )}
    </div>
  );
};

export default CommissionManagement;
