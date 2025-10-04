import { supabase } from '../lib/supabase';

export interface Order {
  id: string;
  user_id: string;
  bigcommerce_order_id?: string;
  bigcommerce_cart_id?: string;
  order_number?: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  items: any[];
  shipping_address?: any;
  billing_address?: any;
  customer_email: string;
  organization_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export async function createOrder(orderData: Partial<Order>) {
  const { data, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserOrders(userId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Order[];
}

export async function getOrder(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data as Order | null;
}

export async function updateOrderStatus(orderId: string, status: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrganizationOrders(organizationId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Order[];
}
