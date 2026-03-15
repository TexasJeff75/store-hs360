import { supabase } from './supabase';

export interface EmailSettings {
  header_html: string;
  footer_html: string;
  updated_at: string | null;
  updated_by: string | null;
}

const DEFAULT_HEADER = `<div style="background: linear-gradient(135deg, #ec4899, #f97316); padding: 32px 24px; text-align: center;">
  <img src="/Logo_web.webp" alt="HealthSpan360" width="48" height="48" style="display:block;margin:0 auto 12px auto;border-radius:8px;" />
  <h1 style="color: white; font-size: 24px; margin: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 700;">
    HealthSpan360
  </h1>
  <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    Turning Insight Into Impact
  </p>
</div>`;

const DEFAULT_FOOTER = `<div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
  <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    HealthSpan360 &bull; This is an automated message. Please do not reply directly.
  </p>
</div>`;

export const emailSettingsService = {
  async get(): Promise<{ data: EmailSettings; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('header_html, footer_html, updated_at, updated_by')
        .eq('id', true)
        .maybeSingle();

      if (error) return { data: { header_html: DEFAULT_HEADER, footer_html: DEFAULT_FOOTER, updated_at: null, updated_by: null }, error: error.message };
      if (!data) return { data: { header_html: DEFAULT_HEADER, footer_html: DEFAULT_FOOTER, updated_at: null, updated_by: null }, error: null };
      return { data, error: null };
    } catch (err) {
      return { data: { header_html: DEFAULT_HEADER, footer_html: DEFAULT_FOOTER, updated_at: null, updated_by: null }, error: err instanceof Error ? err.message : 'Failed to fetch email settings' };
    }
  },

  async update(
    updates: Pick<EmailSettings, 'header_html' | 'footer_html'>,
    userId?: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('email_settings')
        .upsert({ id: true, ...updates, updated_by: userId || null });

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update email settings' };
    }
  },

  DEFAULT_HEADER,
  DEFAULT_FOOTER,
};
