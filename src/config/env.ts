export const ENV = {
  API_BASE: import.meta.env.VITE_API_BASE || '/api',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  QB_CLIENT_ID: import.meta.env.VITE_QB_CLIENT_ID || '',
  QB_ENVIRONMENT: import.meta.env.VITE_QB_ENVIRONMENT || 'sandbox',
  QB_REALM_ID: import.meta.env.VITE_QB_REALM_ID || '',
  QB_REDIRECT_URI: import.meta.env.VITE_QB_REDIRECT_URI || '',
  QB_REDIRECT_URI_PROD: import.meta.env.VITE_QB_REDIRECT_URI_PROD || '',
} as const;

function validateEnv(): { isValid: boolean; missing: string[] } {
  const required = {
    SUPABASE_URL: ENV.SUPABASE_URL,
    SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => `VITE_${key}`);

  return {
    isValid: missing.length === 0,
    missing,
  };
}

if (typeof window !== 'undefined') {
  const validation = validateEnv();
  if (!validation.isValid) {
    console.warn('Missing environment variables:', validation.missing);
  }
}
