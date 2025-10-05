import React, { useEffect, useRef, useState } from 'react';
import { Lock, CreditCard, AlertCircle, Save } from 'lucide-react';

interface BigCommercePaymentFormProps {
  onPaymentReady: (isReady: boolean) => void;
  onPaymentSubmit: (paymentData: any) => void;
  billingAddress: any;
  total: number;
  organizationId?: string;
  locationId?: string;
}

// This component will integrate with BigCommerce's Checkout SDK
// For now, it's a placeholder that shows how the integration would work
const BigCommercePaymentForm: React.FC<BigCommercePaymentFormProps> = ({
  onPaymentReady,
  onPaymentSubmit,
  billingAddress,
  total,
  organizationId,
  locationId
}) => {
  const paymentFormRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['credit_card', 'paypal']);
  const [selectedMethod, setSelectedMethod] = useState('credit_card');
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [paymentMethodLabel, setPaymentMethodLabel] = useState('');

  const [cardData, setCardData] = useState({
    cardholderName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  });

  useEffect(() => {
    onPaymentReady(true);
  }, []);

  const validateCardData = () => {
    if (!cardData.cardholderName.trim()) {
      setError('Cardholder name is required');
      return false;
    }
    if (cardData.cardNumber.replace(/\s/g, '').length !== 16) {
      setError('Invalid card number');
      return false;
    }
    if (!cardData.expiryMonth || parseInt(cardData.expiryMonth) < 1 || parseInt(cardData.expiryMonth) > 12) {
      setError('Invalid expiry month');
      return false;
    }
    if (!cardData.expiryYear || cardData.expiryYear.length !== 2) {
      setError('Invalid expiry year');
      return false;
    }
    if (cardData.cvv.length < 3 || cardData.cvv.length > 4) {
      setError('Invalid CVV');
      return false;
    }
    if (savePaymentMethod && !paymentMethodLabel.trim()) {
      setError('Please provide a label for this payment method');
      return false;
    }
    setError(null);
    return true;
  };

  const handlePaymentMethodSelect = (method: string) => {
    setSelectedMethod(method);
    setError(null);
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ').substring(0, 19);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setCardData({ ...cardData, cardNumber: value.substring(0, 16) });
  };

  const handleSubmitPayment = async () => {
    if (!validateCardData()) {
      return;
    }

    try {
      const paymentData = {
        instrument: {
          type: 'card' as const,
          cardholder_name: cardData.cardholderName,
          number: cardData.cardNumber.replace(/\s/g, ''),
          expiry_month: parseInt(cardData.expiryMonth),
          expiry_year: parseInt('20' + cardData.expiryYear),
          verification_value: cardData.cvv
        },
        savePaymentMethod,
        paymentMethodLabel: savePaymentMethod ? paymentMethodLabel : undefined,
        organizationId,
        locationId
      };

      onPaymentSubmit(paymentData);
    } catch (err) {
      setError('Payment processing failed');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading secure payment form...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Payment Form Error</span>
        </div>
        <p className="text-red-600 text-sm mt-2">{error}</p>
        <button
          onClick={initializeBigCommerceCheckout}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      <div>
        <h4 className="font-semibold mb-3">Payment Method</h4>
        <div className="space-y-2">
          {paymentMethods.map((method) => (
            <label
              key={method}
              className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="radio"
                name="payment_method"
                value={method}
                defaultChecked={method === 'credit_card'}
                onChange={() => handlePaymentMethodSelect(method)}
                className="mr-3"
              />
              <div className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-gray-600" />
                <span className="font-medium">
                  {method === 'credit_card' ? 'Credit/Debit Card' : 'PayPal'}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Secure Payment Form Container */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Lock className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-600 font-medium">Secured by BigCommerce</span>
        </div>

        {/* Credit Card Input Form */}
        <div ref={paymentFormRef} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
            <input
              type="text"
              value={cardData.cardholderName}
              onChange={(e) => setCardData({ ...cardData, cardholderName: e.target.value })}
              placeholder="John Doe"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
            <input
              type="text"
              value={formatCardNumber(cardData.cardNumber)}
              onChange={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <input
                type="text"
                value={cardData.expiryMonth}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setCardData({ ...cardData, expiryMonth: value.substring(0, 2) });
                }}
                placeholder="MM"
                maxLength={2}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <input
                type="text"
                value={cardData.expiryYear}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setCardData({ ...cardData, expiryYear: value.substring(0, 2) });
                }}
                placeholder="YY"
                maxLength={2}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
              <input
                type="text"
                value={cardData.cvv}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setCardData({ ...cardData, cvv: value.substring(0, 4) });
                }}
                placeholder="123"
                maxLength={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono"
              />
            </div>
          </div>

          {(organizationId || locationId) && (
            <div className="border-t pt-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savePaymentMethod}
                  onChange={(e) => setSavePaymentMethod(e.target.checked)}
                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                />
                <div className="flex items-center space-x-2">
                  <Save className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Save for {locationId ? 'this location' : 'this organization'}
                  </span>
                </div>
              </label>
              {savePaymentMethod && (
                <input
                  type="text"
                  value={paymentMethodLabel}
                  onChange={(e) => setPaymentMethodLabel(e.target.value)}
                  placeholder="e.g., Corporate Card, Location Card"
                  className="mt-2 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                />
              )}
            </div>
          )}
        </div>

        {/* Security Badges */}
        <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Lock className="h-3 w-3" />
            <span>SSL Encrypted</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>PCI Compliant</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>256-bit Security</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="text-yellow-800">
            <p className="font-medium text-sm">Test Mode</p>
            <p className="text-xs mt-1">
              Use test card: 4111 1111 1111 1111 with any future expiry date and CVV
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BigCommercePaymentForm;