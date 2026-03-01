import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { quickbooksOAuth } from '../services/quickbooks';

export function QuickBooksCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing QuickBooks authorization...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const realmId = params.get('realmId');
      const error = params.get('error');

      if (error) {
        throw new Error(`QuickBooks authorization failed: ${error}`);
      }

      if (!code || !realmId) {
        throw new Error('Missing authorization code or realm ID');
      }

      const savedState = sessionStorage.getItem('qb_oauth_state');
      if (state !== savedState) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      sessionStorage.removeItem('qb_oauth_state');

      await quickbooksOAuth.exchangeCodeForTokens(code, realmId);

      setStatus('success');
      setMessage('Successfully connected to QuickBooks!');

      setTimeout(() => {
        window.location.href = '/admin?tab=quickbooks';
      }, 2000);
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to connect to QuickBooks');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          {status === 'processing' && (
            <div className="space-y-4">
              <RefreshCw className="h-16 w-16 text-blue-600 mx-auto animate-spin" />
              <h2 className="text-2xl font-bold text-gray-900">Connecting to QuickBooks</h2>
              <p className="text-gray-600">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
              <h2 className="text-2xl font-bold text-gray-900">Connection Successful!</h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500">Redirecting to admin panel...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <XCircle className="h-16 w-16 text-red-600 mx-auto" />
              <h2 className="text-2xl font-bold text-gray-900">Connection Failed</h2>
              <p className="text-gray-600">{message}</p>
              <button
                onClick={() => window.location.href = '/admin?tab=quickbooks'}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Return to Admin Panel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuickBooksCallback;
