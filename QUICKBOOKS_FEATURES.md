# QuickBooks Online Features

This document provides a high-level overview of all QuickBooks Online features available in the application. For technical details, see [QUICKBOOKS_INTEGRATION.md](./QUICKBOOKS_INTEGRATION.md). For setup instructions, see [QUICKBOOKS_SETUP_GUIDE.md](./QUICKBOOKS_SETUP_GUIDE.md).

---

## Feature Summary

| Feature | Description | Location |
|---------|-------------|----------|
| OAuth Connection | Connect/disconnect QuickBooks account | Admin Dashboard > QuickBooks |
| Customer Sync | Sync organizations & locations to QB customers | Admin Dashboard > Sync Operations |
| Invoice Creation | Generate QB invoices from orders | Admin Dashboard > Sync Operations |
| Payment Processing | Credit card & ACH tokenization, authorization, capture | Checkout flow |
| Stored Payment Methods | Save tokenized cards/accounts for reuse | Payment Form |
| Sync Logging | Audit trail of all QB operations | Admin Dashboard > Sync Logs |
| Payment Capture on Ship | Capture authorized payments when orders ship | Order management |

---

## 1. OAuth 2.0 Connection Management

**What it does:** Securely connects the application to a QuickBooks Online company using OAuth 2.0.

**How it works:**
- Admin clicks "Connect to QuickBooks" in the admin dashboard
- Redirects to QuickBooks for authorization
- Tokens are stored server-side in the `quickbooks_credentials` table
- Access tokens auto-refresh before expiration
- Only one active connection is allowed at a time

**Key details:**
- CSRF protection via state parameter
- Server-side token storage (Netlify Functions) - tokens never touch the browser
- Admin-only access enforced by Row Level Security
- Diagnostic tool available for troubleshooting connection issues

**Files:**
- `src/services/quickbooks/oauth.ts` - OAuth service
- `src/components/QuickBooksCallback.tsx` - Callback handler
- `netlify/functions/quickbooks-oauth.cjs` - Server-side OAuth

---

## 2. Customer Synchronization

**What it does:** Syncs organizations and locations from the application database to QuickBooks Online as customers.

**Capabilities:**
- **Single sync** - Sync one organization on demand
- **Batch sync** - Sync all organizations at once
- **Auto-sync** - Organizations are synced automatically when orders are created
- **Location sync** - Locations sync as separate QB customers (formatted as "Org Name - Location Name")
- **Two-way import** - Import existing QB customers as organizations

**Data mapped:**
- Company name, display name
- Primary email and phone
- Billing address (street, city, state, zip, country)
- Notes

**Files:**
- `src/services/quickbooks/customers.ts` - Customer sync service

---

## 3. Invoice Creation

**What it does:** Creates QuickBooks invoices from application orders, with full line item detail.

**Capabilities:**
- **Auto-generate** from orders with line items, quantities, and prices
- **Batch create** invoices for multiple pending orders
- **Email delivery** - Send invoices directly to customers via QuickBooks
- **PDF download** - Generate and download invoice PDFs
- **Void invoices** - Cancel invoices that are no longer needed
- **Payment terms** - Configurable due dates (Net 30, etc.)

**Data mapped:**
- Order line items with product names, quantities, unit prices
- Billing and shipping addresses
- Customer memo and private notes
- Tax codes (via QuickBooks configuration)

**Files:**
- `src/services/quickbooks/invoices.ts` - Invoice service

---

## 4. Payment Processing

**What it does:** Processes credit card and ACH/eCheck payments through QuickBooks Payments API.

### Credit Card Payments

| Operation | Description |
|-----------|-------------|
| Tokenize | Securely tokenize card numbers (PCI compliant) |
| Authorize | Hold funds without capturing (at checkout) |
| Capture | Capture authorized funds (on shipment) |
| Charge | Authorize and capture in one step |
| Refund | Refund a captured charge |
| Void | Cancel an authorized charge before capture |

### ACH/eCheck Payments

| Operation | Description |
|-----------|-------------|
| Tokenize bank account | Securely tokenize routing + account numbers |
| Process ACH | Debit a bank account |
| Process with token | Debit using a stored token |
| Refund eCheck | Refund an ACH payment |
| Void eCheck | Cancel a pending ACH payment |

### Payment Flow

```
Checkout                    Shipment                   QuickBooks
   │                           │                          │
   ├── Tokenize card ──────────┤                          │
   ├── Authorize payment ──────┤                          │
   │                           ├── Capture payment ───────┤
   │                           ├── Record to invoice ─────┤
   │                           │                          │
```

1. Customer enters card at checkout → card is tokenized
2. Payment is authorized (funds held, not captured)
3. When order ships → payment is captured
4. Payment is recorded against the QuickBooks invoice

**Rate limiting:** 10 payment attempts per 15-minute window per user.

**Files:**
- `src/services/quickbooks/payments.ts` - Payments service
- `src/components/checkout/PaymentForm.tsx` - Payment UI
- `netlify/functions/quickbooks-api.cjs` - API proxy with rate limiting

---

## 5. Stored Payment Methods

**What it does:** Allows customers to save payment methods for future orders.

**Capabilities:**
- Save tokenized credit cards linked to organizations/locations
- Save tokenized bank accounts (ACH)
- Display last 4 digits and card type for identification
- Set a default payment method per organization
- Delete stored payment methods
- Expiration date tracking

