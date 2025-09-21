// data-only helpers
const API_BASE = import.meta.env.VITE_API_BASE || "";
const GQL = `${API_BASE}/api/gql`;

export async function gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const res = await fetch(GQL, { 
    method: "POST",
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ query, variables })
  });
  const txt = await res.text();
  const json = JSON.parse(txt);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0,200)}`);
  if (json.errors?.length) {
    // Log, but still try to return data when present
    console.warn("GQL errors:", json.errors);
  }
  return json.data;
}

export const PRODUCTS_BASIC = `
  query Products($first: Int = 20) {
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
                }
              }
            }
          }
        }
      }
    }
  }`;

export const CATEGORIES_BASIC = `
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

// Mock data for fallback
export const mockProducts: Product[] = [
  {
    id: 1,
    name: "Premium Peptide Complex",
    price: 89.99,
    originalPrice: 119.99,
    image: "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=640",
    rating: 4.8,
    reviews: 124,
    category: "Peptides",
    benefits: ["Energy Support", "Recovery"]
  },
  {
    id: 2,
    name: "Genetic Health Panel",
    price: 299.99,
    image: "https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=640",
    rating: 4.9,
    reviews: 89,
    category: "Testing",
    benefits: ["Health Insights", "Personalized"]
  },
  {
    id: 3,
    name: "Advanced Biomarker Test",
    price: 199.99,
    originalPrice: 249.99,
    image: "https://images.pexels.com/photos/3938023/pexels-photo-3938023.jpeg?auto=compress&cs=tinysrgb&w=640",
    rating: 4.7,
    reviews: 156,
    category: "Testing",
    benefits: ["Comprehensive", "Lab Quality"]
  }
];

export const mockCategories: string[] = ["Peptides", "Testing", "Supplements", "Wellness"];

// Data transformation helpers
export function transformBigCommerceProduct(bcProduct: any): Product {
  return {
    id: bcProduct.entityId,
    name: bcProduct.name,
    price: bcProduct.prices?.price?.value || 0,
    originalPrice: bcProduct.prices?.salePrice?.value !== bcProduct.prices?.price?.value 
      ? bcProduct.prices?.price?.value 
      : undefined,
    image: bcProduct.defaultImage?.url || "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=640",
    rating: 4.5, // Default rating
    reviews: Math.floor(Math.random() * 200) + 10, // Random reviews
    category: bcProduct.categories?.edges?.[0]?.node?.name || "General",
    benefits: ["Health Support", "Quality Tested"] // Default benefits
  };
}

// API functions
export async function fetchProducts(logError?: (message: string, error?: Error) => void): Promise<{
  products: Product[];
  errorMessage?: string;
}> {
  try {
    const data = await gql(PRODUCTS_BASIC, { first: 20 });
    const edges = data?.site?.products?.edges ?? [];
    const products = edges.map((edge: any) => 
      transformBigCommerceProduct(edge.node)
    );
    
    return { products: products.length > 0 ? products : mockProducts };
  } catch (error) {
    const errorMessage = "BigCommerce API unavailable, using sample data";
    if (logError) {
      logError(errorMessage, error instanceof Error ? error : new Error(String(error)));
    }
    return { products: mockProducts, errorMessage };
  }
}

export async function fetchCategories(logError?: (message: string, error?: Error) => void): Promise<{
  categories: string[];
  errorMessage?: string;
}> {
  try {
    const data = await gql(CATEGORIES_BASIC, { root: 0 });
    const categoryTree = data?.site?.categoryTree ?? [];
    const categories = categoryTree.map((cat: any) => cat.name);
    
    return { categories: categories.length > 0 ? categories : mockCategories };
  } catch (error) {
    const errorMessage = "BigCommerce API unavailable, using sample categories";
    if (logError) {
      logError(errorMessage, error instanceof Error ? error : new Error(String(error)));
    }
    return { categories: mockCategories, errorMessage };
  }
}

// Export service object for backward compatibility
export const bigCommerceService = {
  getProducts: fetchProducts,
  getCategories: fetchCategories
};