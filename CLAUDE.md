# Store HS360 - Project Context

B2B e-commerce storefront for HS360. Customers browse products, place orders through organizations. Distributors and sales reps earn commissions on completed orders.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, TailwindCSS, Lucide icons, Framer Motion
- **Database/Auth:** Supabase (PostgreSQL + Row Level Security + Auth)
- **Backend:** Netlify Functions (Node.js 18, CommonJS `.cjs`)
- **External APIs:** BigCommerce (product catalog), QuickBooks Online (invoicing/payments)
- **Testing:** Vitest + Testing Library
- **Deploy:** Netlify (Functions + static hosting)

## Project Structure

```
src/
  components/
    admin/          # 27+ admin components (dashboard, orders, commissions, pricing, etc.)
    checkout/       # CheckoutModal, PaymentForm, AddressSelector, OrderReceipt
    (root)          # Customer-facing: Header, ProductGrid, Cart, AuthModal
  services/         # 23+ service files (business logic, API calls)
  contexts/         # AuthContext (auth + impersonation), FavoritesContext
  hooks/            # useContractPricing, useErrorLogger
  config/           # env.ts (environment variable validation)
netlify/functions/  # Serverless: quickbooks-oauth.cjs, quickbooks-api.cjs, payment processing
supabase/migrations/ # 45+ SQL migrations (schema, triggers, RLS policies)
```

## Domain Model

### Core Entities
- **Products** — synced from BigCommerce (SKU, brand, category, price, cost)
- **Organizations** — multi-tenant customer companies (with locations)
- **Orders** — items + totals + shipping/billing + payment status + sales_rep_id
- **Distributors** — buy wholesale, resell to customers, manage sales reps
- **Sales Reps** — assigned to organizations, earn commissions
- **Commissions** — one summary record per order + per-line-item breakdown

### Key Tables
| Table | Purpose |
|-------|---------|
| `profiles` | Users (email, role, approval status) |
| `organizations` | Customer companies |
| `locations` | Sub-divisions within organizations |
| `orders` | Customer orders (items stored as JSONB) |
| `commissions` | Commission summary per order |
| `commission_line_items` | Per-product commission with rule audit trail |
| `commission_audit_log` | Trigger-level debug log |
| `organization_sales_reps` | Sales rep → org assignments with rate |
| `distributors` | Distributor entities |
| `distributor_sales_reps` | Sales reps under a distributor |
| `distributor_commission_rules` | Per-product/category commission overrides |
| `distributor_product_pricing` | Wholesale prices per distributor-product |
| `contract_pricing` | Individual user-product custom prices |
| `organization_pricing` | Org-level product pricing |
| `location_pricing` | Location-level product pricing |
| `product_secret_costs` | Hidden costs (cost_admin only) |
| `payment_methods` | Vault-stored tokenized payment methods |
| `support_tickets` | Customer support with message threads |

## Role System

| Role | Access |
|------|--------|
| `admin` | Full access. Manage users, orgs, distributors, pricing, costs, commissions. Can impersonate users. |
| `sales_rep` | View assigned organizations, own commissions, customer pricing for their orgs |
| `distributor` | Manage own sales reps, set product pricing, view commission splits |
| `customer` | Browse products, place orders, manage addresses/payment methods |

Organization-level roles: `admin`, `manager`, `member`, `viewer`

## Commission System

**This is the most complex subsystem.** Key files:
- `src/services/commissionService.ts` — service layer
- `src/components/admin/CommissionManagement.tsx` — admin UI
- `src/components/admin/DistributorManagement.tsx` — distributor config
- `supabase/migrations/20260311000000_commission_line_items_and_audit.sql` — latest schema + trigger

### Two Pricing Models
1. **Margin Split** (default) — Commission = rate% x (customer_price - product_cost)
2. **Wholesale** — Distributor buys at wholesale_price, keeps spread (customer_price - wholesale_price)

### Five Commission Types
`percent_margin`, `percent_gross_sales`, `percent_net_sales`, `flat_per_order`, `flat_per_unit`

### Commission Rule Priority (highest to lowest)
1. Customer + Product rule (`distributor_commission_rules` with org_id + product_id)
2. Customer + Category rule (org_id + category_id)
3. Product-only rule (product_id, no org_id)
4. Category-only rule (category_id, no org_id)
5. Distributor default (`distributors.commission_rate`)
6. Org-rep rate (`organization_sales_reps.commission_rate`)

