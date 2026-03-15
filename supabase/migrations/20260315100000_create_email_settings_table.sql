-- Global email settings: editable header and footer HTML
-- Singleton table (max one row enforced by CHECK constraint)
CREATE TABLE IF NOT EXISTS email_settings (
  id            BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  header_html   TEXT NOT NULL DEFAULT '',
  footer_html   TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID REFERENCES auth.users(id)
);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW EXECUTE FUNCTION update_email_settings_updated_at();

-- RLS: admin-only access
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email settings"
  ON email_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow the Netlify function (service role) to read settings
CREATE POLICY "Service role can read email settings"
  ON email_settings FOR SELECT
  USING (true);

-- Seed with the default header and footer
INSERT INTO email_settings (header_html, footer_html) VALUES (
  $$<div style="background: linear-gradient(135deg, #ec4899, #f97316); padding: 32px 24px; text-align: center;">
  <img src="/Logo_web.webp" alt="HealthSpan360" width="48" height="48" style="display:block;margin:0 auto 12px auto;border-radius:8px;" />
  <h1 style="color: white; font-size: 24px; margin: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 700;">
    HealthSpan360
  </h1>
  <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    Turning Insight Into Impact
  </p>
</div>$$,
  $$<div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
  <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    HealthSpan360 &bull; This is an automated message. Please do not reply directly.
  </p>
</div>$$
) ON CONFLICT (id) DO NOTHING;
