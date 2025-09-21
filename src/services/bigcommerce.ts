// BigCommerce API service for fetching products and categories
export interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
  description?: string;
}

export interface Category {
  id: number;
  name: string;
}

// Mock data for fallback
const mockProducts: Product[] = [
  {
    id: 1,
    name: "Premium Peptide Complex",
    price: 299.99,
    image: "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=400",
    category: "Peptides",
    description: "Advanced peptide therapy for cellular regeneration"
  },
  {
    id: 2,
    name: "Genetic Testing Kit",
    price: 199.99,
    image: "https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=400",
    category: "Testing",
    description: "Comprehensive genetic analysis for personalized healthcare"
  },
  {
    id: 3,
    name: "NAD+ Booster",
    price: 149.99,
    image: "https://images.pexels.com/photos/3683056/pexels-photo-3683056.jpeg?auto=compress&cs=tinysrgb&w=400",
    category: "Supplements",
    description: "Cellular energy enhancement supplement"
  },
  {
    id: 4,
    name: "Hormone Panel Test",
    price: 249.99,
    image: "https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=400",
    category: "Testing",
    description: "Complete hormone level analysis"
  },
  {
    id: 5,
    name: "Collagen Peptides",
    price: 89.99,
    image: "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=400",
    category: "Peptides",
    description: "Premium collagen for skin and joint health"
  },
  {
    id: 6,
    name: "Vitamin D3 + K2",
    price: 39.99,
    image: "https://images.pexels.com/photos/3683056/pexels-photo-3683056.jpeg?auto=compress&cs=tinysrgb&w=400",
    category: "Supplements",
    description: "Essential vitamin combination for bone health"
  }
];

const mockCategories: Category[] = [
  { id: 1, name: "Peptides" },
  { id: 2, name: "Testing" },
  { id: 3, name: "Supplements" }
];

class BigCommerceService {
  private storeHash: string | null;
  private accessToken: string | null;
  private baseUrl: string;

  constructor() {
    // Check for environment variables with different prefixes
    this.storeHash = import.meta.env.VITE_BC_STORE_HASH || 
                     import.meta.env.BC_STORE_HASH || 
                     null;
    this.accessToken = import.meta.env.VITE_BC_ACCESS_TOKEN || 
                       import.meta.env.BC_ACCESS_TOKEN || 
                       null;
    this.baseUrl = this.storeHash ? `https://api.bigcommerce.com/stores/${this.storeHash}/v3` : '';

    console.log('BigCommerce Service initialized:', {
      hasStoreHash: !!this.storeHash,
      hasAccessToken: !!this.accessToken,
      baseUrl: this.baseUrl
    });
  }

  private async makeRequest(endpoint: string, logError?: (message: string, error?: Error) => void) {
    if (!this.storeHash || !this.accessToken) {
      const message = 'BigCommerce credentials not configured';
      if (logError) logError(message);
      console.warn(message + ', using mock data');
      return null;
    }

    try {
      console.log(`Making BigCommerce API request to: ${this.baseUrl}${endpoint}`);
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-Auth-Token': this.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`BigCommerce API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`BigCommerce API response:`, data);
      return data;
    } catch (error) {
      const message = `Failed to fetch from BigCommerce API: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (logError) logError(message, error instanceof Error ? error : undefined);
      console.error(message, error);
      return null;
    }
  }

  async getProducts(logError?: (message: string, error?: Error) => void) {
    try {
      const data = await this.makeRequest('/catalog/products?include=images,categories&limit=50', logError);
      
      if (!data || !data.data) {
        console.log('Using mock products data');
        return {
          products: mockProducts,
          errorMessage: this.storeHash && this.accessToken ? 'Failed to fetch products from BigCommerce' : null
        };
      }

      // Transform BigCommerce products to our format
      const products: Product[] = data.data.map((product: any) => ({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price) || 0,
        image: product.images?.[0]?.url_standard || 'https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg?auto=compress&cs=tinysrgb&w=400',
        category: product.categories?.[0]?.name || 'Uncategorized',
        description: product.description || ''
      }));

      console.log(`Successfully fetched ${products.length} products from BigCommerce`);
      return { products, errorMessage: null };
    } catch (error) {
      const message = `Error processing BigCommerce products: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (logError) logError(message, error instanceof Error ? error : undefined);
      console.error(message, error);
      
      return {
        products: mockProducts,
        errorMessage: message
      };
    }
  }

  async getCategories(logError?: (message: string, error?: Error) => void) {
    try {
      const data = await this.makeRequest('/catalog/categories?limit=50', logError);
      
      if (!data || !data.data) {
        console.log('Using mock categories data');
        return {
          categories: mockCategories.map(cat => cat.name),
          errorMessage: this.storeHash && this.accessToken ? 'Failed to fetch categories from BigCommerce' : null
        };
      }

      // Transform BigCommerce categories to our format
      const categories = data.data.map((category: any) => category.name);

      console.log(`Successfully fetched ${categories.length} categories from BigCommerce`);
      return { categories, errorMessage: null };
    } catch (error) {
      const message = `Error processing BigCommerce categories: ${error instanceof Error ? error.message : 'Unknown error'}`;
      if (logError) logError(message, error instanceof Error ? error : undefined);
      console.error(message, error);
      
      return {
        categories: mockCategories.map(cat => cat.name),
        errorMessage: message
      };
    }
  }
}

export const bigCommerceService = new BigCommerceService();