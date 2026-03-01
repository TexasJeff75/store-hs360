# QuickBooks Online Integration Guide

## Overview

This application integrates with QuickBooks Online to provide:
- **Invoice-based payment processing** - Create professional invoices for orders
- **Stored payment methods** - Securely tokenize and store credit cards in QuickBooks Payments
- **Automated customer sync** - Sync organizations and locations to QuickBooks customers
- **Payment capture on shipment** - Authorize at checkout, capture when order ships
- **Comprehensive sync logging** - Track all synchronization events and errors

## Prerequisites

1. **QuickBooks Online Account** with QuickBooks Payments enabled
2. **QuickBooks Developer Account** at developer.intuit.com
3. **OAuth 2.0 Credentials** (Client ID and Client Secret)

## Setup Instructions

### 1. Create QuickBooks Developer App

1. Go to [developer.intuit.com](https://developer.intuit.com) and sign in
2. Click "My Apps" and create a new app
3. Select "QuickBooks Online and Payments" as the platform
4. Fill in your app details:
   - **App Name**: Your App Name
   - **App Description**: Brief description of your integration

### 2. Configure OAuth Settings

1. In your app dashboard, go to "Keys & credentials"
2. Copy your **Client ID** and **Client Secret**
3. Add redirect URIs:
   - Development: `http://localhost:3000/admin/quickbooks/callback`
   - Production: `https://yourdomain.com/admin/quickbooks/callback`
4. Set scopes:
   - `com.intuit.quickbooks.accounting` - For invoices, customers, payments
   - `com.intuit.quickbooks.payment` - For payment processing

### 3. Enable QuickBooks Payments

1. In your QuickBooks Online account, go to Settings > Payments
2. Enable QuickBooks Payments merchant services
3. Complete merchant account setup
4. Note: This may require business verification

### 4. Configure Environment Variables

Add the following to your `.env` file:

```env
# QuickBooks OAuth Credentials
VITE_QB_CLIENT_ID=your_client_id_here
VITE_QB_CLIENT_SECRET=your_client_secret_here
VITE_QB_ENVIRONMENT=sandbox
VITE_QB_REDIRECT_URI=http://localhost:3000/admin/quickbooks/callback
VITE_QB_REDIRECT_URI_PROD=https://yourdomain.com/admin/quickbooks/callback
```

**Important:**
- Use `sandbox` for testing, `production` for live
- Keep Client Secret secure and never commit to version control
- Update redirect URIs to match your domain

### 5. Apply Database Migration

The QuickBooks integration requires database schema changes. Apply the migration:

```sql
-- Located at: supabase/migrations/20260301000000_add_quickbooks_integration.sql
-- This migration adds:
-- - quickbooks_credentials table (OAuth tokens)
-- - quickbooks_sync_log table (sync event tracking)
-- - QuickBooks ID fields to organizations, locations, orders, payment_methods
```

The migration SQL is stored in `/tmp/qb_migration.sql` and needs to be applied to your Supabase database.

### 6. Connect to QuickBooks

1. Navigate to Admin Panel > QuickBooks tab
2. Click "Connect to QuickBooks"
3. Sign in to your QuickBooks account
4. Authorize the app
5. You'll be redirected back with an active connection

## Features

### 1. Customer Synchronization

**Organizations → QuickBooks Customers**

Organizations in your database are synced to QuickBooks as customers:
- Company name, billing address, contact info
- Automatic sync on order creation
- Manual batch sync available in admin panel

**Locations → QuickBooks Customers**

Locations can be synced as separate customers:
- Formatted as "Organization Name - Location Name"
- Maintains separate invoicing and payment methods per location

### 2. Invoice Creation

**Automatic Invoice Generation**

When an order is created:
1. Customer is synced to QuickBooks (if not already)
2. Invoice is generated with order line items
3. Invoice ID is linked back to the order
4. Invoice can be emailed to customer

**Invoice Features:**
- Line items with product details, quantities, prices
- Billing and shipping addresses
- Tax calculations (via QuickBooks tax codes)
- Payment terms (Net 30, etc.)
- Custom notes and order references
- PDF generation and download

### 3. Payment Processing

**Card Tokenization**

Credit cards are tokenized using QuickBooks Payments API:
```typescript
import { quickbooksPayments } from './services/quickbooks';

const token = await quickbooksPayments.tokenizeCard({
  number: '4111111111111111',
  name: 'John Doe',
  expMonth: '12',
  expYear: '2025',
  cvc: '123',
  address: {
    streetAddress: '123 Main St',
    city: 'San Francisco',
    region: 'CA',
    country: 'US',
    postalCode: '94105'
  }
});
```

**Payment Flow:**

1. **Authorization** - Payment is authorized at checkout
   ```typescript
   const charge = await quickbooksPayments.authorizePayment(
     orderTotal,
     paymentToken,
     cardholderName
   );
   // Status: AUTHORIZED (funds held but not captured)
   ```

2. **Capture** - Payment is captured when order ships
   ```typescript
   await quickbooksPayments.capturePayment(chargeId);
   // Status: CAPTURED (funds transferred to merchant)
   ```

3. **Record Payment** - Payment is linked to invoice in QuickBooks
   ```typescript
   await quickbooksPayments.recordPaymentToInvoice(
     customerId,
     invoiceId,
     amount,
     chargeId
   );
   ```

### 4. Stored Payment Methods

Customers can save payment methods for future use:
- Securely tokenized in QuickBooks Payments
- Display shows last 4 digits and card type
- Set default payment method per organization/location
- Expiration date tracking and validation

### 5. Sync Logging

All synchronization events are logged:
- Entity type (customer, invoice, payment, etc.)
- Operation type (create, update, delete, read)
- Status (pending, success, failed, retry)
- Full request and response data
- Error messages for troubleshooting

## Usage Examples

### Sync an Organization to QuickBooks

```typescript
import { quickbooksCustomers } from './services/quickbooks';

const quickbooksCustomerId = await quickbooksCustomers.syncOrganization(
  organizationId
);
```

### Create Invoice from Order

```typescript
import { quickbooksInvoices } from './services/quickbooks';

const invoiceId = await quickbooksInvoices.createInvoiceFromOrder(orderId);
```

### Process Payment for Invoice

```typescript
import { quickbooksPayments } from './services/quickbooks';

const { chargeId, paymentId } = await quickbooksPayments.processInvoicePayment(
  orderId,
  invoiceId,
  paymentMethodId
);
```

### Capture Payment on Shipment

```typescript
import { quickbooksPayments } from './services/quickbooks';

await quickbooksPayments.captureOrderPayment(orderId);
```

## Admin Panel Features

### Connection Tab
- View connection status
- Connect/disconnect QuickBooks account
- View OAuth token expiration
- Manual token refresh

### Sync Operations Tab
- Batch sync all organizations
- Create invoices for pending orders
- View sync progress and results

### Sync Logs Tab
- Real-time sync event monitoring
- Filter by status (success, failed, pending)
- View error messages
- Export logs for troubleshooting

## Database Schema

### quickbooks_credentials
Stores OAuth tokens and connection information:
```sql
- id (uuid)
- realm_id (text) - QuickBooks company ID
- access_token (text) - OAuth access token
- refresh_token (text) - OAuth refresh token
- token_expires_at (timestamptz)
- is_active (boolean)
- connected_by (uuid) - User who connected
- last_refresh_at (timestamptz)
- metadata (jsonb)
```

### quickbooks_sync_log
Tracks all synchronization events:
```sql
- id (uuid)
- entity_type (text) - customer, invoice, payment, etc.
- entity_id (uuid) - Local database ID
- quickbooks_id (text) - QuickBooks entity ID
- sync_type (text) - create, update, delete, read
- status (text) - pending, success, failed, retry
- request_data (jsonb)
- response_data (jsonb)
- error_message (text)
- retry_count (integer)
- synced_at (timestamptz)
```

### Extended Fields
Added to existing tables:
- **organizations**: `quickbooks_customer_id`, `last_synced_at`
- **locations**: `quickbooks_customer_id`, `last_synced_at`
- **orders**: `quickbooks_invoice_id`, `quickbooks_payment_id`, `sync_status`, `last_synced_at`
- **payment_methods**: `quickbooks_payment_method_id`, `last_synced_at`

## API Endpoints

### QuickBooks Online Accounting API
Base URL (Sandbox): `https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}`

**Customers**
- `POST /customer` - Create/update customer
- `GET /customer/{id}` - Get customer details
- `GET /query?query={sql}` - Query customers

**Invoices**
- `POST /invoice` - Create invoice
- `GET /invoice/{id}` - Get invoice details
- `POST /invoice/{id}/send` - Email invoice
- `GET /invoice/{id}/pdf` - Download PDF

**Payments**
- `POST /payment` - Record payment to invoice

### QuickBooks Payments API
Base URL (Sandbox): `https://sandbox.api.intuit.com/quickbooks/v4`

**Tokenization**
- `POST /tokens` - Create card token

**Charges**
- `POST /payments/charges` - Create charge (authorize or capture)
- `POST /payments/charges/{id}/capture` - Capture authorized charge
- `POST /payments/charges/{id}/refunds` - Refund or void charge

## Security Best Practices

1. **OAuth Tokens**
   - Tokens are stored encrypted in database
   - Row-level security restricts access to admins only
   - Automatic token refresh before expiration
   - Tokens can be revoked at any time

2. **Payment Data**
   - Never store raw card numbers
   - Only tokenized references are stored
   - QuickBooks Payments is PCI Level 1 compliant
   - Last 4 digits stored for display only

3. **API Communication**
   - All API calls use HTTPS
   - OAuth 2.0 bearer token authentication
   - Request/response logging for audit trail

## Troubleshooting

### Connection Issues

**Error: "No active QuickBooks connection found"**
- Solution: Connect your QuickBooks account in Admin Panel

**Error: "Token expired"**
- Solution: Tokens automatically refresh. Check sync logs for errors.

**Error: "Invalid state parameter"**
- Solution: Clear browser cache and try connecting again.

### Sync Failures

**Customer Sync Failed**
- Check organization has required fields: name, email, address
- Verify QuickBooks account is active
- Review sync logs for specific error message

**Invoice Creation Failed**
- Ensure customer is synced first
- Verify order has valid line items with prices
- Check QuickBooks tax codes are configured

**Payment Processing Failed**
- Verify payment method is tokenized and active
- Check card expiration date
- Ensure sufficient funds available
- Review QuickBooks Payments merchant account status

### Sync Log Errors

Common error messages and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Customer already exists" | Duplicate DisplayName | Use existing customer or change name |
| "Invalid tax code" | Tax code not found | Configure tax codes in QuickBooks |
| "Payment declined" | Insufficient funds or fraud check | Contact customer for alternate payment |
| "Invoice not found" | Invoice deleted in QB | Recreate invoice from order |
| "Token expired" | OAuth token needs refresh | Automatic refresh should trigger |

## Testing

### Sandbox Environment

Use QuickBooks Sandbox for development:
1. Create sandbox company at developer.intuit.com
2. Set `VITE_QB_ENVIRONMENT=sandbox` in `.env`
3. Use sandbox credentials for OAuth

### Test Card Numbers

QuickBooks Payments test cards (sandbox only):
- **Visa**: 4111111111111111
- **Mastercard**: 5105105105105100
- **Amex**: 378282246310005
- **Discover**: 6011111111111117

Test Data:
- CVV: Any 3-4 digits
- Expiry: Any future date
- Address: Any valid US address

### Integration Testing Checklist

- [ ] OAuth connection successful
- [ ] Organization syncs to QuickBooks customer
- [ ] Location syncs to QuickBooks customer
- [ ] Invoice created from order
- [ ] Payment method tokenized and saved
- [ ] Payment authorized at checkout
- [ ] Payment captured on shipment
- [ ] Payment recorded to invoice in QuickBooks
- [ ] Sync logs show successful operations
- [ ] Error handling works for failed operations

## Production Deployment

### Before Going Live

1. **Switch to Production Environment**
   ```env
   VITE_QB_ENVIRONMENT=production
   VITE_QB_REDIRECT_URI_PROD=https://yourdomain.com/admin/quickbooks/callback
   ```

2. **Update Redirect URIs**
   - Add production URL in QuickBooks app settings
   - Update allowed origins for CORS

3. **Verify QuickBooks Payments**
   - Complete merchant account verification
   - Review payment processing fees
   - Set up bank account for deposits

4. **Test with Real Transactions**
   - Process small test order ($1)
   - Verify invoice creation
   - Verify payment capture
   - Check QuickBooks for accuracy

5. **Monitor Sync Logs**
   - Set up alerts for failed syncs
   - Review logs daily initially
   - Implement retry logic for failures

### Ongoing Maintenance

- Monitor OAuth token expiration and refresh
- Review sync logs for errors weekly
- Reconcile orders vs invoices monthly
- Update QuickBooks API client if changes announced
- Keep payment method tokens current (re-tokenize expired cards)

## Support Resources

- [QuickBooks API Documentation](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/customer)
- [QuickBooks Payments API](https://developer.intuit.com/app/developer/qbpayments/docs/api/resources/all-entities/charges)
- [OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [Sandbox Test Data](https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes)

## Appendix: Migration SQL

The complete migration SQL is located at `/tmp/qb_migration.sql`. Apply it to your Supabase database using your preferred method (Supabase Dashboard, psql, or migration tool).

Key tables created:
- `quickbooks_credentials` - OAuth connection data
- `quickbooks_sync_log` - Sync event tracking

Key fields added:
- Organizations, Locations: `quickbooks_customer_id`, `last_synced_at`
- Orders: `quickbooks_invoice_id`, `quickbooks_payment_id`, `sync_status`, `last_synced_at`
- Payment Methods: `quickbooks_payment_method_id`, `last_synced_at`
