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

-- Update order_confirmation template: replace flex item rows with table-based layout
UPDATE email_templates SET body_html = $$<h2 style="color:#111827;font-size:20px;margin:0 0 8px 0;">Order Confirmed</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">Order #{{order_id}}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
  <thead><tr style="border-bottom:2px solid #e5e7eb;">
    <th style="text-align:left;padding:8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;">Item</th>
    <th style="text-align:right;padding:8px 0;font-size:12px;text-transform:uppercase;color:#6b7280;">Total</th>
  </tr></thead>
  <tbody>{{item_rows}}</tbody>
</table>
<div style="background-color:#f9fafb;border-radius:8px;padding:16px;text-align:right;" bgcolor="#f9fafb">
  <span style="font-size:16px;font-weight:700;color:#111827;">Total: ${{formatted_total}}</span>
</div>$$
WHERE email_type = 'order_confirmation';
