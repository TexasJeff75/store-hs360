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
    // Check if credentials are configured
    if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
      console.warn('BigCommerce credentials not configured, using mock data');
      if (logError) {
        logError('BigCommerce credentials not configured. Please set up your store hash and storefront token.');
      }
      return this.getMockProducts();
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
        console.warn('No products found, using mock data');
        return this.getMockProducts();
      }
      
      const result = { products: allProducts };
      
      // Cache successful results
      cacheService.set(cacheKey, result, CacheTTL.products);
      console.log('💾 Products cached for', CacheTTL.products / 1000 / 60, 'minutes');
      
      return result;
    } catch (error) {
      console.error('BigCommerce API Error:', error);
      
      // Log the actual error for debugging
      if (logError) {
        logError(error instanceof Error ? error.message : String(error), 'BigCommerce API');
      }
      
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

  async getCategories(logError?: (message: string, error?: Error) => void): Promise<{
    categories: string[];
    errorMessage?: string;
  }> {
    // Check if credentials are configured
    if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
      console.warn('BigCommerce credentials not configured, using mock data');
      if (logError) {
        logError('BigCommerce credentials not configured. Please set up your store hash and storefront token.');
      }
      return this.getMockCategories();
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
      
      // Log the actual error for debugging
      if (logError) {
        logError(error instanceof Error ? error.message : String(error), 'BigCommerce Categories API');
      }
      
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

  /**
   * Mock products for development when BigCommerce is not configured
   */
  private getMockProducts(): { products: Product[]; errorMessage?: string } {
    const mockProducts: Product[] = [
      {
        id: 1,
        name: "Premium Collagen Peptides",
        price: 89.99,
        originalPrice: 109.99,
        image: "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=640",
        rating: 4.8,
        reviews: 127,
        category: "Peptides",
        benefits: ["Anti-aging", "Joint Health", "Skin Health"]
      },
      {
        id: 2,
        name: "BPC-157 Recovery Complex",
        price: 149.99,
        image: "https://images.pexels.com/photos/3786157/pexels-photo-3786157.jpeg?auto=compress&cs=tinysrgb&w=640",
        rating: 4.9,
        reviews: 89,
        category: "Peptides",
        benefits: ["Muscle Recovery", "Tissue Repair", "Gut Health"]
      },
      {
        id: 3,
        name: "Comprehensive Genetic Panel",
        price: 299.99,
        originalPrice: 399.99,
        image: "https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=640",
        rating: 4.7,
        reviews: 203,
        category: "Genetic Testing",
        benefits: ["Personalized Medicine", "Health Insights", "Risk Assessment"]
      },
      {
        id: 4,
        name: "Advanced Hormone Panel",
        price: 199.99,
        image: "https://images.pexels.com/photos/3938023/pexels-photo-3938023.jpeg?auto=compress&cs=tinysrgb&w=640",
        rating: 4.6,
        reviews: 156,
        category: "Lab Testing",
        benefits: ["Hormone Balance", "Energy Optimization", "Wellness Tracking"]
      },
      {
        id: 5,
        name: "NAD+ Booster Supplement",
        price: 79.99,
        originalPrice: 99.99,
        image: "https://images.pexels.com/photos/3683056/pexels-photo-3683056.jpeg?auto=compress&cs=tinysrgb&w=640",
        rating: 4.5,
        reviews: 94,
        category: "Supplements",
        benefits: ["Cellular Energy", "Anti-aging", "Mental Clarity"]
      },
      {
        id: 6,
        name: "Thymosin Alpha-1 Immune Support",
        price: 179.99,
        image: "https://images.pexels.com/photos/3683081/pexels-photo-3683081.jpeg?auto=compress&cs=tinysrgb&w=640",
        rating: 4.8,
        reviews: 67,
        category: "Peptides",
        benefits: ["Immune Support", "Recovery", "Vitality"]
      },
      {
        id: 7,
        name: "Micronutrient Analysis",
        price: 159.99,
        image: "https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=640",
        rating: 4.4,
        reviews: 112,
        category: "Lab Testing",
        benefits: ["Nutritional Status", "Deficiency Detection", "Optimization"]
      },
      {
        id: 8,
        name: "Longevity Wellness Program",
        price: 499.99,
        originalPrice: 699.99,
        image: "https://images.pexels.com/photos/3938023/pexels-photo-3938023.jpeg?auto=compress&cs=tinysrgb&w=640",
        rating: 4.9,
        reviews: 45,
        category: "Wellness Programs",
        benefits: ["Comprehensive Care", "Personalized Plan", "Expert Guidance"]
      }
    ];

    console.log('🎭 Using mock products for development');
    return { products: mockProducts };
  }

  /**
   * Mock categories for development when BigCommerce is not configured
   */
  private getMockCategories(): { categories: string[]; errorMessage?: string } {
    const mockCategories = ["Peptides", "Genetic Testing", "Lab Testing", "Supplements", "Wellness Programs"];
    console.log('🎭 Using mock categories for development');
    return { categories: mockCategories };
  }
}

export const bigCommerceService = new BigCommerceService();