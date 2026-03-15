const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

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

function getLogoUrl() {
  const siteUrl = process.env.SITE_URL || process.env.URL || '';
  return siteUrl ? `${siteUrl.replace(/\/$/, '')}/Logo_web.webp` : '';
}

function defaultHeaderHtml() {
  const logoUrl = getLogoUrl();
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="HealthSpan360" width="48" height="48" style="display:block;margin:0 auto 12px auto;border-radius:8px;" />`
    : '';
  return `<div style="background: linear-gradient(135deg, #ec4899, #f97316); padding: 32px 24px; text-align: center;">
    ${logoHtml}
    <h1 style="color: white; font-size: 24px; margin: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 700;">
      HealthSpan360
    </h1>
    <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
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
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    ${headerHtml}
    <div style="padding: 32px 24px;">
      ${content}
    </div>
    ${footerHtml}
  </div>
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
      const psLabels = { authorized: 'Authorized', captured: 'Captured', pending: 'Pending', failed: 'Failed' };
      vars.payment_status_badge = `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;background:${psColors[ps] || psColors.pending}">${psLabels[ps] || ps}</span>`;

      // Item cards
      const items = Array.isArray(data.items) ? data.items : [];
      vars.item_rows = items
        .map(
          (i) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f3f4f6;">
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:500;color:#111827;">${i.name}</div>
                <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Qty: ${i.quantity} &times; $${Number(i.price).toFixed(2)}</div>
              </div>
              <div style="font-size:14px;font-weight:600;color:#111827;">$${Number(i.price * i.quantity).toFixed(2)}</div>
            </div>`
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

      const items = Array.isArray(data.items) ? data.items : [];
      const itemCards = items
        .map(
          (i) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f3f4f6;">
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:500;color:#111827;">${i.name}</div>
                <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Qty: ${i.quantity} &times; $${Number(i.price).toFixed(2)}</div>
              </div>
              <div style="font-size:14px;font-weight:600;color:#111827;">$${Number(i.price * i.quantity).toFixed(2)}</div>
            </div>`
        )
        .join('');

      const shippingAddrHtml = data.shipping_address ? formatAddressBlock(data.shipping_address) : '';
      const billingAddrHtml = data.billing_address ? formatAddressBlock(data.billing_address) : '<em style="color:#9ca3af;">Same as shipping address</em>';

      return wrap(`
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
          <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 4px 0;">Order Confirmed</h2>
          <p style="color:#6b7280;font-size:14px;margin:0;">Order #${orderId}</p>
          ${orderDateStr ? `<p style="color:#9ca3af;font-size:13px;margin:4px 0 0 0;">${orderDateStr}</p>` : ''}
        </div>

        <!-- Payment Details -->
        <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
          <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Payment Details</h3>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
            <span style="font-size:14px;color:#6b7280;">Status</span>
            ${statusBadge}
          </div>
          ${paymentMethod ? `<div style="display:flex;justify-content:space-between;padding:6px 0;">
            <span style="font-size:14px;color:#6b7280;">Method</span>
            <span style="font-size:14px;font-weight:500;color:#111827;">${paymentMethod}${paymentLastFour ? ' ****' + paymentLastFour : ''}</span>
          </div>` : ''}
          ${customerEmail ? `<div style="display:flex;justify-content:space-between;padding:6px 0;">
            <span style="font-size:14px;color:#6b7280;">Email</span>
            <span style="font-size:14px;color:#111827;">${customerEmail}</span>
          </div>` : ''}
        </div>

        <!-- Items -->
        <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 8px 0;">Items Ordered</h3>
        <div style="margin-bottom:16px;">
          ${itemCards}
        </div>

        <!-- Totals -->
        <div style="max-width:280px;margin-left:auto;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;">
            <span>Subtotal</span><span>$${subtotal}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;">
            <span>Shipping (${shippingMethod})</span><span>$${shippingAmt}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;">
            <span>Tax</span><span>$${tax}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0 0 0;margin-top:8px;border-top:2px solid #111827;font-size:16px;font-weight:700;color:#111827;">
            <span>Total</span><span>$${total}</span>
          </div>
        </div>

        <!-- Addresses -->
        <div style="display:flex;gap:16px;">
          <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;">
            <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px 0;">Shipping Address</h4>
            ${shippingAddrHtml}
          </div>
          <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;">
            <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px 0;">Billing Address</h4>
            ${billingAddrHtml}
          </div>
        </div>
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
          <a href="${String(data.login_url || '#')}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#f97316);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Log In Now
          </a>
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
        <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
          <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
          <div style="display:flex;justify-content:space-between;padding:6px 0;">
            <span style="font-size:14px;color:#6b7280;">Email</span>
            <span style="font-size:14px;font-weight:500;color:#111827;">${email}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;">
            <span style="font-size:14px;color:#6b7280;">Role</span>
            <span style="font-size:14px;font-weight:500;color:#111827;">${role}</span>
          </div>
        </div>
        <div style="text-align:center;margin-bottom:24px;">
          <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">
            To get started, please set your password using the link below:
          </p>
          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#f97316);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Get Started
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          You will also receive a separate email with a link to set your password.
        </p>
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
    let htmlBody;
    try {
      const { data: template } = await supabase
        .from('email_templates')
        .select('body_html, is_active')
        .eq('email_type', payload.email_type)
        .eq('is_active', true)
        .maybeSingle();

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

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    let emailSent = false;
    let errorMessage = null;

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.office365.com',
          port: Number(process.env.SMTP_PORT || 587),
          secure: false, // STARTTLS
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || smtpUser,
          to: payload.to,
          subject: payload.subject,
          html: htmlBody,
        });

        emailSent = true;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Failed to send via SMTP';
      }
    } else {
      errorMessage = 'SMTP not configured (SMTP_USER / SMTP_PASS not set). Email logged but not sent.';
    }

    // Log to email_notifications table
    const { data: emailLog } = await supabase
      .from('email_notifications')
      .insert({
        user_id: payload.user_id || null,
        email_to: payload.to,
        email_type: payload.email_type,
        subject: payload.subject,
        body_html: htmlBody,
        status: emailSent ? 'sent' : (smtpUser ? 'failed' : 'pending'),
        error_message: errorMessage,
        metadata: payload.template_data || {},
        sent_at: emailSent ? new Date().toISOString() : null,
      })
      .select('id')
      .maybeSingle();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: emailSent,
        email_id: emailLog?.id || null,
        warning: !smtpUser ? 'SMTP not configured. Email was logged but not delivered.' : undefined,
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
