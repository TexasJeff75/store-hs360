import React, { useState, useEffect, useRef } from 'react';
import { X, CreditCard, Truck, MapPin, User, Lock, ArrowLeft, ArrowRight, Loader, AlertCircle, RefreshCw, CheckCircle, Clock, FileText, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PriceDisplay from '../PriceDisplay';
import { restCheckoutService } from '@/services/restCheckout';
import CustomerSelector from './CustomerSelector';
import AddressSelector from './AddressSelector';
import PaymentForm from './PaymentForm';
import type { PaymentData } from './PaymentForm';
import { CustomerAddress, customerAddressService } from '@/services/customerAddresses';
import { supabase } from '@/services/supabase';
import { quickbooksPayments } from '@/services/quickbooks';
import OrderReceipt from './OrderReceipt';
import { siteSettingsService, type ShippingMethod } from '@/services/siteSettings';

interface CartItem {
  id: number;
  name: string;
  price: number;
  retailPrice?: number;
  cost?: number;
  quantity: number;
  image: string;
  hasMarkup?: boolean;
  brand?: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onOrderComplete: (orderId: string) => void;
  organizationId?: string;
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

type CheckoutStep = 'customer' | 'location' | 'shipping' | 'billing' | 'payment' | 'review' | 'processing' | 'confirmation';

interface OrgLocation {
  id: string;
  name: string;
  code: string;
  address?: any;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onOrderComplete,
  organizationId
}) => {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('customer');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>();
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [availableLocations, setAvailableLocations] = useState<OrgLocation[]>([]);
  const [showAddressSelector, setShowAddressSelector] = useState(true);
  const [showBillingAddressSelector, setShowBillingAddressSelector] = useState(true);
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [useManualBillingAddress, setUseManualBillingAddress] = useState(false);
  const [isAdminOrManager, setIsAdminOrManager] = useState(false);
  const [saveShippingAddress, setSaveShippingAddress] = useState(false);
  const [saveBillingAddress, setSaveBillingAddress] = useState(false);
  const [shippingAddressLabel, setShippingAddressLabel] = useState('');
  const [billingAddressLabel, setBillingAddressLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [paymentResult, setPaymentResult] = useState<{
    status: string;
    method: string;
    lastFour: string;
    transactionId: string;
  } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

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
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>(siteSettingsService.getDefaults().shipping);

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = shippingMethods.find(m => m.id === selectedShippingMethod)?.price || 0;
  const tax = 0;
  const total = subtotal + shippingCost + tax;

  useEffect(() => {
    if (isOpen) {
      siteSettingsService.getSettings().then(s => setShippingMethods(s.shipping));
    }
  }, [isOpen]);

  useEffect(() => {
    checkUserRole();
  }, [user]);

  useEffect(() => {
    if (isOpen && items.length > 0 && !sessionId && selectedCustomerId) {
      initializeCheckout();
    }
  }, [isOpen, items, selectedCustomerId]);

  const checkUserRole = async () => {
    if (!user?.id) return;

    const isSystemAdmin = profile?.role === 'admin';

    let isAdmin = isSystemAdmin;

    if (!isAdmin) {
      const { data } = await supabase
        .from('user_organization_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'manager'])
        .limit(1)
        .maybeSingle();

      isAdmin = !!data;
    }

    setIsAdminOrManager(isAdmin);

    if (!isAdmin) {
      setSelectedCustomerId(user.id);
      setCustomerEmail(user.email || '');

      // Find user's organization and locations
      const orgId = organizationId || await getUserOrganizationId(user.id);

      if (orgId) {
        setSelectedOrgId(orgId);

        const { data: locations } = await supabase
          .from('locations')
          .select('id, name, code, address')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .order('name');

        if (locations && locations.length > 1) {
          // Multiple locations — let user choose
          setAvailableLocations(locations);
          setCurrentStep('location');
        } else if (locations && locations.length === 1) {
          // Single location — auto-select
          setSelectedLocationId(locations[0].id);
          await fetchLocationAddress(locations[0].id);
          setCurrentStep('shipping');
        } else {
          setCurrentStep('shipping');
        }
      } else {
        setCurrentStep('shipping');
      }
    } else {
      // Admin flow — if org pre-selected, fetch its locations for CustomerSelector
      if (organizationId) {
        setSelectedOrgId(organizationId);

        const { data: locations } = await supabase
          .from('locations')
          .select('id, name, code, address')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .order('name');

        if (locations && locations.length > 0) {
          setAvailableLocations(locations);
        }
      }
      setCurrentStep('customer');
    }
  };

  const getUserOrganizationId = async (userId: string): Promise<string | undefined> => {
    const { data } = await supabase
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    return data?.organization_id;
  };

  const handleCustomerSelection = async (selection: {
    customerId: string;
    organizationId?: string;
    locationId?: string;
    customerEmail: string;
  }) => {
    setSelectedCustomerId(selection.customerId);
    setSelectedOrgId(selection.organizationId);
    setCustomerEmail(selection.customerEmail);

    if (selection.locationId) {
      setSelectedLocationId(selection.locationId);
      await fetchLocationAddress(selection.locationId);
      setCurrentStep('shipping');
    } else if (selection.organizationId) {
      // Org selected but no location — check if there are locations to choose from
      const { data: locations } = await supabase
        .from('locations')
        .select('id, name, code, address')
        .eq('organization_id', selection.organizationId)
        .eq('is_active', true)
        .order('name');

      if (locations && locations.length > 1) {
        setAvailableLocations(locations);
        setCurrentStep('location');
      } else if (locations && locations.length === 1) {
        setSelectedLocationId(locations[0].id);
        await fetchLocationAddress(locations[0].id);
        setCurrentStep('shipping');
      } else {
        setCurrentStep('shipping');
      }
    } else {
      setCurrentStep('shipping');
    }
  };

  const fetchLocationAddress = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('address, name')
        .eq('id', locationId)
        .single();

      if (error) throw error;

      if (data?.address) {
        const addr = data.address as any;
        setShippingAddress({
          firstName: addr.firstName || addr.first_name || '',
          lastName: addr.lastName || addr.last_name || '',
          company: addr.company || data.name || '',
          address1: addr.address1 || addr.street || '',
          address2: addr.address2 || '',
          city: addr.city || '',
          state: addr.state || addr.state_or_province || '',
          postalCode: addr.postalCode || addr.postal_code || addr.zip || '',
          country: addr.country || addr.country_code || 'US',
          phone: addr.phone || ''
        });
        setShowAddressSelector(false);
      }
    } catch (error) {
      console.error('Error fetching location address:', error);
    }
  };


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

    try {
      const cartItems = items.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        retailPrice: item.retailPrice || item.price,
        cost: item.cost || 0,
        brand: item.brand,
        image: item.image,
        hasMarkup: item.hasMarkup || false
      }));

      const sessionResult = await restCheckoutService.createCheckoutSession(
        user.id,
        cartItems,
        selectedOrgId,
        selectedLocationId
      );

      if (!sessionResult.success || !sessionResult.sessionId) {
        setError(sessionResult.error || 'Failed to create checkout session');
        return;
      }

      setSessionId(sessionResult.sessionId);
    } catch (err) {
      setError('Failed to initialize checkout. Please try again.');
      console.error('Checkout initialization error:', err);
    } finally {
      setLoading(false);
    }
  };


  const validateStep = (step: CheckoutStep): boolean => {
    switch (step) {
      case 'customer':
        if (!selectedCustomerId) {
          setError('Please select a customer');
          return false;
        }
        return true;
      case 'shipping':
        const shippingValid = !!(shippingAddress.firstName && shippingAddress.lastName &&
                 shippingAddress.address1 && shippingAddress.city &&
                 shippingAddress.state && shippingAddress.postalCode);
        if (!shippingValid) return false;
        if (saveShippingAddress && !shippingAddressLabel.trim()) {
          setError('Please provide a label for the address');
          return false;
        }
        return true;
      case 'billing':
        const billingValid = !!(billingAddress.firstName && billingAddress.lastName &&
                 billingAddress.address1 && billingAddress.city &&
                 billingAddress.state && billingAddress.postalCode && billingAddress.email);
        if (!billingValid) return false;
        if (saveBillingAddress && !billingAddressLabel.trim()) {
          setError('Please provide a label for the billing address');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const saveAddressToDatabase = async (
    addressData: ShippingAddress | BillingAddress,
    addressType: 'shipping' | 'billing',
    label: string
  ) => {
    if (!label.trim()) {
      setError('Please provide a label for the address');
      return false;
    }

    if (!user?.id) return true;

    const isOrderingForOtherUser = selectedCustomerId !== user.id;
    if (isOrderingForOtherUser) {
      return true;
    }

    try {
      const addressToSave = {
        user_id: user.id,
        organization_id: selectedOrgId,
        location_id: selectedLocationId,
        address_type: addressType,
        label: label.trim(),
        first_name: addressData.firstName,
        last_name: addressData.lastName,
        company: addressData.company,
        address1: addressData.address1,
        address2: addressData.address2,
        city: addressData.city,
        state_or_province: addressData.state,
        postal_code: addressData.postalCode,
        country_code: addressData.country,
        phone: addressData.phone,
        email: 'email' in addressData ? addressData.email : undefined,
      };

      await customerAddressService.createAddress(addressToSave);
    } catch {
      console.warn('Could not save address, continuing with checkout');
    }

    return true;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) {
      setError('Please fill in all required fields');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (currentStep === 'shipping' && saveShippingAddress && shippingAddressLabel) {
        const saved = await saveAddressToDatabase(shippingAddress, 'shipping', shippingAddressLabel);
        if (!saved) {
          setLoading(false);
          return;
        }
      }

      if (currentStep === 'billing' && saveBillingAddress && billingAddressLabel) {
        const saved = await saveAddressToDatabase(billingAddress, 'billing', billingAddressLabel);
        if (!saved) {
          setLoading(false);
          return;
        }
      }

      if (currentStep === 'shipping' && sessionId && !cartId) {
        const lineItems = items.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }));

        const cartResult = await restCheckoutService.createCart(sessionId, lineItems);

        if (cartResult.success && cartResult.cartId) {
          setCartId(cartResult.cartId);
        } else {
          setError(cartResult.error || 'Failed to create cart');
          setLoading(false);
          return;
        }
      }

      if (currentStep === 'billing' && sessionId && cartId && !checkoutId) {
        const billingAddr = {
          first_name: billingAddress.firstName,
          last_name: billingAddress.lastName,
          email: billingAddress.email,
          company: billingAddress.company,
          address1: billingAddress.address1,
          address2: billingAddress.address2,
          city: billingAddress.city,
          state_or_province: billingAddress.state,
          postal_code: billingAddress.postalCode,
          country_code: billingAddress.country,
          phone: billingAddress.phone,
        };

        const shippingAddr = {
          first_name: shippingAddress.firstName,
          last_name: shippingAddress.lastName,
          email: user?.email || '',
          company: shippingAddress.company,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2,
          city: shippingAddress.city,
          state_or_province: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country_code: shippingAddress.country,
          phone: shippingAddress.phone,
        };

        const checkoutResult = await restCheckoutService.addAddresses(
          sessionId,
          cartId,
          billingAddr,
          shippingAddr
        );

        if (checkoutResult.success && checkoutResult.checkoutId) {
          setCheckoutId(checkoutResult.checkoutId);
        } else {
          setError(checkoutResult.error || 'Failed to create checkout');
          setLoading(false);
          return;
        }
      }

      const steps: CheckoutStep[] = ['customer', 'location', 'shipping', 'billing', 'payment', 'review'];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1]);
      }
    } catch (err) {
      console.error('Error during checkout step:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'shipping' && !useManualAddress && showAddressSelector) {
      setShowAddressSelector(false);
      setUseManualAddress(true);
      return;
    }

    // If on billing step showing manual form (from selecting a saved address), go back to selector
    if (currentStep === 'billing' && !sameAsShipping && !showBillingAddressSelector && !useManualBillingAddress) {
      setShowBillingAddressSelector(true);
      return;
    }
    // If on billing step showing manual entry form (from "Add New"), go back to selector
    if (currentStep === 'billing' && !sameAsShipping && useManualBillingAddress) {
      setUseManualBillingAddress(false);
      setShowBillingAddressSelector(true);
      return;
    }

    // If going back from shipping and there are multiple locations, go to location step
    if (currentStep === 'shipping' && availableLocations.length > 1) {
      setCurrentStep('location');
      return;
    }

    const steps: CheckoutStep[] = ['customer', 'location', 'shipping', 'billing', 'payment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handlePlaceOrder = async () => {
    if (!sessionId || !checkoutId || !paymentData) {
      setError('Checkout session or payment data not found. Please try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let paymentAuthId = '';
      let paymentLastFour = '';
      let paymentStatus = 'authorized';

      if (paymentData.type === 'card') {
        const authResponse = await quickbooksPayments.authorizeCard(
          total,
          paymentData.token,
          'USD',
          `Order from checkout session ${sessionId}`
        );

        if (authResponse.status === 'DECLINED') {
          console.warn('Card payment declined:', { sessionId, lastFour: paymentData.lastFour });
          setError('Your payment was declined. Please try a different payment method.');
          setCurrentStep('payment');
          setLoading(false);
          return;
        }

        paymentAuthId = authResponse.id;
        paymentLastFour = paymentData.lastFour;

        if (paymentData.savePaymentMethod && selectedOrgId && user?.id) {
          try {
            await quickbooksPayments.savePaymentMethod({
              organizationId: selectedOrgId,
              locationId: selectedLocationId,
              userId: user.id,
              label: paymentData.paymentMethodLabel || `Card ****${paymentLastFour}`,
              paymentType: 'credit_card',
              lastFour: paymentLastFour,
              expiryMonth: parseInt(paymentData.expiryMonth),
              expiryYear: parseInt('20' + paymentData.expiryYear),
              accountHolderName: paymentData.cardholderName,
              token: paymentData.token,
            });
          } catch (saveErr) {
            console.warn('Failed to save card payment method:', saveErr);
          }
        }
      } else if (paymentData.type === 'ach') {
        const achResponse = await quickbooksPayments.processACHWithToken(
          total,
          paymentData.token,
          'USD',
          `Order from checkout session ${sessionId}`
        );

        if (achResponse.status === 'DECLINED') {
          console.warn('ACH payment declined:', { sessionId, lastFour: paymentData.lastFour });
          setError('Your payment was declined. Please try a different payment method.');
          setCurrentStep('payment');
          setLoading(false);
          return;
        }

        paymentAuthId = achResponse.id;
        paymentLastFour = paymentData.lastFour;
        paymentStatus = 'pending';

        if (paymentData.savePaymentMethod && selectedOrgId && user?.id) {
          try {
            const acctTypeLower = paymentData.accountType.toLowerCase();
            await quickbooksPayments.savePaymentMethod({
              organizationId: selectedOrgId,
              locationId: selectedLocationId,
              userId: user.id,
              label: paymentData.paymentMethodLabel || `Bank ****${paymentLastFour}`,
              paymentType: 'ach',
              lastFour: paymentLastFour,
              accountHolderName: paymentData.accountHolderName,
              accountType: acctTypeLower.includes('checking') ? 'checking' : 'savings',
              token: paymentData.token,
            });
          } catch (saveErr) {
            console.warn('Failed to save ACH payment method:', saveErr);
          }
        }
      } else if (paymentData.type === 'saved') {
        const { data: { session: authSession } } = await supabase.auth.getSession();

        const savedResponse = await fetch('/api/process-saved-payment', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authSession?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethodId: paymentData.paymentMethodId,
            amount: total,
            currency: 'USD',
            description: `Order from checkout session ${sessionId}`,
          }),
        });

        const savedResult = await savedResponse.json();
        if (!savedResponse.ok || savedResult.error) {
          if (savedResult.status === 'DECLINED') {
            setError('Your payment was declined. Please try a different payment method.');
            setCurrentStep('payment');
            setLoading(false);
            return;
          }
          throw new Error(savedResult.error || 'Failed to process saved payment');
        }

        paymentAuthId = savedResult.transactionId;
        paymentLastFour = paymentData.lastFour;
        paymentStatus = savedResult.paymentStatus || 'authorized';
      }

      const sanitizedPaymentData = {
        cardholder_name: paymentData.type === 'card' ? paymentData.cardholderName
          : paymentData.type === 'ach' ? paymentData.accountHolderName
          : 'Saved Method',
        number: paymentLastFour.padStart(16, '*'),
        expiry_month: 1,
        expiry_year: 2030,
        verification_value: '000',
      };

      const result = await restCheckoutService.processPayment(
        sessionId,
        checkoutId,
        sanitizedPaymentData,
        paymentAuthId
      );

      if (result.success && result.orderId) {
        const { orderService } = await import('@/services/orderService');
        await orderService.updatePaymentStatus(result.orderId, paymentStatus, paymentAuthId);

        const methodLabel = paymentData.type === 'card' ? 'Credit Card'
          : paymentData.type === 'ach' ? 'Bank Account'
          : paymentData.type === 'saved' ? (paymentData.paymentType === 'ach' || paymentData.paymentType === 'bank_account' ? 'Bank Account' : 'Credit Card')
          : 'Card';

        setPaymentResult({
          status: paymentStatus,
          method: methodLabel,
          lastFour: paymentLastFour,
          transactionId: paymentAuthId,
        });

        await orderService.logPaymentEvent(result.orderId, {
          event: paymentStatus === 'authorized' ? 'authorization' : 'payment_initiated',
          status: paymentStatus,
          method: methodLabel,
          lastFour: paymentLastFour,
          transactionId: paymentAuthId,
          amount: total,
        });

        setCompletedOrderId(result.orderId);
        setCurrentStep('confirmation');
      } else {
        setError(result.error || 'Failed to process payment');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('decline')) {
        setError('Your payment was declined. Please try a different payment method.');
        setCurrentStep('payment');
      } else {
        setError(msg || 'Failed to place order. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = (address: CustomerAddress | 'new', type: 'shipping' | 'billing') => {
    if (address === 'new') {
      setUseManualAddress(true);
      return;
    }

    const addressData = {
      firstName: address.first_name,
      lastName: address.last_name,
      company: address.company || '',
      address1: address.address1,
      address2: address.address2 || '',
      city: address.city,
      state: address.state_or_province,
      postalCode: address.postal_code,
      country: address.country_code,
      phone: address.phone || ''
    };

    if (type === 'shipping') {
      setShippingAddress(addressData);
      setShowAddressSelector(false);
    } else {
      setBillingAddress({ ...addressData, email: address.email || customerEmail });
      setShowBillingAddressSelector(false);
    }
  };

  if (!isOpen) return null;

  const handleLocationSelect = async (locationId: string) => {
    setSelectedLocationId(locationId);
    await fetchLocationAddress(locationId);
    setCurrentStep('shipping');
  };

  const renderLocationStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          <span>Select Shipping Location</span>
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose which location this order should be shipped to
        </p>
      </div>

      <div className="space-y-3">
        {availableLocations.map((loc) => {
          const addr = loc.address;
          const addrLine = addr
            ? [addr.address1 || addr.street, addr.city, addr.state || addr.state_or_province].filter(Boolean).join(', ')
            : null;

          return (
            <button
              key={loc.id}
              onClick={() => handleLocationSelect(loc.id)}
              className={`w-full text-left p-4 border-2 rounded-lg transition-colors hover:border-blue-500 hover:bg-blue-50 ${
                selectedLocationId === loc.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">{loc.name}</p>
                  <p className="text-sm text-gray-500">{loc.code}</p>
                  {addrLine && (
                    <p className="text-sm text-gray-600 mt-1">{addrLine}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => {
          setSelectedLocationId(undefined);
          setCurrentStep('shipping');
        }}
        className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
      >
        Ship to a different address instead
      </button>
    </div>
  );

  const renderCustomerStep = () => (
    <div className="space-y-6">
      <CustomerSelector
        onSelect={handleCustomerSelection}
        currentUserId={user?.id || ''}
        preSelectedOrganizationId={organizationId}
      />
    </div>
  );

  const renderShippingStep = () => {
    // If a location is selected and address is populated, skip AddressSelector
    const hasLocationAddress = selectedLocationId && shippingAddress.address1;

    if (!useManualAddress && showAddressSelector && !hasLocationAddress) {
      return (
        <div className="space-y-6">
          <AddressSelector
            userId={selectedCustomerId}
            organizationId={selectedOrgId}
            locationId={selectedLocationId}
            addressType="shipping"
            onSelect={(addr) => handleAddressSelect(addr, 'shipping')}
            onAddNew={() => setUseManualAddress(true)}
          />
        </div>
      );
    }

    return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Truck className="h-5 w-5 text-pink-600" />
          <h3 className="text-lg font-semibold">Shipping Address</h3>
        </div>
        {selectedLocationId && (
          <div className="flex items-center gap-2">
            <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
              {availableLocations.find(l => l.id === selectedLocationId)?.name || 'Location Address'}
            </span>
            {availableLocations.length > 1 && (
              <button
                onClick={() => setCurrentStep('location')}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Change
              </button>
            )}
          </div>
        )}
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

      {/* Save Address Option */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={saveShippingAddress}
            onChange={(e) => setSaveShippingAddress(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Save this address for future orders
          </span>
        </label>

        {saveShippingAddress && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Label *
            </label>
            <input
              type="text"
              value={shippingAddressLabel}
              onChange={(e) => setShippingAddressLabel(e.target.value)}
              placeholder="e.g., Home, Office, Warehouse"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Give this address a memorable name
            </p>
          </div>
        )}
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
  };

  const renderBillingStep = () => {
    // Show saved billing address selector when not same-as-shipping and not manually entering
    if (!sameAsShipping && !useManualBillingAddress && showBillingAddressSelector) {
      return (
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

          <AddressSelector
            userId={selectedCustomerId}
            organizationId={selectedOrgId}
            locationId={selectedLocationId}
            addressType="billing"
            onSelect={(addr) => handleAddressSelect(addr, 'billing')}
            onAddNew={() => setUseManualBillingAddress(true)}
          />
        </div>
      );
    }

    return (
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
            onChange={(e) => {
              setSameAsShipping(e.target.checked);
              if (!e.target.checked) {
                // Reset to show address selector when unchecking
                setShowBillingAddressSelector(true);
                setUseManualBillingAddress(false);
              }
            }}
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

      {/* Save Billing Address Option */}
      {!sameAsShipping && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveBillingAddress}
              onChange={(e) => setSaveBillingAddress(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Save this billing address for future orders
            </span>
          </label>

          {saveBillingAddress && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Label *
              </label>
              <input
                type="text"
                value={billingAddressLabel}
                onChange={(e) => setBillingAddressLabel(e.target.value)}
                placeholder="e.g., Business Address, Corporate HQ"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Give this billing address a memorable name
              </p>
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <CreditCard className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Payment Information</h3>
      </div>

      <PaymentForm
        onPaymentReady={() => {}}
        onPaymentSubmit={(data) => {
          setPaymentData(data);
          setCurrentStep('review');
        }}
        billingAddress={billingAddress}
        total={total}
        organizationId={selectedOrgId}
        locationId={selectedLocationId}
      />
    </div>
  );


  const getPaymentSummary = () => {
    if (!paymentData) return 'No payment method selected';
    if (paymentData.type === 'card') return `Credit Card ****${paymentData.lastFour}`;
    if (paymentData.type === 'ach') return `Bank Account ****${paymentData.lastFour}`;
    if (paymentData.type === 'saved') return `Saved Method ****${paymentData.lastFour}`;
    return 'Unknown';
  };

  const renderReviewStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">Order Review</h3>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">Payment Method</p>
            <p className="text-sm text-gray-600">{getPaymentSummary()}</p>
            {paymentData?.type === 'ach' && (
              <p className="text-xs text-amber-600 mt-1">ACH payments take 3-5 business days to settle</p>
            )}
          </div>
        </div>
      </div>

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

  const renderConfirmationStep = () => {
    const statusConfig: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string; label: string; description: string }> = {
      authorized: {
        icon: <CheckCircle className="h-5 w-5" />,
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        label: 'Card Authorized',
        description: 'Your card has been authorized. The charge will be captured when your order ships.',
      },
      captured: {
        icon: <CheckCircle className="h-5 w-5" />,
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        label: 'Payment Captured',
        description: 'Your payment has been successfully processed.',
      },
      pending: {
        icon: <Clock className="h-5 w-5" />,
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        label: 'Payment Pending',
        description: 'Your ACH payment is being processed. This typically takes 3-5 business days.',
      },
    };

    const paymentInfo = paymentResult ? statusConfig[paymentResult.status] || statusConfig.pending : null;

    return (
      <div className="space-y-6 py-4">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-5">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">Order Placed Successfully</h3>
          <p className="text-gray-500 text-sm">Order #{completedOrderId?.slice(0, 8).toUpperCase()}</p>
        </div>

        {paymentInfo && paymentResult && (
          <div className={`${paymentInfo.bg} ${paymentInfo.border} border rounded-xl p-4`}>
            <div className="flex items-start gap-3">
              <div className={`${paymentInfo.text} mt-0.5`}>{paymentInfo.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className={`font-semibold ${paymentInfo.text}`}>{paymentInfo.label}</p>
                  <span className={`text-sm font-medium ${paymentInfo.text}`}>
                    {paymentResult.method} ****{paymentResult.lastFour}
                  </span>
                </div>
                <p className={`text-sm ${paymentInfo.text} opacity-80`}>{paymentInfo.description}</p>
                {paymentResult.transactionId && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Transaction ID:</span>
                    <span className="text-xs font-mono bg-white/60 px-2 py-0.5 rounded border border-gray-200">{paymentResult.transactionId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Order Total</span>
              <p className="text-lg font-bold text-gray-900">${total.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-500">Items</span>
              <p className="text-lg font-bold text-gray-900">{items.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Shipping</span>
              <p className="font-medium text-gray-900">{shippingMethods.find(m => m.id === selectedShippingMethod)?.name}</p>
            </div>
            <div>
              <span className="text-gray-500">Email</span>
              <p className="font-medium text-gray-900 truncate">{billingAddress.email}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => setShowReceipt(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-900 hover:text-white transition-colors font-medium text-sm"
          >
            <FileText className="h-4 w-4" />
            View Receipt
          </button>
          <button
            onClick={() => {
              if (completedOrderId) {
                onOrderComplete(completedOrderId);
              }
              onClose();
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm"
          >
            Done
          </button>
        </div>

        {showReceipt && (
          <OrderReceipt
            orderId={completedOrderId || ''}
            orderDate={new Date().toISOString()}
            items={items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price, image: item.image }))}
            subtotal={subtotal}
            shipping={shippingCost}
            shippingMethod={shippingMethods.find(m => m.id === selectedShippingMethod)?.name || 'Standard'}
            tax={tax}
            total={total}
            paymentStatus={paymentResult?.status || 'pending'}
            paymentMethod={paymentResult?.method || 'Card'}
            paymentLastFour={paymentResult?.lastFour || '****'}
            transactionId={paymentResult?.transactionId || ''}
            customerEmail={billingAddress.email}
            shippingAddress={shippingAddress}
            billingAddress={billingAddress}
            sameAsShipping={sameAsShipping}
            onClose={() => setShowReceipt(false)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-50"></div>
        
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
            {loading && (
              <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                <Loader className="h-12 w-12 text-blue-600 animate-spin" />
                <p className="text-gray-600">Initializing checkout...</p>
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                  <div className="flex items-center space-x-2 mb-3">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                    <h3 className="text-lg font-semibold text-red-900">Checkout Error</h3>
                  </div>
                  <p className="text-red-700 mb-4">{error}</p>
                  <button
                    onClick={initializeCheckout}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && currentStep === 'customer' && renderCustomerStep()}
            {!loading && !error && currentStep === 'location' && renderLocationStep()}
            {!loading && !error && currentStep === 'shipping' && renderShippingStep()}
            {!loading && !error && currentStep === 'billing' && renderBillingStep()}
            {!loading && !error && currentStep === 'payment' && renderPaymentStep()}
            {!loading && !error && currentStep === 'review' && renderReviewStep()}
            {!loading && !error && currentStep === 'confirmation' && renderConfirmationStep()}
          </div>

          {/* Footer Navigation */}
          {!loading && !error && currentStep !== 'customer' && currentStep !== 'location' && currentStep !== 'confirmation' && (
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBack}
                  className="flex items-center space-x-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>

                {currentStep === 'review' ? (
                  <button
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>Place Order</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;