/*
  # Create site_settings table

  Key-value store for configurable site settings (shipping rates, contact info,
  session timeout). Referenced by src/services/siteSettings.ts.

  Columns match the service's getAllSettingsRaw() query:
    id, key, value, category, label, description
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       JSONB,
  category    TEXT NOT NULL DEFAULT 'general',
  label       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_settings_category ON site_settings(category);

-- Enable RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins have full access to site_settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

-- All authenticated users can read (needed for shipping rates on checkout)
CREATE POLICY "Authenticated users can read site_settings"
  ON site_settings FOR SELECT
  TO authenticated
  USING (true);

-- Seed default settings
INSERT INTO site_settings (key, value, category, label, description) VALUES
  ('shipping_standard_price', '9.99', 'shipping', 'Standard Shipping Price', 'Price for standard shipping'),
  ('shipping_standard_days', '"5-7 business days"', 'shipping', 'Standard Shipping Days', 'Estimated delivery time for standard shipping'),
  ('shipping_express_price', '19.99', 'shipping', 'Express Shipping Price', 'Price for express shipping'),
  ('shipping_express_days', '"2-3 business days"', 'shipping', 'Express Shipping Days', 'Estimated delivery time for express shipping'),
  ('shipping_overnight_price', '39.99', 'shipping', 'Overnight Shipping Price', 'Price for overnight shipping'),
  ('shipping_overnight_days', '"1 business day"', 'shipping', 'Overnight Shipping Days', 'Estimated delivery time for overnight shipping'),
  ('contact_phone', '"1-800-HEALTH-360"', 'contact', 'Phone Number', 'Company contact phone number'),
  ('contact_email', '"support@healthspan360.com"', 'contact', 'Email', 'Company contact email'),
  ('contact_address_line1', '"123 Wellness Way"', 'contact', 'Address Line 1', 'Company address line 1'),
  ('contact_address_line2', '"Health City, HC 12345"', 'contact', 'Address Line 2', 'Company address line 2'),
  ('session_timeout_minutes', '120', 'security', 'Session Timeout (minutes)', 'Auto-logout after this many minutes of inactivity')
ON CONFLICT (key) DO NOTHING;
