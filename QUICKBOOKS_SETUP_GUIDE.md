# QuickBooks Integration Setup & Testing Guide

Step-by-step guide for setting up and testing the QuickBooks Online integration. For a features overview, see [QUICKBOOKS_FEATURES.md](./QUICKBOOKS_FEATURES.md). For technical API details, see [QUICKBOOKS_INTEGRATION.md](./QUICKBOOKS_INTEGRATION.md).

---

## What's Been Configured

1. **Environment Variables** (`.env` file)
   - QuickBooks Client ID and Secret configured
   - Sandbox environment enabled
   - Realm ID: `9341456500832199`
   - Redirect URI: `http://localhost:3000/quickbooks/callback`

2. **Admin Dashboard Integration**
   - New "QuickBooks" tab added to Admin Dashboard
   - Only visible to admin users
   - Located between "Commissions" and "Admin Settings" tabs

3. **Database Migration**
   - Migration SQL file created: `quickbooks_migration.sql`
   - **IMPORTANT**: You need to apply this migration manually (see below)

4. **OAuth Callback Route**
   - Callback route automatically handles `/quickbooks/callback` URLs
   - Seamlessly integrated into the app routing

---

## Step 1: Apply Database Migration

**CRITICAL**: Before testing, you must apply the database migration.

### Option A: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click "New Query"
4. Open the file `quickbooks_migration.sql` in your project root
5. Copy the entire contents
6. Paste into the SQL Editor
7. Click "Run" or press Cmd/Ctrl + Enter
8. Verify success (you should see "Success. No rows returned")

### Option B: Command Line (if you have psql)

```bash
# Get your database URL from Supabase Dashboard > Project Settings > Database
psql "your-connection-string" < quickbooks_migration.sql
```

### What the Migration Creates

- `quickbooks_credentials` table - Stores OAuth tokens
- `quickbooks_sync_log` table - Tracks all sync operations
- Adds QuickBooks fields to `organizations` and `orders` tables
- Sets up Row Level Security (RLS) policies (admin-only access)
- Creates performance indexes

---

## Step 2: Start the Development Server

```bash
npm run dev
```

The app will start at `http://localhost:3000`

---

## Step 3: Testing Workflow

### Phase 1: Connect QuickBooks

1. Sign in as an **admin user**
2. Click "Admin Dashboard" from the header
3. Click the **"QuickBooks"** tab (it has a dollar sign icon)
4. You'll see the connection status page
5. Click **"Connect to QuickBooks"** button
6. You'll be redirected to QuickBooks OAuth page
7. Sign in with your QuickBooks Sandbox credentials
8. Authorize the app
9. You'll be redirected back to `/quickbooks/callback`
10. The callback page will show "Connection Successful!"
11. You'll be automatically redirected back to Admin Dashboard
12. QuickBooks tab should now show "Connected" with a green checkmark

### Phase 2: Sync Organizations to QuickBooks Customers

