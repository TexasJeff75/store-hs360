import React, { useState, useEffect, useRef } from 'react';
import { X, CreditCard, Truck, MapPin, User, Lock, ArrowLeft, ArrowRight, Loader, AlertCircle, RefreshCw, CheckCircle, Clock, FileText, Printer, FlaskConical } from 'lucide-react';
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
import TurnstileWidget from '../TurnstileWidget';
import { activityLogService } from '@/services/activityLog';

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

type CheckoutStep = 'customer' | 'shipping' | 'billing' | 'payment' | 'review' | 'processing' | 'confirmation';

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
  const [customerEmail, setCustomerEmail] = useState<string>('');
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

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
    const isRepOrDistributor = profile?.role === 'sales_rep' || profile?.role === 'distributor';

    let isAdmin = isSystemAdmin;

    if (!isAdmin && !isRepOrDistributor) {
      const { data } = await supabase
        .from('user_organization_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'manager'])
        .limit(1)
        .maybeSingle();

      isAdmin = !!data;
    }

    const canOrderForOthers = isAdmin || isRepOrDistributor;
    setIsAdminOrManager(canOrderForOthers);

    if (!canOrderForOthers) {
      setSelectedCustomerId(user.id);
      setCustomerEmail(user.email || '');

      const orgId = organizationId || await getUserOrganizationId(user.id);
      if (orgId) {
        setSelectedOrgId(orgId);
      }
      setCurrentStep('shipping');
    } else {
      if (organizationId) {
        setSelectedOrgId(organizationId);
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
    customerEmail: string;
  }) => {
    setSelectedCustomerId(selection.customerId);
    setSelectedOrgId(selection.organizationId);
    setCustomerEmail(selection.customerEmail);
    setCurrentStep('shipping');
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
        selectedOrgId
      );

      if (!sessionResult.success || !sessionResult.sessionId) {
        const errorMsg = sessionResult.error || 'Failed to create checkout session';
        setError(errorMsg);
        console.error('[Checkout] Session creation failed:', errorMsg);
        activityLogService.logAction({
          userId: user.id,
          action: 'checkout_session_failed',
          resourceType: 'checkout',
          details: {
            error: errorMsg,
            organization_id: selectedOrgId,
            step: 'session_creation',
            items_count: items.length,
          },
        });
        return;
      }

      setSessionId(sessionResult.sessionId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to initialize checkout. Please try again.');
      console.error('[Checkout] Initialization error:', errorMsg, err);
      activityLogService.logAction({
        userId: user.id,
        action: 'checkout_session_failed',
        resourceType: 'checkout',
        details: {
          error: errorMsg,
          organization_id: selectedOrgId,
          step: 'initialization',
          items_count: items.length,
        },
      });
    } finally {
      setLoading(false);
    }
  };


  const validateStep = (step: CheckoutStep): boolean => {
    const errors: Record<string, string> = {};
    switch (step) {
      case 'customer':
        if (!selectedCustomerId) {
          setFieldErrors({});
          setError('Please select a customer');
          return false;
        }
        break;
      case 'shipping':
        if (!shippingAddress.firstName.trim()) errors['shipping.firstName'] = 'First name is required';
        if (!shippingAddress.lastName.trim()) errors['shipping.lastName'] = 'Last name is required';
        if (!shippingAddress.address1.trim()) errors['shipping.address1'] = 'Address is required';
        if (!shippingAddress.city.trim()) errors['shipping.city'] = 'City is required';
        if (!shippingAddress.state.trim()) errors['shipping.state'] = 'State is required';
        if (!shippingAddress.postalCode.trim()) errors['shipping.postalCode'] = 'ZIP code is required';
        if (saveShippingAddress && !shippingAddressLabel.trim()) errors['shipping.label'] = 'Address label is required';
        break;
      case 'billing':
        if (!billingAddress.firstName.trim()) errors['billing.firstName'] = 'First name is required';
        if (!billingAddress.lastName.trim()) errors['billing.lastName'] = 'Last name is required';
        if (!billingAddress.address1.trim()) errors['billing.address1'] = 'Address is required';
        if (!billingAddress.city.trim()) errors['billing.city'] = 'City is required';
        if (!billingAddress.state.trim()) errors['billing.state'] = 'State is required';
        if (!billingAddress.postalCode.trim()) errors['billing.postalCode'] = 'ZIP code is required';
        if (!billingAddress.email.trim()) errors['billing.email'] = 'Email is required';
        if (saveBillingAddress && !billingAddressLabel.trim()) errors['billing.label'] = 'Address label is required';
        break;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return false;
    return true;
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
      // fieldErrors are set by validateStep — don't set a system-level error
      return;
    }

    setError(null);
    setFieldErrors({});
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
          const errorMsg = cartResult.error || 'Failed to create cart';
          setError(errorMsg);
          console.error('[Checkout] Cart creation failed:', errorMsg);
          if (user?.id) {
            activityLogService.logAction({
              userId: user.id,
              action: 'checkout_error',
              resourceType: 'checkout',
              resourceId: sessionId,
              details: { error: errorMsg, step: 'cart_creation', organization_id: selectedOrgId },
            });
          }
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
          shippingAddr,
          shippingCost
        );

        if (checkoutResult.success && checkoutResult.checkoutId) {
          setCheckoutId(checkoutResult.checkoutId);
        } else {
          const errorMsg = checkoutResult.error || 'Failed to create checkout';
          setError(errorMsg);
          console.error('[Checkout] Address/checkout creation failed:', errorMsg);
          if (user?.id) {
            activityLogService.logAction({
              userId: user.id,
              action: 'checkout_error',
              resourceType: 'checkout',
              resourceId: sessionId,
              details: { error: errorMsg, step: 'address_checkout', organization_id: selectedOrgId },
            });
          }
          setLoading(false);
          return;
        }
      }

      const steps: CheckoutStep[] = ['customer', 'shipping', 'billing', 'payment', 'review'];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Checkout] Step error:', currentStep, errorMsg, err);
      setError('An error occurred. Please try again.');
      if (user?.id) {
        activityLogService.logAction({
          userId: user.id,
          action: 'checkout_error',
          resourceType: 'checkout',
          resourceId: sessionId || undefined,
          details: { error: errorMsg, step: currentStep, organization_id: selectedOrgId },
        });
      }
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

    const steps: CheckoutStep[] = ['customer', 'shipping', 'billing', 'payment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setFieldErrors({});
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

      if (testMode && profile?.role === 'admin') {
        // Test mode — skip actual payment processing
        paymentAuthId = `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        paymentLastFour = paymentData.lastFour || '0000';
        paymentStatus = 'authorized';
      } else if (paymentData.type === 'card') {
        let authResponse;

        if (paymentData.savePaymentMethod && selectedOrgId && user?.id) {
          // Vault the card first to get a reusable token, then charge with it.
          // Vaulting consumes the single-use token, so we must vault BEFORE charging.
          let vaultedPaymentMethodId: string | null = null;
          try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            const vaultResponse = await fetch('/api/vault-payment-method', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authSession?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                token: paymentData.token,
                organizationId: selectedOrgId,
                paymentType: 'credit_card',
                label: paymentData.paymentMethodLabel || `Card ****${paymentData.lastFour}`,
                lastFour: paymentData.lastFour,
                expiryMonth: parseInt(paymentData.expiryMonth),
                expiryYear: parseInt('20' + paymentData.expiryYear),
                accountHolderName: paymentData.cardholderName,
                turnstileToken: turnstileToken || undefined,
              }),
            });

            const vaultResult = await vaultResponse.json();
            if (!vaultResponse.ok || vaultResult.error) {
              // Vault failed — the single-use token may already be consumed by the
              // vault attempt, so we cannot safely fall back to a direct charge.
              console.error('[Checkout] Failed to vault card:', vaultResult.error, 'intuit_tid:', vaultResult.intuit_tid);
              activityLogService.logAction({
                userId: user.id,
                action: 'checkout_vault_failed',
                resourceType: 'checkout',
                resourceId: sessionId,
                details: { error: vaultResult.error, step: 'vault_card', organization_id: selectedOrgId, intuit_tid: vaultResult.intuit_tid },
              });
              setError('Unable to save your payment method. Please uncheck "Save for this organization" and try again, or use a different payment method.');
              setCurrentStep('payment');
              setLoading(false);
              return;
            }
            // Vault succeeded — track the saved ID so we can clean up on charge failure
            vaultedPaymentMethodId = vaultResult.paymentMethodId;
            // Charge using the reusable card-on-file ID
            authResponse = await quickbooksPayments.authorizeCardOnFile(
              total, vaultResult.reusableToken, 'USD',
              `Order from checkout session ${sessionId}`
            );
          } catch (vaultErr) {
            // Network/parse error — token may be consumed, cannot fall back safely
            const vaultErrMsg = vaultErr instanceof Error ? vaultErr.message : 'Unknown vault error';
            console.error('[Checkout] Card vault error:', vaultErrMsg, vaultErr);
            activityLogService.logAction({
              userId: user.id,
              action: 'checkout_vault_failed',
              resourceType: 'checkout',
              resourceId: sessionId,
              details: { error: vaultErrMsg, step: 'vault_card_exception', organization_id: selectedOrgId },
            });
            setError('Unable to save your payment method. Please uncheck "Save for this organization" and try again, or use a different payment method.');
            setCurrentStep('payment');
            setLoading(false);
            return;
          }

          // If charge was declined, clean up the orphaned saved payment method
          if (authResponse.status === 'DECLINED') {
            console.warn('[Checkout] Card payment declined:', { sessionId, lastFour: paymentData.lastFour });
            if (vaultedPaymentMethodId) {
              try {
                await quickbooksPayments.deletePaymentMethod(vaultedPaymentMethodId);
              } catch (delErr) {
                console.warn('Failed to clean up saved payment method after decline:', delErr);
              }
            }
            setError('Your payment was declined. Please try a different payment method.');
            setCurrentStep('payment');
            setLoading(false);
            return;
          }
        } else {
          // No save requested — use single-use token directly
          authResponse = await quickbooksPayments.authorizeCard(
            total, paymentData.token, 'USD',
            `Order from checkout session ${sessionId}`
          );

          if (authResponse.status === 'DECLINED') {
            console.warn('Card payment declined:', { sessionId, lastFour: paymentData.lastFour });
            setError('Your payment was declined. Please try a different payment method.');
            setCurrentStep('payment');
            setLoading(false);
            return;
          }
        }

        paymentAuthId = authResponse.id;
        paymentLastFour = paymentData.lastFour;
      } else if (paymentData.type === 'ach') {
        let achResponse;

        if (paymentData.savePaymentMethod && selectedOrgId && user?.id) {
          // Vault the bank account first, then charge with the reusable ID.
          // Vaulting consumes the single-use token, so we cannot fall back to a direct charge.
          let vaultedPaymentMethodId: string | null = null;
          try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            const acctTypeLower = paymentData.accountType.toLowerCase();
            const vaultResponse = await fetch('/api/vault-payment-method', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authSession?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                token: paymentData.token,
                organizationId: selectedOrgId,
                paymentType: 'ach',
                label: paymentData.paymentMethodLabel || `Bank ****${paymentData.lastFour}`,
                lastFour: paymentData.lastFour,
                accountHolderName: paymentData.accountHolderName,
                accountType: acctTypeLower.includes('checking') ? 'checking' : 'savings',
                turnstileToken: turnstileToken || undefined,
              }),
            });

            const vaultResult = await vaultResponse.json();
            if (!vaultResponse.ok || vaultResult.error) {
              // Vault failed — the single-use token may already be consumed,
              // so we cannot safely fall back to a direct charge.
              console.error('Failed to vault bank account:', vaultResult.error);
              setError('Unable to save your payment method. Please uncheck "Save for this organization" and try again, or use a different payment method.');
              setCurrentStep('payment');
              setLoading(false);
              return;
            }
            // Vault succeeded — track the saved ID so we can clean up on charge failure
            vaultedPaymentMethodId = vaultResult.paymentMethodId;
            // Charge using the reusable bank-on-file ID
            achResponse = await quickbooksPayments.processACHWithToken(
              total, vaultResult.reusableToken, 'USD',
              `Order from checkout session ${sessionId}`
            );
          } catch (vaultErr) {
            // Network/parse error — token may be consumed, cannot fall back safely
            console.error('Vault error:', vaultErr);
            setError('Unable to save your payment method. Please uncheck "Save for this organization" and try again, or use a different payment method.');
            setCurrentStep('payment');
            setLoading(false);
            return;
          }

          // If charge was declined, clean up the orphaned saved payment method
          if (achResponse.status === 'DECLINED') {
            console.warn('ACH payment declined:', { sessionId, lastFour: paymentData.lastFour });
            if (vaultedPaymentMethodId) {
              try {
                await quickbooksPayments.deletePaymentMethod(vaultedPaymentMethodId);
              } catch (delErr) {
                console.warn('Failed to clean up saved payment method after decline:', delErr);
              }
            }
            setError('Your payment was declined. Please try a different payment method.');
            setCurrentStep('payment');
            setLoading(false);
            return;
          }
        } else {
          achResponse = await quickbooksPayments.processACHWithToken(
            total, paymentData.token, 'USD',
            `Order from checkout session ${sessionId}`
          );

          if (achResponse.status === 'DECLINED') {
            console.warn('ACH payment declined:', { sessionId, lastFour: paymentData.lastFour });
            setError('Your payment was declined. Please try a different payment method.');
            setCurrentStep('payment');
            setLoading(false);
            return;
          }
        }

        paymentAuthId = achResponse.id;
        paymentLastFour = paymentData.lastFour;
        paymentStatus = 'pending';
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
            turnstileToken: turnstileToken || undefined,
          }),
        });

        const savedResult = await savedResponse.json();
        if (!savedResponse.ok || savedResult.error) {
          if (savedResult.invalidPaymentMethod) {
            // Token is expired/invalid — auto-delete the bad method and prompt re-entry
            try {
              await quickbooksPayments.deletePaymentMethod(paymentData.paymentMethodId);
            } catch (delErr) {
              console.warn('Failed to auto-delete invalid payment method:', delErr);
            }
            setError('This saved payment method is no longer valid and has been removed. Please enter your payment details again.');
            setCurrentStep('payment');
            setLoading(false);
            return;
          }
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

      const isTestOrder = testMode && profile?.role === 'admin';

      // Determine method label for storage
      const methodLabel = paymentData.type === 'card' ? 'credit_card'
        : paymentData.type === 'ach' ? 'ach'
        : paymentData.type === 'saved' ? (paymentData.paymentType === 'ach' || paymentData.paymentType === 'bank_account' ? 'saved_ach' : 'saved_card')
        : 'credit_card';

      const result = await restCheckoutService.processPayment(
        sessionId,
        checkoutId,
        sanitizedPaymentData,
        paymentAuthId,
        {
          is_test_order: isTestOrder || undefined,
          paymentStatus,
          paymentMethod: isTestOrder ? 'test' : methodLabel,
          paymentLastFour: paymentLastFour,
        }
      );

      if (result.success && result.orderId) {
        // Payment fields are set atomically in the order INSERT via processPayment.
        // No separate updatePaymentStatus call — it would be blocked by RLS for customers.
        const { orderService } = await import('@/services/orderService');

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

        // Log payment event — logPaymentEvent updates orders.notes which requires
        // admin-level UPDATE on orders. Use activity log (user_activity_log) as the
        // primary record since customers can INSERT into it.
        activityLogService.logAction({
          userId: user.id,
          action: 'order_placed',
          resourceType: 'order',
          resourceId: result.orderId,
          details: {
            event: paymentStatus === 'authorized' ? 'authorization' : 'payment_initiated',
            payment_status: paymentStatus,
            payment_method: methodLabel,
            last_four: paymentLastFour,
            transaction_id: paymentAuthId,
            amount: total,
            organization_id: selectedOrgId,
            session_id: sessionId,
          },
        });
        // Also attempt to log to order notes (will succeed for admins, silently fail for customers)
        orderService.logPaymentEvent(result.orderId, {
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
        const errorMsg = result.error || 'Failed to process payment';
        console.error('[Checkout] Order creation failed:', errorMsg);
        activityLogService.logAction({
          userId: user.id,
          action: 'checkout_order_failed',
          resourceType: 'checkout',
          resourceId: sessionId,
          details: {
            error: errorMsg,
            step: 'order_creation',
            organization_id: selectedOrgId,
            payment_type: paymentData.type,
            amount: total,
          },
        });
        setError(errorMsg);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      const isDecline = msg.toLowerCase().includes('decline');
      console.error('[Checkout] Place order error:', msg, err);
      activityLogService.logAction({
        userId: user.id,
        action: 'checkout_payment_failed',
        resourceType: 'checkout',
        resourceId: sessionId,
        details: {
          error: msg || 'Unknown error',
          step: 'place_order',
          organization_id: selectedOrgId,
          payment_type: paymentData?.type,
          amount: total,
          is_decline: isDecline,
        },
      });
      if (isDecline) {
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
    if (!useManualAddress && showAddressSelector) {
      return (
        <div className="space-y-6">
          <AddressSelector
            userId={selectedCustomerId}
            organizationId={selectedOrgId}
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
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input
            type="text"
            value={shippingAddress.firstName}
            onChange={(e) => { setShippingAddress({...shippingAddress, firstName: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['shipping.firstName']; return n; }); }}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['shipping.firstName'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          {fieldErrors['shipping.firstName'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['shipping.firstName']}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input
            type="text"
            value={shippingAddress.lastName}
            onChange={(e) => { setShippingAddress({...shippingAddress, lastName: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['shipping.lastName']; return n; }); }}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['shipping.lastName'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          {fieldErrors['shipping.lastName'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['shipping.lastName']}</p>}
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
          onChange={(e) => { setShippingAddress({...shippingAddress, address1: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['shipping.address1']; return n; }); }}
          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['shipping.address1'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          placeholder="Street address"
        />
        {fieldErrors['shipping.address1'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['shipping.address1']}</p>}
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
            onChange={(e) => { setShippingAddress({...shippingAddress, city: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['shipping.city']; return n; }); }}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['shipping.city'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          {fieldErrors['shipping.city'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['shipping.city']}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
          <input
            type="text"
            value={shippingAddress.state}
            onChange={(e) => { setShippingAddress({...shippingAddress, state: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['shipping.state']; return n; }); }}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['shipping.state'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          {fieldErrors['shipping.state'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['shipping.state']}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
          <input
            type="text"
            value={shippingAddress.postalCode}
            onChange={(e) => { setShippingAddress({...shippingAddress, postalCode: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['shipping.postalCode']; return n; }); }}
            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['shipping.postalCode'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          />
          {fieldErrors['shipping.postalCode'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['shipping.postalCode']}</p>}
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
              onChange={(e) => { setShippingAddressLabel(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n['shipping.label']; return n; }); }}
              placeholder="e.g., Home, Office, Warehouse"
              className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${fieldErrors['shipping.label'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
            />
            {fieldErrors['shipping.label'] ? (
              <p className="text-xs text-red-600 mt-1">{fieldErrors['shipping.label']}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Give this address a memorable name</p>
            )}
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
                onChange={(e) => { setBillingAddress({...billingAddress, firstName: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['billing.firstName']; return n; }); }}
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['billing.firstName'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors['billing.firstName'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['billing.firstName']}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={billingAddress.lastName}
                onChange={(e) => { setBillingAddress({...billingAddress, lastName: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['billing.lastName']; return n; }); }}
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['billing.lastName'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors['billing.lastName'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['billing.lastName']}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
            <input
              type="text"
              value={billingAddress.address1}
              onChange={(e) => { setBillingAddress({...billingAddress, address1: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['billing.address1']; return n; }); }}
              className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['billing.address1'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
            />
            {fieldErrors['billing.address1'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['billing.address1']}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                value={billingAddress.city}
                onChange={(e) => { setBillingAddress({...billingAddress, city: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['billing.city']; return n; }); }}
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['billing.city'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors['billing.city'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['billing.city']}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input
                type="text"
                value={billingAddress.state}
                onChange={(e) => { setBillingAddress({...billingAddress, state: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['billing.state']; return n; }); }}
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['billing.state'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors['billing.state'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['billing.state']}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
              <input
                type="text"
                value={billingAddress.postalCode}
                onChange={(e) => { setBillingAddress({...billingAddress, postalCode: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['billing.postalCode']; return n; }); }}
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['billing.postalCode'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors['billing.postalCode'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['billing.postalCode']}</p>}
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
        <input
          type="email"
          value={billingAddress.email}
          onChange={(e) => { setBillingAddress({...billingAddress, email: e.target.value}); setFieldErrors(prev => { const n = {...prev}; delete n['billing.email']; return n; }); }}
          className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors['billing.email'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
        />
        {fieldErrors['billing.email'] && <p className="text-xs text-red-600 mt-1">{fieldErrors['billing.email']}</p>}
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
                onChange={(e) => { setBillingAddressLabel(e.target.value); setFieldErrors(prev => { const n = {...prev}; delete n['billing.label']; return n; }); }}
                placeholder="e.g., Business Address, Corporate HQ"
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent ${fieldErrors['billing.label'] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              />
              {fieldErrors['billing.label'] ? (
                <p className="text-xs text-red-600 mt-1">{fieldErrors['billing.label']}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Give this billing address a memorable name</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleBack}
          className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Payment Information</h3>
        </div>
        {profile?.role === 'admin' && (
          <button
            type="button"
            onClick={() => setTestMode(!testMode)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              testMode
                ? 'bg-amber-100 border-2 border-amber-400 text-amber-800'
                : 'bg-gray-100 border-2 border-transparent text-gray-500 hover:bg-gray-200'
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            <span>Test Mode {testMode ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>

      {testMode && profile?.role === 'admin' ? (
        <div className="space-y-4">
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <FlaskConical className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800">Admin Test Mode</p>
                <p className="text-sm text-amber-700 mt-1">
                  No credit card will be charged. A simulated transaction will be created and the order will be flagged as a test order.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPaymentData({
                type: 'card',
                token: 'TEST-TOKEN',
                lastFour: '0000',
                cardholderName: 'Test Order',
                expiryMonth: '12',
                expiryYear: '99',
                savePaymentMethod: false,
              } as PaymentData);
              setCurrentStep('review');
            }}
            className="w-full py-3 px-6 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-semibold flex items-center justify-center space-x-2"
          >
            <FlaskConical className="h-5 w-5" />
            <span>Continue with Test Payment</span>
          </button>
        </div>
      ) : (
        <PaymentForm
          onPaymentReady={() => {}}
          onPaymentSubmit={(data) => {
            setPaymentData(data);
            setCurrentStep('review');
          }}
          billingAddress={billingAddress}
          total={total}
          organizationId={selectedOrgId}
        />
      )}
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

      {testMode && profile?.role === 'admin' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 flex items-center space-x-3">
          <FlaskConical className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            TEST ORDER — No payment will be charged
          </p>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">Payment Method</p>
            <p className="text-sm text-gray-600">{testMode ? 'Test Mode — No charge' : getPaymentSummary()}</p>
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
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={e => e.stopPropagation()}>
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

            {!loading && !error && currentStep === 'shipping' && renderShippingStep()}
            {!loading && !error && currentStep === 'billing' && renderBillingStep()}
            {!loading && !error && currentStep === 'payment' && renderPaymentStep()}
            {!loading && !error && currentStep === 'review' && renderReviewStep()}
            {!loading && !error && currentStep === 'confirmation' && renderConfirmationStep()}

            {/* Inline field validation errors banner — shown above the form footer */}
            {Object.keys(fieldErrors).length > 0 && !error && !loading && (
              <div className="mx-6 mt-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-medium">Please fix the following:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {Object.values(fieldErrors).map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation — hidden on customer, confirmation, and payment steps */}
          {/* Payment step has its own submit button inside PaymentForm */}
          {!loading && !error && currentStep !== 'customer' && currentStep !== 'confirmation' && currentStep !== 'payment' && (
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              {currentStep === 'review' && !(testMode && profile?.role === 'admin') && (
                <div className="mb-4 flex justify-center">
                  <TurnstileWidget
                    onVerify={(token) => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken(null)}
                    onError={() => setTurnstileToken('bypass')}
                    action="checkout"
                  />
                </div>
              )}
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
                    disabled={loading || (!(testMode && profile?.role === 'admin') && !turnstileToken)}
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