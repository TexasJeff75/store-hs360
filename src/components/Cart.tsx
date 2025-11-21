import React from 'react';
import { X, Plus, Minus, ShoppingBag, AlertCircle, Tag, Building2 } from 'lucide-react';
import CheckoutModal from './checkout/CheckoutModal';
import PriceDisplay from './PriceDisplay';
import { useContractPricing } from '../hooks/useContractPricing';
import { multiTenantService } from '../services/multiTenant';

interface CartItem {
  id: number;
  name: string;
  price: number;
  retailPrice?: number;
  cost?: number;
  quantity: number;
  image: string;
  hasMarkup?: boolean;
}

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveItem: (id: number) => void;
  onClearCart: () => void;
  organizationId?: string;
}

const CartItemRow: React.FC<{
  item: CartItem;
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemoveItem: (id: number) => void;
  organizationId?: string;
}> = ({ item, onUpdateQuantity, onRemoveItem, organizationId }) => {
  const { price } = useContractPricing(item.id, item.price, item.quantity, organizationId);
  const itemTotal = price * item.quantity;
  const [quantityInput, setQuantityInput] = React.useState(item.quantity.toString());

  React.useEffect(() => {
    setQuantityInput(item.quantity.toString());
  }, [item.quantity]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setQuantityInput(value);
  };

  const handleQuantityBlur = () => {
    const numValue = quantityInput === '' ? 1 : Math.min(999999, Math.max(1, parseInt(quantityInput)));
    setQuantityInput(numValue.toString());
    if (numValue !== item.quantity) {
      onUpdateQuantity(item.id, numValue);
    }
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleQuantityBlur();
    }
  };

  return (
    <div className="flex items-center space-x-4 bg-gray-50 rounded-lg p-4">
      <img
        src={item.image}
        alt={item.name}
        className="w-16 h-16 object-cover rounded-lg"
      />
      <div className="flex-1">
        <h3 className="font-medium text-gray-900 text-sm">{item.name}</h3>
        <PriceDisplay
          productId={item.id}
          regularPrice={item.price}
          quantity={item.quantity}
          organizationId={organizationId}
          showSavings={false}
          className="mt-1"
        />
        <div className="text-xs text-gray-500 mt-1">
          Item total: ${itemTotal.toFixed(2)}
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center space-x-2 mt-2">
          <button
            onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={quantityInput}
            onChange={handleQuantityChange}
            onBlur={handleQuantityBlur}
            onKeyDown={handleQuantityKeyDown}
            className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={6}
          />
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => onRemoveItem(item.id)}
            className="ml-auto text-red-500 hover:text-red-700 transition-colors text-sm"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

const CartItemPrice: React.FC<{
  item: CartItem;
  organizationId?: string;
  onPriceCalculated: (itemId: number, price: number, isContract: boolean) => void;
}> = ({ item, organizationId, onPriceCalculated }) => {
  const { price, source } = useContractPricing(item.id, item.price, item.quantity, organizationId);

  React.useEffect(() => {
    const isContract = source !== 'regular';
    onPriceCalculated(item.id, price * item.quantity, isContract);
  }, [item.id, price, item.quantity, source, onPriceCalculated]);

  return null;
};

const CartTotal: React.FC<{
  items: CartItem[];
  organizationId?: string;
}> = ({ items, organizationId }) => {
  const [itemPrices, setItemPrices] = React.useState<Record<number, { total: number; isContract: boolean }>>({});

  const handlePriceCalculated = React.useCallback((itemId: number, price: number, isContract: boolean) => {
    setItemPrices(prev => ({
      ...prev,
      [itemId]: { total: price, isContract }
    }));
  }, []);

  const total = Object.values(itemPrices).reduce((sum, item) => sum + item.total, 0);
  const hasContractPricing = Object.values(itemPrices).some(item => item.isContract);

  return (
    <div>
      {items.map(item => (
        <CartItemPrice
          key={item.id}
          item={item}
          organizationId={organizationId}
          onPriceCalculated={handlePriceCalculated}
        />
      ))}
      <div className="flex items-center justify-between mb-4">
        <span className="text-lg font-semibold text-gray-900">Total:</span>
        <span className="text-2xl font-bold text-blue-600">${total.toFixed(2)}</span>
      </div>
      {hasContractPricing && (
        <div className="flex items-center space-x-1 text-xs text-green-600 mb-3">
          <Tag className="h-3 w-3" />
          <span>Special pricing applied</span>
        </div>
      )}
    </div>
  );
};

const Cart: React.FC<CartProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  organizationId,
}) => {
  const [isCheckoutOpen, setIsCheckoutOpen] = React.useState(false);
  const [showOrgWarning, setShowOrgWarning] = React.useState(false);
  const [organizationName, setOrganizationName] = React.useState<string>('');

  React.useEffect(() => {
    const fetchOrganizationName = async () => {
      if (organizationId) {
        try {
          const org = await multiTenantService.getOrganizationById(organizationId);
          setOrganizationName(org?.name || '');
        } catch (error) {
          console.error('Error fetching organization name:', error);
          setOrganizationName('');
        }
      } else {
        setOrganizationName('');
      }
    };

    fetchOrganizationName();
  }, [organizationId]);

  const handleCheckoutClick = () => {
    if (!organizationId) {
      setShowOrgWarning(true);
      setTimeout(() => setShowOrgWarning(false), 5000);
    }
    setIsCheckoutOpen(true);
  };

  const handleOrderComplete = (orderId: string) => {
    console.log('Order completed:', orderId);
    // Clear the cart
    onClearCart();
    // Close checkout modal
    setIsCheckoutOpen(false);
    // Close cart
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Shopping Cart</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            {organizationName && (
              <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">{organizationName}</span>
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-6">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <ShoppingBag className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium">Your cart is empty</p>
                <p className="text-sm">Add some products to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map(item => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemoveItem={onRemoveItem}
                    organizationId={organizationId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-gray-200 p-6">
              <CartTotal items={items} organizationId={organizationId} />

              <div className="space-y-3">
                {showOrgWarning && !organizationId && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-yellow-800">
                        You will need to select an organization during checkout
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleCheckoutClick}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Checkout
                </button>
                <button
                  onClick={onClose}
                  className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={items}
        onOrderComplete={handleOrderComplete}
        organizationId={organizationId}
      />
    </div>
  );
};

export default Cart;