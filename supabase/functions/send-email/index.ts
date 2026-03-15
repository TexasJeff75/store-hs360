import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  email_type: string;
  subject: string;
  template_data: Record<string, unknown>;
  user_id?: string;
}

// ── Shared wrapper (header + footer) ──

const emailHeader = `
  <div style="background: linear-gradient(135deg, #ec4899, #f97316); padding: 32px 24px; text-align: center;">
    <h1 style="color: white; font-size: 24px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      HealthSpan360
    </h1>
    <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      Turning Insight Into Impact
    </p>
  </div>
`;

const emailFooter = `
  <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      HealthSpan360 &bull; This is an automated message. Please do not reply directly.
    </p>
  </div>
`;

function wrapEmail(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        ${emailHeader}
        <div style="padding: 32px 24px;">
          ${content}
        </div>
        ${emailFooter}
      </div>
    </body>
    </html>
  `;
}

// ── Pre-compute derived template variables ──

function prepareTemplateData(emailType: string, data: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {};

  // Copy all scalar values as strings
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && typeof value !== 'object') {
      vars[key] = String(value);
    }
  }

  switch (emailType) {
    case "order_confirmation": {
      vars.order_id = String(data.order_id || "").slice(0, 8).toUpperCase();
      vars.formatted_total = Number(data.total || 0).toFixed(2);
      const items = (data.items as Array<{ name: string; quantity: number; price: number }>) || [];
      vars.item_rows = items
        .map(
          (i) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;">${i.name}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;font-size:14px;">${i.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:14px;">$${Number(i.price * i.quantity).toFixed(2)}</td></tr>`,
        )
        .join("");
      break;
    }
    case "recurring_order_processed": {
      vars.formatted_amount = Number(data.amount || 0).toFixed(2);
      const nextDate = String(data.next_order_date || "");
      vars.next_date_html = nextDate
        ? `<p style="color:#6b7280;font-size:14px;">Next delivery: <strong>${nextDate}</strong></p>`
        : "";
      break;
    }
  }

  return vars;
}

// ── Simple {{variable}} replacement ──

function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] ?? "";
  });
}

// ── Hardcoded fallback templates (kept for reliability) ──

