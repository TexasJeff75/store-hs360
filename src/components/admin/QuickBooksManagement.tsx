import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, ExternalLink, Download } from 'lucide-react';
import { quickbooksOAuth, quickbooksCustomers, quickbooksInvoices } from '../../services/quickbooks';
import { supabase } from '../../services/supabase';

interface QBCredentials {
  id: string;
  realm_id: string;
  is_active: boolean;
  connected_by: string | null;
  last_refresh_at: string | null;
  token_expires_at: string;
  created_at: string;
}

interface SyncLog {
  id: string;
  entity_type: string;
  entity_id: string;
  quickbooks_id: string | null;
  sync_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function QuickBooksManagement() {
  const [credentials, setCredentials] = useState<QBCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'connection' | 'sync' | 'logs'>('connection');

  useEffect(() => {
    loadCredentials();
    loadSyncLogs();
  }, []);

  const loadCredentials = async () => {
    try {
      const creds = await quickbooksOAuth.getActiveCredentials();
      setCredentials(creds);
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('quickbooks_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSyncLogs(data || []);
    } catch (error) {
      console.error('Failed to load sync logs:', error);
    }
  };

  const handleConnect = () => {
    const authUrl = quickbooksOAuth.getAuthorizationUrl();
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (!credentials) return;

    if (!confirm('Are you sure you want to disconnect from QuickBooks? This will stop all syncing.')) {
      return;
    }

    try {
      await quickbooksOAuth.disconnect(credentials.id);
      setCredentials(null);
    } catch (error: any) {
      alert(`Failed to disconnect: ${error.message}`);
    }
  };

  const handleSyncOrganizations = async () => {
    setSyncing(true);
    try {
      const result = await quickbooksCustomers.batchSyncOrganizations();
      alert(`Sync complete!\nSuccess: ${result.success.length}\nFailed: ${result.failed.length}`);
      await loadSyncLogs();
    } catch (error: any) {
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncOrders = async () => {
    setSyncing(true);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('sync_status', 'pending')
        .limit(20);

      if (!orders || orders.length === 0) {
        alert('No pending orders to sync');
        setSyncing(false);
        return;
      }

      const result = await quickbooksInvoices.batchCreateInvoices(
        orders.map(o => o.id)
      );

      alert(`Invoices created!\nSuccess: ${result.success.length}\nFailed: ${result.failed.length}`);
      await loadSyncLogs();
    } catch (error: any) {
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      case 'retry':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'retry':
        return <RefreshCw className="h-5 w-5 text-blue-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">QuickBooks Online Integration</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage QuickBooks connection, sync customers and invoices
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('connection')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'connection'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Connection
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sync'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sync Operations
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sync Logs
          </button>
        </nav>
      </div>

      {activeTab === 'connection' && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">QuickBooks Connection Status</h3>
            <div className="mt-4">
              {credentials ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Connected</p>
                        <p className="text-sm text-gray-500">Realm ID: {credentials.realm_id}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Disconnect
                    </button>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Connected At</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(credentials.created_at).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Last Token Refresh</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {credentials.last_refresh_at
                            ? new Date(credentials.last_refresh_at).toLocaleString()
                            : 'Never'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Token Expires</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {new Date(credentials.token_expires_at).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                        <dd className="mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            credentials.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {credentials.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Not Connected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Connect your QuickBooks Online account to enable invoicing and payment processing.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={handleConnect}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <ExternalLink className="h-5 w-5 mr-2" />
                      Connect to QuickBooks
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">Sync Operations</h3>
            <p className="mt-1 text-sm text-gray-500">
              Manually trigger synchronization between your database and QuickBooks.
            </p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Sync Organizations</h4>
                  <p className="mt-1 text-sm text-gray-500">
                    Create or update QuickBooks customers from your organizations
                  </p>
                </div>
                <button
                  onClick={handleSyncOrganizations}
                  disabled={syncing || !credentials}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? (
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-5 w-5 mr-2" />
                  )}
                  Sync Now
                </button>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Create Invoices</h4>
                  <p className="mt-1 text-sm text-gray-500">
                    Generate QuickBooks invoices for pending orders
                  </p>
                </div>
                <button
                  onClick={handleSyncOrders}
                  disabled={syncing || !credentials}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? (
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5 mr-2" />
                  )}
                  Create Invoices
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Sync Logs</h3>
              <p className="mt-1 text-sm text-gray-500">Recent synchronization activity</p>
            </div>
            <button
              onClick={loadSyncLogs}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
          <div className="border-t border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      QB ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {syncLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No sync logs found
                      </td>
                    </tr>
                  ) : (
                    syncLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getStatusIcon(log.status)}
                            <span className={`ml-2 text-sm font-medium ${getStatusColor(log.status)}`}>
                              {log.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.entity_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.sync_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {log.quickbooks_id || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                          {log.error_message || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
