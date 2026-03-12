import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, ExternalLink, Download, Activity, Upload, Search, Building2, BookOpen } from 'lucide-react';
import { quickbooksOAuth, quickbooksCustomers, quickbooksInvoices } from '../../services/quickbooks';
import type { QBConnectionStatus } from '../../services/quickbooks/oauth';
import { supabase } from '../../services/supabase';

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

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'running';
  message: string;
  details?: string;
}

function ConnectionDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => {
      const existing = prev.findIndex(r => r.name === result.name);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = result;
        return updated;
      }
      return [...prev, result];
    });
  };

  const runDiagnostics = async () => {
    setRunning(true);
    setResults([]);

    addResult({ name: 'Supabase Auth', status: 'running', message: 'Checking session...' });
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      addResult({
        name: 'Supabase Auth',
        status: 'pass',
        message: 'Session active',
        details: `User: ${session.user.email}, Token expires: ${new Date((session.expires_at || 0) * 1000).toLocaleString()}`
      });
    } else {
      addResult({
        name: 'Supabase Auth',
        status: 'fail',
        message: 'No active session',
        details: 'You must be logged in to connect to QuickBooks.'
      });
      setRunning(false);
      return;
    }

    addResult({ name: 'VITE env vars', status: 'running', message: 'Checking frontend config...' });
    const viteClientId = import.meta.env.VITE_QB_CLIENT_ID;
    const viteRedirectUri = import.meta.env.VITE_QB_REDIRECT_URI;
    const viteEnv = import.meta.env.VITE_QB_ENVIRONMENT;
    if (viteClientId && viteRedirectUri) {
      addResult({
        name: 'VITE env vars',
        status: 'pass',
        message: 'Frontend QB config present',
        details: `Client ID: ${viteClientId.substring(0, 8)}..., Redirect: ${viteRedirectUri}, Env: ${viteEnv || 'not set'}`
      });
    } else {
      addResult({
        name: 'VITE env vars',
        status: 'warn',
        message: 'Some frontend QB vars missing',
        details: `Client ID: ${viteClientId ? 'set' : 'MISSING'}, Redirect URI: ${viteRedirectUri ? 'set' : 'MISSING'}`
      });
    }

    addResult({ name: 'Server-side Config', status: 'running', message: 'Checking Netlify function environment...' });
    try {
      const diagResponse = await fetch('/.netlify/functions/quickbooks-oauth?action=diagnostics');
      if (diagResponse.ok) {
        const diagData = await diagResponse.json();
        const hasQBError = diagData.quickbooks?.error;
        addResult({
          name: 'Server-side Config',
          status: hasQBError ? 'fail' : 'pass',
          message: hasQBError
            ? `Server QB config error: ${diagData.quickbooks.error}`
            : `Server config OK (storage: ${diagData.storage})`,
          details: JSON.stringify(diagData, null, 2)
        });
      } else {
        let errText = '';
        try { errText = JSON.stringify(await diagResponse.json(), null, 2); } catch { errText = await diagResponse.text(); }
        addResult({
          name: 'Server-side Config',
          status: 'fail',
          message: `Diagnostics endpoint returned HTTP ${diagResponse.status}`,
          details: errText
        });
      }
    } catch (err: any) {
      addResult({
        name: 'Server-side Config',
        status: 'fail',
        message: 'Cannot reach Netlify function at all',
        details: `${err.message}\n\nThis means the function is either not deployed or not reachable. Check Netlify deployment logs.`
      });
    }

    addResult({ name: 'Authorize Endpoint', status: 'running', message: 'Testing authorize flow...' });
    try {
      const response = await fetch('/.netlify/functions/quickbooks-oauth?action=authorize', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        addResult({
          name: 'Authorize Endpoint',
          status: 'pass',
          message: 'Authorize flow works',
          details: `Auth URL generated. Redirect to: ${data.url?.substring(0, 80)}...`
        });
      } else {
        let errorBody = '';
        try {
          const errorData = await response.json();
          errorBody = JSON.stringify(errorData, null, 2);
        } catch {
          errorBody = await response.text();
        }
        addResult({
          name: 'Authorize Endpoint',
          status: 'fail',
          message: `HTTP ${response.status}: ${response.statusText}`,
          details: errorBody
        });
      }
    } catch (err: any) {
      addResult({
        name: 'Authorize Endpoint',
        status: 'fail',
        message: 'Network error calling authorize',
        details: err.message
      });
    }

    addResult({ name: 'Connection Status', status: 'running', message: 'Checking QB connection...' });
    try {
      const connStatus = await quickbooksOAuth.getConnectionStatus();
      if (connStatus.connected) {
        addResult({
          name: 'Connection Status',
          status: connStatus.is_expired ? 'warn' : 'pass',
          message: connStatus.is_expired
            ? `Connected but token expired (realm: ${connStatus.realm_id})`
            : `Active connection (realm: ${connStatus.realm_id})`,
          details: `Expires: ${connStatus.expires_at}\nExpires in: ${connStatus.expires_in_minutes} minutes\nConnected: ${connStatus.connected_at}`
        });
      } else {
        addResult({
          name: 'Connection Status',
          status: 'warn',
          message: 'No active QuickBooks connection',
          details: 'Use the Connection tab to connect your QuickBooks account.'
        });
      }
    } catch (err: any) {
      addResult({
        name: 'Connection Status',
        status: 'fail',
        message: 'Error checking connection status',
        details: err.message
      });
    }

    addResult({ name: 'Redirect URI', status: 'running', message: 'Validating callback path...' });
    const currentOrigin = window.location.origin;
    const expectedRedirect = viteRedirectUri || 'not configured';
    const callbackPathWorks = expectedRedirect.startsWith(currentOrigin);
    addResult({
      name: 'Redirect URI',
      status: callbackPathWorks ? 'pass' : 'fail',
      message: callbackPathWorks
        ? 'Redirect URI matches current origin'
        : 'Redirect URI does NOT match current origin',
      details: `Current origin: ${currentOrigin}\nConfigured redirect: ${expectedRedirect}\n\nThe redirect URI in QuickBooks Developer Portal must exactly match: ${expectedRedirect}`
    });

    setRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />;
      case 'fail': return <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />;
      case 'warn': return <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />;
      case 'running': return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />;
    }
  };

  const getStatusBg = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass': return 'bg-green-50 border-green-200';
      case 'fail': return 'bg-red-50 border-red-200';
      case 'warn': return 'bg-amber-50 border-amber-200';
      case 'running': return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Connection Diagnostics</h3>
          <p className="text-sm text-gray-500">
            Run tests to identify why QuickBooks connection is failing
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={running}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-50"
        >
          {running ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Activity className="h-4 w-4 mr-2" />
          )}
          {running ? 'Running...' : 'Run Diagnostics'}
        </button>
      </div>

      {results.length === 0 && (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          <Activity className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Click "Run Diagnostics" to test the connection pipeline</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((result) => (
            <div
              key={result.name}
              className={`border rounded-lg p-4 ${getStatusBg(result.status)}`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{result.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      result.status === 'pass' ? 'bg-green-100 text-green-700' :
                      result.status === 'fail' ? 'bg-red-100 text-red-700' :
                      result.status === 'warn' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {result.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{result.message}</p>
                  {result.details && (
                    <pre className="mt-2 text-xs text-gray-600 bg-white/60 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                      {result.details}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!running && results.some(r => r.status === 'fail') && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <h4 className="font-medium text-red-800 text-sm">Troubleshooting</h4>
              <ul className="mt-2 text-sm text-red-700 space-y-1 list-disc list-inside">
                {results.find(r => r.name === 'Server-side Config' && r.status === 'fail') && (
                  <>
                    <li>The Netlify function cannot find required QuickBooks env vars on the server</li>
                    <li>Ensure QB_CLIENT_ID, QB_CLIENT_SECRET, and QB_REDIRECT_URI are set in <strong>Netlify Dashboard {'>'} Site settings {'>'} Environment variables</strong></li>
                    <li>Redeploy after adding environment variables</li>
                  </>
                )}
                {results.find(r => r.name === 'Authorize Endpoint' && r.status === 'fail') && (
                  <>
                    <li>The authorize endpoint failed. Check the error details above for the exact error message from the server.</li>
                    <li>Common causes: missing QB credentials or auth token issues.</li>
                  </>
                )}
                {results.find(r => r.name === 'Redirect URI' && r.status === 'fail') && (
                  <li>The redirect URI must match your current site URL. Update it in both QuickBooks Developer Portal and your environment variables.</li>
                )}
                {results.find(r => r.name === 'Supabase Auth' && r.status === 'fail') && (
                  <li>Sign in before attempting to connect QuickBooks.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface QBCustomerRow {
  Id?: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  Active?: boolean;
  // local UI state
  _selected?: boolean;
  _alreadyLinked?: boolean;
  _linkedOrgName?: string;
}

function ImportCustomers({ connected }: { connected: boolean }) {
  const [qbCustomers, setQbCustomers] = useState<QBCustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [importResults, setImportResults] = useState<{ success: string[]; failed: { name: string; error: string }[] } | null>(null);
  const [existingOrgs, setExistingOrgs] = useState<{ id: string; name: string; code: string; quickbooks_customer_id?: string }[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setImportResults(null);
    try {
      // Fetch QB customers and existing orgs in parallel
      const [customers, orgsRes] = await Promise.all([
        quickbooksCustomers.fetchAllCustomers(),
        supabase.from('organizations').select('id, name, code, quickbooks_customer_id'),
      ]);

      const orgs = orgsRes.data || [];
      setExistingOrgs(orgs);

      // Map of QB ID → org for already-linked detection
      const linkedQbIds = new Map(
        orgs.filter(o => o.quickbooks_customer_id).map(o => [o.quickbooks_customer_id!, o])
      );
      // Also check by name match
      const orgNameSet = new Set(orgs.map(o => o.name.toLowerCase()));

      const enriched: QBCustomerRow[] = customers.map(c => {
        const linkedOrg = linkedQbIds.get(c.Id || '');
        const nameMatch = orgNameSet.has((c.CompanyName || c.DisplayName).toLowerCase());
        return {
          ...c,
          _selected: false,
          _alreadyLinked: !!(linkedOrg || nameMatch),
          _linkedOrgName: linkedOrg?.name || (nameMatch ? (c.CompanyName || c.DisplayName) : undefined),
        };
      });

      // Sort: unlinked first, then alphabetical
      enriched.sort((a, b) => {
        if (a._alreadyLinked !== b._alreadyLinked) return a._alreadyLinked ? 1 : -1;
        return a.DisplayName.localeCompare(b.DisplayName);
      });

      setQbCustomers(enriched);
    } catch (error: any) {
      alert(`Failed to fetch QB customers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelect = (idx: number) => {
    setQbCustomers(prev => prev.map((c, i) => i === idx ? { ...c, _selected: !c._selected } : c));
  };

  const selectAllUnlinked = () => {
    setQbCustomers(prev => prev.map(c => c._alreadyLinked ? c : { ...c, _selected: true }));
  };

  const deselectAll = () => {
    setQbCustomers(prev => prev.map(c => ({ ...c, _selected: false })));
  };

  const generateOrgCode = (name: string): string => {
    const words = name.trim().split(/\s+/);
    let code = '';
    if (words.length === 1) {
      code = words[0].substring(0, Math.min(6, words[0].length)).toUpperCase();
    } else {
      code = words
        .slice(0, 3)
        .map(word => word.substring(0, word.length >= 4 ? 3 : 2))
        .join('')
        .toUpperCase();
    }
    if (code.length < 3) {
      code = code.padEnd(3, 'X');
    }
    const existingCodes = new Set(existingOrgs.map(o => o.code.toUpperCase()));
    let finalCode = code;
    let counter = 1;
    while (existingCodes.has(finalCode)) {
      finalCode = code + counter.toString().padStart(2, '0');
      counter++;
    }
    return finalCode;
  };

  const handleImport = async () => {
    const selected = qbCustomers.filter(c => c._selected && !c._alreadyLinked);
    if (selected.length === 0) return;

    if (!confirm(`Import ${selected.length} QuickBooks customer${selected.length > 1 ? 's' : ''} as new organization${selected.length > 1 ? 's' : ''}?`)) return;

    setImporting(true);
    const success: string[] = [];
    const failed: { name: string; error: string }[] = [];
    const usedCodes = new Set(existingOrgs.map(o => o.code.toUpperCase()));

    for (const customer of selected) {
      const name = customer.CompanyName || customer.DisplayName;
      try {
        let code = generateOrgCode(name);
        // Avoid collisions within this batch
        let counter = 1;
        while (usedCodes.has(code.toUpperCase())) {
          code = code.replace(/\d+$/, '') + counter.toString().padStart(2, '0');
          counter++;
        }
        usedCodes.add(code.toUpperCase());

        await quickbooksCustomers.importCustomerAsOrganization(customer as any, code);
        success.push(name);
      } catch (error: any) {
        failed.push({ name, error: error.message });
      }
    }

    setImportResults({ success, failed });

    // Refresh the list to show newly linked customers
    await fetchCustomers();
    setImporting(false);
  };

  const filtered = qbCustomers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.DisplayName.toLowerCase().includes(s) ||
      c.CompanyName?.toLowerCase().includes(s) ||
      c.PrimaryEmailAddr?.Address.toLowerCase().includes(s)
    );
  });

  const selectedCount = qbCustomers.filter(c => c._selected && !c._alreadyLinked).length;
  const unlinkedCount = qbCustomers.filter(c => !c._alreadyLinked).length;

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Import Customers from QuickBooks</h3>
            <p className="mt-1 text-sm text-gray-500">
              Fetch your QuickBooks customers and import them as organizations in this app.
            </p>
          </div>
          <button
            onClick={fetchCustomers}
            disabled={loading || !connected}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Fetching...' : 'Fetch QB Customers'}
          </button>
        </div>

        {!connected && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Connect to QuickBooks first (Connection tab) before importing customers.
          </div>
        )}

        {importResults && (
          <div className={`rounded-lg p-4 text-sm border ${importResults.failed.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 font-medium">
              {importResults.failed.length > 0 ? (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              Import complete: {importResults.success.length} imported{importResults.failed.length > 0 ? `, ${importResults.failed.length} failed` : ''}
            </div>
            {importResults.failed.length > 0 && (
              <ul className="mt-2 ml-6 list-disc text-amber-700">
                {importResults.failed.map((f, i) => (
                  <li key={i}>{f.name}: {f.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {qbCustomers.length > 0 && (
          <>
            {/* Search and bulk actions */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              </div>
              <button onClick={selectAllUnlinked} className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap">
                Select all new ({unlinkedCount})
              </button>
              <button onClick={deselectAll} className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap">
                Deselect all
              </button>
            </div>

            {/* Summary bar */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{qbCustomers.length}</span> QB customers found
                {' · '}
                <span className="text-green-600 font-medium">{qbCustomers.length - unlinkedCount}</span> already linked
                {' · '}
                <span className="text-blue-600 font-medium">{unlinkedCount}</span> available to import
              </div>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {importing ? 'Importing...' : `Import ${selectedCount > 0 ? selectedCount : ''} Selected`}
              </button>
            </div>

            {/* Customer list */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filtered.map((customer, idx) => {
                      const realIdx = qbCustomers.indexOf(customer);
                      return (
                        <tr
                          key={customer.Id || idx}
                          className={`${customer._alreadyLinked ? 'bg-gray-50 opacity-60' : customer._selected ? 'bg-blue-50' : 'hover:bg-gray-50'} cursor-pointer`}
                          onClick={() => !customer._alreadyLinked && toggleSelect(realIdx)}
                        >
                          <td className="px-4 py-3">
                            {customer._alreadyLinked ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={!!customer._selected}
                                onChange={() => toggleSelect(realIdx)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{customer.DisplayName}</div>
                            {customer.CompanyName && customer.CompanyName !== customer.DisplayName && (
                              <div className="text-xs text-gray-500">{customer.CompanyName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {customer.PrimaryEmailAddr?.Address || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {customer.PrimaryPhone?.FreeFormNumber || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {customer.BillAddr ? (
                              <span>{[customer.BillAddr.City, customer.BillAddr.CountrySubDivisionCode].filter(Boolean).join(', ') || '—'}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {customer._alreadyLinked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <Building2 className="h-3 w-3" />
                                Linked
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                          {search ? 'No customers match your search' : 'No customers found'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!loading && qbCustomers.length === 0 && connected && (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <Download className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Click "Fetch QB Customers" to load your QuickBooks customers</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function QuickBooksManagement() {
  const [connectionStatus, setConnectionStatus] = useState<QBConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'connection' | 'diagnostics' | 'import' | 'sync' | 'logs'>('connection');

  useEffect(() => {
    loadConnectionStatus();
    loadSyncLogs();
  }, []);

  const loadConnectionStatus = async () => {
    try {
      const status = await quickbooksOAuth.getConnectionStatus();
      setConnectionStatus(status);
    } catch (error) {
      console.error('Failed to load connection status:', error);
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

  const handleConnect = async () => {
    try {
      const authUrl = await quickbooksOAuth.getAuthorizationUrl();
      window.location.href = authUrl;
    } catch (error: any) {
      alert(`Failed to connect: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    if (!connectionStatus?.connected) return;

    if (!confirm('Are you sure you want to disconnect from QuickBooks? This will stop all syncing.')) {
      return;
    }

    try {
      await quickbooksOAuth.disconnect();
      setConnectionStatus({ connected: false });
    } catch (error: any) {
      alert(`Failed to disconnect: ${error.message}`);
    }
  };

  const handleRefreshTokens = async () => {
    try {
      const updated = await quickbooksOAuth.refreshTokens();
      setConnectionStatus({ connected: true, ...updated });
    } catch (error: any) {
      if (error.message?.startsWith('[RECONNECT_REQUIRED]')) {
        alert('QuickBooks connection has expired and cannot be refreshed. Please disconnect and reconnect to QuickBooks.');
        setConnectionStatus({ connected: false });
      } else {
        alert(`Failed to refresh: ${error.message}`);
      }
    }
  };

  const handleSyncOrganizations = async () => {
    setSyncing(true);
    try {
      const result = await quickbooksCustomers.batchSyncOrganizations();
      alert(`Sync complete!\nSuccess: ${result.success.length}\nFailed: ${result.failed.length}`);
      await loadSyncLogs();
    } catch (error: any) {
      if (error.message?.startsWith('[RECONNECT_REQUIRED]')) {
        alert('QuickBooks connection has expired. Please disconnect and reconnect to QuickBooks.');
        setConnectionStatus({ connected: false });
      } else {
        alert(`Sync failed: ${error.message}`);
      }
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
      if (error.message?.startsWith('[RECONNECT_REQUIRED]')) {
        alert('QuickBooks connection has expired. Please disconnect and reconnect to QuickBooks.');
        setConnectionStatus({ connected: false });
      } else {
        alert(`Sync failed: ${error.message}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      case 'retry': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'retry': return <RefreshCw className="h-5 w-5 text-blue-600" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-600" />;
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
    <div className="p-6 space-y-6">
      <div className="flex items-center space-x-3">
        <BookOpen className="h-8 w-8 text-gray-700" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">QuickBooks Online Integration</h2>
          <p className="text-sm text-gray-500">
            Manage QuickBooks connection, sync customers and invoices
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['connection', 'diagnostics', 'import', 'sync', 'logs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'diagnostics' ? (
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  Diagnostics
                </span>
              ) : tab === 'import' ? (
                <span className="flex items-center gap-1.5">
                  <Upload className="h-4 w-4" />
                  Import Customers
                </span>
              ) : (
                tab.charAt(0).toUpperCase() + tab.slice(1).replace(/([A-Z])/g, ' $1')
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'connection' && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900">QuickBooks Connection Status</h3>
            <div className="mt-4">
              {connectionStatus?.connected ? (
                <div className="space-y-4">
                  {(connectionStatus.refresh_token_expiring_soon || connectionStatus.refresh_token_is_expired) && (
                    <div className={`rounded-md p-4 ${connectionStatus.refresh_token_is_expired ? 'bg-red-50' : 'bg-yellow-50'}`}>
                      <div className="flex">
                        <AlertCircle className={`h-5 w-5 ${connectionStatus.refresh_token_is_expired ? 'text-red-400' : 'text-yellow-400'}`} />
                        <div className="ml-3">
                          <p className={`text-sm font-medium ${connectionStatus.refresh_token_is_expired ? 'text-red-800' : 'text-yellow-800'}`}>
                            {connectionStatus.refresh_token_is_expired
                              ? 'QuickBooks refresh token has expired. Please disconnect and reconnect to restore the integration.'
                              : `QuickBooks refresh token expires in ${connectionStatus.refresh_token_expires_in_days} days. Please disconnect and reconnect soon to avoid service interruption.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Connected</p>
                        <p className="text-sm text-gray-500">Realm ID: {connectionStatus.realm_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRefreshTokens}
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        Refresh Token
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Connected At</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {connectionStatus.connected_at
                            ? new Date(connectionStatus.connected_at).toLocaleString()
                            : 'Unknown'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Last Token Refresh</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {connectionStatus.updated_at
                            ? new Date(connectionStatus.updated_at).toLocaleString()
                            : 'Never'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Token Expires</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {connectionStatus.expires_at
                            ? new Date(connectionStatus.expires_at).toLocaleString()
                            : 'Unknown'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                        <dd className="mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            connectionStatus.is_expired
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {connectionStatus.is_expired ? 'Expired' : 'Active'}
                          </span>
                          {connectionStatus.expires_in_minutes != null && !connectionStatus.is_expired && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({connectionStatus.expires_in_minutes}m remaining)
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Refresh Token Expires</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {connectionStatus.refresh_token_expires_at
                            ? new Date(connectionStatus.refresh_token_expires_at).toLocaleDateString()
                            : 'Unknown'}
                          {connectionStatus.refresh_token_is_expired && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Expired
                            </span>
                          )}
                          {connectionStatus.refresh_token_expiring_soon && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {connectionStatus.refresh_token_expires_in_days}d remaining
                            </span>
                          )}
                          {!connectionStatus.refresh_token_is_expired && !connectionStatus.refresh_token_expiring_soon && connectionStatus.refresh_token_expires_in_days != null && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({connectionStatus.refresh_token_expires_in_days}d remaining)
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs text-gray-500">
                      Credentials are stored securely on the server. Tokens never pass through the browser.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Not Connected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Connect your QuickBooks Online account to enable invoicing and payment processing.
                  </p>
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={handleConnect}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <ExternalLink className="h-5 w-5 mr-2" />
                      Connect to QuickBooks
                    </button>
                    <p className="text-xs text-gray-400">
                      If connection fails, use the Diagnostics tab to troubleshoot
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && <ConnectionDiagnostics />}

      {activeTab === 'import' && (
        <ImportCustomers connected={!!connectionStatus?.connected} />
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
                  disabled={syncing || !connectionStatus?.connected}
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
                  disabled={syncing || !connectionStatus?.connected}
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

export default QuickBooksManagement;
