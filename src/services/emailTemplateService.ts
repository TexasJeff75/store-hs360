import { supabase } from './supabase';

export interface EmailTemplateVariable {
  key: string;
  description: string;
  example?: string;
}

export interface EmailTemplate {
  id: string;
  email_type: string;
  name: string;
  subject_template: string;
  body_html: string;
  variables: EmailTemplateVariable[];
  is_active: boolean;
  updated_at: string;
  updated_by: string | null;
}

export const emailTemplateService = {
  async getAll(): Promise<{ data: EmailTemplate[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (error) return { data: [], error: error.message };
      return { data: data || [], error: null };
    } catch (err) {
      return { data: [], error: err instanceof Error ? err.message : 'Failed to fetch templates' };
    }
  },

  async update(
    id: string,
    updates: Partial<Pick<EmailTemplate, 'subject_template' | 'body_html' | 'is_active'>>,
    userId?: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ ...updates, updated_by: userId || null })
        .eq('id', id);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update template' };
    }
  },
};
