import React, { useState, useEffect } from 'react';
import {
  Shield, Calendar, CheckCircle, XCircle, Search, Download, Filter,
  Clock, LogOut, Globe, Monitor, Eye, AlertTriangle, RefreshCw
} from 'lucide-react';
import { supabase } from '../../services/supabase';

interface LoginAudit {
  id: string;
  user_id: string;
  email: string;
  age_verified: boolean;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  login_timestamp: string;
  logout_timestamp?: string;
  session_duration?: number;
  session_ended?: boolean;
  created_at: string;
}

const isImpersonationEvent = (log: LoginAudit) =>
  log.session_id?.startsWith('impersonation_') || log.user_agent?.startsWith('IMPERSONATION:');

const formatDuration = (seconds?: number): string => {
  if (seconds == null || seconds < 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const parseImpersonationDetails = (log: LoginAudit): string => {
  // user_agent format: "IMPERSONATION: admin {adminId} impersonating {userId}"
  const match = log.user_agent?.match(/impersonating\s+(\S+)/);
  return match ? `Target: ${match[1].slice(0, 8)}…` : 'Impersonation';
};

type FilterType = 'all' | 'verified' | 'unverified' | 'impersonation' | 'active' | 'ended';

const LoginAuditLog: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<LoginAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('login_audit')
        .select('*')
        .order('login_timestamp', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching audit logs:', error);
      } else {
        setAuditLogs(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      log.email.toLowerCase().includes(lowerSearch) ||
      log.ip_address?.toLowerCase().includes(lowerSearch) ||
      log.session_id?.toLowerCase().includes(lowerSearch);

    const matchesFilter = (() => {
      switch (filterType) {
        case 'verified':      return log.age_verified && !isImpersonationEvent(log);
        case 'unverified':    return !log.age_verified && !isImpersonationEvent(log);
        case 'impersonation': return isImpersonationEvent(log);
        case 'active':        return !log.logout_timestamp && !isImpersonationEvent(log);
        case 'ended':         return !!log.logout_timestamp;
        default:              return true;
      }
    })();

    return matchesSearch && matchesFilter;
  });

  const impersonationCount = auditLogs.filter(isImpersonationEvent).length;
  const activeCount = auditLogs.filter(l => !l.logout_timestamp && !isImpersonationEvent(l)).length;

  const stats = {
    total: auditLogs.filter(l => !isImpersonationEvent(l)).length,
    verified: auditLogs.filter(l => l.age_verified && !isImpersonationEvent(l)).length,
    unverified: auditLogs.filter(l => !l.age_verified && !isImpersonationEvent(l)).length,
    impersonation: impersonationCount,
    active: activeCount,
  };

  const exportToCSV = () => {
    const headers = [
      'Login Time', 'Logout Time', 'Email', 'Age Verified',
      'Session Duration', 'Session Ended', 'IP Address', 'User Agent', 'Session ID'
    ];
    const rows = filteredLogs.map(log => [
      new Date(log.login_timestamp).toLocaleString(),
      log.logout_timestamp ? new Date(log.logout_timestamp).toLocaleString() : '',
      log.email,
      isImpersonationEvent(log) ? 'N/A (impersonation)' : log.age_verified ? 'Yes' : 'No',
      formatDuration(log.session_duration),
      log.session_ended == null ? '' : log.session_ended ? 'Explicit Logout' : 'Browser Close',
      log.ip_address || '',
      log.user_agent || '',
      log.session_id || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `login-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-purple-600" />
            Login Audit Log
          </h2>
          <p className="text-gray-500 mt-1 text-sm">All login events, session durations, and age verification</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAuditLogs}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Logins', value: stats.total, icon: Calendar, color: 'blue' },
          { label: 'Age Verified', value: stats.verified, icon: CheckCircle, color: 'green' },
          { label: 'Not Verified', value: stats.unverified, icon: XCircle, color: 'red' },
          { label: 'Active Now', value: stats.active, icon: Clock, color: 'yellow' },
          { label: 'Impersonations', value: stats.impersonation, icon: Eye, color: 'purple' },
        ].map(stat => (
          <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-200 rounded-lg p-3`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-${stat.color}-600 text-xs font-medium`}>{stat.label}</p>
                <p className={`text-xl font-bold text-${stat.color}-900 mt-0.5`}>{stat.value}</p>
              </div>
              <stat.icon className={`h-6 w-6 text-${stat.color}-400`} />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search email, IP address, or session ID…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as FilterType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Events</option>
            <option value="verified">Age Verified</option>
            <option value="unverified">Not Verified</option>
            <option value="active">Active Sessions</option>
            <option value="ended">Ended Sessions</option>
            <option value="impersonation">Impersonation Events</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Login Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Age Verified</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">End Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No records found
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isImpersonation = isImpersonationEvent(log);
                  const isActive = !log.logout_timestamp && !isImpersonation;
                  const isExpanded = expandedRow === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          isImpersonation ? 'bg-purple-50/50' : ''
                        }`}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        {/* Login time */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isImpersonation && <Eye className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />}
                            {isActive && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Active session" />}
                            <div>
                              <p className="text-gray-900 font-medium">
                                {new Date(log.login_timestamp).toLocaleDateString()}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {new Date(log.login_timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                          {isImpersonation ? (
                            <span className="text-purple-700 font-medium">{log.email}</span>
                          ) : (
                            log.email
                          )}
                        </td>

                        {/* Age verified */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isImpersonation ? (
                            <span className="text-xs text-gray-400 italic">N/A</span>
                          ) : log.age_verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="h-3 w-3" /> Not Verified
                            </span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-gray-700">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {isActive ? (
                              <span className="text-green-600 font-medium">Active</span>
                            ) : (
                              formatDuration(log.session_duration)
                            )}
                          </div>
                        </td>

                        {/* End reason */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!log.logout_timestamp ? (
                            isImpersonation ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Active
                              </span>
                            )
                          ) : log.session_ended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <LogOut className="h-3 w-3" /> Logged Out
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              <Monitor className="h-3 w-3" /> Browser Closed
                            </span>
                          )}
                        </td>

                        {/* IP */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-gray-600 text-xs">
                            <Globe className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            {log.ip_address || <span className="text-gray-300">—</span>}
                          </div>
                        </td>

                        {/* Details toggle */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isImpersonation ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <AlertTriangle className="h-3 w-3" /> Impersonation
                            </span>
                          ) : (
                            <button className="text-xs text-blue-600 hover:text-blue-800 underline">
                              {isExpanded ? 'Hide' : 'More'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-600">
                              <div><span className="font-medium text-gray-800">Session ID:</span> <span className="font-mono">{log.session_id || '—'}</span></div>
                              <div><span className="font-medium text-gray-800">User ID:</span> <span className="font-mono">{log.user_id.slice(0, 16)}…</span></div>
                              {log.logout_timestamp && (
                                <div><span className="font-medium text-gray-800">Logout Time:</span> {new Date(log.logout_timestamp).toLocaleString()}</div>
                              )}
                              <div><span className="font-medium text-gray-800">User Agent:</span> <span className="break-all">{log.user_agent || '—'}</span></div>
                              {isImpersonation && (
                                <div className="col-span-2">
                                  <span className="font-medium text-purple-800">Impersonation Details:</span>{' '}
                                  <span className="text-purple-700">{parseImpersonationDetails(log)}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLogs.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Showing {filteredLogs.length} of {auditLogs.length} total records
        </p>
      )}
    </div>
  );
};

export default LoginAuditLog;
