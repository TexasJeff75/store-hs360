-- Add user_invitation email template
INSERT INTO email_templates (email_type, name, subject_template, body_html, variables, is_active)
VALUES (
  'user_invitation',
  'User Invitation',
  'You''re Invited to HealthSpan360',
  $$<div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
  <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
  <p style="color:#6b7280;font-size:14px;margin:0;">You've been invited to join our platform.</p>
</div>

<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
  <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Email</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{email}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Role</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{role}}</span>
  </div>
</div>

<div style="text-align:center;margin-bottom:24px;">
  <p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">
    To get started, please set your password using the link below:
  </p>
  <a href="{{login_url}}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#f97316);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
    Set Up Your Password
  </a>
</div>

<p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
  This link will expire in 24 hours. If it expires, contact your administrator for a new invitation.
</p>$$,
  '[
    {"key":"full_name","description":"Invited user full name","example":"John Doe"},
    {"key":"email","description":"Invited user email address","example":"john@example.com"},
    {"key":"role","description":"Assigned role","example":"customer"},
    {"key":"login_url","description":"Password setup URL (recovery link)","example":"https://store.healthspan360.com"}
  ]'::jsonb,
  true
)
ON CONFLICT (email_type) DO UPDATE SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html = EXCLUDED.body_html,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;
