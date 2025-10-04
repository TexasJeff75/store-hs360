import { X, Plus, Minus, ShoppingBag, ExternalLink } from 'lucide-react';
import { useBCCart } from '../hooks/useBCCart';

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Cart({ isOpen, onClose }: CartProps) {
  const { cart, updateItemQuantity, removeItem, total, itemCount, getCheckoutUrl, loading } = useBCCart();

  const items = cart?.line_items.physical_items || [];

  const handleCheckout = async () => {
    try {
      const checkoutUrl = await getCheckoutUrl();
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error('Failed to get checkout URL:', err);
      alert('Failed to proceed to checkout. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            Cart ({itemCount})
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <ShoppingBag className="w-16 h-16 mb-4 opacity-50" />
              <p>Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg"
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {item.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      ${item.sale_price.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateItemQuantity(item.id, item.product_id, item.quantity - 1)
                        }
                        disabled={loading}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateItemQuantity(item.id, item.product_id, item.quantity + 1)
                        }
                        disabled={loading}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={loading}
                        className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 rounded disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-gray-900 dark:text-white">
                ${total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : 'Proceed to Checkout'}
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
