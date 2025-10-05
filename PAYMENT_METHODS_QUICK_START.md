# Payment Methods Quick Start Guide

## Overview

This system stores payment methods (credit cards, debit cards, bank accounts) in a **PCI-compliant** manner using tokenization.

## Key Principles

✅ **We ONLY store:**
- Payment processor tokens (safe references)
- Last 4 digits
- Expiry dates
- Account holder names

❌ **We NEVER store:**
- Full card numbers
- CVV codes
- Full bank account numbers
- Magnetic stripe data
- PINs

## Quick Integration

### 1. Add Payment Method Service to Your Component

```typescript
import { addPaymentMethod, getPaymentMethods, formatPaymentMethodDisplay } from '@/services/paymentMethods';
```

### 2. Tokenize Payment Data (Client-Side)

**Important:** Use your payment processor's SDK to tokenize data in the browser before sending to your server.

```typescript
// Example using BigCommerce Payments
async function handleAddCard(cardData) {
  // Step 1: Tokenize with payment processor (client-side)
  const token = await bigCommercePayments.tokenizeCard({
    number: cardData.number,        // Full number stays in browser
    cvv: cardData.cvv,             // CVV never sent to server
    expiryMonth: cardData.month,
    expiryYear: cardData.year,
    cardholderName: cardData.name
  });

  // Step 2: Save only the token and safe display data
  const { data, error } = await addPaymentMethod({
    organization_id: organizationId,
    label: 'Corporate Card',
    payment_type: 'credit_card',
    last_four: cardData.number.slice(-4),  // Only last 4
    expiry_month: cardData.month,
    expiry_year: cardData.year,
    account_holder_name: cardData.name,
    payment_token: token.id,               // Tokenized reference
    payment_processor: 'bigcommerce',
    is_default: true
  });

  if (error) {
    console.error('Failed to save:', error);
    return;
  }

  console.log('Payment method saved!');
}
```

### 3. Display Payment Methods

```typescript
async function loadPaymentMethods() {
  const { data, error } = await getPaymentMethods(organizationId);

  if (error) {
    console.error('Failed to load:', error);
    return;
  }

  // Display to user
  data.forEach(method => {
    const display = formatPaymentMethodDisplay(method);
    // e.g., "Credit Card •••• 1111 (Exp: 12/2025)"
    console.log(display);
  });
}
```

### 4. Process Payment with Token

```typescript
async function processPayment(organizationId, amount) {
  // Get the payment method
  const { data: method } = await getDefaultPaymentMethod(organizationId);

  // Use the token with your payment processor
  const result = await paymentProcessor.charge({
    token: method.payment_token,  // Use stored token
    amount: amount,
    currency: 'USD'
  });

  return result;
}
```

## Supported Payment Types

### Credit/Debit Cards

```typescript
{
  payment_type: 'credit_card' | 'debit_card',
  last_four: '1111',
  expiry_month: 12,
  expiry_year: 2025,
  account_holder_name: 'John Doe',
  payment_token: 'tok_xxx',
  payment_processor: 'bigcommerce'
}
```

### Bank Accounts (ACH)

```typescript
{
  payment_type: 'bank_account' | 'ach',
  last_four: '6789',
  account_holder_name: 'John Doe',
  bank_name: 'Chase Bank',
  account_type: 'checking' | 'savings',
  payment_token: 'tok_xxx',
  payment_processor: 'bigcommerce'
}
```

## Available Functions

### `getPaymentMethods(organizationId, locationId?)`
Get all payment methods for an organization

### `addPaymentMethod(data)`
Add a new payment method (requires token)

### `updatePaymentMethod(id, updates)`
Update payment method details (label, default status)

### `deletePaymentMethod(id)`
Delete a payment method

### `setDefaultPaymentMethod(id)`
Set a payment method as default

### `getDefaultPaymentMethod(organizationId, locationId?)`
Get the default payment method

### `formatPaymentMethodDisplay(method)`
Format payment method for display

### `isPaymentMethodExpired(method)`
Check if a card is expired

## Security Notes

### ✅ DO:
- Use payment processor SDKs for tokenization
- Tokenize on the client-side
- Store only payment tokens
- Use HTTPS for all connections
- Validate user permissions (RLS handles this)

### ❌ DON'T:
- Create custom payment forms that handle raw card data
- Store CVV codes
- Store full card/account numbers
- Log payment data
- Transmit sensitive data over HTTP

## Test Cards

For development:

```
Visa: 4111 1111 1111 1111
Mastercard: 5500 0000 0000 0004
Amex: 3400 0000 0000 009

Expiry: Any future date
CVV: Any 3 digits (4 for Amex)
```

## Row Level Security

The database automatically enforces:
- Users can only see payment methods for their organizations
- Only organization admins can add/edit/delete
- Tokens are protected by RLS policies

## Need More Details?

See `PCI_COMPLIANCE.md` for complete documentation.
