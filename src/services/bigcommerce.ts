// data-only helpers
const API_BASE = import.meta.env.VITE_API_BASE || "";
const GQL = `${API_BASE}/api/gql`;

export async function gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
  // Add timeout and better error handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  const res = await fetch(GQL, { 
    method: "POST",
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ query, variables }),
    signal: controller.signal
  });
  
  clearTimeout(timeoutId);
  
  const txt = await res.text();
  const json = JSON.parse(txt);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0,200)}`);
  if (json.errors?.length) {
    // Log, but still try to return data when present
    console.warn("GQL errors:", json.errors);
  }
  return json.data;
}

const PRODUCTS_Q = /* GraphQL */ `
  query ProductsDetailed($first: Int = 20) {
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
function transformBigCommerceProduct(bcProduct: any): Product {
  return {
    id: bcProduct.entityId,
    name: bcProduct.name,
    price: bcProduct.prices?.price?.value || bcProduct.defaultPrice || 0,
    originalPrice: bcProduct.prices?.salePrice?.value !== bcProduct.prices?.price?.value 
      ? bcProduct.prices?.price?.value 
      : undefined,
    image: bcProduct.defaultImage?.url || "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=640",
    rating: bcProduct.reviewSummary?.averageRating || 0,
    reviews: bcProduct.reviewSummary?.numberOfReviews || 0,
    category: bcProduct.categories?.edges?.[0]?.node?.name || "General",
    benefits: bcProduct.customFields?.edges?.map((edge: any) => edge.node.value) || []
  };
}

class BigCommerceService {
  async getProducts(logError?: (message: string, error?: Error) => void): Promise<{
    products: Product[];
    errorMessage?: string;
  }> {
    try {
      const data = await gql(PRODUCTS_Q, { first: 20 });
      const edges = data?.site?.products?.edges ?? [];
      const products = edges.map((edge: any) => 
        transformBigCommerceProduct(edge.node)
      );
      
      if (products.length === 0) {
        return { products: [], errorMessage: "No products found in BigCommerce" };
      }
      
      return { products };
    } catch (error) {
      const errorMessage = "BigCommerce API unavailable";
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