function buildFallbackHtml(emailType: string, data: Record<string, unknown>): string {
  switch (emailType) {
    case "order_confirmation": {
      const orderId = String(data.order_id || "").slice(0, 8).toUpperCase();
      const total = Number(data.total || 0).toFixed(2);
      const items = (data.items as Array<{ name: string; quantity: number; price: number }>) || [];
      const itemRows = items
        .map(
          (i) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;">${i.name}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:center;font-size:14px;">${i.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:14px;">$${Number(i.price * i.quantity).toFixed(2)}</td></tr>`,
        )
        .join("");
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Order Confirmed</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Order #${orderId}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead><tr style="border-bottom:2px solid #e5e7eb;">
            <th style="text-align:left;padding:8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;">Item</th>
            <th style="text-align:center;padding:8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;">Qty</th>
            <th style="text-align:right;padding:8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;">Total</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:right;">
          <span style="font-size:16px;font-weight:700;color:#111827;">Total: $${total}</span>
        </div>
      `);
    }

    case "recurring_order_processed": {
      const productName = String(data.product_name || "Product");
      const quantity = Number(data.quantity || 1);
      const amount = Number(data.amount || 0).toFixed(2);
      const nextDate = String(data.next_order_date || "");
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Recurring Order Processed</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Your recurring order has been automatically placed.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="color:#166534;font-size:14px;margin:0;"><strong>${productName}</strong> x ${quantity}</p>
          <p style="color:#166534;font-size:16px;font-weight:700;margin:8px 0 0 0;">$${amount}</p>
        </div>
        ${nextDate ? `<p style="color:#6b7280;font-size:14px;">Next delivery: <strong>${nextDate}</strong></p>` : ""}
      `);
    }

    case "recurring_order_failed": {
      const productName = String(data.product_name || "Product");
      const errorReason = String(data.error || "An error occurred during processing.");
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Recurring Order Failed</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">We were unable to process your recurring order.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="color:#991b1b;font-size:14px;margin:0;"><strong>${productName}</strong></p>
          <p style="color:#991b1b;font-size:13px;margin:8px 0 0 0;">${errorReason}</p>
        </div>
        <p style="color:#6b7280;font-size:14px;">Please check your payment method and try again, or contact support for assistance.</p>
      `);
    }

    case "account_approved":
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Account Approved</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Your account has been approved. You can now log in and start placing orders.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${String(data.login_url || "#")}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#f97316);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Log In Now
          </a>
        </div>
      `);

    case "account_denied":
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Account Update</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">We were unable to approve your account at this time.</p>
        <p style="color:#6b7280;font-size:14px;">If you believe this is an error, please contact our support team for assistance.</p>
      `);

    case "support_ticket_created": {
      const ticketNumber = String(data.ticket_number || "");
      const subject = String(data.subject || "");
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Support Ticket Created</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">We've received your support request and will respond as soon as possible.</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
          <p style="color:#1e40af;font-size:13px;margin:0;">Ticket ${ticketNumber}</p>
          <p style="color:#1e40af;font-size:15px;font-weight:600;margin:4px 0 0 0;">${subject}</p>
        </div>
      `);
    }

    case "support_ticket_reply": {
      const ticketNumber = String(data.ticket_number || "");
      const message = String(data.message || "");
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">New Reply on Your Ticket</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">There's a new reply on ticket ${ticketNumber}.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
          <p style="color:#374151;font-size:14px;margin:0;white-space:pre-wrap;">${message}</p>
        </div>
      `);
    }

    case "support_ticket_resolved": {
      const ticketNumber = String(data.ticket_number || "");
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Ticket Resolved</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Your support ticket ${ticketNumber} has been marked as resolved.</p>
        <p style="color:#6b7280;font-size:14px;">If your issue isn't fully resolved, you can create a new ticket anytime.</p>
      `);
    }

    default:
      return wrapEmail(`
        <h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Notification</h2>
        <p style="color:#6b7280;font-size:14px;">${String(data.message || "You have a new notification from HealthSpan360.")}</p>
      `);
  }
}

// ── Main handler ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: EmailRequest = await req.json();

    if (!payload.to || !payload.email_type || !payload.subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, email_type, subject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Try DB template first, fall back to hardcoded
    let htmlBody: string;
    try {
      const { data: template } = await supabase
        .from("email_templates")
        .select("body_html, is_active")
        .eq("email_type", payload.email_type)
        .eq("is_active", true)
        .maybeSingle();

      if (template?.body_html) {
        const vars = prepareTemplateData(payload.email_type, payload.template_data || {});
        const renderedBody = renderTemplate(template.body_html, vars);
        htmlBody = wrapEmail(renderedBody);
      } else {
        htmlBody = buildFallbackHtml(payload.email_type, payload.template_data || {});
      }
    } catch {
      // DB lookup failed — use hardcoded fallback
      htmlBody = buildFallbackHtml(payload.email_type, payload.template_data || {});
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    let errorMessage: string | null = null;

    if (resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: Deno.env.get("EMAIL_FROM") || "HealthSpan360 <noreply@hs360.co>",
            to: [payload.to],
            subject: payload.subject,
            html: htmlBody,
          }),
        });

        if (response.ok) {
          emailSent = true;
        } else {
          const errBody = await response.text();
          errorMessage = `Resend API error: ${response.status} - ${errBody}`;
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Failed to send via Resend";
      }
    } else {
      errorMessage = "No email provider configured (RESEND_API_KEY not set). Email logged but not sent.";
    }

    const { data: emailLog } = await supabase
      .from("email_notifications")
      .insert({
        user_id: payload.user_id || null,
        email_to: payload.to,
        email_type: payload.email_type,
        subject: payload.subject,
        body_html: htmlBody,
        status: emailSent ? "sent" : (resendKey ? "failed" : "pending"),
        error_message: errorMessage,
        metadata: payload.template_data || {},
        sent_at: emailSent ? new Date().toISOString() : null,
      })
      .select("id")
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: emailSent,
        email_id: emailLog?.id || null,
        warning: !resendKey ? "No email provider configured. Email was logged but not delivered." : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
