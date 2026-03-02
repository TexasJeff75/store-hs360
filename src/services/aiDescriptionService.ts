import { supabase } from './supabase';
import { Product, productService } from './productService';
import { ENV } from '../config/env';
import { descriptionTemplateService, DescriptionTemplate, TemplateSection } from './descriptionTemplateService';

interface GenerateDescriptionPayload {
  name: string;
  category?: string;
  brand?: string;
  price?: number;
  sku?: string;
  condition?: string;
  weight?: number;
  weightUnit?: string;
  benefits?: string[];
  existingDescription?: string;
}

interface EdgeFunctionPayload extends GenerateDescriptionPayload {
  templateSections?: TemplateSection[];
  systemPrompt?: string;
  guidelines?: string;
}

let cachedTemplate: DescriptionTemplate | null | undefined = undefined;

async function getDefaultTemplate(): Promise<DescriptionTemplate | null> {
  if (cachedTemplate !== undefined) return cachedTemplate;
  try {
    cachedTemplate = await descriptionTemplateService.getDefault();
  } catch {
    cachedTemplate = null;
  }
  return cachedTemplate;
}

export function clearTemplateCache(): void {
  cachedTemplate = undefined;
}

export async function generateProductDescription(product: Product, templateId?: string): Promise<string> {
  const payload: GenerateDescriptionPayload = {
    name: product.name,
    category: product.category !== 'Uncategorized' ? product.category : undefined,
    brand: product.brand || undefined,
    price: product.price,
    sku: product.sku || undefined,
    condition: product.condition || undefined,
    weight: product.weight || undefined,
    weightUnit: product.weightUnit || undefined,
    benefits: product.benefits?.length > 0 ? product.benefits : undefined,
    existingDescription: product.plainTextDescription || undefined,
  };

  let template: DescriptionTemplate | null = null;
  if (templateId) {
    template = await descriptionTemplateService.getById(templateId);
  } else {
    template = await getDefaultTemplate();
  }

  try {
    const description = await fetchFromEdgeFunction(payload, template);
    if (description) return description;
  } catch {
    // Edge function unavailable, fall through to client-side generation
  }

  return generateClientDescription(payload, template);
}

async function fetchFromEdgeFunction(
  payload: GenerateDescriptionPayload,
  template: DescriptionTemplate | null
): Promise<string> {
  const apiUrl = `${ENV.SUPABASE_URL}/functions/v1/super-responder`;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || ENV.SUPABASE_ANON_KEY;

  const edgePayload: EdgeFunctionPayload = { ...payload };

  if (template) {
    edgePayload.templateSections = template.sections;
    edgePayload.systemPrompt = template.system_prompt;
    edgePayload.guidelines = template.guidelines;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'apikey': ENV.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(edgePayload),
  });

  if (!response.ok) {
    throw new Error(`Edge function error: ${response.status}`);
  }

  const data = await response.json();
  return data.description;
}

function generateClientDescription(
  product: GenerateDescriptionPayload,
  template: DescriptionTemplate | null
): string {
  const name = product.name;
  const category = product.category || 'health and wellness';
  const brand = product.brand || '';
  const benefits = product.benefits || [];

  if (template && template.sections.length > 0) {
    return buildFromTemplate(template.sections, { name, category, brand, benefits, product });
  }

  return buildDefaultHtml({ name, category, brand, benefits, product });
}

interface DescContext {
  name: string;
  category: string;
  brand: string;
  benefits: string[];
  product: GenerateDescriptionPayload;
}

function buildFromTemplate(sections: TemplateSection[], ctx: DescContext): string {
  const parts = sections.map(section => {
    const heading = section.heading;

    if (section.type === 'list') {
      const items = ctx.benefits.length > 0
        ? ctx.benefits.map(b => `    <li>${escapeHtml(b)}</li>`).join('\n')
        : section.placeholder.split('\n').filter(Boolean).map(line => `    <li>${escapeHtml(line)}</li>`).join('\n');
      return `  <h3>${escapeHtml(heading)}</h3>\n  <ul>\n${items}\n  </ul>`;
    }

    const content = getSectionContent(heading, section.placeholder, ctx);
    return `  <h3>${escapeHtml(heading)}</h3>\n  <p>${content}</p>`;
  });

  return `<div>\n${parts.join('\n\n')}\n</div>`;
}

function getSectionContent(heading: string, placeholder: string, ctx: DescContext): string {
  const brandLine = ctx.brand ? ` by ${escapeHtml(ctx.brand)}` : '';
  const weightLine = ctx.product.weight && ctx.product.weightUnit
    ? ` Available in ${ctx.product.weight} ${ctx.product.weightUnit} size.`
    : '';
  const existingContext = ctx.product.existingDescription
    ? ` ${escapeHtml(ctx.product.existingDescription)}`
    : '';

  const productIntro = `${escapeHtml(ctx.name)} is a professional-grade ${escapeHtml(ctx.category.toLowerCase())} product${brandLine}`;

  if (placeholder && placeholder.trim().length > 0) {
    return `${productIntro}. ${escapeHtml(placeholder)}${weightLine}${existingContext}`;
  }

  return `${productIntro} designed for healthcare practitioners and their patients.${weightLine}${existingContext}`;
}

function buildDefaultHtml(ctx: DescContext): string {
  const brandLine = ctx.brand ? ` by ${escapeHtml(ctx.brand)}` : '';
  const weightLine = ctx.product.weight && ctx.product.weightUnit
    ? ` Available in ${ctx.product.weight} ${ctx.product.weightUnit} size.`
    : '';
  const existingContext = ctx.product.existingDescription
    ? ` ${escapeHtml(ctx.product.existingDescription)}`
    : '';

  const benefitItems = ctx.benefits.length > 0
    ? ctx.benefits.map(b => `    <li>${escapeHtml(b)}</li>`).join('\n')
    : `    <li>Professional-grade formulation</li>
    <li>Designed for healthcare practitioners</li>
    <li>Quality-tested ingredients</li>
    <li>Manufactured under strict quality controls</li>`;

  return `<div>
  <h3>Overview</h3>
  <p>${escapeHtml(ctx.name)} is a professional-grade ${escapeHtml(ctx.category.toLowerCase())} product${brandLine} designed for healthcare practitioners and their patients. This formulation is crafted to meet the highest standards of quality and efficacy.${weightLine}${existingContext}</p>

  <h3>Key Benefits</h3>
  <ul>
${benefitItems}
  </ul>

  <h3>How It Works</h3>
  <p>This product utilizes carefully selected ingredients to support optimal health outcomes. The formulation is designed to deliver targeted support through clinically relevant pathways, helping practitioners provide effective care for their patients.</p>

  <h3>Suggested Use</h3>
  <p>Use as directed by your healthcare practitioner. Refer to the product label for specific dosage and administration guidelines. For best results, follow the recommended protocol consistently.</p>

  <h3>Quality Assurance</h3>
  <p>Manufactured in a GMP-certified facility with rigorous third-party testing to ensure purity, potency, and safety. Each batch undergoes comprehensive quality control to meet the highest industry standards.</p>
</div>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

export async function saveGeneratedDescription(
  productId: number,
  htmlDescription: string
): Promise<boolean> {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlDescription;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';

  const updated = await productService.updateProduct(productId, {
    description: htmlDescription,
    plain_text_description: plainText.trim(),
  });

  return !!updated;
}
