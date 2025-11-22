/**
 * Payment Methods Service - PCI Compliant
 *
 * CRITICAL SECURITY REQUIREMENTS:
 *
 * 1. NEVER store raw credit card numbers, CVV codes, or full bank account numbers
 * 2. All sensitive payment data must be tokenized by a payment processor first
 * 3. Only store payment processor tokens and non-sensitive display data (last 4 digits)
 * 4. Never log or console.log any payment data
 * 5. All payment data collection must happen via secure payment processor forms (not custom forms)
 *
 * PCI DSS Compliance Notes:
 * - This implementation follows PCI DSS guidelines for token storage
 * - Actual card/bank data never touches our servers
 * - Tokenization happens client-side via payment processor SDKs
 * - We only store references to tokenized payment methods
 */

import { supabase } from './supabase';

interface PaymentMethod {
  id: string;
  organization_id: string;
  location_id?: string;
  user_id: string;
  label: string;
  payment_type: 'credit_card' | 'debit_card' | 'bank_account' | 'ach';
  last_four: string;
  expiry_month?: number;
  expiry_year?: number;
  account_holder_name: string;
  bank_name?: string;
  account_type?: 'checking' | 'savings';
  is_default: boolean;
  payment_token?: string;
  payment_processor: string;
  created_at: string;
  updated_at: string;
}

interface CreatePaymentMethodData {
  organization_id: string;
  location_id?: string;
  label: string;
  payment_type: 'credit_card' | 'debit_card' | 'bank_account' | 'ach';
  last_four: string;
  expiry_month?: number;
  expiry_year?: number;
  account_holder_name: string;
  bank_name?: string;
  account_type?: 'checking' | 'savings';
  is_default?: boolean;
  payment_token: string;
  payment_processor: string;
}

/**
 * Get all payment methods for an organization
 * Users can only see payment methods for organizations they belong to (enforced by RLS)
 */
export async function getPaymentMethods(
  organizationId: string,
  locationId?: string
): Promise<{ data: PaymentMethod[] | null; error: string | null }> {
  try {
    let query = supabase
      .from('payment_methods')
      .select('*')
      .eq('organization_id', organizationId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (locationId) {
      query = query.eq('location_id', locationId);
    } else {
      query = query.is('location_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payment methods:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payment methods';
    return { data: null, error: message };
  }
}

/**
 * Add a new payment method
 * IMPORTANT: The payment_token must be obtained from a payment processor first
 * NEVER pass raw card numbers or account numbers to this function
 */
async function addPaymentMethod(
  paymentMethodData: CreatePaymentMethodData
): Promise<{ data: PaymentMethod | null; error: string | null }> {
  try {
    // Validate that we have a token (never allow creation without tokenization)
    if (!paymentMethodData.payment_token) {
      return {
        data: null,
        error: 'Payment token is required. Payment data must be tokenized first.'
      };
    }

    // Validate last_four is exactly 4 digits
    if (!/^\d{4}$/.test(paymentMethodData.last_four)) {
      return {
        data: null,
        error: 'Invalid last four digits. Must be exactly 4 digits.'
      };
    }

    // Validate expiry for cards
    if (
      (paymentMethodData.payment_type === 'credit_card' ||
       paymentMethodData.payment_type === 'debit_card') &&
      (!paymentMethodData.expiry_month || !paymentMethodData.expiry_year)
    ) {
      return {
        data: null,
        error: 'Credit and debit cards require expiry date.'
      };
    }

    // Validate account_type for bank accounts
    if (
      (paymentMethodData.payment_type === 'bank_account' ||
       paymentMethodData.payment_type === 'ach') &&
      !paymentMethodData.account_type
    ) {
      return {
        data: null,
        error: 'Bank accounts require account type (checking or savings).'
      };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // If this is being set as default, unset other defaults first
    if (paymentMethodData.is_default) {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('organization_id', paymentMethodData.organization_id)
        .eq('location_id', paymentMethodData.location_id || null);
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        ...paymentMethodData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding payment method:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add payment method';
    return { data: null, error: message };
  }
}

/**
 * Update a payment method
 * Note: payment_token should not be updated after creation
 */
async function updatePaymentMethod(
  id: string,
  updates: Partial<Omit<CreatePaymentMethodData, 'payment_token' | 'payment_processor'>>
): Promise<{ data: PaymentMethod | null; error: string | null }> {
  try {
    // If setting as default, unset other defaults first
    if (updates.is_default) {
      const { data: currentMethod } = await supabase
        .from('payment_methods')
        .select('organization_id, location_id')
        .eq('id', id)
        .single();

      if (currentMethod) {
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('organization_id', currentMethod.organization_id)
          .eq('location_id', currentMethod.location_id || null);
      }
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment method:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update payment method';
    return { data: null, error: message };
  }
}

/**
 * Delete a payment method
 */
async function deletePaymentMethod(
  id: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting payment method:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete payment method';
    return { error: message };
  }
}

/**
 * Set a payment method as default
 */
async function setDefaultPaymentMethod(
  id: string
): Promise<{ error: string | null }> {
  try {
    const { data: method } = await supabase
      .from('payment_methods')
      .select('organization_id, location_id')
      .eq('id', id)
      .single();

    if (!method) {
      return { error: 'Payment method not found' };
    }

    // Unset other defaults
    await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('organization_id', method.organization_id)
      .eq('location_id', method.location_id || null);

    // Set this one as default
    const { error } = await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', id);

    if (error) {
      console.error('Error setting default payment method:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set default payment method';
    return { error: message };
  }
}

/**
 * Get the default payment method for an organization
 */
async function getDefaultPaymentMethod(
  organizationId: string,
  locationId?: string
): Promise<{ data: PaymentMethod | null; error: string | null }> {
  try {
    let query = supabase
      .from('payment_methods')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_default', true);

    if (locationId) {
      query = query.eq('location_id', locationId);
    } else {
      query = query.is('location_id', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error fetching default payment method:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch default payment method';
    return { data: null, error: message };
  }
}

/**
 * Helper function to format payment method for display
 */
function formatPaymentMethodDisplay(method: PaymentMethod): string {
  const typeLabel = method.payment_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

  if (method.payment_type === 'credit_card' || method.payment_type === 'debit_card') {
    return `${typeLabel} •••• ${method.last_four} (Exp: ${method.expiry_month}/${method.expiry_year})`;
  } else {
    const bankName = method.bank_name ? `${method.bank_name} ` : '';
    const accountType = method.account_type ? ` ${method.account_type.charAt(0).toUpperCase() + method.account_type.slice(1)}` : '';
    return `${bankName}${accountType} •••• ${method.last_four}`;
  }
}

/**
 * Check if a payment method is expired (for cards only)
 */
function isPaymentMethodExpired(method: PaymentMethod): boolean {
  if (method.payment_type !== 'credit_card' && method.payment_type !== 'debit_card') {
    return false;
  }

  if (!method.expiry_month || !method.expiry_year) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (method.expiry_year < currentYear) {
    return true;
  }

  if (method.expiry_year === currentYear && method.expiry_month < currentMonth) {
    return true;
  }

  return false;
}
