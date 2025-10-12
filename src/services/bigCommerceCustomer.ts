import { gql } from './bigcommerce';
import type { Organization } from './supabase';

// GraphQL mutations for customer management
const CREATE_CUSTOMER = /* GraphQL */ `
  mutation CreateCustomer($input: CreateCustomerInput!) {
    customer {
      createCustomer(input: $input) {
        customer {
          entityId
          email
          firstName
          lastName
          company
          phone
          addresses {
            edges {
              node {
                entityId
                firstName
                lastName
                company
                address1
                address2
                city
                stateOrProvince
                postalCode
                countryCode
                phone
              }
            }
          }
        }
        errors {
          ... on ValidationError {
            message
            path
          }
          ... on CustomerRegistrationError {
            message
          }
        }
      }
    }
  }
`;

const UPDATE_CUSTOMER = /* GraphQL */ `
  mutation UpdateCustomer($input: UpdateCustomerInput!) {
    customer {
      updateCustomer(input: $input) {
        customer {
          entityId
          email
          firstName
          lastName
          company
          phone
        }
        errors {
          ... on ValidationError {
            message
            path
          }
        }
      }
    }
  }
`;

const GET_CUSTOMER_BY_EMAIL = /* GraphQL */ `
  query GetCustomerByEmail($email: String!) {
    site {
      customers(filters: { email: $email }) {
        edges {
          node {
            entityId
            email
            firstName
            lastName
            company
            phone
            addresses {
              edges {
                node {
                  entityId
                  firstName
                  lastName
                  company
                  address1
                  address2
                  city
                  stateOrProvince
                  postalCode
                  countryCode
                  phone
                }
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_ORDER = /* GraphQL */ `
  mutation CreateOrder($input: CreateOrderInput!) {
    order {
      createOrder(input: $input) {
        order {
          entityId
          orderId
          status
          totalIncTax {
            value
            currencyCode
          }
          customer {
            entityId
            email
          }
        }
        errors {
          ... on ValidationError {
            message
            path
          }
        }
      }
    }
  }
