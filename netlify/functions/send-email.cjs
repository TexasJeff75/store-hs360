const { createClient } = require('@supabase/supabase-js');

const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Content-Type': 'application/json',
};

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase config missing. SUPABASE_SERVICE_ROLE_KEY is required.');
  }
  return createClient(url, key);
}

// ── Shared email wrapper ──

function getSiteUrl() {
  return (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');
}

function getLogoUrl() {
  const siteUrl = getSiteUrl();
  return siteUrl ? `${siteUrl}/Logo_web.webp` : '';
}

/**
 * Resolve relative src/href attributes to absolute URLs.
 * Email clients cannot resolve relative paths — images and links must be absolute.
 */
function resolveRelativeUrls(html) {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return html;
  // Replace src="/..." and href="/..." (but not src="//..." or href="http...")
  return html.replace(/(src|href)="\/(?!\/)/g, `$1="${siteUrl}/`);
}

/**
 * Outlook-compatible button using VML fallback.
 * Outlook's Word renderer doesn't support border-radius or gradients on <a> tags.
 */
function outlookButton(href, text, bgColor = '#ec4899') {
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="18%" strokecolor="${bgColor}" fillcolor="${bgColor}">
  <w:anchorlock/>
  <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">${text}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${href}" style="display:inline-block;background-color:${bgColor};color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${text}</a>
<!--<![endif]-->`;
}

function defaultHeaderHtml() {
  const logoUrl = getLogoUrl();
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="HealthSpan360" width="48" height="48" style="display:block;margin:0 auto 12px auto;border-radius:8px;" />`
    : '';
  // Use bgcolor attribute for Outlook (it ignores CSS background/gradient)
  return `<div style="background-color:#ec4899;background:linear-gradient(135deg,#ec4899,#f97316);padding:32px 24px;text-align:center;" bgcolor="#ec4899">
    ${logoHtml}
    <h1 style="color:white;font-size:24px;margin:0;font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;">
      HealthSpan360
    </h1>
    <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:4px 0 0 0;font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      Turning Insight Into Impact
    </p>
  </div>`;
}

const DEFAULT_FOOTER_HTML = `<div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      HealthSpan360 &bull; This is an automated message. Please do not reply directly.
    </p>
  </div>`;

async function getEmailSettings(supabase) {
  try {
    const { data } = await supabase
      .from('email_settings')
      .select('header_html, footer_html')
      .eq('id', true)
      .maybeSingle();
    if (data && (data.header_html || data.footer_html)) {
      return {
        headerHtml: data.header_html || defaultHeaderHtml(),
        footerHtml: data.footer_html || DEFAULT_FOOTER_HTML,
      };
    }
  } catch (_) {
    // fall through to defaults
  }
  return { headerHtml: defaultHeaderHtml(), footerHtml: DEFAULT_FOOTER_HTML };
}

function wrapEmail(content, headerHtml, footerHtml) {
  // Resolve any relative URLs in all HTML parts
  const header = resolveRelativeUrls(headerHtml);
  const body = resolveRelativeUrls(content);
  const footer = resolveRelativeUrls(footerHtml);

  // Use table-based layout for Outlook compatibility.
  // Outlook's Word renderer doesn't support max-width on divs, border-radius, or box-shadow.
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" bgcolor="#f3f4f6">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6;" bgcolor="#f3f4f6">
    <tr>
      <td align="center" style="padding:24px 0;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td>
        <![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;" bgcolor="#ffffff">
          <tr>
            <td>${header}</td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td>${footer}</td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Address formatting helper ──

function formatAddressBlock(addr) {
  if (!addr) return '';
  const lines = [];
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(' ');
  if (name) lines.push(`<div style="font-weight:500;color:#111827;">${name}</div>`);
  if (addr.company) lines.push(`<div style="color:#6b7280;">${addr.company}</div>`);
  if (addr.address1) lines.push(`<div style="color:#6b7280;">${addr.address1}</div>`);
  if (addr.address2) lines.push(`<div style="color:#6b7280;">${addr.address2}</div>`);
  const cityLine = [addr.city, addr.state].filter(Boolean).join(', ');
  if (cityLine || addr.postalCode) lines.push(`<div style="color:#6b7280;">${cityLine} ${addr.postalCode || ''}</div>`);
  if (addr.phone) lines.push(`<div style="color:#9ca3af;margin-top:4px;">Phone: ${addr.phone}</div>`);
  return `<div style="font-size:14px;line-height:1.6;">${lines.join('')}</div>`;
}

// ── Pre-compute derived template variables ──

function prepareTemplateData(emailType, data) {
  const vars = {};

  // Copy all scalar values as strings
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && typeof value !== 'object') {
      vars[key] = String(value);
    }
  }

  switch (emailType) {
    case 'order_confirmation': {
      vars.order_id = String(data.order_id || '').slice(0, 8).toUpperCase();
      vars.formatted_subtotal = Number(data.subtotal || 0).toFixed(2);
      vars.formatted_shipping = Number(data.shipping || 0).toFixed(2);
      vars.formatted_tax = Number(data.tax || 0).toFixed(2);
      vars.formatted_total = Number(data.total || 0).toFixed(2);
      vars.shipping_method = String(data.shipping_method || 'Standard');
      vars.customer_email = String(data.customer_email || '');
      vars.payment_method = String(data.payment_method || '');
      vars.payment_last_four = String(data.payment_last_four || '');
      vars.transaction_id = String(data.transaction_id || '');

      // Format order date
      if (data.order_date) {
        try {
          const d = new Date(data.order_date);
          vars.order_date = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          vars.order_time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch (_) {
          vars.order_date = '';
          vars.order_time = '';
        }
      }

      // Payment status badge
      const ps = String(data.payment_status || 'pending');
      const psColors = { authorized: '#dbeafe;color:#1e40af', captured: '#dcfce7;color:#166534', pending: '#fef3c7;color:#92400e', failed: '#fee2e2;color:#991b1b' };
      const psLabels = { authorized: 'Payment Authorized', captured: 'Payment Captured', pending: 'Payment Pending', failed: 'Payment Failed' };
      vars.payment_status_badge = `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;background:${psColors[ps] || psColors.pending}">${psLabels[ps] || ps}</span>`;

      // Payment method display
      const pm = vars.payment_method;
      const plf = vars.payment_last_four;
      vars.payment_method_display = pm ? `${pm}${plf ? ' ****' + plf : ''}` : '';

      // Transaction ID row (pre-rendered, empty if no transaction_id)
      vars.transaction_id_html = data.transaction_id
        ? `<tr>
            <td style="padding:6px 0;font-size:14px;color:#6b7280;">Transaction ID</td>
            <td style="padding:6px 0;text-align:right;font-size:12px;font-family:monospace;font-weight:500;color:#374151;">${String(data.transaction_id)}</td>
          </tr>`
        : '';

      // Payment status info message (matches receipt component)
      const formattedTotal = vars.formatted_total;
      if (ps === 'authorized') {
        vars.payment_info_html = `<div style="background-color:#dbeafe;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-top:12px;" bgcolor="#dbeafe">
          <p style="color:#1e40af;font-size:12px;margin:0;">Your card has been authorized for $${formattedTotal}. The charge will be captured when your order ships.</p>
        </div>`;
      } else if (ps === 'pending') {
        vars.payment_info_html = `<div style="background-color:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-top:12px;" bgcolor="#fef3c7">
          <p style="color:#92400e;font-size:12px;margin:0;">Your ACH payment is being processed. This typically takes 3-5 business days to settle.</p>
        </div>`;
      } else {
        vars.payment_info_html = '';
      }

      // Item rows — 4-column format matching receipt (Item, Qty, Price, Total)
      const items = Array.isArray(data.items) ? data.items : [];
      vars.item_rows = items
        .map(
          (i) =>
            `<tr>
              <td style="padding:12px 8px 12px 12px;font-size:14px;font-weight:500;color:#111827;border-bottom:1px solid #f3f4f6;">${i.name}</td>
              <td style="padding:12px 8px;font-size:14px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
              <td style="padding:12px 8px;font-size:14px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;">$${Number(i.price).toFixed(2)}</td>
              <td style="padding:12px 12px 12px 8px;font-size:14px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;">$${Number(i.price * i.quantity).toFixed(2)}</td>
            </tr>`
        )
        .join('');

      // Shipping address block
      const sa = data.shipping_address;
      if (sa && typeof sa === 'object') {
        vars.shipping_address_html = formatAddressBlock(sa);
      } else {
        vars.shipping_address_html = '';
      }

      // Billing address block
      const ba = data.billing_address;
      if (ba && typeof ba === 'object') {
        vars.billing_address_html = formatAddressBlock(ba);
      } else {
        vars.billing_address_html = '<em style="color:#9ca3af;">Same as shipping address</em>';
      }

      break;
    }
    case 'recurring_order_processed': {
      vars.formatted_amount = Number(data.amount || 0).toFixed(2);
      const nextDate = String(data.next_order_date || '');
      vars.next_date_html = nextDate
        ? `<p style="color:#6b7280;font-size:14px;">Next delivery: <strong>${nextDate}</strong></p>`
        : '';
      break;
    }

    case 'customer_invitation':
    case 'distributor_invitation':
    case 'sales_rep_invitation':
    case 'user_invitation': {
      vars.full_name = String(data.full_name || '');
      vars.email = String(data.email || '');
      vars.role = String(data.role || 'customer');
      vars.login_url = String(data.login_url || '');
      break;
    }
  }

  return vars;
}

