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
