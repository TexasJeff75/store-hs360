export const ENV = {
  BC_STORE_HASH: import.meta.env.VITE_BC_STORE_HASH || '',
  BC_STOREFRONT_TOKEN: import.meta.env.VITE_BC_STOREFRONT_TOKEN || '',
  API_BASE: import.meta.env.VITE_API_BASE || '/api',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  QB_CLIENT_ID: import.meta.env.VITE_QB_CLIENT_ID || '',
  QB_CLIENT_SECRET: import.meta.env.VITE_QB_CLIENT_SECRET || '',
  QB_ENVIRONMENT: import.meta.env.VITE_QB_ENVIRONMENT || 'sandbox',
  QB_REDIRECT_URI: import.meta.env.VITE_QB_REDIRECT_URI || '',
  QB_REDIRECT_URI_PROD: import.meta.env.VITE_QB_REDIRECT_URI_PROD || '',
} as const;

function validateEnv(): { isValid: boolean; missing: string[] } {
  const required = {
    BC_STORE_HASH: ENV.BC_STORE_HASH,
    BC_STOREFRONT_TOKEN: ENV.BC_STOREFRONT_TOKEN,
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
    console.warn('⚠️ Missing environment variables:', validation.missing);
  }

  console.log('🔧 Environment Configuration:');
  console.log('  - DEV mode:', import.meta.env.DEV);
  console.log('  - API_BASE:', ENV.API_BASE);
  console.log('  - VITE_API_BASE env var:', import.meta.env.VITE_API_BASE || '(not set - using auto-detection)');
}
