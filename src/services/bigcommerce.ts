// BigCommerce Storefront GraphQL API service
import { connNodes, pick } from '../utils/graphql';

const GRAPHQL_ENDPOINT = import.meta.env.DEV ? 'http://localhost:4000/api/gql' : '/.netlify/functions/gql';

export interface BigCommerceProduct {
  entityId: number;
  name: string;
  prices: {
    price: {
      value: number;
      currencyCode: string;
    };
    salePrice?: {
      value: number;
      currencyCode: string;
    };
  };
  defaultImage?: {
    url: string;
    altText: string;
  };
  categories: {
    edges: Array<{
      node: {
        entityId: number;
        name: string;
      };
    }>;
  };
  description: string;
  customFields: {
    edges: Array<{
      node: {
        name: string;
        value: string;
      };
    }>;
  };
}

export interface BigCommerceCategory {
  entityId: number;
  name: string;
  description: string;
}

// Transform BigCommerce GraphQL product to our Product interface
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
  description: string;
}

class BigCommerceStorefrontService {
  private async makeGraphQLRequest(query: string, variables: Record<string, any> = {}) {
    // Debug logging
    console.log('BigCommerce GraphQL Debug:', {
      endpoint: GRAPHQL_ENDPOINT,
      query: query.substring(0, 100) + '...',
      variables,
    });

    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables
        }),
      });

      console.log('BigCommerce GraphQL Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        
        console.error('BigCommerce GraphQL Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          url: response.url
        });
        throw new Error(`BigCommerce GraphQL error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        throw new Error(`GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}`);
      }

      return data.data;
    } catch (error) {
      console.error('BigCommerce GraphQL Request Failed:', error);
      throw error;
    }
  }

  // Test the GraphQL connection with a simple query
  async testConnection(logError?: (message: string, error?: Error, type?: 'error' | 'warning' | 'info', source?: string) => void): Promise<boolean> {
    try {
      console.log('Testing BigCommerce GraphQL connection...');
      
      const query = `
        query TestConnection {
          site {
            settings {
              storeName
            }
          }
        }
      `;
      
      const data = await this.makeGraphQLRequest(query);
      console.log('GraphQL connection test successful:', data);
      return true;
    } catch (error) {
      if (logError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(
          `GraphQL connection test failed: ${errorMessage}`,
          error instanceof Error ? error : new Error(String(error)),
          'error',
          'BigCommerce GraphQL Connection Test'
        );
      }
      return false;
    }
  }

  async getProducts(logError?: (message: string, error?: Error, type?: 'error' | 'warning' | 'info', source?: string) => void): Promise<Product[]> {
  }
  async getProducts(logError?: (message: string, error?: Error, type?: 'error' | 'warning' | 'info', source?: string) => void): Promise<{ products: Product[]; errorMessage?: string }> {
    try {
      // Null-safe query with only essential fields
      const query = `
        query GetProducts {
          site {
            products(first: 10) {
              edges {
                node {
                  entityId
                  name
                  prices {
                    price {
                      value
                      currencyCode
                    }
                  }
                  defaultImage {
                    url(width: 400, height: 400)
                    altText
                  }
                  categories {
                    edges {
                      node {
                        entityId
                        name
                      }
                    }
                  }
                  customFields(first: 10) {
                    edges {
                      node {
                        name
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const data = await this.makeGraphQLRequest(query);
      
      // Null-safe product extraction
      const productEdges = data?.site?.products?.edges ?? [];
      if (!Array.isArray(productEdges)) {
        console.warn("[products] Unexpected response shape:", data);
        return { products: this.getMockProducts(), errorMessage: "Invalid response format from BigCommerce" };
      }
      
      const products = productEdges
        .map((edge: any) => this.transformProduct(edge?.node))
        .filter(Boolean);
      
      return { products };
    } catch (error) {
      // Log the error if logger is provided
      let userFriendlyMessage = '';
      if (logError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(
          `Failed to fetch products from BigCommerce GraphQL: ${errorMessage}`,
          error instanceof Error ? error : new Error(String(error)),
          'error',
          'BigCommerce GraphQL API'
        );
      }
      
      // Return mock data when API fails
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { products: this.getMockProducts(), errorMessage };
    }
  }

  async getCategories(logError?: (message: string, error?: Error, type?: 'error' | 'warning' | 'info', source?: string) => void): Promise<{ categories: string[]; errorMessage?: string }> {
    try {
      // Null-safe categories query
      const query = `
        query GetCategories {
          site {
            categoryTree {
              entityId
              name
            }
          }
        }
      `;
      
      const data = await this.makeGraphQLRequest(query);
      const categoryTree = data?.site?.categoryTree ?? [];
      if (!Array.isArray(categoryTree)) {
        console.warn("[categories] Unexpected response shape:", data);
        return { categories: ['Peptides', 'Genetic Testing', 'Lab Testing', 'Supplements', 'Hormones'], errorMessage: "Invalid response format from BigCommerce" };
      }
      
      // Extract category names
      const allCategories: string[] = categoryTree
        .map((cat: any) => cat?.name)
        .filter(Boolean);
      
      return { categories: [...new Set(allCategories)] }; // Remove duplicates
    } catch (error) {
      // Log the error if logger is provided
      let userFriendlyMessage = '';
      if (logError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(
          `Failed to fetch categories from BigCommerce GraphQL: ${errorMessage}`,
          error instanceof Error ? error : new Error(String(error)),
          'error',
          'BigCommerce GraphQL API'
        );
      }
      
      // Return mock categories when API fails
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { categories: ['Peptides', 'Genetic Testing', 'Lab Testing', 'Supplements', 'Hormones'], errorMessage };
    }
  }

  private getMockProducts(): Product[] {
    return [
      {
        id: 1,
        name: 'BPC-157 Peptide Therapy',
        price: 299.99,
        originalPrice: 349.99,
        image: 'https://images.pexels.com/photos/3683107/pexels-photo-3683107.jpeg?auto=compress&cs=tinysrgb&w=400',
        rating: 4.8,
        reviews: 127,
        category: 'Peptides',
        benefits: ['Tissue Repair', 'Recovery Support'],
        description: 'Advanced peptide therapy for enhanced healing and recovery.'
      },
      {
        id: 2,
        name: 'Comprehensive Genetic Analysis',
        price: 599.99,
        image: 'https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=400',
        rating: 4.9,
        reviews: 89,
        category: 'Genetic Testing',
        benefits: ['Genetic Insights', 'Personalized Care'],
        description: 'Complete genetic profile analysis for personalized healthcare.'
      },
      {
        id: 3,
        name: 'NAD+ Optimization Protocol',
        price: 449.99,
        originalPrice: 499.99,
        image: 'https://images.pexels.com/photos/3786126/pexels-photo-3786126.jpeg?auto=compress&cs=tinysrgb&w=400',
        rating: 4.7,
        reviews: 156,
        category: 'Supplements',
        benefits: ['Anti-aging', 'Energy Boost'],
        description: 'Advanced NAD+ therapy for cellular rejuvenation and energy.'
      },
      {
        id: 4,
        name: 'Thymosin Alpha-1 Immune Support',
        price: 379.99,
        image: 'https://images.pexels.com/photos/3683098/pexels-photo-3683098.jpeg?auto=compress&cs=tinysrgb&w=400',
        rating: 4.6,
        reviews: 94,
        category: 'Peptides',
        benefits: ['Immune Support', 'Wellness'],
        description: 'Peptide therapy designed to enhance immune system function.'
      },
      {
        id: 5,
        name: 'Advanced Hormone Panel',
        price: 249.99,
        image: 'https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg?auto=compress&cs=tinysrgb&w=400',
        rating: 4.8,
        reviews: 203,
        category: 'Lab Testing',
        benefits: ['Hormone Balance', 'Health Insights'],
        description: 'Comprehensive hormone testing for optimal health management.'
      },
      {
        id: 6,
        name: 'GHK-Cu Copper Peptide Complex',
        price: 199.99,
        originalPrice: 229.99,
        image: 'https://images.pexels.com/photos/3786126/pexels-photo-3786126.jpeg?auto=compress&cs=tinysrgb&w=400',
        rating: 4.5,
        reviews: 78,
        category: 'Peptides',
        benefits: ['Skin Health', 'Anti-aging'],
        description: 'Copper peptide complex for enhanced skin health and repair.'
      }
    ];
  }

  private transformProduct(bcProduct: any): Product | null {
    if (!bcProduct) return null;
    
    // Safely read connections using connNodes helper
    const categories = connNodes(bcProduct.categories);
    const customFields = connNodes<{ name: string; value: string }>(bcProduct.customFields);
    
    // Get the first category name, or default to 'General'
    const categoryName = categories.length > 0 ? categories[0].name : 'General';

    // Extract benefits from custom fields or description
    const benefits = this.extractBenefits({ customFields });

    // Get the main product image
    const image = bcProduct.defaultImage?.url || 
      'https://images.pexels.com/photos/3683107/pexels-photo-3683107.jpeg?auto=compress&cs=tinysrgb&w=400';

    // Handle pricing
    const price = bcProduct.prices?.price?.value || 0;
    const originalPrice = bcProduct.prices?.salePrice ? price : undefined;
    const currentPrice = bcProduct.prices?.salePrice?.value || price;

    return {
      id: bcProduct.entityId,
      name: bcProduct.name || 'Unknown Product',
      price: currentPrice,
      originalPrice,
      image,
      rating: 4.5, // Default rating - you could store this in custom fields
      reviews: Math.floor(Math.random() * 500) + 50, // Random reviews - you could integrate with review system
      category: categoryName,
      benefits,
      description: '',
    };
  }

  private extractBenefits(src: { customFields?: Array<{ name: string; value: string }> }): string[] {
    const fields = src?.customFields ?? [];
    
    // Look for benefits in custom fields first
    const benefitsField = fields.find(field => 
      /benefit/i.test(field.name) || /feature/i.test(field.name)
    );
      
    if (benefitsField?.value) {
      try {
        // Try JSON first; if not JSON, return a line-split list
        const parsed = JSON.parse(benefitsField.value);
        return Array.isArray(parsed) ? parsed : [String(parsed)];
      } catch {
        return benefitsField.value
          .split(/[,\r?\n]/)
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 3);
      }
    }

    // Default benefits when no custom fields are found
    return ['Health Support', 'Wellness'];
  }
}

export const bigCommerceService = new BigCommerceStorefrontService();