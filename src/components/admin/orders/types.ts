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
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
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
  order_type?: string;
  is_sub_order?: boolean;
  vendor_brand?: string;
  parent_order_id?: string;
  split_from_order_id?: string;
  viewed_by_admin?: boolean;
}
