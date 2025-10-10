import React, { useState, useEffect } from 'react';
import { X, CreditCard, Truck, MapPin, User, Lock, ArrowLeft, ArrowRight, Building2, AlertCircle, CheckCircle, DollarSign, Loader, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { bigCommerceCustomerService } from '@/services/bigCommerceCustomer';
import { bulletproofCheckoutService, CheckoutSession } from '@/services/bulletproofCheckout';
import { orderService } from '@/services/orderService';
import PriceDisplay from '../PriceDisplay';
import LocationSelector from './LocationSelector';
import type { Organization } from '@/services/supabase';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface OrganizationCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  organization: Organization;
  onOrderComplete: (orderId: string, paymentMethod: 'online' | 'offline') => void;
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

type CheckoutStep = 'shipping' | 'payment' | 'review';
type PaymentMethod = 'online' | 'offline';

const OrganizationCheckoutModal: React.FC<OrganizationCheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  organization,
  onOrderComplete
}) => {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [syncingCustomer, setSyncingCustomer] = useState(false);
  const [customerSynced, setCustomerSynced] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  // Form data - pre-populate with organization data
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    firstName: organization.name.split(' ')[0] || organization.name,
    lastName: organization.name.split(' ').slice(1).join(' ') || 'Organization',
    company: organization.name,
    address1: organization.billing_address?.address1 || '',
    address2: organization.billing_address?.address2 || '',
    city: organization.billing_address?.city || '',
    state: organization.billing_address?.state || '',
    postalCode: organization.billing_address?.postalCode || '',
    country: organization.billing_address?.country || 'US',
    phone: organization.contact_phone || ''
  });
  
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('standard');

  // Mock shipping methods - in real implementation, fetch from BigCommerce
  const shippingMethods = [
    { id: 'standard', name: 'Standard Shipping', price: 9.99, days: '5-7 business days' },
    { id: 'express', name: 'Express Shipping', price: 19.99, days: '2-3 business days' },
    { id: 'overnight', name: 'Overnight Shipping', price: 39.99, days: '1 business day' }
  ];

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = shippingMethods.find(m => m.id === selectedShippingMethod)?.price || 0;
  const tax = subtotal * 0.08; // Mock 8% tax
  const total = subtotal + shippingCost + tax;

  useEffect(() => {
    if (isOpen && organization && user?.id && !sessionId) {
      initializeCheckout();
    }
  }, [isOpen, organization, user]);

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

  const initializeCheckout = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    try {
      setSyncingCustomer(true);
      setError(null);
      setCanRetry(false);

      const syncResult = await bigCommerceCustomerService.syncOrganizationCustomer(organization);

      if (!syncResult.success) {
        setError(`Failed to sync customer data: ${syncResult.error}`);
        setCanRetry(true);
        return;
      }

      setCustomerSynced(true);

      const cartItems = items.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.image
      }));

      const sessionResult = await bulletproofCheckoutService.createSession(
        user.id,
        cartItems,
        organization.id
      );

      if (!sessionResult.success || !sessionResult.sessionId) {
        setError(sessionResult.error || 'Failed to create checkout session');
        setCanRetry(sessionResult.canRetry || false);
        return;
      }

      setSessionId(sessionResult.sessionId);

      await bulletproofCheckoutService.updateSession(sessionResult.sessionId, {
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
      });

    } catch (err) {
      setError('Failed to initialize checkout');
      setCanRetry(true);
      console.error('Checkout initialization error:', err);
    } finally {
      setSyncingCustomer(false);
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

      if (result.success) {
        setError(null);
        setCanRetry(false);
      } else {
        setError(result.error || 'Failed to recover checkout session');
        setCanRetry(result.canRetry || false);
      }
    } catch (err) {
      setError('Failed to retry checkout');
      setCanRetry(true);
      console.error('Checkout retry error:', err);
    } finally {
      setRetrying(false);
    }
  };

  const validateStep = (step: CheckoutStep): boolean => {
    switch (step) {
      case 'shipping':
        return !!(selectedLocationId && shippingAddress.firstName && shippingAddress.lastName &&
                 shippingAddress.address1 && shippingAddress.city &&
                 shippingAddress.state && shippingAddress.postalCode);
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
    const steps: CheckoutStep[] = ['shipping', 'payment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: CheckoutStep[] = ['shipping', 'payment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handlePlaceOrder = async () => {
    if (!sessionId) {
      setError('No active checkout session');
      return;
    }

    setLoading(true);
    setError(null);
    setCanRetry(false);

    try {
      await bulletproofCheckoutService.updateSession(sessionId, {
        shipping_address: shippingAddress,
        payment_method: paymentMethod,
        status: 'processing',
        location_id: selectedLocationId,
      });

      if (paymentMethod === 'online') {
        const result = await bigCommerceCustomerService.createOrderForOrganization(
          organization,
          items.map(item => ({
            productId: item.id,
            quantity: item.quantity
          }))
        );

        if (result.success && result.orderId) {
          await bulletproofCheckoutService.completeCheckout(sessionId, result.orderId);
          onOrderComplete(result.orderId, 'online');
          onClose();
        } else {
          setError(result.error || 'Failed to place order');
          setCanRetry(true);
          await bulletproofCheckoutService.updateSession(sessionId, {
            status: 'failed',
            last_error: result.error || 'Failed to place order',
          });
        }
      } else {
        const result = await bigCommerceCustomerService.createOrderForOrganization(
          organization,
          items.map(item => ({
            productId: item.id,
            quantity: item.quantity
          })),
          { paymentMethod: 'offline', status: 'pending_payment' }
        );

        if (result.success && result.orderId) {
          await bulletproofCheckoutService.completeCheckout(sessionId, result.orderId);
          onOrderComplete(result.orderId, 'offline');
          onClose();
        } else {
          setError(result.error || 'Failed to create order');
          setCanRetry(true);
          await bulletproofCheckoutService.updateSession(sessionId, {
            status: 'failed',
            last_error: result.error || 'Failed to create order',
          });
        }
      }
    } catch (err) {
      const errorMsg = 'Failed to place order. Please try again.';
      setError(errorMsg);
      setCanRetry(true);
      console.error('Order placement error:', err);

      if (sessionId) {
        await bulletproofCheckoutService.updateSession(sessionId, {
          status: 'failed',
          last_error: errorMsg,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {['shipping', 'payment', 'review'].map((step, index) => (
        <React.Fragment key={step}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
            currentStep === step 
              ? 'bg-pink-600 text-white' 
              : index < ['shipping', 'payment', 'review'].indexOf(currentStep)
                ? 'bg-green-600 text-white'
                : 'bg-gray-300 text-gray-600'
          }`}>
            {index + 1}
          </div>
          {index < 2 && (
            <div className={`w-12 h-0.5 mx-2 ${
              index < ['shipping', 'payment', 'review'].indexOf(currentStep)
                ? 'bg-green-600'
                : 'bg-gray-300'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderShippingStep = () => (
    <div className="space-y-6">
      {/* Organization Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <Building2 className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="font-semibold text-blue-900">Ordering for: {organization.name}</h3>
            <p className="text-sm text-blue-700">Code: {organization.code}</p>
            {organization.contact_email && (
              <p className="text-xs text-blue-600">{organization.contact_email}</p>
            )}
          </div>
          {syncingCustomer && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
          {customerSynced && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <Truck className="h-5 w-5 text-pink-600" />
        <h3 className="text-lg font-semibold">Shipping Information</h3>
      </div>

      <div className="mb-6">
        <LocationSelector
          organizationId={organization.id}
          selectedLocationId={selectedLocationId}
          onLocationSelect={(locationId, location) => {
            setSelectedLocationId(locationId);
            setSelectedLocation(location);
            if (location.address) {
              setShippingAddress({
                ...shippingAddress,
                address1: location.address.address1 || '',
                address2: location.address.address2 || '',
                city: location.address.city || '',
                state: location.address.state || '',
                postalCode: location.address.postalCode || '',
                country: location.address.country || 'US',
                company: location.name,
              });
            }
          }}
          error={error && !selectedLocationId ? 'Please select a location' : undefined}
        />
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
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

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <CreditCard className="h-5 w-5 text-pink-600" />
        <h3 className="text-lg font-semibold">Payment Method</h3>
      </div>

      {/* Payment Method Selection */}
      <div className="space-y-3">
        <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="payment_method"
            value="online"
            checked={paymentMethod === 'online'}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="mr-3"
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-gray-600" />
              <span className="font-medium">Online Payment</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Process payment immediately through BigCommerce
            </p>
          </div>
        </label>

        <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="payment_method"
            value="offline"
            checked={paymentMethod === 'offline'}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="mr-3"
          />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-gray-600" />
              <span className="font-medium">Offline Payment</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Create order for offline payment (invoice, check, wire transfer, etc.)
            </p>
          </div>
        </label>
      </div>

      {/* Payment Method Details */}
      {paymentMethod === 'online' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-blue-800">
            <Lock className="h-5 w-5" />
            <span className="font-medium">Secure Online Payment</span>
          </div>
          <p className="text-blue-700 text-sm mt-2">
            Order will be processed immediately through BigCommerce's secure payment system.
          </p>
        </div>
      )}

      {paymentMethod === 'offline' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-yellow-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Offline Payment Required</span>
          </div>
          <p className="text-yellow-700 text-sm mt-2">
            Order will be created with "Pending Payment" status. The order will be released for fulfillment 
            once payment is confirmed through your offline payment method.
          </p>
          <div className="mt-3 text-xs text-yellow-600">
            <p><strong>Next Steps:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Order will be created in BigCommerce</li>
              <li>Invoice will be generated for the organization</li>
              <li>Order will be held until payment confirmation</li>
              <li>Admin can release order once payment is received</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">Order Review</h3>
      
      {/* Organization Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <Building2 className="h-6 w-6 text-blue-600" />
          <div>
            <h4 className="font-semibold text-blue-900">Customer: {organization.name}</h4>
            <p className="text-sm text-blue-700">Code: {organization.code}</p>
            <p className="text-xs text-blue-600">
              Sales Rep: {profile?.email} | Order Date: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
      
      {/* Order Items with Organization Pricing */}
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
                  organizationId={organization.id}
                  className="text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping Address */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Shipping Address</h4>
        <div className="text-sm text-gray-600">
          <p>{shippingAddress.firstName} {shippingAddress.lastName}</p>
          <p>{shippingAddress.company}</p>
          <p>{shippingAddress.address1}</p>
          {shippingAddress.address2 && <p>{shippingAddress.address2}</p>}
          <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}</p>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Payment Method</h4>
        <div className="flex items-center space-x-2">
          {paymentMethod === 'online' ? (
            <>
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Online Payment</span>
            </>
          ) : (
            <>
              <DollarSign className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-700 font-medium">Offline Payment (Pending)</span>
            </>
          )}
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

      {/* Payment Status Notice */}
      {paymentMethod === 'offline' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 text-yellow-800">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Order will be created with pending payment status</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Organization Checkout</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {renderStepIndicator()}
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="mb-2">{error}</p>

                {session && session.retry_count > 0 && (
                  <div className="bg-red-100 border border-red-300 rounded p-2 mb-2">
                    <p className="text-xs text-red-800">
                      Retry attempt {session.retry_count} of 3
                    </p>
                  </div>
                )}

                {canRetry && (
                  <button
                    onClick={handleRetry}
                    disabled={retrying}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {retrying ? (
                      <>
                        <Loader className="h-3 w-3 animate-spin" />
                        <span>Retrying...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3" />
                        <span>Retry Now</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            <div className="min-h-[400px]">
              {currentStep === 'shipping' && renderShippingStep()}
              {currentStep === 'payment' && renderPaymentStep()}
              {currentStep === 'review' && renderReviewStep()}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {currentStep !== 'shipping' && (
                <button
                  onClick={handleBack}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-lg font-semibold">${total.toFixed(2)}</p>
              </div>
              
              {currentStep === 'review' ? (
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading || !customerSynced}
                  className="flex items-center space-x-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  <span>
                    {loading ? 'Processing...' : 
                     paymentMethod === 'online' ? 'Place Order' : 'Create Order (Pending Payment)'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!customerSynced}
                  className="flex items-center space-x-2 bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationCheckoutModal;