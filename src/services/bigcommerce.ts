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

export interface ProductsResponse {
  products: Product[];
  errorMessage?: string;
}

export interface CategoriesResponse {
  categories: string[];
  errorMessage?: string;
}

type LogErrorFunction = (message: string, error?: Error, type?: 'error' | 'warning' | 'info', source?: string) => void;

class BigCommerceService {
  private baseUrl: string;
  private storeHash: string;
  private accessToken: string;

  constructor() {
    this.baseUrl = 'https://api.bigcommerce.com/stores';
    this.storeHash = import.meta.env.VITE_BC_STORE_HASH || '';
    this.accessToken = import.meta.env.VITE_BC_ACCESS_TOKEN || '';
  }

  private async makeRequest(endpoint: string, logError?: LogErrorFunction): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/${this.storeHash}${endpoint}`, {
        headers: {
          'X-Auth-Token': this.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (logError) {
        logError(`BigCommerce API request failed: ${endpoint}`, error as Error, 'error', 'BigCommerce');
      }
      throw error;
    }
  }

  async getProducts(logError?: LogErrorFunction): Promise<ProductsResponse> {
    try {
      // If no credentials are configured, return mock data
      if (!this.storeHash || !this.accessToken) {
        if (logError) {
          logError('BigCommerce credentials not configured, using mock data', undefined, 'warning', 'BigCommerce');
        }
        
        return {
          products: this.getMockProducts(),
          errorMessage: 'Using mock data - BigCommerce not configured'
        };
      }

      const data = await this.makeRequest('/v3/catalog/products?include=images', logError);
      
      const products: Product[] = data.data.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: parseFloat(item.price) || 0,
        image: item.images?.[0]?.url_standard || 'https://images.pexels.com/photos/3735747/pexels-photo-3735747.jpeg',
        category: item.categories?.[0] || 'General',
        description: item.description
      }));

      return { products };
    } catch (error) {
      if (logError) {
        logError('Failed to fetch products from BigCommerce', error as Error, 'error', 'BigCommerce');
      }
      
      return {
        products: this.getMockProducts(),
        errorMessage: 'Failed to load products from BigCommerce, showing sample data'
      };
    }
  }

  async getCategories(logError?: LogErrorFunction): Promise<CategoriesResponse> {
    try {
      // If no credentials are configured, return mock data
      if (!this.storeHash || !this.accessToken) {
        if (logError) {
          logError('BigCommerce credentials not configured, using mock categories', undefined, 'warning', 'BigCommerce');
        }
        
        return {
          categories: this.getMockCategories(),
          errorMessage: 'Using mock data - BigCommerce not configured'
        };
      }

      const data = await this.makeRequest('/v3/catalog/categories', logError);
      
      const categories = data.data.map((item: any) => item.name);
      
      return { categories };
    } catch (error) {
      if (logError) {
        logError('Failed to fetch categories from BigCommerce', error as Error, 'error', 'BigCommerce');
      }
      
      return {
        categories: this.getMockCategories(),
        errorMessage: 'Failed to load categories from BigCommerce, showing sample data'
      };
    }
  }

  private getMockProducts(): Product[] {
    return [
      {
        id: 1,
        name: "NAD+ Boost Peptide",
        price: 89.99,
        image: "https://images.pexels.com/photos/3735747/pexels-photo-3735747.jpeg",
        category: "Peptides",
        description: "Advanced NAD+ boosting peptide for cellular energy and longevity"
      },
      {
        id: 2,
        name: "Comprehensive Genetic Test",
        price: 299.99,
        image: "https://images.pexels.com/photos/3938023/pexels-photo-3938023.jpeg",
        category: "Genetic Testing",
        description: "Complete genetic analysis for personalized health insights"
      },
      {
        id: 3,
        name: "Collagen Synthesis Peptide",
        price: 79.99,
        image: "https://images.pexels.com/photos/4021775/pexels-photo-4021775.jpeg",
        category: "Peptides",
        description: "Premium collagen peptide for skin and joint health"
      },
      {
        id: 4,
        name: "Hormone Panel Test",
        price: 199.99,
        image: "https://images.pexels.com/photos/3786157/pexels-photo-3786157.jpeg",
        category: "Lab Testing",
        description: "Comprehensive hormone level analysis"
      },
      {
        id: 5,
        name: "Growth Factor Peptide",
        price: 129.99,
        image: "https://images.pexels.com/photos/3873193/pexels-photo-3873193.jpeg",
        category: "Peptides",
        description: "Advanced growth factor peptide for muscle recovery"
      },
      {
        id: 6,
        name: "Nutrient Deficiency Test",
        price: 149.99,
        image: "https://images.pexels.com/photos/4021775/pexels-photo-4021775.jpeg",
        category: "Lab Testing",
        description: "Identify key nutrient deficiencies for optimal health"
      }
    ];
  }

  private getMockCategories(): string[] {
    return ["Peptides", "Genetic Testing", "Lab Testing", "Supplements"];
  }
}

export const bigCommerceService = new BigCommerceService();