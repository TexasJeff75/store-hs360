const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Cloudflare Turnstile token server-side.
 * @param {string} token - The Turnstile response token from the client
 * @param {string} [remoteIp] - The client's IP address (optional, improves accuracy)
 * @returns {{ success: boolean, errorCodes?: string[] }}
 */
async function verifyTurnstileToken(token, remoteIp) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    // In production, missing CAPTCHA config should be treated as a configuration error
    const isProduction = process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';
    if (isProduction) {
      console.error('TURNSTILE_SECRET_KEY not configured in production — blocking request for safety');
      return { success: false, errorCodes: ['missing-secret-key'] };
    }
    console.warn('TURNSTILE_SECRET_KEY not configured — skipping CAPTCHA verification (non-production)');
    return { success: true };
  }

  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });

    const result = await response.json();
    return {
      success: result.success === true,
      errorCodes: result['error-codes'] || [],
    };
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return { success: false, errorCodes: ['network-error'] };
  }
}

module.exports = { verifyTurnstileToken };
