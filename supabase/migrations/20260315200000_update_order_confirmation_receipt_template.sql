-- Update order_confirmation template to receipt-style layout with expanded variables
UPDATE email_templates
SET
  body_html = $$<div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
  <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 4px 0;">Order Confirmed</h2>
  <p style="color:#6b7280;font-size:14px;margin:0;">Order #{{order_id}}</p>
  <p style="color:#9ca3af;font-size:13px;margin:4px 0 0 0;">{{order_date}} at {{order_time}}</p>
</div>

<!-- Payment Details -->
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
  <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Payment Details</h3>
  <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Status</span>
    {{payment_status_badge}}
  </div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Method</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{payment_method}} ****{{payment_last_four}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Email</span>
    <span style="font-size:14px;color:#111827;">{{customer_email}}</span>
  </div>
</div>

<!-- Items -->
<h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 8px 0;">Items Ordered</h3>
<div style="margin-bottom:16px;">
  {{item_rows}}
</div>

<!-- Totals -->
<div style="max-width:280px;margin-left:auto;margin-bottom:24px;">
  <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;">
    <span>Subtotal</span><span>${{formatted_subtotal}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;">
    <span>Shipping ({{shipping_method}})</span><span>${{formatted_shipping}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;">
    <span>Tax</span><span>${{formatted_tax}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:8px 0 0 0;margin-top:8px;border-top:2px solid #111827;font-size:16px;font-weight:700;color:#111827;">
    <span>Total</span><span>${{formatted_total}}</span>
  </div>
</div>

<!-- Addresses -->
<div style="display:flex;gap:16px;">
  <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;">
    <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px 0;">Shipping Address</h4>
    {{shipping_address_html}}
  </div>
  <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;">
    <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px 0;">Billing Address</h4>
    {{billing_address_html}}
  </div>
</div>$$,
  variables = '[
    {"key":"order_id","description":"Short order ID (first 8 chars, uppercased)","example":"A1B2C3D4"},
    {"key":"order_date","description":"Formatted order date","example":"Monday, March 15, 2026"},
    {"key":"order_time","description":"Formatted order time","example":"2:30 PM"},
    {"key":"item_rows","description":"Pre-rendered HTML item cards (auto-generated)","example":"<div>Product x 2 — $29.98</div>"},
    {"key":"formatted_subtotal","description":"Subtotal formatted with 2 decimals","example":"129.99"},
    {"key":"formatted_shipping","description":"Shipping cost formatted","example":"9.99"},
    {"key":"shipping_method","description":"Shipping method name","example":"Standard"},
    {"key":"formatted_tax","description":"Tax amount formatted","example":"10.01"},
    {"key":"formatted_total","description":"Order total formatted","example":"149.99"},
    {"key":"customer_email","description":"Customer email address","example":"customer@example.com"},
    {"key":"payment_method","description":"Payment method type","example":"Visa"},
    {"key":"payment_last_four","description":"Last 4 digits of payment method","example":"4242"},
    {"key":"payment_status_badge","description":"Pre-rendered HTML payment status badge (auto-generated)","example":"<span>Authorized</span>"},
    {"key":"shipping_address_html","description":"Pre-rendered shipping address block (auto-generated)","example":"<div>John Doe<br>123 Main St</div>"},
    {"key":"billing_address_html","description":"Pre-rendered billing address block (auto-generated)","example":"<div>Same as shipping</div>"}
  ]'::jsonb
WHERE email_type = 'order_confirmation';
