import { supabase } from './supabase';

export interface ShippingMethod {
  id: string;
  name: string;
  price: number;
  days: string;
}

export interface ContactInfo {
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
}

export interface SiteSettings {
  shipping: ShippingMethod[];
  contact: ContactInfo;
  sessionTimeoutMinutes: number;
}

const DEFAULT_SETTINGS: SiteSettings = {
  shipping: [
    { id: 'standard', name: 'Standard Shipping', price: 9.99, days: '5-7 business days' },
    { id: 'express', name: 'Express Shipping', price: 19.99, days: '2-3 business days' },
    { id: 'overnight', name: 'Overnight Shipping', price: 39.99, days: '1 business day' },
  ],
  contact: {
    phone: '1-800-HEALTH-360',
    email: 'support@healthspan360.com',
    addressLine1: '123 Wellness Way',
    addressLine2: 'Health City, HC 12345',
  },
  sessionTimeoutMinutes: 120,
};

const CACHE_KEY = 'site_settings_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedSettings {
  data: SiteSettings;
  timestamp: number;
}

function getCachedSettings(): SiteSettings | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSettings = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

function setCachedSettings(data: SiteSettings): void {
  try {
    const cached: CachedSettings = { data, timestamp: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // ignore
  }
}

function parseSettingsRows(rows: Array<{ key: string; value: unknown }>): Partial<SiteSettings> {
  const map = new Map<string, unknown>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }

  const shipping: ShippingMethod[] = [
    {
      id: 'standard',
      name: 'Standard Shipping',
      price: typeof map.get('shipping_standard_price') === 'number'
        ? (map.get('shipping_standard_price') as number)
        : DEFAULT_SETTINGS.shipping[0].price,
      days: typeof map.get('shipping_standard_days') === 'string'
        ? (map.get('shipping_standard_days') as string)
        : DEFAULT_SETTINGS.shipping[0].days,
    },
    {
      id: 'express',
      name: 'Express Shipping',
      price: typeof map.get('shipping_express_price') === 'number'
        ? (map.get('shipping_express_price') as number)
        : DEFAULT_SETTINGS.shipping[1].price,
      days: typeof map.get('shipping_express_days') === 'string'
        ? (map.get('shipping_express_days') as string)
        : DEFAULT_SETTINGS.shipping[1].days,
    },
    {
      id: 'overnight',
      name: 'Overnight Shipping',
      price: typeof map.get('shipping_overnight_price') === 'number'
        ? (map.get('shipping_overnight_price') as number)
        : DEFAULT_SETTINGS.shipping[2].price,
      days: typeof map.get('shipping_overnight_days') === 'string'
        ? (map.get('shipping_overnight_days') as string)
        : DEFAULT_SETTINGS.shipping[2].days,
    },
  ];

  const contact: ContactInfo = {
    phone: typeof map.get('contact_phone') === 'string'
      ? (map.get('contact_phone') as string)
      : DEFAULT_SETTINGS.contact.phone,
    email: typeof map.get('contact_email') === 'string'
      ? (map.get('contact_email') as string)
      : DEFAULT_SETTINGS.contact.email,
    addressLine1: typeof map.get('contact_address_line1') === 'string'
      ? (map.get('contact_address_line1') as string)
      : DEFAULT_SETTINGS.contact.addressLine1,
    addressLine2: typeof map.get('contact_address_line2') === 'string'
      ? (map.get('contact_address_line2') as string)
      : DEFAULT_SETTINGS.contact.addressLine2,
  };

  const timeoutVal = map.get('session_timeout_minutes');
  const sessionTimeoutMinutes = typeof timeoutVal === 'number' && timeoutVal > 0
    ? timeoutVal
    : DEFAULT_SETTINGS.sessionTimeoutMinutes;

  return { shipping, contact, sessionTimeoutMinutes };
}

export const siteSettingsService = {
  getDefaults(): SiteSettings {
    return { ...DEFAULT_SETTINGS };
  },

  async getSettings(): Promise<SiteSettings> {
    const cached = getCachedSettings();
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value');

      if (error || !data || data.length === 0) {
        return DEFAULT_SETTINGS;
      }

      const parsed = parseSettingsRows(data);
      const merged: SiteSettings = {
        shipping: parsed.shipping || DEFAULT_SETTINGS.shipping,
        contact: parsed.contact || DEFAULT_SETTINGS.contact,
        sessionTimeoutMinutes: parsed.sessionTimeoutMinutes || DEFAULT_SETTINGS.sessionTimeoutMinutes,
      };

      setCachedSettings(merged);
      return merged;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async updateSetting(key: string, value: unknown): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) throw error;

      sessionStorage.removeItem(CACHE_KEY);
      return true;
    } catch {
      return false;
    }
  },

  async getAllSettingsRaw(): Promise<Array<{ id: string; key: string; value: unknown; category: string; label: string; description: string }>> {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('id, key, value, category, label, description')
        .order('category')
        .order('key');

      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  clearCache(): void {
    sessionStorage.removeItem(CACHE_KEY);
  },
};
