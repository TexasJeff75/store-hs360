import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { recurringOrderService, RecurringOrder } from '../services/recurringOrderService';
import { customerAddressService, CustomerAddress } from '../services/customerAddresses';
import { supabase } from '../services/supabase';

interface EditRecurringOrderModalProps {
  order: RecurringOrder;
  productName: string;
  onClose: () => void;
  onSaved: () => void;
}

interface PaymentMethod {
  id: string;
  card_brand: string;
  last_four: string;
  nickname: string | null;
}

const EditRecurringOrderModal: React.FC<EditRecurringOrderModalProps> = ({ order, productName, onClose, onSaved }) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [quantity, setQuantity] = useState(order.quantity);
  const [frequency, setFrequency] = useState(order.frequency);
  const [frequencyInterval, setFrequencyInterval] = useState(order.frequency_interval);
  const [nextOrderDate, setNextOrderDate] = useState(order.next_order_date);
  const [shippingAddressId, setShippingAddressId] = useState(order.shipping_address_id || '');
  const [paymentMethodId, setPaymentMethodId] = useState(order.payment_method_id || '');
  const [notes, setNotes] = useState(order.notes || '');

  useEffect(() => {
    if (user?.id) {
      loadAddresses();
      loadPaymentMethods();
    }
  }, [user]);

  const loadAddresses = async () => {
    if (!user?.id) return;
    const data = await customerAddressService.getUserAddresses(user.id, 'shipping');
    setAddresses(data);
  };

  const loadPaymentMethods = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('payment_methods')
      .select('id, card_brand, last_four, nickname')
      .eq('user_id', user.id)
      .eq('is_active', true);
    setPaymentMethods(data || []);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await recurringOrderService.updateRecurringOrder(order.id, {
      quantity,
      frequency,
      frequency_interval: frequencyInterval,
      next_order_date: nextOrderDate,
      shipping_address_id: shippingAddressId || undefined,
      payment_method_id: paymentMethodId || undefined,
      notes: notes || undefined,
    });

    setSaving(false);
    if (result) {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.stopPropagation()}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Edit Recurring Order</h3>
            <p className="text-sm text-gray-500 mt-1">{productName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as RecurringOrder['frequency'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interval</label>
              <input
                type="number"
                min={1}
                value={frequencyInterval}
                onChange={e => setFrequencyInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Order Date</label>
            <input
              type="date"
              value={nextOrderDate}
              onChange={e => setNextOrderDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {addresses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
              <select
                value={shippingAddressId}
                onChange={e => setShippingAddressId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No preference</option>
                {addresses.map(addr => (
                  <option key={addr.id} value={addr.id}>
                    {addr.label} - {addr.address1}, {addr.city}
                  </option>
                ))}
              </select>
            </div>
          )}

          {paymentMethods.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethodId}
                onChange={e => setPaymentMethodId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No preference</option>
                {paymentMethods.map(pm => (
                  <option key={pm.id} value={pm.id}>
                    {pm.nickname || pm.card_brand} ending in {pm.last_four}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Optional delivery instructions..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditRecurringOrderModal;
