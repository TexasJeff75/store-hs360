/**
 * send-password-reset.cjs
 *
 * Generates a Supabase password-recovery link using the admin API
 * (bypasses captcha) then sends it via Resend.
 *
 * Caller must be an authenticated admin, distributor, or sales_rep.
 */
const { createClient } = require('@supabase/supabase-js');

const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin config missing');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getSupabaseUser(accessToken) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Supabase anon config missing');
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // ── Verify caller is an authenticated admin / distributor / sales_rep ──
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const userClient = getSupabaseUser(token);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid session' }) };
    }

    const adminClient = getSupabaseAdmin();
    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Profile not found' }) };
    }

    const allowedRoles = ['admin', 'distributor', 'sales_rep'];
    if (!allowedRoles.includes(callerProfile.role)) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    // ── Parse body ──
    const { email, redirectTo } = JSON.parse(event.body || '{}');
    if (!email) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'email is required' }) };
    }

    const siteUrl = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');
    const recoveryRedirect = redirectTo || `${siteUrl}/reset-password?type=recovery`;

    // ── Generate recovery link via admin API (no captcha) ──
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: recoveryRedirect },
    });

    if (linkError) {
      console.error('[send-password-reset] generateLink error:', linkError);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: linkError.message }) };
    }

    // Build link to our own app with the token_hash instead of using Supabase's
    // action_link. The action_link goes through Supabase's server which consumes
    // the one-time token on first hit — enterprise email security scanners
    // (Microsoft Safe Links, Proofpoint, etc.) pre-fetch links and consume the
    // token before the real user clicks. By linking directly to our app with the
    // token_hash, the token is only exchanged client-side via verifyOtp() when
    // real JavaScript executes in the user's browser.
    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to generate recovery link' }) };
    }

    const recoveryLink = `${recoveryRedirect}${recoveryRedirect.includes('?') ? '&' : '?'}token_hash=${encodeURIComponent(tokenHash)}`;


    // ── Send email via Resend ──
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'HealthSpan360 <noreply@hs360.co>';

    if (!resendApiKey) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Email service not configured' }) };
    }

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#111827;">Reset Your Password</h2>
        <p style="color:#374151;">You have been sent a password reset link. Click the button below to set your password.</p>
        <p style="margin:24px 0;">
          <a href="${recoveryLink}"
             style="background:#ec4899;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px;">This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${recoveryLink}" style="color:#6b7280;">${recoveryLink}</a>
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: emailFrom, to: [email], subject: 'Reset Your Password', html }),
    });

    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      console.error('[send-password-reset] Resend error:', resBody);
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to send email', detail: resBody }) };
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('[send-password-reset] Unexpected error:', err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || 'Internal server error' }) };
  }
};
