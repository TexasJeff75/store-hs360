# REST API Checkout Flow

This document describes the headless checkout implementation using BigCommerce REST APIs without redirects to hosted checkout pages.

## Overview

The checkout flow is entirely API-driven and consists of these steps:

1. **Create Cart** - Add items to a BigCommerce cart
2. **Add Addresses** - Set billing and shipping addresses
3. **Select Shipping** - Choose shipping method
4. **Process Payment** - Submit payment information
5. **Create Order** - Finalize the order

All steps happen via REST API calls without redirecting users to BigCommerce's hosted checkout.

## Architecture

```
Frontend (React) → Backend API (Express/Netlify) → BigCommerce REST API
                 ↓
              Supabase (Session & Order Storage)
```

### Components

- **Frontend**: `src/components/checkout/CheckoutModal.tsx`
- **Service Layer**: `src/services/restCheckout.ts`
- **BigCommerce API**: `src/services/bigcommerceRestAPI.ts`
- **Backend Proxy**: `server/gql.cjs` and `netlify/functions/bigcommerce-cart.js`

## Checkout Flow

### 1. Create Checkout Session

```typescript
import { restCheckoutService } from '@/services/restCheckout';

const result = await restCheckoutService.createCheckoutSession(userId, cartItems);
```

Creates a session in Supabase to track checkout progress.

**Session Data:**
- User ID
- Cart items
- Pricing (subtotal, tax, shipping, total)
- Status tracking

### 2. Create Cart

```typescript
const cartItems: CartLineItem[] = [
  {
    product_id: 123,
    quantity: 2,
  }
];

const result = await restCheckoutService.createCart(sessionId, cartItems);
```

Creates a cart in BigCommerce and stores the cart ID in the session.

**BigCommerce API:** `POST /v3/carts`

### 3. Add Addresses

```typescript
const billingAddress: AddressData = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  address1: '123 Main St',
  city: 'Austin',
  state_or_province: 'TX',
  postal_code: '78701',
  country_code: 'US',
  phone: '555-1234',
};

const result = await restCheckoutService.addAddresses(
  sessionId,
  cartId,
  billingAddress,
  shippingAddress
);
```

Creates a checkout with addresses and returns a checkout ID.

**BigCommerce API:** `POST /v3/checkouts`

### 4. Get Shipping Options

```typescript
const options = await bcRestAPI.getShippingOptions(checkoutId, consignmentId);
```

Retrieves available shipping methods with costs.

**BigCommerce API:** `GET /v3/checkouts/{checkoutId}/consignments/{consignmentId}/shipping-options`

### 5. Select Shipping Method

```typescript
await bcRestAPI.updateShippingOption(checkoutId, consignmentId, shippingOptionId);
```

Updates the checkout with selected shipping method.

**BigCommerce API:** `PUT /v3/checkouts/{checkoutId}/consignments/{consignmentId}`

### 6. Process Payment

```typescript
const paymentData = {
  cardholder_name: 'John Doe',
  number: '4111111111111111',
  expiry_month: 12,
  expiry_year: 2025,
  verification_value: '123',
};

const result = await restCheckoutService.processPayment(sessionId, checkoutId, paymentData);
```

Processes the payment and creates an order.

**BigCommerce APIs:**
- `POST /v3/checkouts/{checkoutId}/payments` - Process payment
- `POST /v3/checkouts/{checkoutId}/orders` - Create order

### 7. Store Order in Supabase

After successful order creation, order details are saved to Supabase for tracking and history.

## API Endpoints

### Backend Proxy Actions

All requests go through `${API_BASE}/bigcommerce-cart`:

| Action | Method | Purpose |
|--------|--------|---------|
| `createCart` | POST | Create a new cart |
| `getCart` | POST | Retrieve cart details |
| `createCheckout` | POST | Create checkout with addresses |
| `updateCheckout` | POST | Update checkout (shipping, etc) |
| `getCheckout` | POST | Get checkout details |
| `checkoutAction` | POST | Generic checkout operations |

### Request Format

```javascript
const response = await fetch(`${API_BASE}/bigcommerce-cart`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'createCart',
    data: {
      line_items: [{ product_id: 123, quantity: 1 }]
    }
  })
});
```

## Required BigCommerce Scopes

Your `BC_ACCESS_TOKEN` must have these OAuth scopes:

- ✅ **Carts** - Modify
- ✅ **Checkouts** - Modify
- ✅ **Orders** - Modify
- ✅ **Products** - Read-only (recommended)

See [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md) for detailed setup instructions.

## Error Handling

