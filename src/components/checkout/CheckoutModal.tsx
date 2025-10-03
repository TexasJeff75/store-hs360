import React, { useState, useEffect } from 'react';
import { X, Loader, ExternalLink } from 'lucide-react';
import { checkoutService } from '@/services/checkout';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && items.length > 0 && !checkoutUrl) {
      initializeCheckout();
    }
  }, [isOpen, items]);

  useEffect(() => {
    if (!isOpen) {
      setCheckoutUrl(null);
      setError(null);
    }
  }, [isOpen]);

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

      if (result.success && result.checkoutUrl) {
        setCheckoutUrl(result.checkoutUrl);
        window.location.href = result.checkoutUrl;
      } else {
        setError(result.error || 'Failed to initialize checkout');
      }
    } catch (err) {
      console.error('Checkout initialization error:', err);
      setError(`Failed to initialize checkout: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderCheckoutContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
          <Loader className="h-12 w-12 text-blue-600 animate-spin" />
          <p className="text-gray-600">Redirecting to secure checkout...</p>
          <p className="text-sm text-gray-500">You will be redirected to BigCommerce to complete your purchase</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
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

    if (checkoutUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
          <ExternalLink className="h-12 w-12 text-blue-600" />
          <p className="text-gray-600">Redirecting to checkout...</p>
          <a
            href={checkoutUrl}
            className="text-blue-600 hover:underline"
          >
            Click here if you are not redirected automatically
          </a>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Checkout</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            {renderCheckoutContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