1. In the QuickBooks tab, click the **"Sync Operations"** sub-tab
2. Click **"Sync Organizations Now"** button
3. Wait for the sync to complete (you'll see a success message)
4. Click the **"Sync Logs"** sub-tab to verify
5. You should see successful customer sync entries

**Verify in QuickBooks:**
- Log into QuickBooks Sandbox
- Go to **Sales** > **Customers**
- Your organizations should appear as customers

### Phase 3: Create Test Order & Generate Invoice

1. **Create a test order in your app:**
   - Sign out from admin account
   - Sign in as a customer user
   - Add products to cart
   - Select an organization
   - Complete checkout
   - An order will be created in the database

2. **Generate invoice from order:**
   - Sign back in as admin
   - Go to Admin Dashboard > QuickBooks tab
   - Click "Sync Operations"
   - Click **"Create Invoices"** button
   - This will create invoices for pending orders
   - Check "Sync Logs" to verify success

**Verify in QuickBooks:**
- Go to **Sales** > **Invoices** in QuickBooks
- Find the invoice for your test order
- Verify line items, quantities, and prices match

### Phase 4: Payment Processing (Advanced)

Payment processing is built-in but requires integration into your checkout flow. The services are ready to use:

```javascript
// Available in src/services/quickbooks/payments.ts
import { quickbooksPayments } from '@/services/quickbooks';

// 1. Tokenize credit card
const token = await quickbooksPayments.tokenizeCard({
  number: '4111111111111111', // Test Visa
  name: 'Customer Name',
  expMonth: '12',
  expYear: '2025',
  cvc: '123',
  address: { /* address details */ }
});

// 2. Authorize payment
const charge = await quickbooksPayments.authorizePayment(
  amount,
  token,
  'Customer Name'
);

// 3. Capture payment
await quickbooksPayments.capturePayment(charge.id);

// 4. Record payment to invoice
await quickbooksPayments.recordPaymentToInvoice(
  customerId,
  invoiceId,
  amount,
  charge.id
);
```

---

## QuickBooks Sandbox Test Cards

Use these test cards for payment testing:

- **Visa**: 4111111111111111
- **Mastercard**: 5105105105105100
- **American Express**: 378282246310005
- **Discover**: 6011111111111117

All test cards:
- **CVV**: Any 3-4 digits
- **Expiry**: Any future date
- **Zip Code**: Any valid US zip code

---

## QuickBooks Management Features

The QuickBooks tab in Admin Dashboard provides three sub-sections:

### Connection Status

- Shows connection state (Connected/Disconnected)
- Displays Realm ID
- Shows token expiration time
- "Connect to QuickBooks" / "Disconnect" buttons
- Token refresh status

### Sync Operations

- **Sync Organizations Now** - Syncs all organizations to QB customers
- **Create Invoices** - Creates invoices from pending orders
- Shows sync statistics (success/failure counts)
- Real-time sync status updates

### Sync Logs

- Complete audit trail of all QB operations
- Filterable by entity type (customer, invoice, payment)
- Shows success/failure status
- Error messages for failed syncs
- Timestamps for all operations
- Searchable by entity ID or QuickBooks ID

---

## Troubleshooting

### Issue: "No active QuickBooks connection found"

**Solution**:
- Go to Admin Dashboard > QuickBooks tab
- Click "Connect to QuickBooks"
- Complete OAuth flow

### Issue: OAuth redirect fails

**Solution**:
- Verify redirect URI in QuickBooks app settings matches exactly: `http://localhost:3000/quickbooks/callback`
- Check browser console for errors
- Clear browser cache and try again
- Verify environment variables are set correctly

### Issue: Customer sync fails

**Solution**:
- Ensure organization has required fields (name, email)
- Check sync logs for specific error message
- Verify QuickBooks OAuth token hasn't expired (tokens expire after 3600 seconds)
- Try refreshing the connection

### Issue: Invoice creation fails

**Solution**:
- Ensure organization is synced to QuickBooks first (has `quickbooks_customer_id`)
- Verify order exists in database
- Check that order has line items
- Review sync logs for detailed error message

### Issue: Token expired

**Solution**:
- The system should auto-refresh tokens
- If manual refresh needed, disconnect and reconnect
- Check `quickbooks_credentials` table for `expires_at` timestamp

---

## Database Schema

### `quickbooks_credentials`

Stores OAuth tokens and connection info:

```sql
- id (uuid)
- access_token (text) - encrypted
- refresh_token (text) - encrypted
- realm_id (text) - your QB company ID
- expires_at (timestamptz)
- refresh_token_expires_at (timestamptz)
- is_active (boolean) - only one active connection
- created_at, updated_at
```

### `quickbooks_sync_log`

Audit trail of all sync operations:

```sql
- id (uuid)
- entity_type (text) - 'customer', 'invoice', 'payment'
- entity_id (text) - local database ID
- operation (text) - 'create', 'update', 'read'
- status (text) - 'success', 'failed'
- quickbooks_id (text) - QB entity ID
- error_message (text)
- request_payload (jsonb)
- response_payload (jsonb)
- created_at (timestamptz)
```

### Modified Tables

**organizations** - Added columns:
- `quickbooks_customer_id` (text) - QB Customer ID
- `last_synced_at` (timestamptz)

**orders** - Added columns:
- `quickbooks_invoice_id` (text) - QB Invoice ID
- `sync_status` (text) - 'pending', 'synced', 'failed'
- `last_synced_at` (timestamptz)

---

## Security

- All QuickBooks credentials are encrypted at rest
- Row Level Security (RLS) enforced - admin-only access
- OAuth tokens automatically refresh before expiration
- Only one active connection allowed (constraint enforced)
- All sync operations logged for audit compliance

---

## Production Deployment

Before deploying to production:

1. **Update Environment Variables**:
   ```
   VITE_QB_ENVIRONMENT=production
   VITE_QB_REDIRECT_URI_PROD=https://yourdomain.com/quickbooks/callback
   ```

2. **Update QuickBooks App Settings**:
   - Add production redirect URI to QuickBooks app
   - Switch from sandbox to production mode
   - Use production credentials

3. **Test in Staging First**:
   - Test OAuth flow with production environment
   - Verify customer syncing
   - Test invoice creation
   - Test payment processing

4. **Monitor Sync Logs**:
   - Regularly check sync logs for errors
   - Set up alerts for failed syncs
   - Monitor token expiration

---

## Next Steps

1. Apply the database migration
2. Start the dev server
3. Connect QuickBooks
4. Sync an organization
5. Create a test order
6. Generate an invoice
7. Integrate payment processing into checkout
8. Add automated invoice creation on order placement
9. Set up payment capture on shipment
10. Test in production environment

---

## Related Documentation

- [QUICKBOOKS_FEATURES.md](./QUICKBOOKS_FEATURES.md) - QuickBooks features overview
- [QUICKBOOKS_INTEGRATION.md](./QUICKBOOKS_INTEGRATION.md) - Technical integration guide
- [PCI_COMPLIANCE.md](./PCI_COMPLIANCE.md) - Payment security compliance
- [QuickBooks API Docs](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/customer)
- [OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [Payments API](https://developer.intuit.com/app/developer/qbpayments/docs/get-started)
