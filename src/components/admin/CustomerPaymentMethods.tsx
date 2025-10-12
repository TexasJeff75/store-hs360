import React, { useState, useEffect } from 'react';
import { CreditCard, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PaymentMethod {
  id: string;
  payment_type: 'credit_card' | 'debit_card' | 'bank_account' | 'ach';
  account_holder_name: string;
  last_four: string;
  expiry_month?: number;
  expiry_year?: number;
  bank_name?: string;
  account_type?: 'checking' | 'savings';
  is_default: boolean;
  payment_processor: string;
  created_at: string;
}

interface CustomerPaymentMethodsProps {
  organizationId?: string;
}

const CustomerPaymentMethods: React.FC<CustomerPaymentMethodsProps> = ({ organizationId }) => {
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentMethods();
  }, [user, organizationId]);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('payment_methods')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchPaymentMethods();
    } catch (error) {
      console.error('Error deleting payment method:', error);
      alert('Failed to delete payment method. Please try again.');
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;

    try {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id);

      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      fetchPaymentMethods();
    } catch (error) {
      console.error('Error setting default payment method:', error);
      alert('Failed to set default payment method. Please try again.');
    }
  };

  const getPaymentIcon = (type: string) => {
    return <CreditCard className="h-5 w-5" />;
  };

  const formatPaymentType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const isExpired = (month?: number, year?: number) => {
    if (!month || !year) return false;
    const now = new Date();
    const expiry = new Date(year, month - 1);
    return expiry < now;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Methods</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Payment methods are managed during checkout</p>
            <p>
              You can add new payment methods when placing an order. Your payment information is securely stored and tokenized by our payment processor.
            </p>
          </div>
        </div>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No payment methods yet</h3>
          <p className="text-gray-600">
            Payment methods will be saved when you complete your first order
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.map((method) => {
            const expired = isExpired(method.expiry_month, method.expiry_year);

            return (
              <div
                key={method.id}
                className={`bg-white rounded-lg border-2 p-4 ${
                  method.is_default ? 'border-pink-500' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {getPaymentIcon(method.payment_type)}
                    <span className="font-semibold text-gray-900">
                      {formatPaymentType(method.payment_type)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(method.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete payment method"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Account Holder</p>
                    <p className="font-medium text-gray-900">{method.account_holder_name}</p>
                  </div>

                  {method.payment_type === 'credit_card' || method.payment_type === 'debit_card' ? (
                    <>
                      <div>
                        <p className="text-gray-600">Card Number</p>
                        <p className="font-medium text-gray-900">**** **** **** {method.last_four}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Expires</p>
                        <p className={`font-medium ${expired ? 'text-red-600' : 'text-gray-900'}`}>
                          {method.expiry_month?.toString().padStart(2, '0')}/{method.expiry_year}
                          {expired && <span className="ml-2 text-xs">(Expired)</span>}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {method.bank_name && (
                        <div>
                          <p className="text-gray-600">Bank</p>
                          <p className="font-medium text-gray-900">{method.bank_name}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-600">Account</p>
                        <p className="font-medium text-gray-900">
                          {method.account_type?.charAt(0).toUpperCase() + method.account_type?.slice(1)} ****{method.last_four}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Added {new Date(method.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {method.is_default ? (
                  <div className="mt-3 px-3 py-1 bg-pink-100 text-pink-800 rounded text-xs font-medium text-center">
                    Default Payment Method
                  </div>
                ) : (
                  <button
                    onClick={() => handleSetDefault(method.id)}
                    className="mt-3 w-full px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-xs font-medium"
                    disabled={expired}
                  >
                    Set as Default
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-gray-600" />
          <span>Security & PCI Compliance</span>
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start space-x-2">
            <span className="text-green-600 mt-0.5">✓</span>
            <span>All payment information is encrypted and securely tokenized</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-green-600 mt-0.5">✓</span>
            <span>We never store your full card number or CVV code</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-green-600 mt-0.5">✓</span>
            <span>Your data is protected according to PCI DSS standards</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-green-600 mt-0.5">✓</span>
            <span>Payment processing is handled by certified payment providers</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CustomerPaymentMethods;
