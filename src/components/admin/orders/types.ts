export interface OrderItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
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
}
