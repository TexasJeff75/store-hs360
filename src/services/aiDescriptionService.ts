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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to generate description (${response.status})`);
  }

  const data = await response.json();
  return data.description;
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
