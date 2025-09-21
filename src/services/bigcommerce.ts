// BigCommerce Storefront GraphQL API service
const GRAPHQL_ENDPOINT = '/api/graphql';
const STOREFRONT_TOKEN = import.meta.env.VITE_BIGCOMMERCE_STOREFRONT_API_TOKEN;

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
      hasToken: !!STOREFRONT_TOKEN,
      tokenLength: STOREFRONT_TOKEN?.length || 0,
      query: query.substring(0, 100) + '...',
      variables,
      envVars: {
        VITE_BIGCOMMERCE_STOREFRONT_API_URL: import.meta.env.VITE_BIGCOMMERCE_STOREFRONT_API_URL,
        VITE_BIGCOMMERCE_STOREFRONT_API_TOKEN: STOREFRONT_TOKEN ? `${STOREFRONT_TOKEN.substring(0, 10)}...` : 'NOT_SET'
      }
    });

    if (!STOREFRONT_TOKEN) {
      throw new Error('STOREFRONT_TOKEN_MISSING');
    }

    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables
        }),
      });

      console.log('BigCommerce GraphQL Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        
        // Check for "Coming Soon" page (503 error)
        if (response.status === 503 && errorText.includes('Coming Soon')) {
          throw new Error('STORE_NOT_LIVE');
        }
        
        // Check for 404 Not Found - incorrect GraphQL endpoint
        if (response.status === 404) {
          throw new Error('GRAPHQL_ENDPOINT_NOT_FOUND');
        }
        
        // Check for 401 Unauthorized - invalid JWT token
        if (response.status === 401) {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors.some((e: any) => e.message.includes('String is not a JWT'))) {
            throw new Error('INVALID_JWT_TOKEN');
          }
          throw new Error('UNAUTHORIZED');
        }
        
        // Check for 402 Payment Required - API access not available on current plan
        if (response.status === 402) {
          throw new Error('API_ACCESS_NOT_AVAILABLE');
        }
        
        console.error('BigCommerce GraphQL Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          url: response.url,
          requestHeaders: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer [REDACTED]'
          }
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
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('CORS_ERROR');
      }
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
      const query = `
        query GetProducts($first: Int!) {
          site {
            products(first: $first) {
              edges {
                node {
                  entityId
                  name
                  description
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
                  customFields {
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
      
      const data = await this.makeGraphQLRequest(query, { first: 50 });
      const products: BigCommerceProduct[] = data.site.products.edges.map((edge: any) => edge.node);
      
      return { products: products.map(product => this.transformProduct(product)) };
    } catch (error) {
      // Log the error if logger is provided
      let userFriendlyMessage = '';
      if (logError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Provide specific error messages for common issues
        userFriendlyMessage = errorMessage;
        if (errorMessage === 'STORE_NOT_LIVE') {
          userFriendlyMessage = 'Your BigCommerce store appears to be in "Coming Soon" mode. Please make your store live to fetch products.';
        } else if (errorMessage === 'STOREFRONT_TOKEN_MISSING') {
          userFriendlyMessage = 'BigCommerce Storefront API token is missing. Please check your environment variables.';
        } else if (errorMessage === 'GRAPHQL_ENDPOINT_NOT_FOUND') {
          userFriendlyMessage = 'GraphQL endpoint not found. Please verify your VITE_BIGCOMMERCE_STOREFRONT_API_URL is correct (should be your store\'s base URL without /graphql).';
        } else if (errorMessage === 'CORS_ERROR') {
          userFriendlyMessage = 'CORS error - please ensure your domain is added to BigCommerce CORS origins.';
        }
        
        logError(
          `Failed to fetch products from BigCommerce GraphQL: ${userFriendlyMessage}`,
          error instanceof Error ? error : new Error(String(error)),
          'error',
          'BigCommerce GraphQL API'
        );
      }
      
      // Return mock data when API fails
      const errorMessage = error instanceof Error ? error.message : String(error);
      let displayMessage = errorMessage;
      if (errorMessage === 'STORE_NOT_LIVE') {
        displayMessage = 'Your BigCommerce store appears to be in "Coming Soon" mode. Please make your store live to fetch products.';
      } else if (errorMessage === 'GRAPHQL_ENDPOINT_NOT_FOUND') {
        displayMessage = 'GraphQL endpoint not found. Please verify your VITE_BIGCOMMERCE_STOREFRONT_API_URL is correct (should be your store\'s base URL without /graphql).';
      } else if (errorMessage === 'API_ACCESS_NOT_AVAILABLE') {
        displayMessage = 'BigCommerce Storefront API access is not available on your current plan. Using demo products instead.';
      }
      
      return { products: this.getMockProducts(), errorMessage: displayMessage };
    }
  }

  async getCategories(logError?: (message: string, error?: Error, type?: 'error' | 'warning' | 'info', source?: string) => void): Promise<{ categories: string[]; errorMessage?: string }> {
    try {
      const query = `
        query GetCategories($first: Int!) {
          site {
            categoryTree(rootEntityId: 0) {
              entityId
              name
              description
              children {
                entityId
                name
                description
              }
            }
          }
        }
      `;
      
      const data = await this.makeGraphQLRequest(query, { first: 50 });
      const categories: BigCommerceCategory[] = data.site.categoryTree || [];
      
      // Flatten categories and their children
      const allCategories: string[] = [];
      categories.forEach(category => {
        allCategories.push(category.name);
        if (category.children) {
          category.children.forEach((child: BigCommerceCategory) => {
            allCategories.push(child.name);
          });
        }
      });
      
      return { categories: [...new Set(allCategories)] }; // Remove duplicates
    } catch (error) {
      // Log the error if logger is provided
      let userFriendlyMessage = '';
      if (logError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Provide specific error messages for common issues
        userFriendlyMessage = errorMessage;
        if (errorMessage === 'STORE_NOT_LIVE') {
          userFriendlyMessage = 'Your BigCommerce store appears to be in "Coming Soon" mode. Please make your store live to fetch categories.';
        } else if (errorMessage === 'STOREFRONT_TOKEN_MISSING') {
          userFriendlyMessage = 'BigCommerce Storefront API token is missing. Please check your environment variables.';
        } else if (errorMessage === 'GRAPHQL_ENDPOINT_NOT_FOUND') {
          userFriendlyMessage = 'GraphQL endpoint not found. Please verify your VITE_BIGCOMMERCE_STOREFRONT_API_URL is correct (should be your store\'s base URL without /graphql).';
        } else if (errorMessage === 'CORS_ERROR') {
          userFriendlyMessage = 'CORS error - please ensure your domain is added to BigCommerce CORS origins.';
        }
        
        logError(
          `Failed to fetch categories from BigCommerce GraphQL: ${userFriendlyMessage}`,
          error instanceof Error ? error : new Error(String(error)),
          'error',
          'BigCommerce GraphQL API'
        );
      }
      
      // Return mock categories when API fails
      const errorMessage = error instanceof Error ? error.message : String(error);
      let displayMessage = errorMessage;
      if (errorMessage === 'STORE_NOT_LIVE') {
        displayMessage = 'Your BigCommerce store appears to be in "Coming Soon" mode. Please make your store live to fetch categories.';
      } else if (errorMessage === 'GRAPHQL_ENDPOINT_NOT_FOUND') {
        displayMessage = 'GraphQL endpoint not found. Please verify your VITE_BIGCOMMERCE_STOREFRONT_API_URL is correct (should be your store\'s base URL without /graphql).';
      } else if (errorMessage === 'INVALID_JWT_TOKEN') {
        displayMessage = 'Invalid BigCommerce Storefront API token. Please check that your VITE_BIGCOMMERCE_STOREFRONT_API_TOKEN is a valid JWT token from your BigCommerce control panel.';
      } else if (errorMessage === 'UNAUTHORIZED') {
        displayMessage = 'Unauthorized access to BigCommerce API. Please verify your Storefront API token has the correct permissions.';
      }
      
      return { categories: ['Peptides', 'Genetic Testing', 'Lab Testing', 'Supplements', 'Hormones'], errorMessage: displayMessage };
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

  private transformProduct(bcProduct: BigCommerceProduct): Product {
    // Get the first category name, or default to 'General'
    const categoryName = bcProduct.categories.edges.length > 0 
      ? bcProduct.categories.edges[0].node.name
      : 'General';

    // Extract benefits from custom fields or description
    const benefits = this.extractBenefits(bcProduct);

    // Get the main product image
    const image = bcProduct.defaultImage?.url || 
      'https://images.pexels.com/photos/3683107/pexels-photo-3683107.jpeg?auto=compress&cs=tinysrgb&w=400';

    // Handle pricing
    const price = bcProduct.prices.price.value;
    const originalPrice = bcProduct.prices.salePrice ? price : undefined;
    const currentPrice = bcProduct.prices.salePrice?.value || price;

    return {
      id: bcProduct.entityId,
      name: bcProduct.name,
      price: currentPrice,
      originalPrice,
      image,
      rating: 4.5, // Default rating - you could store this in custom fields
      reviews: Math.floor(Math.random() * 500) + 50, // Random reviews - you could integrate with review system
      category: categoryName,
      benefits,
      description: bcProduct.description || '',
    };
  }

  private extractBenefits(product: BigCommerceProduct): string[] {
    // Look for benefits in custom fields first
    if (product.customFields.edges.length > 0) {
      const benefitsField = product.customFields.edges.find(edge => 
        edge.node.name.toLowerCase().includes('benefit') || 
        edge.node.name.toLowerCase().includes('feature')
      );
      
      if (benefitsField) {
        return benefitsField.node.value.split(',').map(b => b.trim()).slice(0, 3);
      }
    }

    // Default benefits based on product name/category
    const name = product.name.toLowerCase();
    const defaultBenefits = [];

    if (name.includes('peptide') || name.includes('bpc') || name.includes('thymosin')) {
      defaultBenefits.push('Tissue Repair', 'Recovery Support');
    } else if (name.includes('genetic') || name.includes('dna')) {
      defaultBenefits.push('Genetic Insights', 'Personalized Care');
    } else if (name.includes('nad') || name.includes('anti-aging')) {
      defaultBenefits.push('Anti-aging', 'Energy Boost');
    } else if (name.includes('hormone')) {
      defaultBenefits.push('Hormone Balance', 'Vitality');
    } else if (name.includes('immune')) {
      defaultBenefits.push('Immune Support', 'Wellness');
    } else {
      defaultBenefits.push('Health Support', 'Wellness');
    }

    return defaultBenefits.slice(0, 2);
  }
}

export const bigCommerceService = new BigCommerceStorefrontService();