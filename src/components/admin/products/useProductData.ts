import { useState, useEffect } from 'react';
import { Product, bigCommerceService } from '@/services/bigcommerce';
import { bcRestAPI } from '@/services/bigcommerceRestAPI';
import { cacheService } from '@/services/cache';

export function useProductData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setLoadingCosts(false);

      if (forceRefresh) {
        cacheService.delete('products_all');
      }

      const { products, errorMessage } = await bigCommerceService.getProducts();

      if (errorMessage) {
        setError(errorMessage);
      } else {
        setProducts(products);
        setLoading(false);
        setLoadingCosts(true);

        const productIds = products.map(p => p.id);
        try {
          const costData = await bcRestAPI.getProductCosts(productIds);


          const updatedProducts = products.map(product => {
            const costInfo = costData[product.id];
            if (costInfo) {
              return {
                ...product,
                cost: costInfo.cost_price !== null && costInfo.cost_price !== undefined ? costInfo.cost_price : undefined,
                brandId: costInfo.brand_id,
                brandName: costInfo.brand_name || product.brand
              };
            }
            return product;
          });

          setProducts(updatedProducts);
        } catch (costErr) {
          console.error('Failed to fetch product costs:', costErr);
        } finally {
          setLoadingCosts(false);
        }
      }
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
