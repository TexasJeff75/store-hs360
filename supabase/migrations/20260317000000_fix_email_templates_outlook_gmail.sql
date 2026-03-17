-- Fix email header for Outlook/Gmail compatibility:
-- 1. Add bgcolor attribute (Outlook ignores CSS background/gradient)
-- 2. Add background-color fallback before gradient
-- 3. Use absolute-friendly image path pattern (resolved at send time by Netlify function)

UPDATE email_settings SET header_html = $$<div style="background-color:#ec4899;background:linear-gradient(135deg,#ec4899,#f97316);padding:32px 24px;text-align:center;" bgcolor="#ec4899">
  <img src="/Logo_web.webp" alt="HealthSpan360" width="48" height="48" style="display:block;margin:0 auto 12px auto;border-radius:8px;" />
  <h1 style="color:white;font-size:24px;margin:0;font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;">
    HealthSpan360
  </h1>
  <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:4px 0 0 0;font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    Turning Insight Into Impact
  </p>
</div>$$
WHERE id = true;

-- Update button-containing templates to use Outlook-compatible VML buttons
-- account_approved template
UPDATE email_templates SET body_html = $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Account Approved</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Your account has been approved. You can now log in and start placing orders.</p>
<div style="text-align:center;margin:24px 0;">
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{login_url}}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="18%" strokecolor="#ec4899" fillcolor="#ec4899">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Log In Now</center>
  </v:roundrect>
  <![endif]-->
  <!--[if !mso]><!-->
  <a href="{{login_url}}" style="display:inline-block;background-color:#ec4899;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Log In Now</a>
  <!--<![endif]-->
</div>$$
WHERE email_type = 'account_approved';

-- Update order_confirmation template to match the OrderReceipt component layout
UPDATE email_templates SET body_html = $$<!-- Header -->
<div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
  <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 4px 0;">Order Confirmed</h2>
  <p style="color:#6b7280;font-size:14px;margin:0;">Order #{{order_id}}</p>
  <p style="color:#9ca3af;font-size:13px;margin:4px 0 0 0;">{{order_date}} at {{order_time}}</p>
</div>

<!-- Payment Details -->
<div style="background-color:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;" bgcolor="#f9fafb">
  <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Payment Details</h3>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280;">Status</td>
      <td style="padding:6px 0;text-align:right;">{{payment_status_badge}}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280;">Method</td>
      <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:500;color:#111827;">{{payment_method_display}}</td>
    </tr>
    {{transaction_id_html}}
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280;">Email</td>
      <td style="padding:6px 0;text-align:right;font-size:14px;color:#111827;">{{customer_email}}</td>
    </tr>
  </table>
  {{payment_info_html}}
</div>

<!-- Items Ordered -->
<h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 8px 0;">Items Ordered</h3>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
  <thead>
    <tr style="background-color:#f9fafb;" bgcolor="#f9fafb">
      <th style="padding:10px 8px 10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:500;border-bottom:2px solid #e5e7eb;">Item</th>
      <th style="padding:10px 8px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:500;border-bottom:2px solid #e5e7eb;">Qty</th>
      <th style="padding:10px 8px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:500;border-bottom:2px solid #e5e7eb;">Price</th>
      <th style="padding:10px 12px 10px 8px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;font-weight:500;border-bottom:2px solid #e5e7eb;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{item_rows}}
  </tbody>
</table>

<!-- Totals -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="280" align="right" style="margin-bottom:24px;">
  <tr>
    <td style="padding:4px 0;font-size:14px;color:#6b7280;">Subtotal</td>
    <td style="padding:4px 0;font-size:14px;color:#6b7280;text-align:right;">${{formatted_subtotal}}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;font-size:14px;color:#6b7280;">Shipping ({{shipping_method}})</td>
    <td style="padding:4px 0;font-size:14px;color:#6b7280;text-align:right;">${{formatted_shipping}}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;font-size:14px;color:#6b7280;">Tax</td>
    <td style="padding:4px 0;font-size:14px;color:#6b7280;text-align:right;">${{formatted_tax}}</td>
  </tr>
  <tr>
    <td style="padding:8px 0 0 0;border-top:2px solid #111827;font-size:16px;font-weight:700;color:#111827;">Total</td>
    <td style="padding:8px 0 0 0;border-top:2px solid #111827;font-size:16px;font-weight:700;color:#111827;text-align:right;">${{formatted_total}}</td>
  </tr>
</table>
<div style="clear:both;"></div>

<!-- Addresses -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td width="48%" valign="top" style="background-color:#f9fafb;border-radius:12px;padding:16px;" bgcolor="#f9fafb">
      <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px 0;">Shipping Address</h4>
      {{shipping_address_html}}
    </td>
    <td width="4%"></td>
    <td width="48%" valign="top" style="background-color:#f9fafb;border-radius:12px;padding:16px;" bgcolor="#f9fafb">
      <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px 0;">Billing Address</h4>
      {{billing_address_html}}
    </td>
  </tr>
</table>$$,
variables = '[
  {"key":"order_id","description":"Short order ID (first 8 chars, uppercased)","example":"A1B2C3D4"},
  {"key":"order_date","description":"Formatted order date","example":"Monday, March 17, 2026"},
  {"key":"order_time","description":"Formatted order time","example":"2:30 PM"},
  {"key":"payment_status_badge","description":"Pre-rendered payment status badge HTML","example":"<span style=\"display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;background:#dcfce7;color:#166534\">Payment Captured</span>"},
  {"key":"payment_method_display","description":"Payment method with masked card number","example":"Visa ****4242"},
  {"key":"transaction_id_html","description":"Pre-rendered transaction ID row (empty if none)","example":""},
  {"key":"customer_email","description":"Customer email address","example":"customer@example.com"},
  {"key":"payment_info_html","description":"Status-specific info message (empty for captured/failed)","example":""},
  {"key":"item_rows","description":"Pre-rendered HTML table rows for order items","example":"<tr><td>Vitamin D3</td><td>2</td><td>$14.99</td><td>$29.98</td></tr>"},
  {"key":"formatted_subtotal","description":"Subtotal formatted with 2 decimals","example":"129.97"},
  {"key":"shipping_method","description":"Shipping method name","example":"Standard"},
  {"key":"formatted_shipping","description":"Shipping cost formatted with 2 decimals","example":"9.99"},
  {"key":"formatted_tax","description":"Tax formatted with 2 decimals","example":"10.03"},
  {"key":"formatted_total","description":"Total formatted with 2 decimals","example":"149.99"},
  {"key":"shipping_address_html","description":"Pre-rendered shipping address block","example":"<div>John Doe<br>123 Main St</div>"},
  {"key":"billing_address_html","description":"Pre-rendered billing address block","example":"<em>Same as shipping address</em>"}
]'::jsonb
WHERE email_type = 'order_confirmation';
