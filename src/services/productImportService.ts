import { supabase } from './supabase';

export interface ImportRow {
  name: string;
  sku?: string;
  price: number;
  cost?: number;
  original_price?: number;
  category?: string;
  brand?: string;
  description?: string;
  condition?: string;
  weight?: number;
  weight_unit?: string;
  is_in_stock?: boolean;
  is_active?: boolean;
  image_url?: string;
  secret_cost?: number;
  contract_price?: number;
  pricing_type?: string;
  entity_id?: string;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportValidationError[];
  pricingCreated: number;
}

const REQUIRED_COLUMNS = ['name', 'price'];

const ALL_COLUMNS = [
  'name', 'sku', 'price', 'cost', 'original_price', 'category', 'brand',
  'description', 'condition', 'weight', 'weight_unit', 'is_in_stock',
  'is_active', 'image_url', 'secret_cost', 'contract_price', 'pricing_type', 'entity_id',
];

export function generateTemplate(): string {
  const headers = ALL_COLUMNS.join(',');
  const example = [
    '"Example Product"', '"SKU-001"', '99.99', '50.00', '129.99',
    '"Peptides"', '"ABM"', '"A sample product description"', '"New"',
    '0.5', '"lb"', 'true', 'true', '""', '25.00', '""', '""', '""',
  ].join(',');
  return `${headers}\n${example}`;
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  if (!text.trim()) return { headers: [], rows: [] };

  const records: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field.trim());
        field = '';
      } else if (char === '\n' || (char === '\r' && text[i + 1] === '\n')) {
        if (char === '\r') i++;
        current.push(field.trim());
        field = '';
        if (current.some(c => c !== '')) {
          records.push(current);
        }
        current = [];
      } else if (char === '\r') {
        current.push(field.trim());
        field = '';
        if (current.some(c => c !== '')) {
          records.push(current);
        }
        current = [];
      } else {
        field += char;
      }
    }
  }

  current.push(field.trim());
  if (current.some(c => c !== '')) {
    records.push(current);
  }

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = records.slice(1);

  return { headers, rows };
}

