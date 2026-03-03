import { supabase } from './supabase';

export interface PaymentMethod {
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

export async function createPaymentMethod(
  params: Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: PaymentMethod | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert(params)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating payment method:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment method';
    return { data: null, error: message };
  }
}

export async function deletePaymentMethod(
  paymentMethodId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', paymentMethodId);

    if (error) {
      console.error('Error deleting payment method:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete payment method';
    return { success: false, error: message };
  }
}

export async function setDefaultPaymentMethod(
  paymentMethodId: string,
  organizationId: string,
  locationId?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    let resetQuery = supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('organization_id', organizationId)
      .eq('is_default', true);

    if (locationId) {
      resetQuery = resetQuery.eq('location_id', locationId);
    } else {
      resetQuery = resetQuery.is('location_id', null);
    }

    await resetQuery;

    const { error } = await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', paymentMethodId);

    if (error) {
      console.error('Error setting default payment method:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set default payment method';
    return { success: false, error: message };
  }
}
