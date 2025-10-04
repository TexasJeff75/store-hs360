import { gql } from './bigcommerce';

// BigCommerce Checkout API integration for hybrid checkout
export interface CheckoutData {
  lineItems: Array<{
    productId: number;
    quantity: number;
    variantId?: number;
  }>;
  billingAddress: {
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    stateOrProvince: string;
    postalCode: string;
    countryCode: string;
    phone?: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    stateOrProvince: string;
    postalCode: string;
    countryCode: string;
    phone?: string;
  };
  shippingOptionId?: string;
}

export interface CheckoutResponse {
  success: boolean;
  checkoutId?: string;
  orderId?: string;
  error?: string;
}

// GraphQL mutations for checkout operations
const CREATE_CHECKOUT = /* GraphQL */ `
  mutation CreateCheckout($checkoutInput: CheckoutInput!) {
    checkout {
      createCheckout(input: $checkoutInput) {
        checkout {
          id
          cart {
            entityId
          }
          billingAddress {
            firstName
            lastName
            email
          }
          shippingAddress {
            firstName
            lastName
          }
          order {
            entityId
          }
        }
      }
    }
  }
`;

const UPDATE_CHECKOUT_BILLING_ADDRESS = /* GraphQL */ `
  mutation UpdateCheckoutBillingAddress($checkoutId: String!, $data: CheckoutBillingAddressInput!) {
    checkout {
      updateCheckoutBillingAddress(input: { checkoutId: $checkoutId, data: $data }) {
        checkout {
          id
          billingAddress {
            firstName
            lastName
            email
          }
        }
      }
    }
  }
`;

const UPDATE_CHECKOUT_SHIPPING_ADDRESS = /* GraphQL */ `
  mutation UpdateCheckoutShippingAddress($checkoutId: String!, $data: CheckoutShippingAddressInput!) {
    checkout {
      updateCheckoutShippingAddress(input: { checkoutId: $checkoutId, data: $data }) {
        checkout {
          id
          shippingAddress {
            firstName
            lastName
          }
          availableShippingOptions {
            entityId
            description
            cost {
              value
              currencyCode
            }
          }
        }
      }
    }
  }
`;

const SELECT_CHECKOUT_SHIPPING_OPTION = /* GraphQL */ `
  mutation SelectCheckoutShippingOption($checkoutId: String!, $shippingOptionEntityId: String!) {
    checkout {
      selectCheckoutShippingOption(input: { 
        checkoutId: $checkoutId, 
        shippingOptionEntityId: $shippingOptionEntityId 
      }) {
        checkout {
          id
          shippingCostTotal {
            value
            currencyCode
          }
        }
      }
    }
  }
`;

const COMPLETE_CHECKOUT = /* GraphQL */ `
  mutation CompleteCheckout($checkoutId: String!) {
    checkout {
      completeCheckout(input: { checkoutId: $checkoutId }) {
        orderEntityId
        paymentAccessToken
      }
    }
  }
`;

