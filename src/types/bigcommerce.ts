export interface Product {
  entityId: number;
  name: string;
  path: string;
  description: string;
  prices: {
    price: {
      value: number;
      currencyCode: string;
    };
    salePrice?: {
      value: number;
      currencyCode: string;
    };
    retailPrice?: {
      value: number;
      currencyCode: string;
    };
  };
  defaultImage?: {
    url: string;
    altText: string;
  };
  images: {
    edges: Array<{
      node: {
        url: string;
        altText: string;
      };
    }>;
  };
  brand?: {
    name: string;
  };
  availabilityV2: {
    status: string;
  };
}

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface BCCart {
  id: string;
  line_items: {
    physical_items: BCCartItem[];
  };
  cart_amount: number;
  redirect_urls: {
    checkout_url: string;
    embedded_checkout_url: string;
    cart_url: string;
  };
}

export interface BCCartItem {
  id: string;
  product_id: number;
  name: string;
  quantity: number;
  sale_price: number;
  list_price: number;
  image_url: string;
}