The service includes comprehensive error handling:

```typescript
const result = await restCheckoutService.createCart(sessionId, items);

if (!result.success) {
  console.error('Cart creation failed:', result.error);
  // Handle error - show message to user
}
```

All methods return a consistent result format:

```typescript
interface CheckoutFlowResult {
  success: boolean;
  sessionId?: string;
  cartId?: string;
  checkoutId?: string;
  orderId?: string;
  error?: string;
}
```

## Session Management

Sessions are stored in the `checkout_sessions` table:

```sql
CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  cart_id TEXT,
  checkout_id TEXT,
  status TEXT NOT NULL,
  cart_items JSONB NOT NULL,
  shipping_address JSONB,
  billing_address JSONB,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL,
  shipping DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Session Status Flow

1. **pending** - Session created, cart not yet created
2. **address_entered** - Addresses added, ready for payment
3. **payment_pending** - Payment being processed
4. **completed** - Order successfully created
5. **failed** - Error occurred during checkout

## Payment Security

### Important Security Notes

1. **Never store card data** - Payment information is sent directly to BigCommerce and never stored
2. **PCI Compliance** - BigCommerce handles PCI compliance for card processing
3. **Use HTTPS** - All API calls must use HTTPS in production
4. **Token Security** - `BC_ACCESS_TOKEN` must never be exposed to the browser

### Payment Flow

```
User Input (Frontend)
  ↓
Backend Proxy (Express/Netlify)
  ↓
BigCommerce Payment Processing
  ↓
Order Creation
  ↓
Confirmation to User
```

The frontend never directly handles payment tokens - everything goes through your backend.

## Testing

### Test Card Numbers

Use BigCommerce's test mode with these test cards:

| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| Visa | 4111111111111111 | Any 3 digits | Any future date |
| Mastercard | 5555555555554444 | Any 3 digits | Any future date |
| Amex | 378282246310005 | Any 4 digits | Any future date |

### Test Checkout Flow

```bash
# 1. Start dev server
npm run dev

# 2. Test cart creation
curl http://localhost:4000/api/bigcommerce-cart \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "createCart",
    "data": {
      "line_items": [{"product_id": 123, "quantity": 1}]
    }
  }'

# 3. Test checkout creation
# (Use cartId from previous response)
curl http://localhost:4000/api/bigcommerce-cart \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "createCheckout",
    "data": {
      "endpoint": "/checkouts",
      "method": "POST",
      "body": {
        "cart_id": "abc-123",
        "billing_address": { ... }
      }
    }
  }'
```

## Advantages of REST API Checkout

✅ **Full Control** - Complete control over UX and branding
✅ **No Redirects** - Users stay on your site throughout checkout
✅ **Custom Flows** - Implement any checkout flow you want
✅ **Better Analytics** - Track every step of the checkout process
✅ **Mobile Optimized** - Build custom mobile experiences
✅ **A/B Testing** - Test different checkout flows easily

## Limitations

⚠️ **Payment Gateway** - Limited to what BigCommerce supports
⚠️ **PCI Compliance** - You're responsible for secure implementation
⚠️ **Complex** - More code to maintain vs redirect checkout
⚠️ **Testing** - Requires thorough testing of all payment scenarios

## Migration from Redirect Checkout

If you were using redirect-based checkout before:

1. ✅ `getCheckoutUrl()` method removed from `bcRestAPI`
2. ✅ `redirectUrl` removed from cart creation response
3. ✅ New `restCheckoutService` handles full checkout flow
4. ✅ Payment processing happens via API instead of redirect
5. ✅ Checkout UI is fully custom in your React components

## Troubleshooting

### "Scope Error" when creating cart/checkout
**Solution:** Check your `BC_ACCESS_TOKEN` has Carts-Modify and Checkouts-Modify scopes.
See [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md)

### Payment fails with "Invalid payment instrument"
**Solution:** Ensure card data format is correct. Use test cards in test mode.

### Checkout session not found
**Solution:** Sessions expire after 24 hours. Check session status in Supabase.

### "Cart not found" error
**Solution:** Cart may have expired. BigCommerce carts expire after a period of inactivity.

## Additional Resources

- [BigCommerce Carts API](https://developer.bigcommerce.com/api-reference/cart-checkout/server-server-cart-api)
- [BigCommerce Checkouts API](https://developer.bigcommerce.com/api-reference/cart-checkout/server-server-checkout-api)
- [BigCommerce Payments API](https://developer.bigcommerce.com/api-reference/payments)
- [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md) - Token permissions guide
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment configuration
