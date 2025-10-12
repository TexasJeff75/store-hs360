import { cacheService, CacheKeys, CacheTTL } from './cache';
import { ENV } from '../config/env';

const BC_STORE_HASH = ENV.BC_STORE_HASH;
const BC_STOREFRONT_TOKEN = ENV.BC_STOREFRONT_TOKEN;
const API_BASE = ENV.API_BASE;
const GQL = `${API_BASE}/gql`;

console.log('🔧 BigCommerce Environment Variables:');
console.log('  BC_STORE_HASH:', BC_STORE_HASH ? `"${BC_STORE_HASH}"` : 'undefined');
console.log('  BC_STOREFRONT_TOKEN:', BC_STOREFRONT_TOKEN ? `"${BC_STOREFRONT_TOKEN.substring(0, 20)}..."` : 'undefined');
console.log('  Both configured:', !!(BC_STORE_HASH && BC_STOREFRONT_TOKEN));

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
      if (res.status === 500 && json.error === 'MISSING_CREDENTIALS') {
        throw new Error('MISSING_CREDENTIALS');
      }
      throw new Error(`HTTP ${res.status}: ${txt.slice(0,200)}`);
    }

    if (json.errors?.length) {
      const errorMessages = json.errors.map((e: any) => e.message).join(', ');

      if (errorMessages.toLowerCase().includes('scope')) {
        console.error('❌ BigCommerce API Scope Error:', errorMessages);
        console.error('📖 See BIGCOMMERCE_SCOPES.md for help configuring token scopes');
        throw new Error(`Scope Error: ${errorMessages}. Your Storefront API token may be missing required permissions. Check BIGCOMMERCE_SCOPES.md`);
      }

      console.warn("GQL errors:", json.errors);
    }

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
            description
            plainTextDescription
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
  cost?: number;
  image: string;
  rating: number;
  reviews: number;
  category: string;
  benefits: string[];
  description?: string;
  plainTextDescription?: string;
}

// Data transformation helpers
function transformBigCommerceProduct(bc: any): Product {
  const base = bc?.prices?.price?.value ?? 0;
  const sale = bc?.prices?.salePrice?.value;

  // BigCommerce price is the normal retail price (what customer pays)
  // Use salePrice if available for promotional pricing, otherwise use base price
  const retailPrice = typeof sale === "number" ? sale : base;

  return {
    id: bc.entityId,
    name: bc.name,
    price: retailPrice, // This is the normal retail price
    originalPrice: undefined, // Not used currently
    cost: retailPrice, // TODO: Extract from custom field "cost" in BigCommerce
    image: bc.defaultImage?.url || "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=640",
    rating: bc.reviewSummary?.averageRating || 0,
    reviews: bc.reviewSummary?.numberOfReviews || 0,
    category: bc.categories?.edges?.[0]?.node?.name || "General",
    benefits: (bc.customFields?.edges ?? []).map((e: any) => e?.node?.value).filter(Boolean),
    description: bc.description || '',
    plainTextDescription: bc.plainTextDescription || ''
  };
}

class BigCommerceService {
  async getProducts(): Promise<{
    products: Product[];
    errorMessage?: string;
  }> {
    // Check if credentials are configured
    if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
      const errorMsg = 'BigCommerce credentials not configured. Please set up your store hash and storefront token.';
      console.error('❌', errorMsg);
      return { 
        products: [], 
        errorMessage: errorMsg
      };
    }

    // Try to get from cache first
    const cacheKey = CacheKeys.products();
    const cached = cacheService.get<{ products: Product[]; errorMessage?: string }>(cacheKey);
    if (cached) {
      console.log('📦 Products loaded from cache');
      return cached;
    }

    try {
      console.log('Fetching products from BigCommerce...');
      console.log('Using store hash:', BC_STORE_HASH);
      console.log('Token configured:', !!BC_STOREFRONT_TOKEN);
      
      let allProducts: Product[] = [];
      let hasNextPage = true;
      let cursor: string | null = null;
      let fetchedCount = 0;
      const maxProducts = 1000;
      
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
        console.warn('No products found from BigCommerce API');
        return { 
          products: [], 
          errorMessage: 'No products found in BigCommerce store'
        };
      }
      
      const result = { products: allProducts };
      
      // Cache successful results
      cacheService.set(cacheKey, result, CacheTTL.products);
      console.log('💾 Products cached for', CacheTTL.products / 1000 / 60, 'minutes');
      
      return result;
    } catch (error) {
      console.error('BigCommerce API Error:', error);
      
      if (error instanceof Error && error.message === 'MISSING_CREDENTIALS') {
        const errorMsg = 'BigCommerce credentials not configured. Please check your .env file for VITE_BC_STORE_HASH and VITE_BC_STOREFRONT_TOKEN';
        console.warn(errorMsg);
        return { 
          products: [], 
          errorMessage: errorMsg
        };
      }
      
      // For other API errors, return empty products with error message
      const errorMsg = `Failed to fetch products from BigCommerce: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.warn(errorMsg);
      return { 
        products: [], 
        errorMessage: errorMsg
      };
    }
  }

  async getCategories(): Promise<{
    categories: string[];
    errorMessage?: string;
  }> {
    // Check if credentials are configured
    if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
      const errorMsg = 'BigCommerce credentials not configured. Please set up your store hash and storefront token.';
      console.error('❌', errorMsg);
      return { 
        categories: [], 
        errorMessage: errorMsg
      };
    }

    // Try to get from cache first
    const cacheKey = CacheKeys.categories();
    const cached = cacheService.get<{ categories: string[]; errorMessage?: string }>(cacheKey);
    if (cached) {
      console.log('📦 Categories loaded from cache');
      return cached;
    }

    try {
      console.log('Fetching categories from BigCommerce...');
      const data = await gql(CATEGORIES_Q, { root: 0 });
      const categoryTree = data?.site?.categoryTree ?? [];
      const categories = categoryTree.map((cat: any) => cat.name);
      
      if (categories.length === 0) {
        console.warn('No categories found from BigCommerce API');
        return { 
          categories: ['General'], 
          errorMessage: 'No categories found in BigCommerce store'
        };
      }
      
      const result = { categories };
      
      // Cache successful results
      cacheService.set(cacheKey, result, CacheTTL.categories);
      console.log('💾 Categories cached for', CacheTTL.categories / 1000 / 60, 'minutes');
      
      return result;
    } catch (error) {
      console.error('BigCommerce Categories API Error:', error);
      
      if (error instanceof Error && error.message === 'MISSING_CREDENTIALS') {
        const errorMsg = 'BigCommerce credentials not configured. Please check your .env file for VITE_BC_STORE_HASH and VITE_BC_STOREFRONT_TOKEN';
        return { 
          categories: [], 
          errorMessage: errorMsg
        };
      }
      
      // For other API errors, return empty categories with error message
      const errorMsg = `Failed to fetch categories from BigCommerce: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return { 
        categories: [], 
        errorMessage: errorMsg
      };
    }
  }
}

export const bigCommerceService = new BigCommerceService();