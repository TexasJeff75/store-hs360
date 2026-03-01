export interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  brand?: string;
  backorder?: boolean;
  backorder_reason?: string;
}

export interface Address {
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  state_or_province?: string;
  postalCode?: string;
  postal_code?: string;
  country?: string;
  country_code?: string;
  phone?: string;
  email?: string;
}

export function normalizeAddress(addr?: Address | null): {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
} | null {
  if (!addr) return null;
  return {
    firstName: addr.firstName || addr.first_name || '',
    lastName: addr.lastName || addr.last_name || '',
    company: addr.company || '',
    address1: addr.address1 || '',
    address2: addr.address2 || '',
    city: addr.city || '',
    state: addr.state || addr.state_or_province || '',
    postalCode: addr.postalCode || addr.postal_code || '',
    country: addr.country || addr.country_code || '',
    phone: addr.phone || '',
    email: addr.email || '',
  };
}

export interface Shipment {
  carrier: string;
  tracking_number: string;
  shipped_date?: string;
  estimated_delivery?: string;
  status: string;
  notes?: string;
}

export interface Order {
  id: string;
  user_id: string;
  organization_id?: string;
  location_id?: string;
  bigcommerce_order_id?: string;
  bigcommerce_cart_id?: string;
  order_number?: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  items: OrderItem[];
  shipping_address?: Address;
  billing_address?: Address;
  customer_email: string;
  notes?: string;
  shipments?: Shipment[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  order_type?: string;
  is_sub_order?: boolean;
  vendor_brand?: string;
  parent_order_id?: string;
  split_from_order_id?: string;
  viewed_by_admin?: boolean;
  payment_status?: string;
  payment_authorization_id?: string;
  payment_captured_at?: string;
  sales_rep_id?: string;
  backorder_reason?: string;
}
