-- Email templates table for admin-managed email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type    TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  subject_template TEXT NOT NULL DEFAULT '',
  body_html     TEXT NOT NULL DEFAULT '',
  variables     JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID REFERENCES auth.users(id)
);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_email_templates_updated_at();

-- RLS: admin-only access
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates"
  ON email_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed the 8 existing templates
INSERT INTO email_templates (email_type, name, subject_template, body_html, variables) VALUES
(
  'order_confirmation',
  'Order Confirmation',
  'Order Confirmed — #{{order_id}}',
  $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Order Confirmed</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Order #{{order_id}}</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
  <thead><tr style="border-bottom:2px solid #e5e7eb;">
    <th style="text-align:left;padding:8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;">Item</th>
    <th style="text-align:center;padding:8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;">Qty</th>
    <th style="text-align:right;padding:8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;">Total</th>
  </tr></thead>
  <tbody>{{item_rows}}</tbody>
</table>
<div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:right;">
  <span style="font-size:16px;font-weight:700;color:#111827;">Total: ${{formatted_total}}</span>
</div>$$,
  '[{"key":"order_id","description":"Short order ID (first 8 chars, uppercased)","example":"A1B2C3D4"},{"key":"formatted_total","description":"Order total formatted with 2 decimals","example":"149.99"},{"key":"item_rows","description":"Pre-rendered HTML table rows for order items (auto-generated)","example":"<tr><td>Product</td><td>2</td><td>$29.98</td></tr>"}]'::jsonb
),
(
  'recurring_order_processed',
  'Recurring Order Processed',
  'Recurring Order Processed',
  $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Recurring Order Processed</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Your recurring order has been automatically placed.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:16px;">
  <p style="color:#166534;font-size:14px;margin:0;"><strong>{{product_name}}</strong> x {{quantity}}</p>
  <p style="color:#166534;font-size:16px;font-weight:700;margin:8px 0 0 0;">${{formatted_amount}}</p>
</div>
{{next_date_html}}$$,
  '[{"key":"product_name","description":"Name of the product","example":"Vitamin D3"},{"key":"quantity","description":"Order quantity","example":"2"},{"key":"formatted_amount","description":"Total amount formatted","example":"49.98"},{"key":"next_date_html","description":"Next delivery date HTML (auto-generated, may be empty)","example":"<p>Next delivery: <strong>2026-04-15</strong></p>"}]'::jsonb
),
(
  'recurring_order_failed',
  'Recurring Order Failed',
  'Recurring Order Failed',
  $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Recurring Order Failed</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">We were unable to process your recurring order.</p>
<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px;">
  <p style="color:#991b1b;font-size:14px;margin:0;"><strong>{{product_name}}</strong></p>
  <p style="color:#991b1b;font-size:13px;margin:8px 0 0 0;">{{error}}</p>
</div>
<p style="color:#6b7280;font-size:14px;">Please check your payment method and try again, or contact support for assistance.</p>$$,
  '[{"key":"product_name","description":"Name of the product","example":"Vitamin D3"},{"key":"error","description":"Error message describing the failure","example":"Payment method declined"}]'::jsonb
),
(
  'account_approved',
  'Account Approved',
  'Your Account Has Been Approved',
  $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Account Approved</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Your account has been approved. You can now log in and start placing orders.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{login_url}}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#f97316);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
    Log In Now
  </a>
</div>$$,
  '[{"key":"login_url","description":"URL to the login page","example":"https://store.hs360.co"}]'::jsonb
),
(
  'account_denied',
  'Account Denied',
  'Account Update',
  $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Account Update</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">We were unable to approve your account at this time.</p>
<p style="color:#6b7280;font-size:14px;">If you believe this is an error, please contact our support team for assistance.</p>$$,
  '[]'::jsonb
),
(
  'support_ticket_created',
  'Support Ticket Created',
  'Support Ticket Created — {{ticket_number}}',
  $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Support Ticket Created</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">We've received your support request and will respond as soon as possible.</p>
<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
  <p style="color:#1e40af;font-size:13px;margin:0;">Ticket {{ticket_number}}</p>
  <p style="color:#1e40af;font-size:15px;font-weight:600;margin:4px 0 0 0;">{{subject}}</p>
</div>$$,
  '[{"key":"ticket_number","description":"Support ticket number","example":"TK-00042"},{"key":"subject","description":"Ticket subject line","example":"Issue with my order"}]'::jsonb
),
(
  'support_ticket_reply',
  'Support Ticket Reply',
  'New Reply on Ticket {{ticket_number}}',
  $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">New Reply on Your Ticket</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">There's a new reply on ticket {{ticket_number}}.</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
  <p style="color:#374151;font-size:14px;margin:0;white-space:pre-wrap;">{{message}}</p>
</div>$$,
  '[{"key":"ticket_number","description":"Support ticket number","example":"TK-00042"},{"key":"message","description":"Reply message content","example":"We have shipped your replacement item."}]'::jsonb
),
(
  'support_ticket_resolved',
  'Support Ticket Resolved',
  'Ticket {{ticket_number}} Resolved',
  $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Ticket Resolved</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Your support ticket {{ticket_number}} has been marked as resolved.</p>
<p style="color:#6b7280;font-size:14px;">If your issue isn't fully resolved, you can create a new ticket anytime.</p>$$,
  '[{"key":"ticket_number","description":"Support ticket number","example":"TK-00042"}]'::jsonb
)
ON CONFLICT (email_type) DO NOTHING;
