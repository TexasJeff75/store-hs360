import React, { useEffect, useState } from 'react';
import { Lock, CreditCard, AlertCircle, Save, Building2, Loader, CheckCircle, ShieldCheck } from 'lucide-react';
import { getPaymentMethods } from '@/services/paymentMethods';

export type PaymentMethodType = 'card' | 'ach' | 'saved';

export interface TokenizedCardPayment {
  type: 'card';
  token: string;
  lastFour: string;
  cardholderName: string;
  expiryMonth: string;
  expiryYear: string;
  cardBrand: string;
  savePaymentMethod: boolean;
  paymentMethodLabel?: string;
}

export interface TokenizedACHPayment {
  type: 'ach';
  token: string;
  lastFour: string;
  accountHolderName: string;
  accountType: 'PERSONAL_CHECKING' | 'PERSONAL_SAVINGS' | 'BUSINESS_CHECKING' | 'BUSINESS_SAVINGS';
  phone: string;
  savePaymentMethod: boolean;
  paymentMethodLabel?: string;
}

export interface SavedPaymentData {
  type: 'saved';
  paymentMethodId: string;
  paymentType: string;
  lastFour: string;
}

export type PaymentData = TokenizedCardPayment | TokenizedACHPayment | SavedPaymentData;

interface PaymentFormProps {
  onPaymentReady: (isReady: boolean) => void;
  onPaymentSubmit: (paymentData: PaymentData) => void;
  billingAddress: any;
  total: number;
  organizationId?: string;
  locationId?: string;
}

interface SavedMethod {
  id: string;
  label: string;
  payment_type: string;
  last_four: string;
  expiry_month?: number;
  expiry_year?: number;
  account_holder_name: string;
  bank_name?: string;
  is_default: boolean;
}

const MAX_DECLINE_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

