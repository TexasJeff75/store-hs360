// data-only helpers
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const GQL = `${API_BASE}/gql`;

export async function gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
  // Add timeout and better error handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    console.log('Making GraphQL request to:', GQL);
    const res = await fetch(GQL, { 
      method: "POST",
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ query, variables }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const txt = await res.text();
    console.log('GraphQL response status:', res.status);
    console.log('GraphQL response:', txt.substring(0, 200) + '...');
    
    const json = JSON.parse(txt);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0,200)}`);
    if (json.errors?.length) {
      // Log, but still try to return data when present
      console.warn("GQL errors:", json.errors);
    }
    return json.data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('GraphQL request failed:', error);
    throw error;
  }
}

const PRODUCTS_Q = /* GraphQL */ `
  query ProductsDetailed($first: Int = 250) {
    site {
      products(first: $first) {
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
  async getProducts(logError?: (message: string, error?: Error) => void): Promise<{
    products: Product[];
    errorMessage?: string;
  }> {
    try {
      console.log('Fetching products from BigCommerce...');
      const data = await gql(PRODUCTS_Q, { first: 250 });
      console.log('Raw BigCommerce data:', data);
      
      const edges = data?.site?.products?.edges ?? [];
      console.log('Product edges found:', edges.length);
      
      const products = edges.map((edge: any) => 
        transformBigCommerceProduct(edge.node)
      );
      
      console.log('Transformed products:', products.length);
      
      if (products.length === 0) {
        const errorMessage = "No products found in BigCommerce. Check your store configuration.";
        console.warn(errorMessage);
        return { products: [], errorMessage };
      }
      
      return { products };
    } catch (error) {
      console.error('BigCommerce API Error:', error);
      const errorMessage = `BigCommerce API Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
    try {
      const data = await gql(CATEGORIES_Q, { root: 0 });
      const categoryTree = data?.site?.categoryTree ?? [];
      const categories = categoryTree.map((cat: any) => cat.name);
      
      if (categories.length === 0) {
        return { categories: [], errorMessage: "No categories found in BigCommerce" };
      }
      
      return { categories };
    } catch (error) {
      const errorMessage = "BigCommerce API unavailable";
      if (logError) {
        logError(errorMessage, error instanceof Error ? error : new Error(String(error)));
      }
      return { categories: [], errorMessage };
    }
  }
}

export const bigCommerceService = new BigCommerceService();