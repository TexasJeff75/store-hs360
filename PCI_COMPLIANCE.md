# PCI Compliance Guide

This document explains how payment methods are handled in a PCI DSS compliant manner.

## Critical Security Rules

### ⚠️ NEVER Do These Things

1. **NEVER store full credit card numbers** - Only store last 4 digits
2. **NEVER store CVV/CVC codes** - Not even encrypted
3. **NEVER store full bank account numbers** - Only store last 4 digits
4. **NEVER store full magnetic stripe data**
5. **NEVER store PIN numbers or PIN blocks**
6. **NEVER log or console.log payment data**
7. **NEVER transmit card data over unencrypted connections**
8. **NEVER create custom payment forms that collect card data**

### ✅ What You CAN Store

According to PCI DSS, you may store:
- Last 4 digits of card/account number
- Cardholder/account holder name
- Card expiration date
- Service code
- Payment processor tokens (our primary method)

## Our PCI Compliance Strategy

We use **tokenization** to achieve PCI compliance:

```
┌─────────────┐
│   Browser   │
│             │
│  Customer   │
│  enters     │
│  card data  │
└──────┬──────┘
       │
       │ Sent directly to payment processor
       │ (NEVER to our server)
       ↓
┌─────────────────────────────┐
│   Payment Processor         │
│   (BigCommerce/Stripe/etc)  │
│                             │
│   - Validates card          │
│   - Creates secure token    │
└──────┬──────────────────────┘
       │
       │ Returns token
       ↓
┌─────────────┐
│ Our Server  │
│             │
│ Stores only:│
│ - Token     │
│ - Last 4    │
│ - Expiry    │
│ - Name      │
└─────────────┘
```

## Implementation Details

### Database Schema

The `payment_methods` table stores:

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  location_id UUID,
  user_id UUID NOT NULL,

  -- Display Information (PCI Compliant)
  label TEXT NOT NULL,                    -- e.g., "Corporate Card"
  payment_type TEXT NOT NULL,             -- credit_card, debit_card, bank_account, ach
  last_four TEXT NOT NULL,                -- Only last 4 digits
  account_holder_name TEXT NOT NULL,      -- Name on card/account

  -- Card-specific (optional)
  expiry_month INTEGER,                   -- Expiration month
  expiry_year INTEGER,                    -- Expiration year

  -- Bank-specific (optional)
  bank_name TEXT,                         -- Bank name
  account_type TEXT,                      -- checking or savings

  -- Payment Processor Integration
  payment_token TEXT,                     -- Tokenized reference (NOT raw data)
  payment_processor TEXT NOT NULL,        -- e.g., 'bigcommerce', 'stripe'

  -- Metadata
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security

RLS policies ensure:
- Users can only view payment methods for their organizations
- Only organization admins can add/update/delete payment methods
- Payment tokens are never exposed unnecessarily

## Integration Guide

### Step 1: Tokenize Payment Data

Use the payment processor's SDK to tokenize payment data **client-side**:

#### Example: BigCommerce Payments

```javascript
// Load BigCommerce Payments SDK
const paymentsClient = window.BigCommerce.payments.client.create({
  storeId: 'YOUR_STORE_ID',
  currencyCode: 'USD'
});

// Tokenize card data (happens in browser)
async function tokenizeCard(cardData) {
  try {
    const token = await paymentsClient.tokenizeCard({
      number: cardData.number,           // Full card number (client-side only)
      cvv: cardData.cvv,                 // CVV (client-side only)
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      cardholderName: cardData.name
    });

    // Token is safe to send to your server
    return {
      token: token.id,
      lastFour: cardData.number.slice(-4),
      expiryMonth: cardData.expiryMonth,
      expiryYear: cardData.expiryYear,
      name: cardData.name
    };
  } catch (error) {
    console.error('Tokenization failed:', error);
    throw error;
  }
}
```

#### Example: Stripe

```javascript
// Load Stripe.js
const stripe = Stripe('YOUR_PUBLISHABLE_KEY');
const elements = stripe.elements();
const cardElement = elements.create('card');

// Tokenize card data
async function tokenizeCard() {
  const { token, error } = await stripe.createToken(cardElement);

  if (error) {
    console.error('Tokenization failed:', error);
    throw error;
  }

  return {
    token: token.id,
    lastFour: token.card.last4,
    expiryMonth: token.card.exp_month,
    expiryYear: token.card.exp_year,
    name: token.card.name,
    cardType: token.card.brand
  };
}
```

### Step 2: Save Token to Database

