import { useState, useEffect } from 'react';
import { Product, productService } from '@/services/productService';

export function useProductData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const allProducts = await productService.getAllProducts();
      setProducts(allProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
      setLoadingCosts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return {
    products,
    loading,
    loadingCosts,
    error,
    refetchProducts: fetchProducts,
  };
}