### Commission Split Types
- `percentage_of_distributor` — Sales rep gets X% of total commission
- `fixed_with_override` — Sales rep and distributor each get independent % of margin
- Company rep — independent payout from remaining margin

### Commission Lifecycle
`order completed` → trigger calculates → `pending` → admin approves → `approved` → admin marks paid → `paid`

### Important: No Default Rates
Commission rates are **never** auto-filled. All rates must be explicitly set:
- `organization_sales_reps.commission_rate` — no DEFAULT
- `distributors.commission_rate` — form starts empty
- `distributor_sales_reps.sales_rep_rate` — form starts empty
- The trigger logs to `commission_audit_log` if no config is found (instead of silently defaulting to 5%)

### Audit Trail
- `commission_line_items` — per-product: `rule_source`, `rule_id`, `commission_type`, `commission_rate`, `effective_price`
- `commission_audit_log` — events: `calculated`, `skipped`, `fallback_used`, `error` + JSON details

## Pricing Hierarchy

Resolution order (first match wins):
1. **Location pricing** (`location_pricing`) — org + location + product
2. **Organization pricing** (`organization_pricing`) — org + product
3. **Individual contract pricing** (`contract_pricing`) — user + product
4. **Retail/list price** — default from BigCommerce

**Secret costs** (`product_secret_costs`) — hidden product costs visible only to `cost_admin` role, used in profit calculations.

**Wholesale pricing** (`distributor_product_pricing`) — used only in the wholesale commission model.

## Key Services

| Service | File | Purpose |
|---------|------|---------|
| Order | `orderService.ts` | Create, update, split orders |
| Commission | `commissionService.ts` | Commission CRUD, line items, audit log |
| Pricing | `contractPricing.ts` | Price resolution (individual/org/location) |
| Products | `productService.ts` | BigCommerce product sync and search |
| Secret Costs | `secretCostService.ts` | Hidden cost management (cost_admin) |
| Multi-Tenant | `multiTenant.ts` | Organization/address/role management |
| QuickBooks | `quickbooks/*.ts` | OAuth, invoicing, payment recording |
| Payments | `paymentMethods.ts` | Vault-stored payment methods |
| Recurring | `recurringOrderService.ts` | Subscription order management |

## External Integrations

### BigCommerce
- Products synced via `productImportService` into `products` table
- Cart/order data flows through Supabase, not direct BC API from frontend
- Product images, custom fields, SKUs, brands, categories all imported

### QuickBooks Online
- OAuth 2.0 via Netlify Function (`quickbooks-oauth.cjs`)
- Customer sync: organizations → QB customers
- Invoice creation for completed orders
- Payment recording
- Admin manages connection in QuickBooksManagement component

### Supabase
- PostgreSQL with RLS policies on all sensitive tables
- Auth: email/password with JWT
- Triggers: commission calculation on order completion
- No Realtime or Storage (Netlify Blobs used instead)

## Conventions

- **Auth:** `AuthContext` manages user state + impersonation. Use `effectiveUserId`/`effectiveProfile` for data display (supports impersonation), `user`/`profile` for permission checks.
- **Admin UI:** Tab-based navigation in `AdminDashboard.tsx`. Modal dialogs for forms. `SortableTable` component for data tables.
- **RLS:** Every sensitive table has Row Level Security policies. Check `auth.uid()` for user access, `profiles.role` for admin checks.
- **Services:** Return `{ data, error }` or `{ success, error }` pattern. Never throw — always catch and return error strings.
- **Forms:** Validate on submit, show inline errors. Use `alert()` for success/failure (legacy pattern).
- **Migrations:** Numbered timestamps `YYYYMMDDHHMMSS_description.sql`. Latest trigger is always the source of truth.

## Common Gotchas

1. **Commission split columns can be NULL** on records created before Oct 2025. Never use `sales_rep_commission ?? commission_amount` — use `sales_rep_commission || 0` instead.
2. **Commission trigger is PL/pgSQL** (~500 lines). It's rewritten via migrations, not versioned in app code. Always check the latest migration for current logic.
3. **Order items are JSONB** in `orders.items`. Each item has: `productId`, `name`, `price`, `cost`, `quantity`, `retailPrice`, `markup`.
4. **The `products` table** is synced from BigCommerce. Don't modify product data directly — it will be overwritten on next sync.
5. **Netlify Functions** use CommonJS (`.cjs`), not ESM. They run on Node 18.
6. **Environment variables:** Frontend uses `VITE_` prefix. Backend (Netlify Functions) uses plain names. See `.env.example`.