**Security:**
- Raw card/account numbers are never stored
- Only QuickBooks payment tokens are persisted
- PCI Level 1 compliance via QuickBooks Payments

**Files:**
- `src/services/quickbooks/payments.ts` - `savePaymentMethod()`, `deletePaymentMethod()`

---

## 6. Sync Logging & Monitoring

**What it does:** Provides a complete audit trail of all QuickBooks synchronization operations.

**What is logged:**
- Entity type (customer, invoice, payment)
- Operation type (create, update, read)
- Status (success, failed, pending, retry)
- Full request and response payloads
- Error messages for failed operations
- Timestamps and user attribution

**Admin dashboard features:**
- Real-time sync event monitoring
- Filter by entity type and status
- Search by entity ID or QuickBooks ID
- Error message display for troubleshooting

**Database:** `quickbooks_sync_log` table with RLS (admin-only access)

**Files:**
- `src/services/quickbooks/client.ts` - `logSync()` method
- `src/components/admin/QuickBooksManagement.tsx` - Sync Logs tab

---

## 7. Admin Dashboard

The QuickBooks tab in the Admin Dashboard provides three sections:

### Connection Status
- View connected/disconnected state
- Display Realm ID (QuickBooks company ID)
- Show token expiration time
- Connect/Disconnect buttons
- Connection diagnostics tool

### Sync Operations
- **Sync Organizations Now** - Batch sync all organizations to QB customers
- **Create Invoices** - Generate invoices for pending orders
- Progress tracking with success/failure counts
- Real-time status updates during operations

### Sync Logs
- Chronological list of all sync operations
- Color-coded status indicators
- Expandable error details
- Filterable and searchable

**Access:** Admin role only (enforced via UI and database RLS)

**Files:**
- `src/components/admin/QuickBooksManagement.tsx`
- `src/components/admin/AdminDashboard.tsx` - Tab registration

---

## 8. Order Integration

**What it does:** Integrates QuickBooks with the order lifecycle.

**Automatic actions:**
- Customer sync on order creation (if not already synced)
- Invoice generation from order data
- Payment authorization at checkout
- Payment capture when order status changes to "shipped"
- Payment recording to QB invoice

**Order fields added:**
- `quickbooks_invoice_id` - Links order to QB invoice
- `sync_status` - Tracks sync state (pending, synced, failed)
- `last_synced_at` - Timestamp of last sync

**Files:**
- `src/services/orderService.ts` - Capture on shipment
- `src/components/checkout/CheckoutModal.tsx` - Checkout integration

---

## Database Schema

### New Tables

| Table | Purpose |
|-------|---------|
| `quickbooks_credentials` | OAuth tokens, realm ID, connection state |
| `quickbooks_sync_log` | Audit trail of all sync operations |

### Extended Fields

| Table | Added Fields |
|-------|-------------|
| `organizations` | `quickbooks_customer_id`, `last_synced_at` |
| `locations` | `quickbooks_customer_id`, `last_synced_at` |
| `orders` | `quickbooks_invoice_id`, `sync_status`, `last_synced_at` |
| `payment_methods` | `quickbooks_payment_method_id`, `last_synced_at` |

**Migration file:** `quickbooks_migration.sql` (project root)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ QB Admin Tab  │  │ Payment Form │  │ QB Callback   │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
┌─────────┼─────────────────┼──────────────────┼──────────┐
│         ▼                 ▼                  ▼          │
│  ┌─────────────────────────────────────────────────┐    │
│  │           QuickBooks Service Layer               │    │
│  │  oauth.ts │ customers.ts │ invoices.ts │ payments│    │
│  └─────────────────────┬───────────────────────────┘    │
│                        │                                │
│  ┌─────────────────────▼───────────────────────────┐    │
│  │           Netlify Functions (Server-side)         │    │
│  │  quickbooks-oauth.cjs  │  quickbooks-api.cjs     │    │
│  └─────────────────────┬───────────────────────────┘    │
└────────────────────────┼────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌───────────┐
   │ QB OAuth   │ │ QB Online  │ │ QB        │
   │ Servers    │ │ Accounting │ │ Payments  │
   │            │ │ API        │ │ API       │
   └────────────┘ └────────────┘ └───────────┘
```

---

## Security

- **OAuth tokens** stored server-side only, never exposed to browser
- **Payment data** tokenized via QuickBooks Payments (PCI Level 1)
- **Row Level Security** on all QB tables (admin-only)
- **Rate limiting** on payment endpoints (10 attempts per 15 min)
- **CSRF protection** on OAuth flow via state parameter
- **Sensitive data sanitization** in sync logs (card numbers, tokens redacted)
- **Single active connection** constraint prevents stale credentials

---

## Related Documentation

- [QUICKBOOKS_INTEGRATION.md](./QUICKBOOKS_INTEGRATION.md) - Technical API details, code examples, endpoint reference
- [QUICKBOOKS_SETUP_GUIDE.md](./QUICKBOOKS_SETUP_GUIDE.md) - Step-by-step setup, testing workflow, troubleshooting
- [PCI_COMPLIANCE.md](./PCI_COMPLIANCE.md) - Payment security compliance details
