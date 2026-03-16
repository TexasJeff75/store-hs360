# HS360 Admin Training Guide

This guide covers everything an Administrator needs to know to manage the HS360 B2B e-commerce platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Admin Dashboard Overview](#admin-dashboard-overview)
3. [User Management](#user-management)
4. [Order Management](#order-management)
5. [Commission Management](#commission-management)
6. [Customer (Organization) Management](#customer-organization-management)
7. [Sales Rep Assignment](#sales-rep-assignment)
8. [Distributor Management](#distributor-management)
9. [Pricing Management](#pricing-management)
10. [Product Management](#product-management)
11. [Category Management](#category-management)
12. [Cost Admin & Profit Reports](#cost-admin--profit-reports)
13. [QuickBooks Integration](#quickbooks-integration)
14. [Site Settings & Email Templates](#site-settings--email-templates)
15. [Analytics & Audit Logs](#analytics--audit-logs)
16. [Support Tickets](#support-tickets)
17. [Impersonation](#impersonation)

---

## Getting Started

After logging in with your admin credentials, you will be taken to the **Admin Dashboard**. The dashboard is organized with a sidebar navigation containing the following sections:

- **Home** — KPIs, charts, pending approvals, and quick actions
- **Operations** — Users, Orders, Recurring Orders, Commissions
- **Settings** — Customers, Sales Reps, Pricing, Distributors, Products, Categories, Cost Admin, QuickBooks, Site Settings, Email Templates
- **Analytics** — Login Audit Log, Profit Reports
- **Support** — Support Ticket Management
- **Help** — Documentation and FAQs

---

## Admin Dashboard Overview

The **Home** tab provides an at-a-glance view of your system:

### Key Performance Indicators (KPIs)
- **Revenue** — Total revenue over the last 30 days
- **Orders** — Number of orders in the last 30 days
- **Active Users** — Count of active user accounts
- **Customers** — Total customer organizations
- **Active Products** — Products currently available in the catalog
- **Pending Orders** — Orders awaiting processing
- **Completed Orders** — Successfully fulfilled orders

### Pending User Approvals
A badge on the Home tab shows the count of users waiting for approval. New user registrations require admin approval before the user can access the system.

### Charts
- **Orders by Day** — Bar chart of the last 7 days of order activity
- **Top Products** — Most frequently ordered products over the last 30 days

### Quick Actions
One-click buttons to jump directly to Orders, Users, Customers, Products, Analytics, or Support.

---

## User Management

Navigate to **Operations > Users**.

### Viewing Users
- Browse all users across all roles (admin, customer, sales_rep, distributor)
- Search by name or email
- Filter by role and approval status

### Approving New Users
When a new user registers, their account starts in a **pending** state. You must approve them before they can access the system:
1. Look for the pending approval badge on the Users tab
2. Click on a pending user
3. Review their registration details
4. Click **Approve** or **Deny**

### Managing User Roles
- Change a user's system role (admin, customer, sales_rep, distributor)
- Manage organization-level roles (admin, manager, member, viewer) for users within customer organizations

### Important Notes
- A user can belong to multiple organizations with different org-level roles
- Changing a user's system role does not affect their organization-level roles
- Denied users cannot log in but their record is retained for audit purposes

---

## Order Management

Navigate to **Operations > Orders**.

### Viewing Orders
- View all orders system-wide
- Filter by status: pending, processing, completed, cancelled
- Search by order ID, customer name, or date range
- Click any order to view full details including line items, quantities, prices, and totals

### Order Lifecycle
1. **Pending** — Customer has placed the order
2. **Processing** — Order is being prepared
3. **Completed** — Order fulfilled and delivered
4. **Cancelled** — Order was cancelled

### Key Actions
- **Update status** — Move an order through the lifecycle stages
- **View details** — See complete order breakdown (items are stored as JSONB with productId, name, price, cost, quantity, retailPrice, markup)
- **Print receipt** — Generate a printable order receipt
- **Export data** — Download order data for reporting

### Recurring Orders
Navigate to **Operations > Recurring Orders** to manage subscription orders:
- View all recurring orders across all customers
- Filter by status: active, paused, cancelled, expired
- See which orders are due today or overdue
- Pause, resume, or cancel recurring orders

---

## Commission Management

Navigate to **Operations > Commissions**.

This is one of the most complex areas of the system. Commissions are automatically calculated when an order is completed, but require admin approval before payout.

### Commission Lifecycle
1. **Order Completed** — A database trigger automatically calculates commissions
2. **Pending** — Commission is calculated and awaiting admin review
3. **Approved** — Admin has reviewed and approved the commission
4. **Paid** — Admin has marked the commission as paid out
5. **Cancelled** — Commission was cancelled (can be restored)

### Viewing Commissions
- Filter by status (pending, approved, paid, cancelled)
- Search by organization, sales rep, or distributor name
- Group commissions by month for batch processing
- View totals broken down by status

### Approving & Paying Commissions
1. Review pending commissions in the list
2. Click into a commission to see the per-order breakdown
3. Review the **line items** — each product in the order has its own commission calculation
4. Click **Approve** to move from pending to approved
5. When payment is sent, click **Mark as Paid**
6. Use **batch operations** to approve or pay multiple commissions at once

### Commission Line Items
Each order's commission includes per-product line items showing:
- **Rule source** — Which commission rule was applied (and why)
- **Commission type** — percent_margin, percent_gross_sales, percent_net_sales, flat_per_order, or flat_per_unit
- **Commission rate** — The percentage or flat amount applied
- **Effective price** — The customer price used in the calculation
- **Wholesale price** — If using the wholesale model

### Audit Trail
The **Commission Audit Log** records every calculation step:
- `calculated` — Commission was successfully calculated
- `skipped` — Line item was skipped (and why)
- `fallback_used` — A fallback rule was applied
- `error` — An error occurred during calculation

### Diagnostics
Use the diagnostics panel to identify:
- Orders without commission records (missing calculations)
- Mismatched organization/sales rep configurations
- Missing pricing rule assignments

### Commission Rule Priority
When calculating commissions, the system checks rules in this order (first match wins):
1. Customer + Product rule (most specific)
2. Customer + Category rule
3. Product-only rule
4. Category-only rule
5. Distributor default rate
6. Organization-rep assignment rate

### Commission Split Types
When a distributor has sales reps, commissions are split:
- **Percentage of Distributor** — Sales rep gets X% of the distributor's total commission
- **Fixed with Override** — Sales rep and distributor each get independent percentages of the margin

### Important Notes
- Commission rates are **never** auto-filled. All rates must be explicitly set.
- Commission split columns can be NULL on older records. Always check for null values.
- The calculation trigger is a ~500-line PL/pgSQL function. Check the latest migration for current logic.

---

## Customer (Organization) Management

Navigate to **Settings > Customers**.

### Creating an Organization
1. Click **Create New Organization**
2. Fill in: Name, Code, Description, Contact Person, Email, Phone
3. Set the address (City, State, ZIP)
4. Set status to Active
5. Save

### Managing Organization Details
Each organization has several management areas:

#### Locations
Organizations can have multiple locations (sub-divisions):
- Create, edit, and delete locations
- Each location can have its own address
- Locations can have their own pricing rules (see Pricing Management)

#### Users
- Add existing users to the organization
- Remove users from the organization
- Set organization-level roles:
  - **Admin** — Full control within the org
  - **Manager** — Can manage orders and users
  - **Member** — Can place orders
  - **Viewer** — Read-only access

#### Addresses
- Add billing and shipping addresses
- Multiple addresses per organization
- Addresses are used during checkout

#### Pricing
- Set organization-level pricing overrides (see Pricing Management)

### Archiving Organizations
- Use soft delete (archive) rather than hard delete
- Archived organizations retain all historical data

---

## Sales Rep Assignment

Navigate to **Settings > Sales Reps**.

### Assigning Sales Reps to Organizations
1. Select a sales rep from the list
2. Choose the organization to assign them to
3. Set the **commission rate** for this specific assignment
4. Save the assignment

### Managing Assignments
- View all assignments in a matrix format
- Update commission rates for existing assignments
- Remove sales rep assignments
- Track which sales reps service which customers

### Important Notes
- The `organization_sales_reps.commission_rate` has no default — it must be explicitly set
- A sales rep can be assigned to multiple organizations with different rates
- Commission rate here is used as a fallback if no distributor-level rules exist

---

## Distributor Management

Navigate to **Settings > Distributors**.

### Creating a Distributor
1. Click **Create New Distributor**
2. Select the user profile to associate
3. Set: Name, Code, Classification (independent or company)
4. Configure commission settings:
   - **Pricing Model**: Margin Split (default) or Wholesale
   - **Commission Type**: percent_margin, percent_gross_sales, percent_net_sales, flat_per_order, flat_per_unit
   - **Default Commission Rate**
5. Set contact information and address
6. Save

### Two Pricing Models

**Margin Split (Default)**
- Commission = Rate% × (Customer Price − Product Cost)
- The distributor earns a percentage of the profit margin

**Wholesale**
- Distributor buys at wholesale price, sells at customer price
- Commission = Customer Price − Wholesale Price
- Requires setting wholesale prices per product

### Managing Distributor Sales Reps
1. Open a distributor's detail view
2. Navigate to the Sales Reps section
3. Add sales reps with commission split configuration:
   - **Percentage of Distributor** — Rep gets X% of the distributor's commission
   - **Fixed with Override** — Rep and distributor each get independent rates
4. Set the sales rep rate and distributor override rate

### Commission Rules
Create product-specific or category-specific commission overrides:
1. Select the distributor
2. Choose rule scope: All customers or a specific organization
3. Choose rule target: Specific product or product category
4. Set commission type and rate
5. Save

### Wholesale Pricing
For distributors using the wholesale model:
- Set per-product wholesale prices
- Import wholesale prices via CSV
- Visual grid for managing pricing

### W-9 / Tax Information
Track distributor tax information:
- Tax ID (EIN or SSN)
- Tax classification
- W-9 status: pending, received, verified
- W-9 consent tracking

### Delegates
Distributors can have delegate users who manage operations on their behalf. Admins can view and manage these delegate assignments.

---

## Pricing Management

Navigate to **Settings > Pricing**.

The pricing system uses a three-tier hierarchy. When a customer views a product, the system resolves the price in this order (first match wins):

### 1. Location Pricing (Highest Priority)
- Organization + Location + Product
- Used when a customer's location has special pricing

### 2. Organization Pricing
- Organization + Product
- Used for company-wide negotiated pricing

### 3. Contract Pricing
- Individual User + Product
- Used for user-specific negotiated pricing

### 4. Retail/List Price (Fallback)
- Default price from the BigCommerce product catalog

### Managing Pricing Rules
For each pricing tier:
1. Search for the product or browse the catalog
2. Select the target (user, organization, or location)
3. Set the custom price
4. Optionally set effective and expiry dates
5. Save

### Bulk Operations
- **Import from CSV** — Upload pricing rules in bulk
- **Export templates** — Download CSV templates for offline editing

---

## Product Management

Navigate to **Settings > Products**.

### Viewing Products
- Search and filter by name, SKU, category, or brand
- Sort by price, cost, inventory, or brand
- View product details: SKU, brand, category, retail price, cost, images

### Product Sync
Products are synced from BigCommerce:
- Use the import function to pull new products from BigCommerce
- Product data (SKU, brand, category, price, cost, images) is overwritten on each sync
- **Do not modify product data directly** — changes will be overwritten

### Creating Products
- Products can also be created manually within the system
- Set all required fields: name, SKU, brand, category, price, cost

### Contract Pricing Count
Each product shows how many pricing rules exist for it, helping you identify products with custom pricing.

---

## Category Management

Navigate to **Settings > Categories**.

- Create new product categories
- Edit category names
- Set parent-child category relationships
- Delete unused categories
- Category slugs are auto-generated from the name

---

## Cost Admin & Profit Reports

### Cost Admin Access
Navigate to **Settings > Cost Admin**.

Cost admin is a special permission granted to select admin users:
- Grant or revoke cost admin access
- Cost admins can view **secret costs** — hidden product costs not visible to sales reps or distributors
- Secret costs are used for internal profit calculations

### Profit Reports
Navigate to **Analytics > Profit Report** (requires cost admin access).

Profit reports show:
- **Revenue** — Customer price × quantity
- **Cost** — Product cost × quantity
- **Gross Profit** — Revenue − Cost
- **Profit Margin %** — Gross Profit / Revenue
- **Commission Waterfall**:
  - Distributor commission amount
  - Sales rep commission amount
  - Company rep commission amount
- **Net Profit** — Gross Profit − All Commissions

Filter by date range and order status. Export data for external analysis.

---

## QuickBooks Integration

Navigate to **Settings > QuickBooks**.

### Initial Setup
1. Click **Connect to QuickBooks**
2. Complete the OAuth 2.0 authorization flow
3. Verify the connection using the Diagnostics panel

### Diagnostics
The diagnostics panel checks:
- Auth token status and expiration
- Frontend environment variable configuration
- Backend server configuration
- Overall connection health

### Features
- **Customer Sync** — Automatically sync organizations as QuickBooks customers
- **Invoice Creation** — Create QuickBooks invoices from completed orders
- **Payment Recording** — Record customer payments in QuickBooks
- **Sync Logs** — View all sync operations with status, timestamps, and error details
- **Entity Mapping** — Map local organizations to QuickBooks customer records

### Troubleshooting
- Check sync logs for failed operations
- View request/response payloads for debugging
- Re-authorize if tokens have expired

---

## Site Settings & Email Templates

### Site Settings
Navigate to **Settings > Site Settings**.

Manage global configuration organized by category:
- **Shipping** — Shipping methods, rates, and restrictions
- **Contact** — Business contact information displayed on the site
- **Security** — Security-related settings

All settings use a key-value interface with real-time saving.

### Email Templates
Navigate to **Settings > Email Templates**.

- Create and edit HTML email templates
- Use the formatting toolbar for rich text editing
- Insert template variables (e.g., `{{order_id}}`, `{{customer_name}}`, `{{order_total}}`)
- Preview templates with example data
- Enable or disable specific templates
- Manage email headers and footers

---

## Analytics & Audit Logs

Navigate to **Analytics**.

### Login Audit Log
Track all user login activity:
- User email, timestamp, IP address, user agent
- Session ID and duration (login to logout)
- Age verification status
- Filter by: verified, unverified, impersonation events, active sessions, ended sessions
- Search by email, IP, or session ID
- Export audit data for compliance reporting

### Coming Soon
- Sales Analytics
- User Analytics

---

## Support Tickets

Navigate to **Support**.

### Managing Tickets
- View all customer support tickets
- Filter by status: open, in_progress, waiting_on_customer, resolved, closed
- Search by subject or ticket number
- View priority levels: low, medium, high, urgent

### Working a Ticket
1. Open a ticket to view the message thread
2. Read the customer's messages
3. Add a **reply** (visible to the customer)
4. Add an **internal note** (visible only to admins)
5. Change the ticket status as you work through it
6. Assign the ticket to a specific admin staff member

---

## Impersonation

Admins can impersonate any user to see the system from their perspective.

### How to Impersonate
1. Find the user you want to impersonate (in User Management or elsewhere)
2. Click the **Impersonate** button
3. The header will show "Viewing as [User Name]" to remind you that you're in impersonation mode
4. Browse the system as that user — you'll see their products, pricing, orders, and permissions

### Important Notes
- Impersonation is logged in the audit trail
- Use `effectiveUserId` / `effectiveProfile` for data display (respects impersonation)
- Use `user` / `profile` for permission checks (always your real admin identity)
- Click **Exit Impersonation** in the header to return to your admin view
- Useful for troubleshooting customer issues, verifying pricing, and testing role-based access

---

## Quick Reference: Admin Workflows

### New Customer Onboarding
1. Create the organization (Settings > Customers)
2. Add locations if needed
3. Set up pricing rules (Settings > Pricing)
4. Assign a sales rep (Settings > Sales Reps)
5. Approve the customer's user registration (Operations > Users)

### New Distributor Setup
1. Create the distributor (Settings > Distributors)
2. Configure commission model and rates
3. Add sales reps under the distributor
4. Set commission rules for products/categories
5. If wholesale model: set wholesale pricing

### Monthly Commission Processing
1. Go to Operations > Commissions
2. Filter by status: Pending
3. Group by month
4. Review commission line items and audit trail
5. Batch approve reviewed commissions
6. When payment is sent, batch mark as Paid

### Troubleshooting Missing Commissions
1. Go to Commissions > Diagnostics
2. Check for orders without commission records
3. Verify the sales rep is assigned to the organization
4. Verify the distributor has commission rules configured
5. Check the commission audit log for errors or skipped items
