import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Download, Calendar, Filter, Eye } from 'lucide-react';
import { supabase } from '@/services/supabase';
import SortableTable, { Column } from './SortableTable';

interface OrderProfit {
  order_id: string;
  order_number: string;
  user_id: string;
  organization_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  sales_rep_id: string | null;
  items: any[];
  revenue: number;
  total_cost: number;
  gross_profit: number;
  profit_margin: number;
}

interface ProfitSummary {
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  average_margin: number;
  order_count: number;
}

const ProfitReport: React.FC = () => {
  const [orders, setOrders] = useState<OrderProfit[]>([]);
  const [summary, setSummary] = useState<ProfitSummary>({
    total_revenue: 0,
    total_cost: 0,
    total_profit: 0,
    average_margin: 0,
    order_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCostAdmin, setIsCostAdmin] = useState(false);

  useEffect(() => {
    checkCostAdmin();
  }, []);

  useEffect(() => {
    if (isCostAdmin) {
      fetchProfitData();
    }
  }, [isCostAdmin, startDate, endDate, statusFilter]);

  const checkCostAdmin = async () => {
    try {
      const { data, error } = await supabase.rpc('is_cost_admin');
      if (error) throw error;
      setIsCostAdmin(data);

      if (!data) {
        setError('Access Denied: You do not have permission to view profit reports. Contact jeff.lutz for access.');
      }
    } catch (err) {
      console.error('Error checking cost admin status:', err);
      setIsCostAdmin(false);
      setError('Unable to verify permissions');
    }
  };

  const fetchProfitData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch orders within date range
      let query = supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      // Get all product IDs from orders
      const productIds = new Set<number>();
      ordersData?.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (item.productId) {
              productIds.add(item.productId);
            }
          });
        }
      });

      // Fetch product costs (secret costs)
      const { data: costsData, error: costsError } = await supabase
        .from('product_costs')
        .select('product_id, secret_cost, cost_price')
        .in('product_id', Array.from(productIds));

      if (costsError) throw costsError;

      // Build cost map
      const costMap = new Map<number, number>();
      costsData?.forEach(cost => {
        // Use secret_cost if available, fallback to cost_price
        costMap.set(cost.product_id, cost.secret_cost || cost.cost_price || 0);
      });

      // Calculate profit for each order
      const ordersWithProfit: OrderProfit[] = ordersData?.map(order => {
        let totalCost = 0;

        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const cost = costMap.get(item.productId) || 0;
            totalCost += cost * (item.quantity || 1);
          });
        }

        const revenue = order.total || 0;
        const grossProfit = revenue - totalCost;
        const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        return {
          order_id: order.id,
          order_number: order.order_number,
          user_id: order.user_id,
          organization_id: order.organization_id,
          total_amount: revenue,
          status: order.status,
          created_at: order.created_at,
          sales_rep_id: order.sales_rep_id,
          items: order.items,
          revenue,
          total_cost: totalCost,
          gross_profit: grossProfit,
          profit_margin: profitMargin
        };
      }) || [];

      setOrders(ordersWithProfit);

      // Calculate summary
      const summaryData = ordersWithProfit.reduce(
        (acc, order) => ({
          total_revenue: acc.total_revenue + order.revenue,
          total_cost: acc.total_cost + order.total_cost,
          total_profit: acc.total_profit + order.gross_profit,
          average_margin: 0,
          order_count: acc.order_count + 1
        }),
        { total_revenue: 0, total_cost: 0, total_profit: 0, average_margin: 0, order_count: 0 }
      );

      summaryData.average_margin = summaryData.total_revenue > 0
        ? (summaryData.total_profit / summaryData.total_revenue) * 100
        : 0;

      setSummary(summaryData);

      // Log access for audit
      await supabase.from('cost_admin_audit').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'viewed_profit_report',
        accessed_at: new Date().toISOString()
      });

    } catch (err) {
      console.error('Error fetching profit data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profit data');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Order Number', 'Date', 'Status', 'Revenue', 'Cost', 'Gross Profit', 'Margin %'];
    const rows = orders.map(order => [
      order.order_number,
      new Date(order.created_at).toLocaleDateString(),
      order.status,
      order.revenue.toFixed(2),
      order.total_cost.toFixed(2),
      order.gross_profit.toFixed(2),
      order.profit_margin.toFixed(2)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!isCostAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <Eye className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-red-900 mb-2">Access Restricted</h2>
          <p className="text-red-700">{error || 'You do not have permission to view profit reports.'}</p>
          <p className="text-sm text-red-600 mt-2">Contact jeff.lutz for cost admin access.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Profit Report</h2>
            <p className="text-sm text-red-600 mt-1">
              <Eye className="inline w-4 h-4 mr-1" />
              Confidential: Using TRUE product costs (secret_cost)
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Orders</p>
                <p className="text-2xl font-bold text-gray-900">{summary.order_count}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${summary.total_revenue.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">True Cost</p>
                <p className="text-2xl font-bold text-red-900">${summary.total_cost.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gross Profit</p>
                <p className={`text-2xl font-bold ${summary.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${summary.total_profit.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Margin</p>
                <p className={`text-2xl font-bold ${summary.average_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.average_margin.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <SortableTable
        data={orders}
        columns={[
          {
            key: 'order_number',
            label: 'Order',
            sortable: true,
            filterable: true,
            className: 'whitespace-nowrap',
            render: (order) => (
              <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
            )
          },
          {
            key: 'created_at',
            label: 'Date',
            sortable: true,
            filterable: true,
            className: 'whitespace-nowrap',
            render: (order) => (
              <div className="text-sm text-gray-900">
                {new Date(order.created_at).toLocaleDateString()}
              </div>
            )
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            filterable: true,
            className: 'whitespace-nowrap',
            render: (order) => (
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                order.status === 'completed' ? 'bg-green-100 text-green-800' :
                order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {order.status}
              </span>
            )
          },
          {
            key: 'revenue',
            label: 'Revenue',
            sortable: true,
            className: 'whitespace-nowrap text-right',
            headerClassName: 'text-right',
            render: (order) => (
              <div className="text-sm font-medium text-gray-900">
                ${order.revenue.toFixed(2)}
              </div>
            )
          },
          {
            key: 'total_cost',
            label: 'True Cost',
            sortable: true,
            className: 'whitespace-nowrap text-right',
            headerClassName: 'text-right',
            render: (order) => (
              <div className="text-sm font-medium text-red-900">
                ${order.total_cost.toFixed(2)}
              </div>
            )
          },
          {
            key: 'gross_profit',
            label: 'Gross Profit',
            sortable: true,
            className: 'whitespace-nowrap text-right',
            headerClassName: 'text-right',
            render: (order) => (
              <div className={`text-sm font-bold ${order.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${order.gross_profit.toFixed(2)}
              </div>
            )
          },
          {
            key: 'profit_margin',
            label: 'Margin %',
            sortable: true,
            className: 'whitespace-nowrap text-right',
            headerClassName: 'text-right',
            render: (order) => (
              <div className={`text-sm font-bold ${order.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {order.profit_margin.toFixed(1)}%
              </div>
            )
          }
        ]}
        keyExtractor={(order) => order.order_id}
        searchPlaceholder="Search orders..."
        emptyMessage="Try adjusting your date range or filters."
        emptyIcon={<TrendingUp className="mx-auto h-12 w-12 text-gray-400" />}
      />
    </div>
  );
};

export default ProfitReport;
