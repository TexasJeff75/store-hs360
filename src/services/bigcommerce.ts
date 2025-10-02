// data-only helpers
import { cacheService, CacheKeys, CacheTTL } from './cache';

// Get BigCommerce configuration from environment
const BC_STORE_HASH = import.meta.env.VITE_BC_STORE_HASH;
const BC_STOREFRONT_TOKEN = import.meta.env.VITE_BC_STOREFRONT_TOKEN;

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const GQL = `${API_BASE}/gql`;

// BigCommerce Store Hash for checkout URLs
export async function gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const txt = await res.text();
    const json = JSON.parse(txt);

    if (!res.ok) {
      // Handle missing credentials specifically
      if (res.status === 500 && json.error === 'MISSING_CREDENTIALS') {
        throw new Error('MISSING_CREDENTIALS');
      }
      throw new Error(`HTTP ${res.status}: ${txt.slice(0,200)}`);
    }
    if (json.errors?.length) console.warn("GQL errors:", json.errors);

    return json.data as T;
  } catch (e) {
    clearTimeout(timeoutId);
    console.error("GraphQL request failed:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

const PRODUCTS_Q = /* GraphQL */ `
  query ProductsDetailed($first: Int = 50, $after: String) {
    site {
      products(first: $first, after: $after) {
        edges {
          node {
            entityId
            name
            path
            defaultImage { url(width: 640) }
            prices {
              price {
                value
                currencyCode
              }
              salePrice {
                value
                currencyCode
              }
            }
            categories {
              edges {
                node {
                  name
                  path
                }
              }
            }
            customFields {
              edges {
                node {
                  name
                  value
                }
              }
            }
            reviewSummary {
              averageRating
              numberOfReviews
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }`;

const CATEGORIES_Q = /* GraphQL */ `
  query Categories($root: Int = 0) {
    site {
      categoryTree(rootEntityId: $root) {
        entityId
        name
        path
        children {
          entityId
          name
          path
          children {
            entityId
            name
            path
          }
        }
      }
    }
  }`;

// TypeScript interfaces
export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  category: string;
  benefits: string[];
}

// Data transformation helpers
function transformBigCommerceProduct(bc: any): Product {
  const base = bc?.prices?.price?.value ?? 0;
  const sale = bc?.prices?.salePrice?.value;

  return {
    id: bc.entityId,
    name: bc.name,
    price: (typeof sale === "number" ? sale : base),
    originalPrice: (typeof sale === "number" ? base : undefined),
    image: bc.defaultImage?.url || "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=640",
    rating: bc.reviewSummary?.averageRating || 0,
    reviews: bc.reviewSummary?.numberOfReviews || 0,
    category: bc.categories?.edges?.[0]?.node?.name || "General",
    benefits: (bc.customFields?.edges ?? []).map((e: any) => e?.node?.value).filter(Boolean)
  };
}

class BigCommerceService {
  async getProducts(logError?: (message: string, error?: Error) => void, maxProducts: number = 1000): Promise<{
    products: Product[];
    errorMessage?: string;
  }> {
    // Try to get from cache first
    const cacheKey = CacheKeys.products();
    const cached = cacheService.get<{ products: Product[]; errorMessage?: string }>(cacheKey);
    if (cached) {
      console.log('📦 Products loaded from cache');
      return cached;
    }

    try {
      console.log('Fetching products from BigCommerce...');
      
      let allProducts: Product[] = [];
      let hasNextPage = true;
      let cursor: string | null = null;
      let fetchedCount = 0;
      
      while (hasNextPage && fetchedCount < maxProducts) {
        const remainingProducts = maxProducts - fetchedCount;
        const batchSize = Math.min(50, remainingProducts);
        
        console.log(`Fetching batch: ${fetchedCount + 1}-${fetchedCount + batchSize}`);
        
        const variables: any = { first: batchSize };
        if (cursor) {
          variables.after = cursor;
        }
        
        const data = await gql(PRODUCTS_Q, variables);
        console.log(`Batch data received:`, data?.site?.products?.edges?.length || 0, 'products');
        
        const edges = data?.site?.products?.edges ?? [];
        const pageInfo = data?.site?.products?.pageInfo;
        
        if (edges.length === 0) {
          break;
        }
        
        const batchProducts = edges.map((edge: any) => 
          transformBigCommerceProduct(edge.node)
        );
        
        allProducts = [...allProducts, ...batchProducts];
        fetchedCount += edges.length;
        
        hasNextPage = pageInfo?.hasNextPage || false;
        cursor = pageInfo?.endCursor || null;
        
        console.log(`Total products fetched so far: ${allProducts.length}`);
        
        if (!hasNextPage) {
          console.log('No more pages available');
          break;
        }
      }
      
      console.log(`Final product count: ${allProducts.length}`);
      
      if (allProducts.length === 0) {
        const errorMessage = "No products found in BigCommerce. Check your store configuration.";
        console.warn(errorMessage);
        const result = { products: [], errorMessage };
        // Don't cache empty results
        return result;
      }
      
      const result = { products: allProducts };
      
      // Cache successful results
      cacheService.set(cacheKey, result, CacheTTL.products);
      console.log('💾 Products cached for', CacheTTL.products / 1000 / 60, 'minutes');
      
      return result;
    } catch (error) {
      console.error('BigCommerce API Error:', error);
      let errorMessage = "BigCommerce API unavailable";
      
      if (error instanceof Error && error.message === 'MISSING_CREDENTIALS') {
        errorMessage = "BigCommerce credentials not configured. Please set up your store hash and storefront token.";
      }
      
      if (logError) {
        logError(errorMessage, error instanceof Error ? error : new Error(String(error)));
      }
      return { products: [], errorMessage };
    }
  }

  async getCategories(logError?: (message: string, error?: Error) => void): Promise<{
    categories: string[];
    errorMessage?: string;
  }> {
    // Try to get from cache first
    const cacheKey = CacheKeys.categories();
    const cached = cacheService.get<{ categories: string[]; errorMessage?: string }>(cacheKey);
    if (cached) {
      console.log('📦 Categories loaded from cache');
      return cached;
    }

    try {
      const data = await gql(CATEGORIES_Q, { root: 0 });
      const categoryTree = data?.site?.categoryTree ?? [];
      const categories = categoryTree.map((cat: any) => cat.name);
      
      if (categories.length === 0) {
        const result = { categories: [], errorMessage: "No categories found in BigCommerce" };
        // Don't cache empty results
        return result;
      }
      
      const result = { categories };
      
      // Cache successful results
      cacheService.set(cacheKey, result, CacheTTL.categories);
      console.log('💾 Categories cached for', CacheTTL.categories / 1000 / 60, 'minutes');
      
      return result;
    } catch (error) {
      let errorMessage = "BigCommerce API unavailable";
      
      if (error instanceof Error && error.message === 'MISSING_CREDENTIALS') {
        errorMessage = "BigCommerce credentials not configured. Please set up your store hash and storefront token.";
      }
      
      if (logError) {
        logError(errorMessage, error instanceof Error ? error : new Error(String(error)));
      }
      return { categories: [], errorMessage };
    }
  }
}

export const bigCommerceService = new BigCommerceService();