`;

export interface CustomerSyncResult {
  success: boolean;
  customerId?: number;
  error?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface OrderLineItem {
  productId: number;
  quantity: number;
  variantId?: number;
}

class BigCommerceCustomerService {
  /**
   * Sync organization data with BigCommerce customer database
   */
  async syncOrganizationCustomer(organization: Organization): Promise<CustomerSyncResult> {
    try {
      // First, check if customer already exists
      const existingCustomer = await this.findCustomerByEmail(organization.contact_email || `${organization.code.toLowerCase()}@${organization.name.toLowerCase().replace(/\s+/g, '')}.com`);
      
      if (existingCustomer) {
        // Update existing customer
        const result = await this.updateCustomer(existingCustomer.entityId, organization);
        return {
          success: result.success,
          customerId: existingCustomer.entityId,
          error: result.error
        };
      } else {
        // Create new customer
        return await this.createCustomer(organization);
      }
    } catch (error) {
      console.error('Error syncing organization customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync customer'
      };
    }
  }

  /**
   * Find customer by email in BigCommerce
   */
  private async findCustomerByEmail(email: string): Promise<any | null> {
    try {
      const data = await gql(GET_CUSTOMER_BY_EMAIL, { email });
      const customers = data?.site?.customers?.edges || [];
      
      return customers.length > 0 ? customers[0].node : null;
    } catch (error) {
      console.error('Error finding customer by email:', error);
      return null;
    }
  }

  /**
   * Create new customer in BigCommerce
   */
  private async createCustomer(organization: Organization): Promise<CustomerSyncResult> {
    try {
      const customerEmail = organization.contact_email || `${organization.code.toLowerCase()}@${organization.name.toLowerCase().replace(/\s+/g, '')}.com`;
      
      const input = {
        email: customerEmail,
        firstName: organization.name.split(' ')[0] || organization.name,
        lastName: organization.name.split(' ').slice(1).join(' ') || 'Organization',
        company: organization.name,
        phone: organization.contact_phone || '',
        // Add default address if billing address exists
        ...(organization.billing_address && {
          addresses: [{
            firstName: organization.name.split(' ')[0] || organization.name,
            lastName: organization.name.split(' ').slice(1).join(' ') || 'Organization',
            company: organization.name,
            address1: organization.billing_address.address1 || '',
            address2: organization.billing_address.address2 || '',
            city: organization.billing_address.city || '',
            stateOrProvince: organization.billing_address.state || '',
            postalCode: organization.billing_address.postalCode || '',
            countryCode: organization.billing_address.country || 'US',
            phone: organization.contact_phone || ''
          }]
        })
      };

      const data = await gql(CREATE_CUSTOMER, { input });
      const result = data?.customer?.createCustomer;
      
      if (result?.errors?.length > 0) {
        return {
          success: false,
          error: result.errors[0].message
        };
      }

      return {
        success: true,
        customerId: result?.customer?.entityId
      };
    } catch (error) {
      console.error('Error creating customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create customer'
      };
    }
  }

  /**
   * Update existing customer in BigCommerce
   */
  private async updateCustomer(customerId: number, organization: Organization): Promise<{ success: boolean; error?: string }> {
    try {
      const input = {
        entityId: customerId,
        email: organization.contact_email || `${organization.code.toLowerCase()}@${organization.name.toLowerCase().replace(/\s+/g, '')}.com`,
        firstName: organization.name.split(' ')[0] || organization.name,
        lastName: organization.name.split(' ').slice(1).join(' ') || 'Organization',
        company: organization.name,
        phone: organization.contact_phone || ''
      };

      const data = await gql(UPDATE_CUSTOMER, { input });
      const result = data?.customer?.updateCustomer;
      
      if (result?.errors?.length > 0) {
        return {
          success: false,
          error: result.errors[0].message
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update customer'
      };
    }
  }

  /**
   * Get tax calculation for organization checkout
   */
  async getTaxForOrganization(
    organization: Organization,
    lineItems: OrderLineItem[]
  ): Promise<{ tax: number; shipping: number; subtotal: number; total: number } | null> {
    try {
      const restCartItems = lineItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        ...(item.variantId && { variantId: item.variantId })
      }));

      const { cartId } = await bcRestAPI.createCart(restCartItems);
      if (!cartId) {
        console.error('Failed to create cart for tax calculation');
        return null;
      }

      const billingAddress = {
        first_name: organization.name.split(' ')[0] || organization.name,
        last_name: organization.name.split(' ').slice(1).join(' ') || 'Organization',
        company: organization.name,
        email: organization.contact_email || `${organization.code}@example.com`,
        phone: organization.contact_phone || '',
        address1: organization.billing_address?.address1 || '123 Business St',
        address2: organization.billing_address?.address2 || '',
        city: organization.billing_address?.city || 'Business City',
        state_or_province: organization.billing_address?.state || 'CA',
        state_or_province_code: organization.billing_address?.state || 'CA',
        postal_code: organization.billing_address?.postalCode || '90210',
        country_code: organization.billing_address?.country || 'US'
      };

      const checkoutData = await bcRestAPI.addBillingAddress(cartId, billingAddress);

      if (checkoutData) {
        return {
          tax: checkoutData.tax_total || 0,
          shipping: checkoutData.shipping_cost_total_inc_tax || 0,
          subtotal: checkoutData.subtotal_ex_tax || 0,
          total: checkoutData.grand_total || 0
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting tax for organization:', error);
      return null;
    }
  }

  /**
   * Create order for organization in BigCommerce
   */
  async createOrderForOrganization(
    organization: Organization,
    lineItems: OrderLineItem[]
  ): Promise<OrderResult> {
    try {
      // First ensure customer exists
      const syncResult = await this.syncOrganizationCustomer(organization);
      if (!syncResult.success || !syncResult.customerId) {
        return {
          success: false,
          error: syncResult.error || 'Failed to sync customer data'
        };
      }

      // Create order
      const customerEmail = organization.contact_email || `${organization.code.toLowerCase()}@${organization.name.toLowerCase().replace(/\s+/g, '')}.com`;
      
      const input = {
        customerId: syncResult.customerId,
        billingAddress: {
          firstName: organization.name.split(' ')[0] || organization.name,
          lastName: organization.name.split(' ').slice(1).join(' ') || 'Organization',
          company: organization.name,
          email: customerEmail,
          phone: organization.contact_phone || '',
          address1: organization.billing_address?.address1 || '123 Business St',
          city: organization.billing_address?.city || 'Business City',
          stateOrProvince: organization.billing_address?.state || 'CA',
          postalCode: organization.billing_address?.postalCode || '90210',
          countryCode: organization.billing_address?.country || 'US'
        },
        lineItems: lineItems.map(item => ({
          productEntityId: item.productId,
          quantity: item.quantity,
          ...(item.variantId && { variantEntityId: item.variantId })
        }))
      };

      const data = await gql(CREATE_ORDER, { input });
      const result = data?.order?.createOrder;
      
      if (result?.errors?.length > 0) {
        return {
          success: false,
          error: result.errors[0].message
        };
      }

      return {
        success: true,
        orderId: result?.order?.orderId || result?.order?.entityId?.toString()
      };
    } catch (error) {
      console.error('Error creating order for organization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order'
      };
    }
  }

  /**
   * Get customer orders from BigCommerce
   */
  async getCustomerOrders(customerId: number): Promise<any[]> {
    try {
      // This would require additional GraphQL queries to fetch orders
      // Implementation depends on BigCommerce's order API structure
      console.log('Fetching orders for customer:', customerId);
      return [];
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      return [];
    }
  }
}

export const bigCommerceCustomerService = new BigCommerceCustomerService();