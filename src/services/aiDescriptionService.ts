import { supabase } from './supabase';
import { Product, productService } from './productService';
import { ENV } from '../config/env';

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

export async function generateProductDescription(product: Product): Promise<string> {
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

  try {
    const description = await fetchFromEdgeFunction(payload);
    if (description) return description;
  } catch {
    // Edge function unavailable, fall through to client-side generation
  }

  return generateClientDescription(payload);
}

async function fetchFromEdgeFunction(
  payload: GenerateDescriptionPayload
): Promise<string> {
  const apiUrl = `${ENV.SUPABASE_URL}/functions/v1/generate-product-description`;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || ENV.SUPABASE_ANON_KEY;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'apikey': ENV.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Edge function error: ${response.status}`);
  }

  const data = await response.json();
  return data.description;
}

function generateClientDescription(product: GenerateDescriptionPayload): string {
  const name = product.name;
  const category = product.category || 'health and wellness';
  const brand = product.brand || '';
  const benefits = product.benefits || [];

  return buildDefaultHtml({ name, category, brand, benefits, product });
}

interface DescContext {
  name: string;
  category: string;
  brand: string;
  benefits: string[];
  product: GenerateDescriptionPayload;
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