export function validateImportData(
  headers: string[],
  rows: string[][]
): { parsedRows: ImportRow[]; errors: ImportValidationError[] } {
  const errors: ImportValidationError[] = [];
  const parsedRows: ImportRow[] = [];

  const missingRequired = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missingRequired.length > 0) {
    errors.push({
      row: 0,
      field: 'headers',
      message: `Missing required columns: ${missingRequired.join(', ')}`,
    });
    return { parsedRows, errors };
  }

  const colIndex = (col: string) => headers.indexOf(col);

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const getValue = (col: string) => {
      const i = colIndex(col);
      return i >= 0 && i < row.length ? row[i].replace(/^"|"$/g, '') : '';
    };

    const name = getValue('name');
    if (!name) {
      errors.push({ row: rowNum, field: 'name', message: 'Product name is required' });
      return;
    }

    const priceStr = getValue('price').replace(/[$,]/g, '');
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) {
      errors.push({ row: rowNum, field: 'price', message: `Invalid price: "${priceStr}"` });
      return;
    }

    const costStr = getValue('cost').replace(/[$,]/g, '');
    const cost = costStr ? parseFloat(costStr) : undefined;
    if (costStr && (isNaN(cost!) || cost! < 0)) {
      errors.push({ row: rowNum, field: 'cost', message: `Invalid cost: "${costStr}"` });
      return;
    }

    const originalPriceStr = getValue('original_price').replace(/[$,]/g, '');
    const originalPrice = originalPriceStr ? parseFloat(originalPriceStr) : undefined;

    const weightStr = getValue('weight');
    const weight = weightStr ? parseFloat(weightStr) : undefined;

    const isInStockStr = getValue('is_in_stock').toLowerCase();
    const isInStock = isInStockStr === '' ? true : isInStockStr !== 'false' && isInStockStr !== '0';

    const isActiveStr = getValue('is_active').toLowerCase();
    const isActive = isActiveStr === '' ? true : isActiveStr !== 'false' && isActiveStr !== '0';

    const secretCostStr = getValue('secret_cost').replace(/[$,]/g, '');
    const secretCost = secretCostStr ? parseFloat(secretCostStr) : undefined;
    if (secretCostStr && (isNaN(secretCost!) || secretCost! < 0)) {
      errors.push({ row: rowNum, field: 'secret_cost', message: `Invalid secret cost: "${secretCostStr}"` });
      return;
    }

    const contractPriceStr = getValue('contract_price').replace(/[$,]/g, '');
    const contractPrice = contractPriceStr ? parseFloat(contractPriceStr) : undefined;
    if (contractPriceStr && isNaN(contractPrice!)) {
      errors.push({ row: rowNum, field: 'contract_price', message: `Invalid contract price: "${contractPriceStr}"` });
      return;
    }

    const pricingType = getValue('pricing_type');
    const entityId = getValue('entity_id');

    if (contractPrice !== undefined && !pricingType) {
      errors.push({ row: rowNum, field: 'pricing_type', message: 'pricing_type required when contract_price is set' });
      return;
    }
    if (contractPrice !== undefined && !entityId) {
      errors.push({ row: rowNum, field: 'entity_id', message: 'entity_id required when contract_price is set' });
      return;
    }

    parsedRows.push({
      name,
      sku: getValue('sku') || undefined,
      price,
      cost,
      original_price: originalPrice,
      category: getValue('category') || undefined,
      brand: getValue('brand') || undefined,
      description: getValue('description') || undefined,
      condition: getValue('condition') || undefined,
      weight,
      weight_unit: getValue('weight_unit') || undefined,
      is_in_stock: isInStock,
      is_active: isActive,
      image_url: getValue('image_url') || undefined,
      secret_cost: secretCost,
      contract_price: contractPrice,
      pricing_type: pricingType || undefined,
      entity_id: entityId || undefined,
    });
  });

  return { parsedRows, errors };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function importProducts(
  rows: ImportRow[],
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    pricingCreated: 0,
  };

  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id, name');
  const categoryMap = new Map(
    (existingCategories || []).map(c => [c.name.toLowerCase(), c.id])
  );

  const { data: existingBrands } = await supabase
    .from('brands')
    .select('id, name');
  const brandMap = new Map(
    (existingBrands || []).map(b => [b.name.toLowerCase(), b.id])
  );

  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, sku, name');
  const skuMap = new Map<string, number>();
  const nameMap = new Map<string, number>();
  (existingProducts || []).forEach(p => {
    if (p.sku) skuMap.set(p.sku.toLowerCase(), p.id);
    nameMap.set(p.name.toLowerCase(), p.id);
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    onProgress?.(i + 1, rows.length);

    try {
      let categoryId: string | undefined;
      if (row.category) {
        const key = row.category.toLowerCase();
        if (categoryMap.has(key)) {
          categoryId = categoryMap.get(key);
        } else {
          const slug = slugify(row.category);
          const { data: existingBySlug } = await supabase
            .from('categories')
            .select('id, name')
            .eq('slug', slug)
            .maybeSingle();

          if (existingBySlug) {
            categoryId = existingBySlug.id;
            categoryMap.set(key, existingBySlug.id);
          } else {
            const { data: newCat, error: catError } = await supabase
              .from('categories')
              .insert({ name: row.category, slug, is_active: true })
              .select('id')
              .single();
            if (catError) {
              result.errors.push({ row: rowNum, field: 'category', message: catError.message });
            } else {
              categoryId = newCat.id;
              categoryMap.set(key, newCat.id);
            }
          }
        }
      }

      let brandId: string | undefined;
      if (row.brand) {
        const key = row.brand.toLowerCase();
        if (brandMap.has(key)) {
          brandId = brandMap.get(key);
        } else {
          const slug = slugify(row.brand);
          const { data: existingBySlug } = await supabase
            .from('brands')
            .select('id, name')
            .eq('slug', slug)
            .maybeSingle();

          if (existingBySlug) {
            brandId = existingBySlug.id;
            brandMap.set(key, existingBySlug.id);
          } else {
            const { data: newBrand, error: brandError } = await supabase
              .from('brands')
              .insert({ name: row.brand, slug, is_active: true })
              .select('id')
              .single();
            if (brandError) {
              result.errors.push({ row: rowNum, field: 'brand', message: brandError.message });
            } else {
              brandId = newBrand.id;
              brandMap.set(key, newBrand.id);
            }
          }
        }
      }

      const baseSlug = slugify(row.name);
      const slug = row.sku ? `${baseSlug}-${slugify(row.sku)}` : baseSlug;

      const productPayload: Record<string, unknown> = {
        name: row.name,
        price: row.price,
        slug,
        is_in_stock: row.is_in_stock ?? true,
        is_active: row.is_active ?? true,
      };
      if (row.sku) productPayload.sku = row.sku;
      if (row.cost !== undefined) productPayload.cost = row.cost;
      if (row.original_price !== undefined) productPayload.original_price = row.original_price;
      if (categoryId) productPayload.category_id = categoryId;
      if (brandId) productPayload.brand_id = brandId;
      if (row.description) productPayload.description = row.description;
      if (row.condition) productPayload.condition = row.condition;
      if (row.weight !== undefined) productPayload.weight = row.weight;
      if (row.weight_unit) productPayload.weight_unit = row.weight_unit;
      if (row.image_url) productPayload.image_url = row.image_url;

      let existingId: number | undefined;
      if (row.sku && skuMap.has(row.sku.toLowerCase())) {
        existingId = skuMap.get(row.sku.toLowerCase());
      } else if (!row.sku && nameMap.has(row.name.toLowerCase())) {
        existingId = nameMap.get(row.name.toLowerCase());
      }

      let productId: number;

      if (existingId) {
        const { data: updated, error: updateErr } = await supabase
          .from('products')
          .update({ ...productPayload, updated_at: new Date().toISOString() })
          .eq('id', existingId)
          .select('id')
          .single();
        if (updateErr) {
          result.errors.push({ row: rowNum, field: 'product', message: updateErr.message });
          result.skipped++;
          continue;
        }
        productId = updated.id;
        result.updated++;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('products')
          .insert(productPayload)
          .select('id')
          .single();
        if (createErr) {
          result.errors.push({ row: rowNum, field: 'product', message: createErr.message });
          result.skipped++;
          continue;
        }
        productId = created.id;
        if (row.sku) skuMap.set(row.sku.toLowerCase(), productId);
        nameMap.set(row.name.toLowerCase(), productId);
        result.created++;
      }

      if (row.secret_cost !== undefined) {
        const { data: existingSecret } = await supabase
          .from('product_secret_costs')
          .select('id')
          .eq('product_id', productId)
          .maybeSingle();

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        if (existingSecret) {
          await supabase
            .from('product_secret_costs')
            .update({ secret_cost: row.secret_cost, updated_by: userId })
            .eq('product_id', productId);
        } else {
          await supabase
            .from('product_secret_costs')
            .insert({
              product_id: productId,
              secret_cost: row.secret_cost,
              created_by: userId,
              updated_by: userId,
            });
        }
      }

      if (row.contract_price !== undefined && row.pricing_type && row.entity_id) {
        const { error: pricingErr } = await supabase
          .from('contract_pricing')
          .upsert({
            pricing_type: row.pricing_type,
            entity_id: row.entity_id,
            product_id: productId,
            contract_price: row.contract_price,
            min_quantity: 1,
            effective_date: new Date().toISOString(),
            ...(row.pricing_type === 'individual' && { user_id: row.entity_id }),
          }, {
            onConflict: 'pricing_type,entity_id,product_id',
            ignoreDuplicates: false,
          });
        if (pricingErr) {
          result.errors.push({ row: rowNum, field: 'contract_price', message: pricingErr.message });
        } else {
          result.pricingCreated++;
        }
      }
    } catch (err: any) {
      result.errors.push({ row: rowNum, field: 'unknown', message: err.message || 'Unexpected error' });
      result.skipped++;
    }
  }

  return result;
}

export function exportProductsCSV(products: Array<{
  name: string;
  sku?: string;
  price: number;
  cost?: number;
  original_price?: number;
  category?: string;
  brand?: string;
  description?: string;
  condition?: string;
  weight?: number;
  weight_unit?: string;
  is_in_stock?: boolean;
  is_active?: boolean;
  image_url?: string;
  secret_cost?: number;
}>): string {
  const headers = [
    'name', 'sku', 'price', 'cost', 'original_price', 'category', 'brand',
    'description', 'condition', 'weight', 'weight_unit', 'is_in_stock', 'is_active', 'image_url', 'secret_cost',
  ];

  const escapeCSV = (val: string | number | boolean | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = products.map(p =>
    headers.map(h => escapeCSV((p as any)[h])).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
