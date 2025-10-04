import { Product } from '../types/bigcommerce';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export async function fetchProducts(): Promise<Product[]> {
  const query = `
    query {
      site {
        products {
          edges {
            node {
              entityId
              name
              path
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
                retailPrice {
                  value
                  currencyCode
                }
              }
              defaultImage {
                url(width: 500)
                altText
              }
              images {
                edges {
                  node {
                    url(width: 500)
                    altText
                  }
                }
              }
              brand {
                name
              }
              availabilityV2 {
                status
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(`${API_BASE}/gql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error('Failed to fetch products');
    }

    return data.data?.site?.products?.edges?.map((edge: any) => edge.node) || [];
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}