```typescript
import { addPaymentMethod } from '@/services/paymentMethods';

async function savePaymentMethod(tokenizedData, organizationId) {
  const { data, error } = await addPaymentMethod({
    organization_id: organizationId,
    label: 'Primary Card',
    payment_type: 'credit_card',
    last_four: tokenizedData.lastFour,      // Safe to store
    expiry_month: tokenizedData.expiryMonth, // Safe to store
    expiry_year: tokenizedData.expiryYear,   // Safe to store
    account_holder_name: tokenizedData.name, // Safe to store
    payment_token: tokenizedData.token,      // Tokenized reference
    payment_processor: 'bigcommerce',
    is_default: true
  });

  if (error) {
    console.error('Failed to save payment method:', error);
    return;
  }

  console.log('Payment method saved successfully');
}
```

### Step 3: Use Token for Payments

When processing a payment, use the stored token:

```typescript
import { getDefaultPaymentMethod } from '@/services/paymentMethods';

async function processPayment(organizationId, amount) {
  // Get the tokenized payment method
  const { data: paymentMethod, error } = await getDefaultPaymentMethod(organizationId);

  if (error || !paymentMethod) {
    throw new Error('No payment method found');
  }

  // Use the token with the payment processor
  // The processor will handle the actual payment using the token
  const paymentResult = await paymentProcessorAPI.charge({
    token: paymentMethod.payment_token,
    amount: amount,
    currency: 'USD'
  });

  return paymentResult;
}
```

## Bank Accounts (ACH)

For bank accounts, follow the same tokenization process:

```javascript
async function tokenizeBankAccount(bankData) {
  const token = await paymentsClient.tokenizeBankAccount({
    accountNumber: bankData.accountNumber,  // Client-side only
    routingNumber: bankData.routingNumber,  // Can be stored (public)
    accountType: bankData.accountType,      // checking or savings
    accountHolderName: bankData.name
  });

  return {
    token: token.id,
    lastFour: bankData.accountNumber.slice(-4),
    accountType: bankData.accountType,
    name: bankData.name,
    bankName: bankData.bankName
  };
}
```

Save to database:

```typescript
await addPaymentMethod({
  organization_id: organizationId,
  label: 'Business Checking',
  payment_type: 'bank_account',
  last_four: tokenizedData.lastFour,
  account_holder_name: tokenizedData.name,
  bank_name: tokenizedData.bankName,
  account_type: 'checking',
  payment_token: tokenizedData.token,
  payment_processor: 'bigcommerce',
  is_default: true
});
```

## Security Checklist

- [ ] All payment data tokenized before reaching server
- [ ] CVV codes never stored
- [ ] Full card numbers never stored
- [ ] Full account numbers never stored
- [ ] Payment forms use payment processor SDKs
- [ ] HTTPS enabled on all endpoints
- [ ] Row Level Security enabled on payment_methods table
- [ ] Payment tokens stored securely
- [ ] Access restricted to authorized users only
- [ ] Regular security audits performed

## Testing

### Test Card Numbers (BigCommerce)

For development/testing, use these test card numbers:

```
Visa: 4111 1111 1111 1111
Mastercard: 5500 0000 0000 0004
Amex: 3400 0000 0000 009
Discover: 6011 0000 0000 0004

Any future expiry date
Any 3-digit CVV (4 digits for Amex)
```

### Test Bank Account (BigCommerce)

```
Routing Number: 110000000
Account Number: 000123456789
Account Type: checking
```

## Common Mistakes to Avoid

### ❌ DON'T: Create custom payment forms

```javascript
// WRONG - This collects card data on your server
<input type="text" name="card_number" />
<input type="text" name="cvv" />
```

### ✅ DO: Use payment processor forms

```javascript
// CORRECT - Use processor's secure form
<div id="bigcommerce-payment-form"></div>
// or
<div id="stripe-card-element"></div>
```

### ❌ DON'T: Store sensitive data

```javascript
// WRONG - Storing full card number
await supabase.from('payment_methods').insert({
  card_number: '4111111111111111',  // PCI VIOLATION
  cvv: '123'                        // PCI VIOLATION
});
```

### ✅ DO: Store only tokens

```javascript
// CORRECT - Only storing token and safe display data
await supabase.from('payment_methods').insert({
  payment_token: 'tok_abc123xyz',   // Safe
  last_four: '1111',                // Safe
  expiry_month: 12,                 // Safe
  expiry_year: 2025                 // Safe
});
```

## Resources

- [PCI DSS Quick Reference Guide](https://www.pcisecuritystandards.org/document_library)
- [BigCommerce Payments API](https://developer.bigcommerce.com/api-docs/payments/payments-api-overview)
- [Stripe Security Best Practices](https://stripe.com/docs/security/guide)
- [PCI Tokenization Guidelines](https://www.pcisecuritystandards.org/documents/Tokenization_Guidelines_Info_Supplement.pdf)

## Support

If you have questions about PCI compliance:
1. Consult with your payment processor's support team
2. Review PCI DSS documentation
3. Consider hiring a PCI compliance consultant
4. Perform regular security audits

**Remember: When in doubt, tokenize and let the payment processor handle sensitive data.**