class BigCommerceCheckoutService {
  /**
   * Create a new checkout session
   */
  async createCheckout(data: CheckoutData): Promise<{ checkoutId: string | null; error?: string }> {
    try {
      const checkoutInput = {
        lineItems: data.lineItems.map(item => ({
          productEntityId: item.productId,
          quantity: item.quantity,
          ...(item.variantId && { variantEntityId: item.variantId })
        }))
      };

      const response = await gql(CREATE_CHECKOUT, { checkoutInput });
      
      const checkout = response?.checkout?.createCheckout?.checkout;
      if (checkout?.id) {
        return { checkoutId: checkout.id };
      } else {
        return { checkoutId: null, error: 'Failed to create checkout session' };
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      return { 
        checkoutId: null, 
        error: error instanceof Error ? error.message : 'Failed to create checkout' 
      };
    }
  }

  /**
   * Update billing address
   */
  async updateBillingAddress(checkoutId: string, billingAddress: CheckoutData['billingAddress']): Promise<{ success: boolean; error?: string }> {
    try {
      const data = {
        firstName: billingAddress.firstName,
        lastName: billingAddress.lastName,
        email: billingAddress.email,
        company: billingAddress.company || '',
        address1: billingAddress.address1,
        address2: billingAddress.address2 || '',
        city: billingAddress.city,
        stateOrProvince: billingAddress.stateOrProvince,
        postalCode: billingAddress.postalCode,
        countryCode: billingAddress.countryCode,
        phone: billingAddress.phone || ''
      };

      await gql(UPDATE_CHECKOUT_BILLING_ADDRESS, { checkoutId, data });
      return { success: true };
    } catch (error) {
      console.error('Error updating billing address:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update billing address' 
      };
    }
  }

  /**
   * Update shipping address and get available shipping options
   */
  async updateShippingAddress(checkoutId: string, shippingAddress: CheckoutData['shippingAddress']): Promise<{ 
    success: boolean; 
    shippingOptions?: Array<{
      id: string;
      description: string;
      cost: number;
    }>; 
    error?: string;
  }> {
    try {
      const data = {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        company: shippingAddress.company || '',
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        stateOrProvince: shippingAddress.stateOrProvince,
        postalCode: shippingAddress.postalCode,
        countryCode: shippingAddress.countryCode,
        phone: shippingAddress.phone || ''
      };

      const response = await gql(UPDATE_CHECKOUT_SHIPPING_ADDRESS, { checkoutId, data });
      
      const checkout = response?.checkout?.updateCheckoutShippingAddress?.checkout;
      const shippingOptions = checkout?.availableShippingOptions?.map((option: any) => ({
        id: option.entityId,
        description: option.description,
        cost: option.cost?.value || 0
      })) || [];

      return { success: true, shippingOptions };
    } catch (error) {
      console.error('Error updating shipping address:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update shipping address' 
      };
    }
  }

  /**
   * Select shipping option
   */
  async selectShippingOption(checkoutId: string, shippingOptionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await gql(SELECT_CHECKOUT_SHIPPING_OPTION, { 
        checkoutId, 
        shippingOptionEntityId: shippingOptionId 
      });
      return { success: true };
    } catch (error) {
      console.error('Error selecting shipping option:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to select shipping option' 
      };
    }
  }

  /**
   * Complete checkout (after payment is processed)
   */
  async completeCheckout(checkoutId: string): Promise<CheckoutResponse> {
    try {
      const response = await gql(COMPLETE_CHECKOUT, { checkoutId });
      
      const result = response?.checkout?.completeCheckout;
      if (result?.orderEntityId) {
        return {
          success: true,
          checkoutId,
          orderId: result.orderEntityId
        };
      } else {
        return {
          success: false,
          error: 'Failed to complete checkout'
        };
      }
    } catch (error) {
      console.error('Error completing checkout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete checkout'
      };
    }
  }

  /**
   * Process full checkout flow
   */
  async processCheckout(data: CheckoutData): Promise<CheckoutResponse> {
    try {
      // Step 1: Create checkout
      const { checkoutId, error: createError } = await this.createCheckout(data);
      if (!checkoutId || createError) {
        return { success: false, error: createError || 'Failed to create checkout' };
      }

      // Step 2: Update billing address
      const { success: billingSuccess, error: billingError } = await this.updateBillingAddress(checkoutId, data.billingAddress);
      if (!billingSuccess) {
        return { success: false, error: billingError || 'Failed to update billing address' };
      }

      // Step 3: Update shipping address
      const { success: shippingSuccess, error: shippingError } = await this.updateShippingAddress(checkoutId, data.shippingAddress);
      if (!shippingSuccess) {
        return { success: false, error: shippingError || 'Failed to update shipping address' };
      }

      // Step 4: Select shipping option (if provided)
      if (data.shippingOptionId) {
        const { success: optionSuccess, error: optionError } = await this.selectShippingOption(checkoutId, data.shippingOptionId);
        if (!optionSuccess) {
          return { success: false, error: optionError || 'Failed to select shipping option' };
        }
      }

      // Return checkout ID for payment processing
      return {
        success: true,
        checkoutId
      };
    } catch (error) {
      console.error('Error processing checkout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Checkout processing failed'
      };
    }
  }
}

export const bigCommerceCheckoutService = new BigCommerceCheckoutService();