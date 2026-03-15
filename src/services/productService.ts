import { supabase } from './supabase';

export interface Product {
  id: number;
  name: string;
  sku?: string;
  slug?: string;
  price: number;
  cost?: number;
  originalPrice?: number;
  image: string;
  hasImage: boolean;
  hasDescription: boolean;
  category: string;
  categoryId?: string;
  brand?: string;
  brandId?: string;
  brandName?: string;
  condition?: string;
  weight?: number;
  weightUnit?: string;
  isInStock?: boolean;
  isActive?: boolean;
  benefits: string[];
  description?: string;
  plainTextDescription?: string;
  extendedDescription?: string;
  reference1?: string;
  reference2?: string;
  reference3?: string;
  customFields?: Array<{ name: string; value: string }>;
  rating: number;
  reviews: number;
  images?: Array<{ id: string; url: string; altText: string; sortOrder: number; isPrimary: boolean }>;
}

export interface Category {
  id: string;
  name: string;
  slug?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  children?: Category[];
}

export interface Brand {
  id: string;
  name: string;
  slug?: string;
  isActive: boolean;
}

interface DBProduct {
  id: number;
  name: string;
  sku: string | null;
  slug: string | null;
  description: string | null;
  plain_text_description: string | null;
  price: number;
  cost: number | null;
  original_price: number | null;
  category_id: string | null;
  brand_id: string | null;
  condition: string | null;
  weight: number | null;
  weight_unit: string | null;
  is_in_stock: boolean;
  is_active: boolean;
  image_url: string | null;
  sort_order: number;
  extended_description: string | null;
  reference_1: string | null;
  reference_2: string | null;
  reference_3: string | null;
  custom_fields: Array<{ name: string; value: string }> | null;
  categories?: { name: string } | null;
  brands?: { name: string } | null;
}

function mapDBProduct(row: DBProduct): Product {
  const customFields = row.custom_fields || [];
  const benefits = customFields
    .filter((f) => f.name?.toLowerCase() === 'benefit')
    .map((f) => f.value);

  return {
    id: row.id,
    name: row.name,
    sku: row.sku || undefined,
    slug: row.slug || undefined,
    price: Number(row.price) || 0,
    cost: row.cost ? Number(row.cost) : undefined,
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    image: row.image_url || '',
    hasImage: !!row.image_url,
    hasDescription: !!(row.description || row.plain_text_description),
    category: (row.categories as any)?.name || 'Uncategorized',
    categoryId: row.category_id || undefined,
    brand: (row.brands as any)?.name || undefined,
    brandId: row.brand_id || undefined,
    brandName: (row.brands as any)?.name || undefined,
    condition: row.condition || undefined,
    weight: row.weight ? Number(row.weight) : undefined,
    weightUnit: row.weight_unit || 'lb',
    isInStock: row.is_in_stock,
    isActive: row.is_active,
    benefits,
    description: row.description || undefined,
    plainTextDescription: row.plain_text_description || undefined,
    extendedDescription: row.extended_description || undefined,
    reference1: row.reference_1 || undefined,
    reference2: row.reference_2 || undefined,
    reference3: row.reference_3 || undefined,
    customFields: customFields.length > 0 ? customFields : undefined,
    rating: 0,
    reviews: 0,
  };
}

