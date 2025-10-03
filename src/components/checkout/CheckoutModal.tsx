import React, { useState, useEffect, useRef } from 'react';
import { X, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { checkoutService } from '@/services/checkout';
import { createCheckoutService } from '@bigcommerce/checkout-sdk';

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

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  onOrderComplete
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const checkoutContainerRef = useRef<HTMLDivElement>(null);
  const checkoutServiceRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isOpen && items.length > 0 && !checkoutId && !isInitializedRef.current) {
      isInitializedRef.current = true;
      initializeCheckout();
    }
  }, [isOpen, items, checkoutId]);

  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      setCheckoutId(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (checkoutServiceRef.current) {
        checkoutServiceRef.current = null;
      }
    };
  }, []);

  const initializeCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Initializing checkout with items:', items);

      const lineItems = items.map(item => ({
        productId: item.id,
        quantity: item.quantity
      }));

      const result = await checkoutService.processCheckout(lineItems);
      console.log('Checkout service result:', result);

      if (result.success && result.checkoutId) {
        setCheckoutId(result.checkoutId);
        setTimeout(() => loadCheckoutSDK(result.checkoutId!), 100);
      } else {
        setError(result.error || 'Failed to initialize checkout');
        setLoading(false);
      }
    } catch (err) {
      console.error('Checkout initialization error:', err);
      setError(`Failed to initialize checkout: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const loadCheckoutSDK = async (checkoutIdValue: string) => {
    try {
      console.log('Loading checkout SDK with ID:', checkoutIdValue);

      const service = createCheckoutService();
      checkoutServiceRef.current = service;

      console.log('Loading checkout state...');
      const state = await service.loadCheckout(checkoutIdValue);
      console.log('Checkout state loaded:', state);

      console.log('Rendering checkout...');
      await service.renderCheckout({
        containerId: 'checkout-container',
      });
      console.log('Checkout rendered successfully');

      service.subscribe((state) => {
        console.log('Checkout state change:', state);
        if (state.data.getOrder()) {
          const order = state.data.getOrder();
          console.log('Order completed:', order);
          onOrderComplete(order?.orderId?.toString() || checkoutIdValue);
          onClose();
        }
      });

      setLoading(false);
    } catch (err) {
      console.error('Error loading checkout SDK:', err);
      setError(`Failed to load checkout: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderCheckoutContent = () => {
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
            <h3 className="text-lg font-semibold text-red-900 mb-2">Checkout Error</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={initializeCheckout}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return (
      <div id="checkout-container" ref={checkoutContainerRef} className="min-h-[600px]" />
    );
  };


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
            {renderCheckoutContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;