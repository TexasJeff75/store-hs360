import React, { useRef } from 'react';
import { Printer, Download, X, CheckCircle, Clock, AlertCircle, CreditCard, Truck, MapPin } from 'lucide-react';

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface ReceiptAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface OrderReceiptProps {
  orderId: string;
  orderDate: string;
  items: ReceiptItem[];
  subtotal: number;
  shipping: number;
  shippingMethod: string;
  tax: number;
  total: number;
  paymentStatus: string;
  paymentMethod: string;
  paymentLastFour: string;
  transactionId: string;
  customerEmail: string;
  shippingAddress: ReceiptAddress;
  billingAddress: ReceiptAddress;
  sameAsShipping: boolean;
  onClose: () => void;
}

const PaymentStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    authorized: {
      icon: <CheckCircle className="h-4 w-4" />,
      label: 'Payment Authorized',
      className: 'bg-blue-50 text-blue-800 border-blue-200',
    },
    captured: {
      icon: <CheckCircle className="h-4 w-4" />,
      label: 'Payment Captured',
      className: 'bg-green-50 text-green-800 border-green-200',
    },
    pending: {
      icon: <Clock className="h-4 w-4" />,
      label: 'Payment Pending',
      className: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    failed: {
      icon: <AlertCircle className="h-4 w-4" />,
      label: 'Payment Failed',
      className: 'bg-red-50 text-red-800 border-red-200',
    },
  };

  const { icon, label, className } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-full ${className}`}>
      {icon}
      {label}
    </span>
  );
};

const OrderReceipt: React.FC<OrderReceiptProps> = ({
  orderId,
  orderDate,
  items,
  subtotal,
  shipping,
  shippingMethod,
  tax,
  total,
  paymentStatus,
  paymentMethod,
  paymentLastFour,
  transactionId,
  customerEmail,
  shippingAddress,
  billingAddress,
  sameAsShipping,
  onClose,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Receipt - ${orderId.slice(0, 8)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
            .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
            .header p { font-size: 14px; color: #6b7280; }
            .section { margin-bottom: 24px; }
            .section-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
            .info-row .label { color: #6b7280; }
            .info-row .value { font-weight: 500; }
            .items-table { width: 100%; border-collapse: collapse; }
            .items-table th { text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
            .items-table th:last-child, .items-table td:last-child { text-align: right; }
            .items-table th:nth-child(2), .items-table td:nth-child(2) { text-align: center; }
            .items-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
            .totals { margin-top: 16px; border-top: 2px solid #e5e7eb; padding-top: 12px; }
            .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
            .totals .total-row { font-size: 18px; font-weight: 700; padding-top: 8px; margin-top: 8px; border-top: 2px solid #1a1a1a; }
            .payment-status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
            .status-authorized { background: #dbeafe; color: #1e40af; }
            .status-captured { background: #dcfce7; color: #166534; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-failed { background: #fee2e2; color: #991b1b; }
            .address { font-size: 14px; line-height: 1.6; }
            .footer { margin-top: 40px; text-align: center; padding-top: 24px; border-top: 2px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Order Receipt</h1>
            <p>Order #${orderId.slice(0, 8).toUpperCase()}</p>
            <p>${new Date(orderDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date(orderDate).toLocaleTimeString()}</p>
          </div>

          <div class="section">
            <div class="section-title">Payment Information</div>
            <div class="info-row">
              <span class="label">Status</span>
              <span class="payment-status status-${paymentStatus}">${paymentStatus === 'authorized' ? 'Authorized' : paymentStatus === 'captured' ? 'Captured' : paymentStatus === 'pending' ? 'Pending' : paymentStatus}</span>
            </div>
            <div class="info-row">
              <span class="label">Payment Method</span>
              <span class="value">${paymentMethod} ****${paymentLastFour}</span>
            </div>
            ${transactionId ? `<div class="info-row"><span class="label">Transaction ID</span><span class="value" style="font-family: monospace; font-size: 12px;">${transactionId}</span></div>` : ''}
            <div class="info-row">
              <span class="label">Email</span>
              <span class="value">${customerEmail}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Items Ordered</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td>$${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="totals">
              <div class="row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
              <div class="row"><span>Shipping (${shippingMethod})</span><span>$${shipping.toFixed(2)}</span></div>
              <div class="row"><span>Tax</span><span>$${tax.toFixed(2)}</span></div>
              <div class="row total-row"><span>Total</span><span>$${total.toFixed(2)}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="grid-2">
              <div>
                <div class="section-title">Shipping Address</div>
                <div class="address">
                  ${shippingAddress.firstName} ${shippingAddress.lastName}<br>
                  ${shippingAddress.company ? shippingAddress.company + '<br>' : ''}
                  ${shippingAddress.address1}<br>
                  ${shippingAddress.address2 ? shippingAddress.address2 + '<br>' : ''}
                  ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postalCode}<br>
                  ${shippingAddress.phone ? 'Phone: ' + shippingAddress.phone : ''}
                </div>
              </div>
              <div>
                <div class="section-title">Billing Address</div>
                <div class="address">
                  ${sameAsShipping ? '<em>Same as shipping address</em>' : `
                    ${billingAddress.firstName} ${billingAddress.lastName}<br>
                    ${billingAddress.company ? billingAddress.company + '<br>' : ''}
                    ${billingAddress.address1}<br>
                    ${billingAddress.address2 ? billingAddress.address2 + '<br>' : ''}
                    ${billingAddress.city}, ${billingAddress.state} ${billingAddress.postalCode}<br>
                    ${billingAddress.phone ? 'Phone: ' + billingAddress.phone : ''}
                  `}
                </div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for your order.</p>
            <p>If you have questions, contact us at ${customerEmail}.</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const formatAddress = (addr: ReceiptAddress) => (
    <div className="text-sm text-gray-700 leading-relaxed">
      <p className="font-medium text-gray-900">{addr.firstName} {addr.lastName}</p>
      {addr.company && <p>{addr.company}</p>}
      <p>{addr.address1}</p>
      {addr.address2 && <p>{addr.address2}</p>}
      <p>{addr.city}, {addr.state} {addr.postalCode}</p>
      {addr.phone && <p className="mt-1 text-gray-500">Phone: {addr.phone}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
            <h3 className="text-lg font-bold text-gray-900">Order Receipt</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div ref={receiptRef} className="p-6 space-y-6">
            <div className="text-center pb-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Order Confirmed</h2>
              <p className="text-sm text-gray-500">
                Order #{orderId.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(orderDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })} at {new Date(orderDate).toLocaleTimeString()}
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-gray-600" />
                <h4 className="font-semibold text-gray-900">Payment Details</h4>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <PaymentStatusBadge status={paymentStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Method</span>
                <span className="text-sm font-medium text-gray-900">{paymentMethod} ****{paymentLastFour}</span>
              </div>
              {transactionId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Transaction ID</span>
                  <span className="text-xs font-mono font-medium text-gray-700 bg-gray-200 px-2 py-1 rounded">{transactionId}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Email</span>
                <span className="text-sm text-gray-900">{customerEmail}</span>
              </div>

              {paymentStatus === 'authorized' && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    Your card has been authorized for ${total.toFixed(2)}. The charge will be captured when your order ships.
                  </p>
                </div>
              )}
              {paymentStatus === 'pending' && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    Your ACH payment is being processed. This typically takes 3-5 business days to settle.
                  </p>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Items Ordered</h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                              />
                            )}
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">${item.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">${(item.price * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2 ml-auto max-w-xs">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Shipping ({shippingMethod})</span>
                  <span>${shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t-2 border-gray-900">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4 text-gray-600" />
                  <h4 className="font-semibold text-gray-900 text-sm">Shipping Address</h4>
                </div>
                {formatAddress(shippingAddress)}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-gray-600" />
                  <h4 className="font-semibold text-gray-900 text-sm">Billing Address</h4>
                </div>
                {sameAsShipping ? (
                  <p className="text-sm text-gray-500 italic">Same as shipping address</p>
                ) : (
                  formatAddress(billingAddress)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderReceipt;