class ProductService {
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name), brands(name)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }

    return (data || []).map(mapDBProduct);
  }

  async getAllProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name), brands(name)')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching all products:', error);
      return [];
    }

    return (data || []).map(mapDBProduct);
  }

  async getProductById(id: number): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name), brands(name)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapDBProduct(data);
  }

  async getProductsByIds(ids: number[]): Promise<Product[]> {
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name), brands(name)')
      .in('id', ids);

    if (error) {
      console.error('Error fetching products by IDs:', error);
      return [];
    }

    return (data || []).map(mapDBProduct);
  }

  async createProduct(product: {
    name: string;
    sku?: string;
    slug?: string;
    description?: string;
    plain_text_description?: string;
    price: number;
    cost?: number;
    original_price?: number;
    category_id?: string;
    brand_id?: string;
    condition?: string;
    weight?: number;
    weight_unit?: string;
    is_in_stock?: boolean;
    is_active?: boolean;
    image_url?: string;
    sort_order?: number;
    custom_fields?: Array<{ name: string; value: string }>;
  }): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select('*, categories(name), brands(name)')
      .single();

    if (error) {
      console.error('Error creating product:', error);
      throw new Error(error.message);
    }

    return mapDBProduct(data);
  }

  async updateProduct(
    id: number,
    updates: Partial<{
      name: string;
      sku: string;
      slug: string;
      description: string;
      plain_text_description: string;
      price: number;
      cost: number;
      original_price: number;
      category_id: string;
      brand_id: string;
      condition: string;
      weight: number;
      weight_unit: string;
      is_in_stock: boolean;
      is_active: boolean;
      image_url: string;
      sort_order: number;
      custom_fields: Array<{ name: string; value: string }>;
    }>
  ): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, categories(name), brands(name)')
      .single();

    if (error) {
      console.error('Error updating product:', error);
      throw new Error(error.message);
    }

    return mapDBProduct(data);
  }

  async deleteProduct(id: number): Promise<boolean> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      console.error('Error deleting product:', error);
      return false;
    }
    return true;
  }

  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    const flat = (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parent_id,
      sortOrder: c.sort_order,
      isActive: c.is_active,
    }));

    return buildCategoryTree(flat);
  }

  async getAllCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching all categories:', error);
      return [];
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parent_id,
      sortOrder: c.sort_order,
      isActive: c.is_active,
    }));
  }

  async createCategory(category: {
    name: string;
    slug?: string;
    parent_id?: string;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw new Error(error.message);
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      parentId: data.parent_id,
      sortOrder: data.sort_order,
      isActive: data.is_active,
    };
  }

  async updateCategory(
    id: string,
    updates: Partial<{
      name: string;
      slug: string;
      parent_id: string | null;
      sort_order: number;
      is_active: boolean;
    }>
  ): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      throw new Error(error.message);
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      parentId: data.parent_id,
      sortOrder: data.sort_order,
      isActive: data.is_active,
    };
  }

  async deleteCategory(id: string): Promise<boolean> {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      console.error('Error deleting category:', error);
      return false;
    }
    return true;
  }

  async getBrands(): Promise<Brand[]> {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching brands:', error);
      return [];
    }

    return (data || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      isActive: b.is_active,
    }));
  }

  async getAllBrands(): Promise<Brand[]> {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching all brands:', error);
      return [];
    }

    return (data || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      isActive: b.is_active,
    }));
  }

  async createBrand(brand: { name: string; slug?: string; is_active?: boolean }): Promise<Brand | null> {
    const { data, error } = await supabase.from('brands').insert(brand).select().single();

    if (error) {
      console.error('Error creating brand:', error);
      throw new Error(error.message);
    }

    return { id: data.id, name: data.name, slug: data.slug, isActive: data.is_active };
  }

  async updateBrand(
    id: string,
    updates: Partial<{ name: string; slug: string; is_active: boolean }>
  ): Promise<Brand | null> {
    const { data, error } = await supabase
      .from('brands')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating brand:', error);
      throw new Error(error.message);
    }

    return { id: data.id, name: data.name, slug: data.slug, isActive: data.is_active };
  }

  async deleteBrand(id: string): Promise<boolean> {
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) {
      console.error('Error deleting brand:', error);
      return false;
    }
    return true;
  }

  async getProductImages(productId: number) {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching product images:', error);
      return [];
    }

    return (data || []).map((img: any) => ({
      id: img.id,
      url: img.image_url,
      altText: img.alt_text || '',
      sortOrder: img.sort_order,
      isPrimary: img.is_primary,
    }));
  }

  async getProductCosts(productIds: number[]): Promise<Map<number, number>> {
    if (productIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('products')
      .select('id, cost')
      .in('id', productIds);

    if (error) {
      console.error('Error fetching product costs:', error);
      return new Map();
    }

    const costMap = new Map<number, number>();
    (data || []).forEach((p: any) => {
      if (p.cost !== null && p.cost !== undefined) {
        costMap.set(p.id, Number(p.cost));
      }
    });

    return costMap;
  }
}

function buildCategoryTree(flat: Category[]): Category[] {
  const map = new Map<string, Category>();
  const roots: Category[] = [];

  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));

  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export const productService = new ProductService();
