/**
 * request-password-reset.cjs
 *
 * Public (unauthenticated) endpoint that lets any user request a password
 * reset email. Protected by Turnstile CAPTCHA and rate-limiting.
 *
 * Always returns 200 to prevent email enumeration — the caller cannot
 * tell whether the email exists or not.
 */
const { createClient } = require('@supabase/supabase-js');
const { verifyTurnstileToken } = require('./utils/turnstile-verify.cjs');

const ALLOWED_ORIGIN = process.env.CORS_ALLOWED_ORIGIN || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Simple in-memory rate limiter: max 3 requests per email per 15 minutes
const rateLimitMap = new Map();
const MAX_PER_EMAIL = 3;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now - record.windowStart > WINDOW_MS) {
    rateLimitMap.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (record.count >= MAX_PER_EMAIL) {
    return false;
  }

  record.count++;
  return true;
}

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin config missing');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    const { email, turnstileToken } = body;

    if (!email || typeof email !== 'string') {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Email is required' }) };
    }

    // Verify Turnstile CAPTCHA
    if (!turnstileToken) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'CAPTCHA verification required' }) };
    }

    const captchaResult = await verifyTurnstileToken(
      turnstileToken,
      event.headers['x-forwarded-for'] || event.headers['client-ip']
    );
    if (!captchaResult.success) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'CAPTCHA verification failed' }) };
    }

    // Rate limit per email
    if (!checkRateLimit(email)) {
      // Still return 200 to prevent enumeration — but silently skip
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    const adminClient = getSupabaseAdmin();

    // Check if the email exists in auth.users (via profiles table to avoid exposing auth internals)
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!profile) {
      // Email doesn't exist — return success anyway to prevent enumeration
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    // Generate recovery link
    const siteUrl = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');
    const recoveryRedirect = `${siteUrl}/reset-password?type=recovery`;

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase().trim(),
      options: { redirectTo: recoveryRedirect },
    });

    if (linkError) {
      console.error('[request-password-reset] generateLink error:', linkError);
      // Return success to prevent enumeration
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    const tokenHash = linkData?.properties?.hashed_token;
    if (!tokenHash) {
      console.error('[request-password-reset] No hashed_token returned');
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    const recoveryLink = `${recoveryRedirect}${recoveryRedirect.includes('?') ? '&' : '?'}token_hash=${encodeURIComponent(tokenHash)}`;

    // Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'HealthSpan360 <noreply@hs360.co>';

    if (!resendApiKey) {
      console.error('[request-password-reset] RESEND_API_KEY not configured');
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#111827;">Reset Your Password</h2>
        <p style="color:#374151;">We received a request to reset the password for your HealthSpan360 account. Click the button below to set a new password.</p>
        <p style="margin:24px 0;">
          <a href="${recoveryLink}"
             style="background:#ec4899;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color:#6b7280;font-size:14px;">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${recoveryLink}" style="color:#6b7280;">${recoveryLink}</a>
        </p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: emailFrom, to: [email.toLowerCase().trim()], subject: 'Reset Your Password', html }),
    });

    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      console.error('[request-password-reset] Resend error:', resBody);
    }

    // Always return success
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('[request-password-reset] Unexpected error:', err);
    // Return success even on errors to prevent enumeration
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
  }
};
