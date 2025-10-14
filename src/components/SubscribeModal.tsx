import React, { useState, useEffect } from 'react';
import { X, Repeat, Calendar, Package, TrendingDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService } from '../services/subscriptionService';
import { customerAddressService } from '../services/customerAddresses';
import { getPaymentMethods } from '../services/paymentMethods';

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
  productPrice: number;
}

const SubscribeModal: React.FC<SubscribeModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  productPrice
}) => {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [frequencyInterval, setFrequencyInterval] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const discountPercentage = 10;

  useEffect(() => {
    if (isOpen && user?.id) {
      loadUserData();
    }
  }, [isOpen, user]);

  const loadUserData = async () => {
    if (!user?.id) return;

    const userAddresses = await customerAddressService.getUserAddresses(user.id);
    setAddresses(userAddresses);
    if (userAddresses.length > 0) {
      setSelectedAddressId(userAddresses[0].id);
    }

    const methods = await getPaymentMethods(user.id);
    setPaymentMethods(methods);
    if (methods.length > 0) {
      setSelectedPaymentId(methods[0].id);
    }
  };

  const calculateSavings = () => {
    const regularTotal = productPrice * quantity;
    const discount = regularTotal * (discountPercentage / 100);
    return discount;
  };

  const calculateSubscriptionPrice = () => {
    const regularTotal = productPrice * quantity;
    const discount = regularTotal * (discountPercentage / 100);
    return regularTotal - discount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);

    const subscription = await subscriptionService.createSubscription({
      user_id: user.id,
      product_id: productId,
      quantity,
      frequency,
      frequency_interval: frequencyInterval,
      start_date: startDate,
      shipping_address_id: selectedAddressId || undefined,
      payment_method_id: selectedPaymentId || undefined,
      discount_percentage: discountPercentage,
      notes: notes || undefined
    });

    setLoading(false);

    if (subscription) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setQuantity(1);
        setFrequency('monthly');
        setFrequencyInterval(1);
        setNotes('');
      }, 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {success ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <Repeat className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription Created!</h3>
              <p className="text-gray-600">Your subscription has been set up successfully.</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                      <Repeat className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Subscribe & Save</h3>
                      <p className="text-purple-100 text-sm">Get {discountPercentage}% off with recurring delivery</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white hover:text-purple-200"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="mb-4">
                  <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                    <Package className="h-5 w-5 text-gray-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{productName}</h4>
                      <p className="text-sm text-gray-600">${productPrice.toFixed(2)} per unit</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    <option value="weekly">Every Week</option>
                    <option value="biweekly">Every 2 Weeks</option>
                    <option value="monthly">Every Month</option>
                    <option value="quarterly">Every 3 Months</option>
                    <option value="yearly">Every Year</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                {addresses.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shipping Address
                    </label>
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select Address</option>
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.address_line1}, {address.city}, {address.state}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {paymentMethods.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={selectedPaymentId}
                      onChange={(e) => setSelectedPaymentId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select Payment Method</option>
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.payment_type} ending in {method.last_four}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Any special instructions..."
                  />
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <TrendingDown className="h-5 w-5" />
                    <span className="font-semibold">Subscription Savings</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Regular Price:</span>
                      <span>${(productPrice * quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-700 font-semibold">
                      <span>You Save ({discountPercentage}%):</span>
                      <span>-${calculateSavings().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-green-200 pt-2 mt-2">
                      <span>Subscription Price:</span>
                      <span>${calculateSubscriptionPrice().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Subscription...' : 'Subscribe Now'}
                </button>

                <p className="text-xs text-center text-gray-500 mt-4">
                  You can pause, modify, or cancel your subscription anytime
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscribeModal;