// ── Simple {{variable}} replacement ──

function renderTemplate(html, vars) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ── Hardcoded fallback templates ──

function buildFallbackHtml(emailType, data, headerHtml, footerHtml) {
  const wrap = (content) => wrapEmail(content, headerHtml, footerHtml);
  switch (emailType) {
    case 'order_confirmation': {
      const orderId = String(data.order_id || '').slice(0, 8).toUpperCase();
      const subtotal = Number(data.subtotal || 0).toFixed(2);
      const shippingAmt = Number(data.shipping || 0).toFixed(2);
      const shippingMethod = String(data.shipping_method || 'Standard');
      const tax = Number(data.tax || 0).toFixed(2);
      const total = Number(data.total || 0).toFixed(2);
      const customerEmail = String(data.customer_email || '');
      const paymentMethod = String(data.payment_method || '');
      const paymentLastFour = String(data.payment_last_four || '');
      const paymentStatus = String(data.payment_status || 'pending');

      let orderDateStr = '';
      if (data.order_date) {
        try {
          const d = new Date(data.order_date);
          orderDateStr = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch (_) { /* skip */ }
      }

      const psColors = { authorized: '#dbeafe;color:#1e40af', captured: '#dcfce7;color:#166534', pending: '#fef3c7;color:#92400e', failed: '#fee2e2;color:#991b1b' };
      const psLabels = { authorized: 'Authorized', captured: 'Captured', pending: 'Pending', failed: 'Failed' };
      const statusBadge = `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;background:${psColors[paymentStatus] || psColors.pending}">${psLabels[paymentStatus] || paymentStatus}</span>`;

      const transactionId = String(data.transaction_id || '');
      const items = Array.isArray(data.items) ? data.items : [];
      const itemRows = items
        .map(
          (i) =>
            `<tr>
              <td style="padding:12px 8px 12px 12px;font-size:14px;font-weight:500;color:#111827;border-bottom:1px solid #f3f4f6;">${i.name}</td>
              <td style="padding:12px 8px;font-size:14px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;">${i.quantity}</td>
              <td style="padding:12px 8px;font-size:14px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;">$${Number(i.price).toFixed(2)}</td>
              <td style="padding:12px 12px 12px 8px;font-size:14px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;">$${Number(i.price * i.quantity).toFixed(2)}</td>
            </tr>`
        )
        .join('');

      const shippingAddrHtml = data.shipping_address ? formatAddressBlock(data.shipping_address) : '';
      const billingAddrHtml = data.billing_address ? formatAddressBlock(data.billing_address) : '<em style="color:#9ca3af;">Same as shipping address</em>';

      // Status-specific info message (matching receipt component)
      let paymentInfoHtml = '';
      if (paymentStatus === 'authorized') {
        paymentInfoHtml = `<div style="background-color:#dbeafe;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-top:12px;" bgcolor="#dbeafe">
          <p style="color:#1e40af;font-size:12px;margin:0;">Your card has been authorized for $${total}. The charge will be captured when your order ships.</p>
        </div>`;
      } else if (paymentStatus === 'pending') {
        paymentInfoHtml = `<div style="background-color:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-top:12px;" bgcolor="#fef3c7">
          <p style="color:#92400e;font-size:12px;margin:0;">Your ACH payment is being processed. This typically takes 3-5 business days to settle.</p>
        </div>`;
      }

      return wrap(`
        <!-- Header -->
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
          <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 4px 0;">Order Confirmed</h2>
          <p style="color:#6b7280;font-size:14px;margin:0;">Order #${orderId}</p>
          ${orderDateStr ? `<p style="color:#9ca3af;font-size:13px;margin:4px 0 0 0;">${orderDateStr}</p>` : ''}
        </div>

        <!-- Payment Details -->
        <div style="background-color:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;" bgcolor="#f9fafb">
          <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Payment Details</h3>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Status</td>
              <td style="padding:6px 0;text-align:right;">${statusBadge}</td>
            </tr>
            ${paymentMethod ? `<tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Method</td>
              <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:500;color:#111827;">${paymentMethod}${paymentLastFour ? ' ****' + paymentLastFour : ''}</td>
            </tr>` : ''}
            ${transactionId ? `<tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Transaction ID</td>
              <td style="padding:6px 0;text-align:right;font-size:12px;font-family:monospace;font-weight:500;color:#374151;">${transactionId}</td>
            </tr>` : ''}
            ${customerEmail ? `<tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Email</td>
              <td style="padding:6px 0;text-align:right;font-size:14px;color:#111827;">${customerEmail}</td>
            </tr>` : ''}
          </table>
          ${paymentInfoHtml}
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
            ${itemRows}
          </tbody>
        </table>

        <!-- Totals -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="280" align="right" style="margin-bottom:24px;">
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#6b7280;">Subtotal</td>
            <td style="padding:4px 0;font-size:14px;color:#6b7280;text-align:right;">$${subtotal}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#6b7280;">Shipping (${shippingMethod})</td>
            <td style="padding:4px 0;font-size:14px;color:#6b7280;text-align:right;">$${shippingAmt}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#6b7280;">Tax</td>
            <td style="padding:4px 0;font-size:14px;color:#6b7280;text-align:right;">$${tax}</td>
          </tr>
          <tr>
            <td style="padding:8px 0 0 0;border-top:2px solid #111827;font-size:16px;font-weight:700;color:#111827;">Total</td>
            <td style="padding:8px 0 0 0;border-top:2px solid #111827;font-size:16px;font-weight:700;color:#111827;text-align:right;">$${total}</td>
          </tr>
        </table>
        <div style="clear:both;"></div>

        <!-- Addresses -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="48%" valign="top" style="background-color:#f9fafb;border-radius:12px;padding:16px;" bgcolor="#f9fafb">
              <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px 0;">Shipping Address</h4>
              ${shippingAddrHtml}
            </td>
            <td width="4%"></td>
            <td width="48%" valign="top" style="background-color:#f9fafb;border-radius:12px;padding:16px;" bgcolor="#f9fafb">
              <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px 0;">Billing Address</h4>
              ${billingAddrHtml}
            </td>
          </tr>
        </table>
      `);
    }

    case 'recurring_order_processed': {
      const productName = String(data.product_name || 'Product');
      const quantity = Number(data.quantity || 1);
      const amount = Number(data.amount || 0).toFixed(2);
      const nextDate = String(data.next_order_date || '');
      return wrap(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Recurring Order Processed</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Your recurring order has been automatically placed.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="color:#166534;font-size:14px;margin:0;"><strong>${productName}</strong> x ${quantity}</p>
          <p style="color:#166534;font-size:16px;font-weight:700;margin:8px 0 0 0;">$${amount}</p>
        </div>
        ${nextDate ? `<p style="color:#6b7280;font-size:14px;">Next delivery: <strong>${nextDate}</strong></p>` : ''}
      `);
    }

    case 'recurring_order_failed': {
      const productName = String(data.product_name || 'Product');
      const errorReason = String(data.error || 'An error occurred during processing.');
      return wrap(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Recurring Order Failed</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">We were unable to process your recurring order.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="color:#991b1b;font-size:14px;margin:0;"><strong>${productName}</strong></p>
          <p style="color:#991b1b;font-size:13px;margin:8px 0 0 0;">${errorReason}</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">Please check your payment method and try again, or contact support for assistance.</p>
      `);
    }

    case 'account_approved':
      return wrap(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Account Approved</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Your account has been approved. You can now log in and start placing orders.</p>
        <div style="text-align:center;margin:24px 0;">
          ${outlookButton(String(data.login_url || '#'), 'Log In Now')}
        </div>
      `);

    case 'account_denied':
      return wrap(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Account Update</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">We were unable to approve your account at this time.</p>
        <p style="color:#6b7280;font-size:14px;">If you believe this is an error, please contact our support team for assistance.</p>
      `);

    case 'support_ticket_created': {
      const ticketNumber = String(data.ticket_number || '');
      const subject = String(data.subject || '');
      return wrap(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Support Ticket Created</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">We've received your support request and will respond as soon as possible.</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
          <p style="color:#1e40af;font-size:13px;margin:0;">Ticket ${ticketNumber}</p>
          <p style="color:#1e40af;font-size:15px;font-weight:600;margin:4px 0 0 0;">${subject}</p>
        </div>
      `);
    }

    case 'support_ticket_reply': {
      const ticketNumber = String(data.ticket_number || '');
      const message = String(data.message || '');
      return wrap(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">New Reply on Your Ticket</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">There's a new reply on ticket ${ticketNumber}.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
          <p style="color:#374151;font-size:14px;margin:0;white-space:pre-wrap;">${message}</p>
        </div>
      `);
    }

    case 'support_ticket_resolved': {
      const ticketNumber = String(data.ticket_number || '');
      return wrap(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Ticket Resolved</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Your support ticket ${ticketNumber} has been marked as resolved.</p>
        <p style="color:#6b7280;font-size:14px;">If your issue isn't fully resolved, you can create a new ticket anytime.</p>
      `);
    }

    case 'customer_invitation': {
      const fullName = String(data.full_name || '');
      const email = String(data.email || '');
      const loginUrl = String(data.login_url || '#');
      return wrap(`
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
          <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
          <p style="color:#6b7280;font-size:14px;margin:0;">You've been invited to join our platform as a customer.</p>
        </div>
        <div style="background-color:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;" bgcolor="#f9fafb">
          <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${fullName ? `<tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Name</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${fullName}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Email</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${email}</td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">
            To get started, please set your password using the link below:
          </p>
          ${outlookButton(loginUrl, 'Set Up Your Password')}
        </div>
        <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
          Once your password is set, you can browse products and place orders.
        </p>
      `);
    }

    case 'distributor_invitation': {
      const fullName = String(data.full_name || '');
      const email = String(data.email || '');
      const loginUrl = String(data.login_url || '#');
      return wrap(`
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
          <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
          <p style="color:#6b7280;font-size:14px;margin:0;">You've been set up as a distributor on our platform.</p>
        </div>
        <div style="background-color:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;" bgcolor="#f9fafb">
          <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${fullName ? `<tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Name</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${fullName}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Email</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Role</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">Distributor</td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">
            To get started, please set your password using the link below:
          </p>
          ${outlookButton(loginUrl, 'Set Up Your Password')}
        </div>
        <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
          Once your password is set, you can manage your sales reps, set product pricing, and view commission reports from your distributor portal.
        </p>
      `);
    }

    case 'sales_rep_invitation': {
      const fullName = String(data.full_name || '');
      const email = String(data.email || '');
      const loginUrl = String(data.login_url || '#');
      return wrap(`
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
          <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
          <p style="color:#6b7280;font-size:14px;margin:0;">You've been set up as a sales representative on our platform.</p>
        </div>
        <div style="background-color:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;" bgcolor="#f9fafb">
          <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${fullName ? `<tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Name</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${fullName}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Email</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Role</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">Sales Representative</td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">
            To get started, please set your password using the link below:
          </p>
          ${outlookButton(loginUrl, 'Set Up Your Password')}
        </div>
        <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
          Once your password is set, you can view your assigned organizations, track commissions, and manage customer relationships.
        </p>
      `);
    }

    case 'user_invitation': {
      const fullName = String(data.full_name || '');
      const email = String(data.email || '');
      const role = String(data.role || 'customer');
      const loginUrl = String(data.login_url || '#');
      return wrap(`
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
          <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
          <p style="color:#6b7280;font-size:14px;margin:0;">You've been invited to join our platform.</p>
        </div>
        <div style="background-color:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;" bgcolor="#f9fafb">
          <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${fullName ? `<tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Name</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${fullName}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Email</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#6b7280;">Role</td>
              <td style="padding:6px 0;font-size:14px;font-weight:500;color:#111827;text-align:right;">${role}</td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">
            To get started, please set your password using the link below:
          </p>
          ${outlookButton(loginUrl, 'Set Up Your Password')}
        </div>
      `);
    }

    default:
      return wrap(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Notification</h2>
        <p style="color:#6b7280;font-size:14px;">${String(data.message || 'You have a new notification from HealthSpan360.')}</p>
      `);
  }
}

// ── Main handler ──

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    if (!payload.to || !payload.email_type || !payload.subject) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields: to, email_type, subject' }),
      };
    }

    const supabase = getSupabaseAdmin();

    // Fetch global email header/footer from DB
    const { headerHtml, footerHtml } = await getEmailSettings(supabase);

    // Try DB template first, fall back to hardcoded
    // For role-specific invitation types, also try generic user_invitation as fallback
    const INVITATION_TYPES = ['customer_invitation', 'distributor_invitation', 'sales_rep_invitation'];
    let htmlBody;
    try {
      let template = null;

      // Look up the specific template
      const { data: specificTemplate } = await supabase
        .from('email_templates')
        .select('body_html, is_active')
        .eq('email_type', payload.email_type)
        .eq('is_active', true)
        .maybeSingle();

      template = specificTemplate;

      // If role-specific invitation template not found, try generic user_invitation
      if (!template && INVITATION_TYPES.includes(payload.email_type)) {
        const { data: genericTemplate } = await supabase
          .from('email_templates')
          .select('body_html, is_active')
          .eq('email_type', 'user_invitation')
          .eq('is_active', true)
          .maybeSingle();
        template = genericTemplate;
      }

      if (template && template.body_html) {
        const vars = prepareTemplateData(payload.email_type, payload.template_data || {});
        const renderedBody = renderTemplate(template.body_html, vars);
        htmlBody = wrapEmail(renderedBody, headerHtml, footerHtml);
      } else {
        htmlBody = buildFallbackHtml(payload.email_type, payload.template_data || {}, headerHtml, footerHtml);
      }
    } catch (_dbErr) {
      htmlBody = buildFallbackHtml(payload.email_type, payload.template_data || {}, headerHtml, footerHtml);
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'HealthSpan360 <noreply@hs360.co>';
    let emailSent = false;
    let errorMessage = null;

    if (!resendApiKey) {
      errorMessage = 'RESEND_API_KEY environment variable is not set';
      console.error('[send-email]', errorMessage);
    } else {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [payload.to],
            subject: payload.subject,
            html: htmlBody,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || `Resend API returned ${res.status}`);
        }

        emailSent = true;
        console.log(`[send-email] Sent "${payload.email_type}" email to ${payload.to}`);
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Failed to send via Resend';
        console.error('[send-email] Resend error:', errorMessage);
      }
    }

    // Log to email_notifications table (best-effort, don't block the response)
    let emailLogId = null;
    try {
      const { data: emailLog } = await supabase
        .from('email_notifications')
        .insert({
          user_id: payload.user_id || null,
          email_to: payload.to,
          email_type: payload.email_type,
          subject: payload.subject,
          body_html: htmlBody,
          status: emailSent ? 'sent' : 'failed',
          error_message: errorMessage,
          metadata: payload.template_data || {},
          sent_at: emailSent ? new Date().toISOString() : null,
        })
        .select('id')
        .maybeSingle();
      emailLogId = emailLog?.id || null;
    } catch (logErr) {
      console.warn('[send-email] Failed to log email notification:', logErr instanceof Error ? logErr.message : logErr);
    }

    if (!emailSent) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: errorMessage,
          email_id: emailLogId,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        email_id: emailLogId,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: message }),
    };
  }
};
