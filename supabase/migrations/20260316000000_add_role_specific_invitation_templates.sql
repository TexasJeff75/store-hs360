-- Add role-specific invitation email templates
-- Previously all roles used a single "user_invitation" type which meant
-- admins couldn't customize the invitation per role via the Email Templates Manager.

INSERT INTO email_templates (email_type, name, subject_template, body_html, variables) VALUES
(
  'customer_invitation',
  'Customer Invitation',
  'Welcome to HealthSpan360',
  $$<div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
  <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
  <p style="color:#6b7280;font-size:14px;margin:0;">You've been invited to join our platform as a customer.</p>
</div>
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
  <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Name</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{full_name}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Email</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{email}}</span>
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
<p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
  Once your password is set, you can browse products and place orders.
</p>$$,
  '[{"key":"full_name","description":"Customer full name","example":"John Doe"},{"key":"email","description":"Customer email address","example":"john@example.com"},{"key":"login_url","description":"Password setup link","example":"https://store.hs360.co/reset"}]'::jsonb
),
(
  'distributor_invitation',
  'Distributor Invitation',
  'Welcome to HealthSpan360 — Distributor Account',
  $$<div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
  <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
  <p style="color:#6b7280;font-size:14px;margin:0;">You've been set up as a distributor on our platform.</p>
</div>
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
  <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Name</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{full_name}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Email</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{email}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Role</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">Distributor</span>
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
<p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
  Once your password is set, you can manage your sales reps, set product pricing, and view commission reports from your distributor portal.
</p>$$,
  '[{"key":"full_name","description":"Distributor full name","example":"Jane Smith"},{"key":"email","description":"Distributor email address","example":"jane@distributor.com"},{"key":"login_url","description":"Password setup link","example":"https://store.hs360.co/reset"}]'::jsonb
),
(
  'sales_rep_invitation',
  'Sales Rep Invitation',
  'Welcome to HealthSpan360 — Sales Rep Account',
  $$<div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
  <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
  <p style="color:#6b7280;font-size:14px;margin:0;">You've been set up as a sales representative on our platform.</p>
</div>
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
  <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Name</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{full_name}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Email</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{email}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Role</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">Sales Representative</span>
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
<p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">
  Once your password is set, you can view your assigned organizations, track commissions, and manage customer relationships.
</p>$$,
  '[{"key":"full_name","description":"Sales rep full name","example":"Mike Johnson"},{"key":"email","description":"Sales rep email address","example":"mike@sales.com"},{"key":"login_url","description":"Password setup link","example":"https://store.hs360.co/reset"}]'::jsonb
),
(
  'user_invitation',
  'User Invitation (General)',
  'You''re Invited to HealthSpan360',
  $$<div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7eb;margin-bottom:24px;">
  <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome to HealthSpan360!</h2>
  <p style="color:#6b7280;font-size:14px;margin:0;">You've been invited to join our platform.</p>
</div>
<div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
  <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px 0;">Your Account Details</h3>
  <div style="display:flex;justify-content:space-between;padding:6px 0;">
    <span style="font-size:14px;color:#6b7280;">Name</span>
    <span style="font-size:14px;font-weight:500;color:#111827;">{{full_name}}</span>
  </div>
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
</div>$$,
  '[{"key":"full_name","description":"User full name","example":"John Doe"},{"key":"email","description":"User email address","example":"john@example.com"},{"key":"role","description":"User role","example":"admin"},{"key":"login_url","description":"Password setup link","example":"https://store.hs360.co/reset"}]'::jsonb
)
ON CONFLICT (email_type) DO NOTHING;
