import { supabase } from './supabase';

export interface ProductCost {
  product_id: number;
  cost_price: number | null;
  secret_cost: number | null;
  retail_price: number | null;
  sale_price: number | null;
  product_name: string | null;
  sku: string | null;
  last_synced_at: string;
}

export const productCostsService = {
  async getProductCost(productId: number): Promise<ProductCost | null> {
    const { data, error } = await supabase
      .from('product_costs')
      .select('*')
      .eq('product_id', productId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching product cost:', error);
      throw error;
    }

    return data;
  },

  async getProductCosts(productIds: number[]): Promise<Map<number, ProductCost>> {
    const { data, error } = await supabase
      .from('product_costs')
      .select('*')
      .in('product_id', productIds);

    if (error) {
      console.error('Error fetching product costs:', error);
      throw error;
    }

    const costMap = new Map<number, ProductCost>();
    data?.forEach(cost => {
      costMap.set(cost.product_id, cost);
    });

    return costMap;
  },

  async getAllProductCosts(): Promise<ProductCost[]> {
    const { data, error } = await supabase
      .from('product_costs')
      .select('*')
      .order('product_name');

    if (error) {
      console.error('Error fetching all product costs:', error);
      throw error;
    }

    return data || [];
  },

  async upsertProductCost(productCost: Omit<ProductCost, 'created_at' | 'updated_at' | 'last_synced_at'>): Promise<void> {
    const { error } = await supabase
      .from('product_costs')
      .upsert({
        ...productCost,
        last_synced_at: new Date().toISOString()
      }, {
        onConflict: 'product_id'
      });

    if (error) {
      console.error('Error upserting product cost:', error);
      throw error;
    }
  },

  async syncProductCostsFromBigCommerce(products: any[]): Promise<void> {
    const productCosts = products.map(product => ({
      product_id: product.id,
      cost_price: product.cost_price || null,
      retail_price: product.retail_price || product.price || null,
      sale_price: product.sale_price || null,
      product_name: product.name || null,
      sku: product.sku || null
    }));

    for (const cost of productCosts) {
      await this.upsertProductCost(cost);
    }
  }
};
