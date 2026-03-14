import React, { useState, useMemo } from 'react';
import { X, DollarSign, Loader, AlertTriangle, Truck, Package, RotateCcw } from 'lucide-react';
import type { Order } from './types';

interface Commission {
  id: string;
  status: string;
  commission_amount: number;
  sales_rep_commission?: number;
  distributor_commission?: number;
  profiles?: { full_name?: string; email?: string };
}

interface RefundModalProps {
  order: Order;
  commission: Commission | null;
  onClose: () => void;
  onSubmit: (options: {
    amount: number;
    includeShipping: boolean;
    cancelCommission: boolean;
    reason: string;
  }) => Promise<void>;
}

type RefundType = 'full' | 'items_only' | 'custom';

const RefundModal: React.FC<RefundModalProps> = ({ order, commission, onClose, onSubmit }) => {
  const [refundType, setRefundType] = useState<RefundType>('full');
  const [includeShipping, setIncludeShipping] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [cancelCommission, setCancelCommission] = useState(true);
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const subtotal = Number(order.subtotal) || 0;
  const shipping = Number(order.shipping) || 0;
  const tax = Number(order.tax) || 0;
  const total = Number(order.total) || 0;

  const refundAmount = useMemo(() => {
    if (refundType === 'full') {
      return total;
    }
    if (refundType === 'items_only') {
      return includeShipping ? subtotal + tax + shipping : subtotal + tax;
    }
    if (refundType === 'custom') {
      const val = parseFloat(customAmount);
      return isNaN(val) ? 0 : val;
    }
    return 0;
  }, [refundType, includeShipping, customAmount, subtotal, shipping, tax, total]);

  const isValid = refundAmount > 0 && refundAmount <= total && reason.trim().length > 0;

  const hasCommission = commission && commission.status !== 'cancelled';
  const commissionIsPaid = commission?.status === 'paid';

  const handleSubmit = async () => {
    if (!isValid) return;
    setProcessing(true);
    setError('');
    try {
      await onSubmit({
        amount: refundAmount,
        includeShipping: refundType === 'full' || includeShipping,
        cancelCommission: cancelCommission && !!hasCommission && !commissionIsPaid,
        reason: reason.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Refund failed');
      setProcessing(false);
    }
  };

  const isPartial = refundAmount < total;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <RotateCcw className="h-5 w-5 mr-2 text-red-600" />
            Refund Payment
          </h3>
          <button
            onClick={onClose}
            disabled={processing}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <div className="font-medium text-gray-700 mb-2">Order #{order.order_number || order.id.slice(0, 8)}</div>
            <div className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal ({order.items?.length || 0} items)</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              )}
              {shipping > 0 && (
                <div className="flex justify-between">
                  <span className="flex items-center"><Truck className="h-3 w-3 mr-1" />Shipping</span>
                  <span>${shipping.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
                <span>Total Charged</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Refund Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Refund Type</label>
            <div className="space-y-2">
              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="refundType"
                  value="full"
                  checked={refundType === 'full'}
                  onChange={() => setRefundType('full')}
                  className="mt-0.5 mr-3"
                />
                <div>
                  <div className="font-medium text-sm text-gray-900">Full Refund</div>
                  <div className="text-xs text-gray-500">
                    Refund entire amount including shipping — ${total.toFixed(2)}
                  </div>
                </div>
              </label>

              {shipping > 0 && (
                <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="refundType"
                    value="items_only"
                    checked={refundType === 'items_only'}
                    onChange={() => setRefundType('items_only')}
                    className="mt-0.5 mr-3"
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900">Items Only (Exclude Shipping)</div>
                    <div className="text-xs text-gray-500">
                      Refund items + tax but keep shipping — ${(subtotal + tax).toFixed(2)}
                    </div>
                  </div>
                </label>
              )}

              <label className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="refundType"
                  value="custom"
                  checked={refundType === 'custom'}
                  onChange={() => setRefundType('custom')}
                  className="mt-0.5 mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">Custom Amount</div>
                  <div className="text-xs text-gray-500 mb-2">Enter a specific refund amount</div>
                  {refundType === 'custom' && (
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={total}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        autoFocus
                      />
                      <div className="text-xs text-gray-400 mt-1">Max: ${total.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Shipping toggle for items_only */}
          {refundType === 'items_only' && shipping > 0 && (
            <label className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeShipping}
                onChange={(e) => setIncludeShipping(e.target.checked)}
                className="mr-3"
              />
              <div>
                <div className="text-sm font-medium text-blue-900">Also refund shipping</div>
                <div className="text-xs text-blue-700">Add ${shipping.toFixed(2)} shipping to the refund</div>
              </div>
            </label>
          )}

          {/* Commission Section */}
          {hasCommission && (
            <div className={`p-3 rounded-lg border ${commissionIsPaid ? 'bg-yellow-50 border-yellow-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="flex items-start">
                <DollarSign className={`h-4 w-4 mt-0.5 mr-2 ${commissionIsPaid ? 'text-yellow-600' : 'text-orange-600'}`} />
                <div className="flex-1">
                  <div className={`text-sm font-medium ${commissionIsPaid ? 'text-yellow-900' : 'text-orange-900'}`}>
                    Commission: ${Number(commission!.commission_amount || 0).toFixed(2)}
                    <span className="ml-2 text-xs font-normal">({commission!.status})</span>
                  </div>
                  {commission!.sales_rep_commission != null && (
                    <div className="text-xs text-gray-600 mt-0.5">
                      Sales rep: ${Number(commission!.sales_rep_commission || 0).toFixed(2)}
                      {commission!.distributor_commission != null && (
                        <> · Distributor: ${Number(commission!.distributor_commission || 0).toFixed(2)}</>
                      )}
                    </div>
                  )}

                  {commissionIsPaid ? (
                    <div className="flex items-center mt-2 text-xs text-yellow-800">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Commission already paid — cannot auto-cancel. Handle manually.
                    </div>
                  ) : (
                    <label className="flex items-center mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cancelCommission}
                        onChange={(e) => setCancelCommission(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-orange-800">Cancel commission on refund</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Refund <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer requested return, defective product, order error..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          {/* Refund Summary */}
          <div className={`p-4 rounded-lg border-2 ${isPartial ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-sm font-semibold ${isPartial ? 'text-amber-900' : 'text-red-900'}`}>
                  {isPartial ? 'Partial Refund' : 'Full Refund'}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {isPartial
                    ? `$${(total - refundAmount).toFixed(2)} will remain captured`
                    : 'Entire payment will be reversed'
                  }
                  {cancelCommission && hasCommission && !commissionIsPaid && (
                    <> · Commission will be cancelled</>
                  )}
                </div>
              </div>
              <div className={`text-xl font-bold ${isPartial ? 'text-amber-700' : 'text-red-700'}`}>
                ${refundAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing || !isValid}
            className="flex items-center space-x-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                <span>Refund ${refundAmount.toFixed(2)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundModal;
