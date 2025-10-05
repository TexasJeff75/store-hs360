import React, { useState, useEffect, useRef } from 'react';
import { X, CreditCard, Truck, MapPin, User, Lock, ArrowLeft, ArrowRight, Loader, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PriceDisplay from '../PriceDisplay';
import { bulletproofCheckoutService, CheckoutSession } from '@/services/bulletproofCheckout';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onOrderComplete: (orderId: string) => void;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface BillingAddress extends ShippingAddress {
  email: string;
}

type CheckoutStep = 'shipping' | 'billing' | 'payment' | 'review' | 'embedded-checkout';

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onOrderComplete
}) => {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('embedded-checkout');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Form data
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: ''
  });
  
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: '',
    email: user?.email || ''
  });
  
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('standard');

  // Mock shipping methods - in real implementation, fetch from BigCommerce
  const shippingMethods = [
    { id: 'standard', name: 'Standard Shipping', price: 9.99, days: '5-7 business days' },
    { id: 'express', name: 'Express Shipping', price: 19.99, days: '2-3 business days' },
    { id: 'overnight', name: 'Overnight Shipping', price: 39.99, days: '1 business day' }
  ];

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = shippingMethods.find(m => m.id === selectedShippingMethod)?.price || 0;
  const tax = subtotal * 0.08;
  const total = subtotal + shippingCost + tax;

  useEffect(() => {
    if (isOpen && items.length > 0 && !sessionId) {
      initializeCheckout();
    }
  }, [isOpen, items]);

  useEffect(() => {
    if (sessionId) {
      const interval = setInterval(async () => {
        const updatedSession = await bulletproofCheckoutService.getSession(sessionId);
        if (updatedSession) {
          setSession(updatedSession);
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sameAsShipping) {
      setBillingAddress({
        ...shippingAddress,
        email: user?.email || billingAddress.email
      });
    }
  }, [sameAsShipping, shippingAddress, user?.email]);

  const initializeCheckout = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setCanRetry(false);

    try {
      const cartItems = items.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image
      }));

      const sessionResult = await bulletproofCheckoutService.createSession(
        user.id,
        cartItems
      );

      if (!sessionResult.success || !sessionResult.sessionId) {
        setError(sessionResult.error || 'Failed to create checkout session');
        setCanRetry(sessionResult.canRetry || false);
        return;
      }

      setSessionId(sessionResult.sessionId);

      const lineItems = items.map(item => ({
        productId: item.id,
        quantity: item.quantity
      }));

      console.log('[CheckoutModal] Processing embedded checkout...');
      const checkoutResult = await bulletproofCheckoutService.processEmbeddedCheckout(
        sessionResult.sessionId,
        lineItems
      );

      console.log('[CheckoutModal] Checkout result:', checkoutResult);

      if (checkoutResult.success && checkoutResult.checkoutUrl) {
        setCheckoutUrl(checkoutResult.checkoutUrl);
        setCurrentStep('embedded-checkout');
      } else {
        console.error('[CheckoutModal] Checkout failed:', checkoutResult.error);
        setError(checkoutResult.error || 'Failed to initialize checkout');
        setCanRetry(checkoutResult.canRetry || false);
      }
    } catch (err) {
      setError('Failed to initialize checkout. Please try again.');
      setCanRetry(true);
      console.error('Checkout initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!sessionId) {
      initializeCheckout();
      return;
    }

    setRetrying(true);
    setError(null);

    try {
      const result = await bulletproofCheckoutService.recoverSession(sessionId);

      if (result.success && result.checkoutUrl) {
        setCheckoutUrl(result.checkoutUrl);
        setCurrentStep('embedded-checkout');
        setError(null);
      } else {
        setError(result.error || 'Failed to recover checkout session');
        setCanRetry(result.canRetry || false);
      }
    } catch (err) {
      setError('Failed to retry checkout. Please try again.');
      setCanRetry(true);
      console.error('Checkout retry error:', err);
    } finally {
      setRetrying(false);
    }
  };

  const validateStep = (step: CheckoutStep): boolean => {
    switch (step) {
      case 'shipping':
        return !!(shippingAddress.firstName && shippingAddress.lastName && 
                 shippingAddress.address1 && shippingAddress.city && 
                 shippingAddress.state && shippingAddress.postalCode);
      case 'billing':
        return !!(billingAddress.firstName && billingAddress.lastName && 
                 billingAddress.address1 && billingAddress.city && 
                 billingAddress.state && billingAddress.postalCode && billingAddress.email);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      setError('Please fill in all required fields');
      return;
    }
    
    setError(null);
    const steps: CheckoutStep[] = ['shipping', 'billing', 'payment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: CheckoutStep[] = ['shipping', 'billing', 'payment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Here you would integrate with BigCommerce's payment processing
      // For now, we'll simulate the order placement
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock order ID
      const orderId = `ORD-${Date.now()}`;
      onOrderComplete(orderId);
      onClose();
    } catch (err) {
      setError('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderShippingStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <Truck className="h-5 w-5 text-pink-600" />
        <h3 className="text-lg font-semibold">Shipping Address</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input
            type="text"
            value={shippingAddress.firstName}
            onChange={(e) => setShippingAddress({...shippingAddress, firstName: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input
            type="text"
            value={shippingAddress.lastName}
            onChange={(e) => setShippingAddress({...shippingAddress, lastName: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <input
          type="text"
          value={shippingAddress.company}
          onChange={(e) => setShippingAddress({...shippingAddress, company: e.target.value})}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
        <input
          type="text"
          value={shippingAddress.address1}
          onChange={(e) => setShippingAddress({...shippingAddress, address1: e.target.value})}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          placeholder="Street address"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
        <input
          type="text"
          value={shippingAddress.address2}
          onChange={(e) => setShippingAddress({...shippingAddress, address2: e.target.value})}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          placeholder="Apartment, suite, etc."
        />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
          <input
            type="text"
            value={shippingAddress.city}
            onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
          <input
            type="text"
            value={shippingAddress.state}
            onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
          <input
            type="text"
            value={shippingAddress.postalCode}
            onChange={(e) => setShippingAddress({...shippingAddress, postalCode: e.target.value})}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={shippingAddress.phone}
          onChange={(e) => setShippingAddress({...shippingAddress, phone: e.target.value})}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        />
      </div>

      {/* Shipping Methods */}
      <div className="mt-8">
        <h4 className="text-lg font-semibold mb-4">Shipping Method</h4>
        <div className="space-y-3">
          {shippingMethods.map((method) => (
            <label key={method.id} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="shipping"
                value={method.id}
                checked={selectedShippingMethod === method.id}
                onChange={(e) => setSelectedShippingMethod(e.target.value)}
                className="mr-3"
              />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{method.name}</span>
                  <span className="font-semibold">${method.price.toFixed(2)}</span>
                </div>
                <span className="text-sm text-gray-600">{method.days}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBillingStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <MapPin className="h-5 w-5 text-pink-600" />
        <h3 className="text-lg font-semibold">Billing Address</h3>
      </div>
      
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={sameAsShipping}
            onChange={(e) => setSameAsShipping(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm">Same as shipping address</span>
        </label>
      </div>

      {!sameAsShipping && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                value={billingAddress.firstName}
                onChange={(e) => setBillingAddress({...billingAddress, firstName: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={billingAddress.lastName}
                onChange={(e) => setBillingAddress({...billingAddress, lastName: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
            <input
              type="text"
              value={billingAddress.address1}
              onChange={(e) => setBillingAddress({...billingAddress, address1: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                value={billingAddress.city}
                onChange={(e) => setBillingAddress({...billingAddress, city: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input
                type="text"
                value={billingAddress.state}
                onChange={(e) => setBillingAddress({...billingAddress, state: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
              <input
                type="text"
                value={billingAddress.postalCode}
                onChange={(e) => setBillingAddress({...billingAddress, postalCode: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>
        </>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
        <input
          type="email"
          value={billingAddress.email}
          onChange={(e) => setBillingAddress({...billingAddress, email: e.target.value})}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        />
      </div>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <CreditCard className="h-5 w-5 text-pink-600" />
        <h3 className="text-lg font-semibold">Payment Information</h3>
      </div>
      
      {/* BigCommerce Payment Form will be embedded here */}
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h4 className="text-lg font-semibold text-gray-700 mb-2">Secure Payment Form</h4>
        <p className="text-gray-600 mb-4">
          BigCommerce's secure payment form will be embedded here
        </p>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
              <div className="w-full h-10 bg-gray-100 rounded border border-gray-300 flex items-center px-3">
                <span className="text-gray-500 text-sm">•••• •••• •••• ••••</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
                <div className="w-full h-10 bg-gray-100 rounded border border-gray-300 flex items-center px-3">
                  <span className="text-gray-500 text-sm">MM/YY</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                <div className="w-full h-10 bg-gray-100 rounded border border-gray-300 flex items-center px-3">
                  <span className="text-gray-500 text-sm">•••</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          This is a placeholder. In production, BigCommerce's secure payment form would be embedded here.
        </p>
      </div>
    </div>
  );

  const renderEmbeddedCheckout = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
          <Loader className="h-12 w-12 text-blue-600 animate-spin" />
          <p className="text-gray-600">Initializing secure checkout...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <div className="flex items-center space-x-2 mb-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Checkout Error</h3>
            </div>
            <p className="text-red-700 mb-4">{error}</p>

            {session && session.retry_count > 0 && (
              <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
                <p className="text-xs text-red-800">
                  Retry attempt {session.retry_count} of 3
                </p>
              </div>
            )}

            {canRetry ? (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {retrying ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Try Again</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-600 mb-2">Unable to retry automatically. Please:</p>
                <button
                  onClick={() => {
                    setError(null);
                    setSessionId(null);
                    initializeCheckout();
                  }}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Start New Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (!checkoutUrl) {
      return null;
    }

    return (
      <div className="h-[600px] w-full">
        <iframe
          ref={iframeRef}
          src={checkoutUrl}
          className="w-full h-full border-0 rounded-lg"
          title="BigCommerce Checkout"
          allow="payment"
        />
      </div>
    );
  };

  const renderReviewStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">Order Review</h3>
      
      {/* Order Items */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold mb-3">Items ({items.length})</h4>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center space-x-3">
              <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded" />
              <div className="flex-1">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
              </div>
              <div className="text-right">
                <PriceDisplay 
                  productId={item.id}
                  regularPrice={item.price}
                  quantity={item.quantity}
                  className="text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold mb-2">Shipping Address</h4>
          <div className="text-sm text-gray-600">
            <p>{shippingAddress.firstName} {shippingAddress.lastName}</p>
            {shippingAddress.company && <p>{shippingAddress.company}</p>}
            <p>{shippingAddress.address1}</p>
            {shippingAddress.address2 && <p>{shippingAddress.address2}</p>}
            <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}</p>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold mb-2">Billing Address</h4>
          <div className="text-sm text-gray-600">
            {sameAsShipping ? (
              <p className="italic">Same as shipping address</p>
            ) : (
              <>
                <p>{billingAddress.firstName} {billingAddress.lastName}</p>
                <p>{billingAddress.address1}</p>
                <p>{billingAddress.city}, {billingAddress.state} {billingAddress.postalCode}</p>
              </>
            )}
            <p className="mt-2">{billingAddress.email}</p>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold mb-3">Order Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping ({shippingMethods.find(m => m.id === selectedShippingMethod)?.name}):</span>
            <span>${shippingCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax:</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Checkout</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {renderEmbeddedCheckout()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;