const PaymentForm: React.FC<PaymentFormProps> = ({
  onPaymentReady,
  onPaymentSubmit,
  billingAddress,
  total,
  organizationId,
  locationId,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('card');
  const [error, setError] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<SavedMethod[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [paymentMethodLabel, setPaymentMethodLabel] = useState('');
  const [isTokenizing, setIsTokenizing] = useState(false);
  const [declineCount, setDeclineCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const [cardData, setCardData] = useState({
    cardholderName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
  });

  const [achData, setAchData] = useState({
    accountHolderName: '',
    routingNumber: '',
    accountNumber: '',
    accountNumberConfirm: '',
    accountType: 'BUSINESS_CHECKING' as const,
    phone: '',
  });

  useEffect(() => {
    onPaymentReady(true);
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadSavedMethods();
    }
  }, [organizationId, locationId]);

  useEffect(() => {
    if (lockedUntil && Date.now() < lockedUntil) {
      const timer = setTimeout(() => {
        setLockedUntil(null);
        setDeclineCount(0);
      }, lockedUntil - Date.now());
      return () => clearTimeout(timer);
    }
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const loadSavedMethods = async () => {
    if (!organizationId) return;
    setLoadingSaved(true);
    try {
      const { data } = await getPaymentMethods(organizationId, locationId);
      if (data && data.length > 0) {
        setSavedMethods(data as SavedMethod[]);
      }
    } catch {
    } finally {
      setLoadingSaved(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const chunks = value.match(/.{1,4}/g) || [];
    return chunks.join(' ').substring(0, 19);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setCardData({ ...cardData, cardNumber: value.substring(0, 16) });
  };

  const getCardBrand = (number: string): string => {
    if (number.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'Mastercard';
    if (number.startsWith('34') || number.startsWith('37')) return 'Amex';
    if (number.startsWith('6011') || number.startsWith('65')) return 'Discover';
    return '';
  };

  const validateCard = (): boolean => {
    if (!cardData.cardholderName.trim()) {
      setError('Cardholder name is required');
      return false;
    }
    const stripped = cardData.cardNumber.replace(/\s/g, '');
    if (stripped.length < 15 || stripped.length > 16) {
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

  const validateACH = (): boolean => {
    if (!achData.accountHolderName.trim()) {
      setError('Account holder name is required');
      return false;
    }
    if (!/^\d{9}$/.test(achData.routingNumber)) {
      setError('Routing number must be 9 digits');
      return false;
    }
    if (achData.accountNumber.length < 4 || achData.accountNumber.length > 17) {
      setError('Invalid account number');
      return false;
    }
    if (achData.accountNumber !== achData.accountNumberConfirm) {
      setError('Account numbers do not match');
      return false;
    }
    if (!achData.phone.replace(/\D/g, '').match(/^\d{10,}$/)) {
      setError('Valid phone number is required for ACH');
      return false;
    }
    if (savePaymentMethod && !paymentMethodLabel.trim()) {
      setError('Please provide a label for this payment method');
      return false;
    }
    setError(null);
    return true;
  };

  const tokenizeCardData = async (): Promise<{ token: string; lastFour: string } | null> => {
    try {
      const { quickbooksPayments } = await import('@/services/quickbooks');
      const stripped = cardData.cardNumber.replace(/\s/g, '');
      const tokenResponse = await quickbooksPayments.tokenizeCard({
        card: {
          number: stripped,
          expMonth: cardData.expiryMonth.padStart(2, '0'),
          expYear: '20' + cardData.expiryYear,
          cvc: cardData.cvv,
          name: cardData.cardholderName,
        },
      });
      return { token: tokenResponse.value, lastFour: stripped.slice(-4) };
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('decline')) {
        handleDecline();
        return null;
      }
      setError('Failed to process card. Please check your details and try again.');
      return null;
    }
  };

  const tokenizeACHData = async (): Promise<{ token: string; lastFour: string } | null> => {
    try {
      const { quickbooksPayments } = await import('@/services/quickbooks');
      const tokenResponse = await quickbooksPayments.tokenizeBankAccount({
        bankAccount: {
          name: achData.accountHolderName,
          routingNumber: achData.routingNumber,
          accountNumber: achData.accountNumber,
          accountType: achData.accountType,
          phone: achData.phone.replace(/\D/g, ''),
        },
      });
      return { token: tokenResponse.value, lastFour: achData.accountNumber.slice(-4) };
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('decline')) {
        handleDecline();
        return null;
      }
      setError('Failed to process bank account. Please check your details and try again.');
      return null;
    }
  };

  const handleDecline = () => {
    const newCount = declineCount + 1;
    setDeclineCount(newCount);
    if (newCount >= MAX_DECLINE_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_DURATION_MS);
      setError('Too many unsuccessful attempts. Please try again in 30 minutes.');
    } else {
      setError('Your payment was declined. Please verify your information and try again.');
    }
  };

  const clearSensitiveData = () => {
    setCardData({
      cardholderName: cardData.cardholderName,
      cardNumber: '',
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      cvv: '',
    });
    setAchData({
      ...achData,
      routingNumber: '',
      accountNumber: '',
      accountNumberConfirm: '',
    });
  };

  const handleSubmit = async () => {
    if (isLocked) {
      setError('Too many unsuccessful attempts. Please try again later.');
      return;
    }

    if (selectedMethod === 'saved') {
      const saved = savedMethods.find((m) => m.id === selectedSavedId);
      if (!saved) {
        setError('Please select a saved payment method');
        return;
      }
      onPaymentSubmit({
        type: 'saved',
        paymentMethodId: saved.id,
        paymentType: saved.payment_type,
        lastFour: saved.last_four,
      });
      return;
    }

    if (selectedMethod === 'card') {
      if (!validateCard()) return;
      setIsTokenizing(true);
      setError(null);
      try {
        const result = await tokenizeCardData();
        if (!result) {
          return;
        }
        const brand = getCardBrand(cardData.cardNumber);
        clearSensitiveData();
        onPaymentSubmit({
          type: 'card',
          token: result.token,
          lastFour: result.lastFour,
          cardholderName: cardData.cardholderName,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          cardBrand: brand,
          savePaymentMethod,
          paymentMethodLabel: savePaymentMethod ? paymentMethodLabel : undefined,
        });
      } finally {
        setIsTokenizing(false);
      }
      return;
    }

    if (selectedMethod === 'ach') {
      if (!validateACH()) return;
      setIsTokenizing(true);
      setError(null);
      try {
        const result = await tokenizeACHData();
        if (!result) {
          return;
        }
        clearSensitiveData();
        onPaymentSubmit({
          type: 'ach',
          token: result.token,
          lastFour: result.lastFour,
          accountHolderName: achData.accountHolderName,
          accountType: achData.accountType,
          phone: achData.phone.replace(/\D/g, ''),
          savePaymentMethod,
          paymentMethodLabel: savePaymentMethod ? paymentMethodLabel : undefined,
        });
      } finally {
        setIsTokenizing(false);
      }
    }
  };

  const cardBrand = getCardBrand(cardData.cardNumber);

  const inputCls =
    'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="space-y-6">
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => { setSelectedMethod('card'); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            selectedMethod === 'card'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Credit / Debit
        </button>
        <button
          type="button"
          onClick={() => { setSelectedMethod('ach'); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-l border-gray-200 transition-colors ${
            selectedMethod === 'ach'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Bank Account (ACH)
        </button>
        {savedMethods.length > 0 && (
          <button
            type="button"
            onClick={() => { setSelectedMethod('saved'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-l border-gray-200 transition-colors ${
              selectedMethod === 'saved'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Save className="h-4 w-4" />
            Saved ({savedMethods.length})
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-600 font-medium">Secure Payment</span>
        </div>

        {selectedMethod === 'card' && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Cardholder Name</label>
              <input
                type="text"
                value={cardData.cardholderName}
                onChange={(e) => setCardData({ ...cardData, cardholderName: e.target.value })}
                placeholder="Name on card"
                autoComplete="cc-name"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Card Number</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCardNumber(cardData.cardNumber)}
                  onChange={handleCardNumberChange}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  autoComplete="cc-number"
                  className={`${inputCls} font-mono pr-20`}
                />
                {cardBrand && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {cardBrand}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Month</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardData.expiryMonth}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    setCardData({ ...cardData, expiryMonth: v.substring(0, 2) });
                  }}
                  placeholder="MM"
                  maxLength={2}
                  autoComplete="cc-exp-month"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>Year</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardData.expiryYear}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    setCardData({ ...cardData, expiryYear: v.substring(0, 2) });
                  }}
                  placeholder="YY"
                  maxLength={2}
                  autoComplete="cc-exp-year"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className={labelCls}>CVV</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={cardData.cvv}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    setCardData({ ...cardData, cvv: v.substring(0, 4) });
                  }}
                  placeholder="***"
                  maxLength={4}
                  autoComplete="cc-csc"
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
          </div>
        )}

        {selectedMethod === 'ach' && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Account Holder Name</label>
              <input
                type="text"
                value={achData.accountHolderName}
                onChange={(e) => setAchData({ ...achData, accountHolderName: e.target.value })}
                placeholder="Name on account"
                autoComplete="name"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Account Type</label>
              <select
                value={achData.accountType}
                onChange={(e) => setAchData({ ...achData, accountType: e.target.value as any })}
                autoComplete="off"
                className={inputCls}
              >
                <option value="BUSINESS_CHECKING">Business Checking</option>
                <option value="BUSINESS_SAVINGS">Business Savings</option>
                <option value="PERSONAL_CHECKING">Personal Checking</option>
                <option value="PERSONAL_SAVINGS">Personal Savings</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Routing Number</label>
              <input
                type="password"
                inputMode="numeric"
                value={achData.routingNumber}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  setAchData({ ...achData, routingNumber: v.substring(0, 9) });
                }}
                placeholder="9 digits"
                maxLength={9}
                autoComplete="off"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <label className={labelCls}>Account Number</label>
              <input
                type="password"
                inputMode="numeric"
                value={achData.accountNumber}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  setAchData({ ...achData, accountNumber: v.substring(0, 17) });
                }}
                placeholder="Account number"
                maxLength={17}
                autoComplete="off"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <label className={labelCls}>Confirm Account Number</label>
              <input
                type="password"
                inputMode="numeric"
                value={achData.accountNumberConfirm}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  setAchData({ ...achData, accountNumberConfirm: v.substring(0, 17) });
                }}
                placeholder="Re-enter account number"
                maxLength={17}
                autoComplete="off"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <label className={labelCls}>Phone Number</label>
              <input
                type="tel"
                value={achData.phone}
                onChange={(e) => setAchData({ ...achData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                autoComplete="tel"
                className={inputCls}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                ACH payments typically take 3-5 business days to settle. By providing your bank
                account details, you authorize us to debit the specified amount.
              </p>
            </div>
          </div>
        )}

        {selectedMethod === 'saved' && (
          <div className="space-y-3">
            {loadingSaved ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : savedMethods.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No saved payment methods found.
              </p>
            ) : (
              savedMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSavedId === method.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="saved_method"
                    checked={selectedSavedId === method.id}
                    onChange={() => setSelectedSavedId(method.id)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {method.payment_type === 'ach' || method.payment_type === 'bank_account' ? (
                      <Building2 className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {method.label}
                        {method.is_default && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {method.payment_type === 'ach' || method.payment_type === 'bank_account'
                          ? `${method.bank_name || 'Bank'} ****${method.last_four}`
                          : `****${method.last_four}`}
                        {method.expiry_month && method.expiry_year && (
                          <span className="ml-2">
                            Exp {String(method.expiry_month).padStart(2, '0')}/{method.expiry_year}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {selectedSavedId === method.id && (
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  )}
                </label>
              ))
            )}
          </div>
        )}

        {selectedMethod !== 'saved' && (organizationId || locationId) && (
          <div className="border-t mt-5 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={savePaymentMethod}
                onChange={(e) => setSavePaymentMethod(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4 text-gray-500" />
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
                placeholder="e.g., Corporate Card, Primary Checking"
                autoComplete="off"
                className="mt-2 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          <span>SSL Encrypted</span>
        </div>
        <div className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          <span>Secured by Intuit</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isTokenizing || isLocked}
        className="w-full py-3.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isTokenizing ? (
          <>
            <Loader className="h-4 w-4 animate-spin" />
            Securing Payment...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Continue to Review - ${total.toFixed(2)}
          </>
        )}
      </button>
    </div>
  );
};

export default PaymentForm;
