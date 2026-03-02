import { supabase } from './supabase';

export interface TemplateSection {
  heading: string;
  placeholder: string;
  type?: 'paragraph' | 'list';
}

export interface DescriptionTemplate {
  id: string;
  name: string;
  is_default: boolean;
  sections: TemplateSection[];
  system_prompt: string;
  guidelines: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATE: Omit<DescriptionTemplate, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Default Health & Wellness',
  is_default: true,
  sections: [
    { heading: 'Overview', placeholder: '2-3 sentences summarizing what this product is and who it\'s for' },
    { heading: 'Key Benefits', placeholder: 'Benefit 1\nBenefit 2\nBenefit 3\nBenefit 4', type: 'list' },
    { heading: 'How It Works', placeholder: '2-3 sentences explaining the mechanism or usage' },
    { heading: 'Suggested Use', placeholder: 'Directions for use or recommended dosage/application' },
    { heading: 'Quality Assurance', placeholder: '1-2 sentences about quality, testing, or manufacturing standards' },
  ],
  system_prompt: 'You are a professional product copywriter for a health and wellness e-commerce platform that serves healthcare practitioners and clinics. Write detailed, accurate product descriptions.',
  guidelines: 'Write in a professional, informative tone suitable for healthcare practitioners.\nDo NOT make specific medical claims or diagnoses.\nUse phrases like "may support", "designed to help", "formulated for".\nFocus on ingredients, mechanisms, and practical benefits.\nKeep it factual and evidence-informed.\nDo not include any markdown, only return clean HTML.',
};

export const descriptionTemplateService = {
  async getAll(): Promise<DescriptionTemplate[]> {
    const { data, error } = await supabase
      .from('description_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');

    if (error) {
      console.error('Error fetching description templates:', error);
      return [];
    }

    return (data || []).map(this.mapRow);
  },

  async getDefault(): Promise<DescriptionTemplate | null> {
    const { data, error } = await supabase
      .from('description_templates')
      .select('*')
      .eq('is_default', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching default template:', error);
      return null;
    }

    return data ? this.mapRow(data) : null;
  },

  async create(template: Omit<DescriptionTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<DescriptionTemplate | null> {
    if (template.is_default) {
      await supabase
        .from('description_templates')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('description_templates')
      .insert({
        name: template.name,
        is_default: template.is_default,
        sections: template.sections,
        system_prompt: template.system_prompt,
        guidelines: template.guidelines,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating template:', error);
      return null;
    }

    return data ? this.mapRow(data) : null;
  },

  async update(id: string, updates: Partial<Omit<DescriptionTemplate, 'id' | 'created_at' | 'updated_at'>>): Promise<boolean> {
    if (updates.is_default) {
      await supabase
        .from('description_templates')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    const { error } = await supabase
      .from('description_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating template:', error);
      return false;
    }

    return true;
  },

  async remove(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('description_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return false;
    }

    return true;
  },

  async setDefault(id: string): Promise<boolean> {
    await supabase
      .from('description_templates')
      .update({ is_default: false })
      .eq('is_default', true);

    const { error } = await supabase
      .from('description_templates')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error setting default template:', error);
      return false;
    }

    return true;
  },

  getHardcodedDefault(): Omit<DescriptionTemplate, 'id' | 'created_at' | 'updated_at'> {
    return { ...DEFAULT_TEMPLATE };
  },

  buildHtmlFromSections(sections: TemplateSection[]): string {
    const parts = sections.map(section => {
      if (section.type === 'list') {
        const items = section.placeholder.split('\n').filter(Boolean);
        const listItems = items.map(item => `    <li>[${item}]</li>`).join('\n');
        return `  <h3>${section.heading}</h3>\n  <ul>\n${listItems}\n  </ul>`;
      }
      return `  <h3>${section.heading}</h3>\n  <p>[${section.placeholder}]</p>`;
    });

    return `<div>\n${parts.join('\n\n')}\n</div>`;
  },

  mapRow(row: Record<string, unknown>): DescriptionTemplate {
    return {
      id: row.id as string,
      name: row.name as string,
      is_default: row.is_default as boolean,
      sections: (row.sections || []) as TemplateSection[],
      system_prompt: row.system_prompt as string,
      guidelines: row.guidelines as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  },
};
