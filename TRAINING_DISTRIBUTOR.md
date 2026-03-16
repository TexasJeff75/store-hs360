# HS360 Distributor Training Guide

This guide covers everything a Distributor needs to know to manage their sales team, customers, pricing, and commissions on the HS360 platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Distributor Portal Overview](#distributor-portal-overview)
3. [Managing Your Customers](#managing-your-customers)
4. [Managing Your Sales Reps](#managing-your-sales-reps)
5. [Managing Delegates](#managing-delegates)
6. [Orders & Commissions](#orders--commissions)
7. [Understanding Commission Models](#understanding-commission-models)
8. [Pricing for Your Customers](#pricing-for-your-customers)
9. [Quick Reference](#quick-reference)

---

## Getting Started

When you log in with your distributor credentials, you are taken to the **Distributor Portal**. This is your central hub for managing your sales team, customer organizations, and commissions.

Your portal has three main tabs:
- **My Customers** — Manage customer organizations you service
- **My Sales Reps** — Manage your sales team and their commission splits
- **Delegates** — Manage users who help you administer your distributorship

You also have access to:
- **Orders** — View orders placed by your customers
- **Commissions** — View your commission summaries and payouts

### Distributor Classification
Your account is set to one of two classifications:
- **Independent** — You operate as a solo sales rep and distributor combined
- **Company** — You manage a team of sales reps under your distributorship

---

## Distributor Portal Overview

### Dashboard Stats
At the top of your portal, you will see key statistics:
- **Total Customers** — Number of organizations you service
- **Active Customers** — Currently active customer organizations
- **Total Addresses** — Sum of all addresses across your customers
- **Active Sales Reps** — Sales reps currently working under you
- **Average Rep Rate** — Average commission rate across your sales team

---

## Managing Your Customers

Navigate to the **My Customers** tab.

### Creating a New Customer
1. Click **Create New Customer**
2. Fill in the organization details:
   - **Name** — The company name
   - **Code** — A short identifier (auto-generated from name, or enter manually)
   - **Contact Person** — Primary point of contact
   - **Email** — Contact email
   - **Phone** — Contact phone
   - **Address** — City, State, ZIP
   - **Description** — Optional notes about the customer
3. Click **Save**
4. The new organization is automatically linked to your distributorship

### Viewing Your Customers
- Browse your customer list with search and filtering
- See each customer's status (active/inactive)
- View quick stats: user count, address count

### Managing a Customer
Click on any customer to access three management sub-tabs:

#### Users Sub-Tab
Manage who has access to this customer's account:
- **Add a user** — Enter their email to add them to the organization
- **Set their role**:
  - **Admin** — Full control within the organization
  - **Manager** — Can manage orders and other users
  - **Member** — Can browse products and place orders
  - **Viewer** — Read-only access to the organization
- **Remove users** — Remove a user's access to the organization

#### Addresses Sub-Tab
Manage the customer's shipping and billing addresses:
- **Add addresses** — Enter new shipping or billing locations
- **Edit addresses** — Update existing address details
- **Delete addresses** — Remove outdated addresses
- Customers will select from these addresses during checkout

#### Contract Pricing Sub-Tab
Set custom pricing for this customer (see [Pricing for Your Customers](#pricing-for-your-customers) for details).

### Sending Invitations
- Use the **Send Invite** button to email an invitation to the customer's contact person
- The invitation allows them to create their account and access the platform

### Deactivating a Customer
- Toggle the customer's status to inactive
- Inactive customers retain their data but cannot place new orders

---

## Managing Your Sales Reps

Navigate to the **My Sales Reps** tab.

### Adding a New Sales Rep
1. Click **Add Sales Rep**
2. Enter the sales rep's details:
   - **Full Name**
   - **Email Address**
   - **Phone Number**
3. Configure their commission split (see below)
4. Click **Save**
5. An invitation email is automatically sent to the new sales rep

### Commission Split Configuration
When adding or editing a sales rep, you must configure how commissions are split between you (the distributor) and the sales rep. There are two split types:

#### Percentage of Distributor
The sales rep receives a percentage of your total commission on each order.

**Example:** If your distributor commission rate is 45% of margin, and you set the sales rep to 50% of distributor:
- Total margin on an order: $100
- Your commission: $100 × 45% = $45
- Sales rep gets: $45 × 50% = $22.50
- You keep: $45 − $22.50 = $22.50

#### Fixed with Override
Both you and the sales rep receive independent percentages of the margin.

**Example:** If you set the sales rep rate to 40% and the distributor override rate to 5%:
- Total margin on an order: $100
- Sales rep gets: $100 × 40% = $40
- You get: $100 × 5% = $5

### Important Notes on Commission Rates
- Commission rates are **never auto-filled** — you must explicitly set every rate
- The `sales_rep_rate` field must be set for each sales rep
- If using "Fixed with Override," the distributor override rate must also be set
- Rates are expressed as percentages (e.g., 40 means 40%)

### Managing Existing Sales Reps
- View all your sales reps with their commission split configuration
- Edit commission rates at any time
- Deactivate or remove sales reps who are no longer with your team
- Monitor the average commission rate across your team

### Sales Rep Statistics
Your dashboard shows:
- Total number of sales reps
- Active vs. inactive count
- Average commission rate across your team

---

## Managing Delegates

Navigate to the **Delegates** tab.

Delegates are trusted users who can help manage your distributorship on your behalf.

### Adding a Delegate
1. Click **Add Delegate**
2. Enter:
   - **Full Name**
   - **Email Address**
   - **Notes** — Describe their role (e.g., "Office manager, handles daily operations")
3. Click **Save**
4. An invitation email is sent to the delegate

### What Delegates Can Do
Delegates have the ability to:
- Manage customer organizations
- Manage sales representatives
- View orders and commissions
- Set pricing for customers

### Managing Delegates
- View all active delegates
- Remove delegates who no longer need access
- Update notes describing their responsibilities

---

## Orders & Commissions

### Viewing Orders
Navigate to the **Orders** tab to see all orders placed by your customers:
- Filter and search orders
- View order details including items, quantities, and totals
- Track order status through the lifecycle

### Viewing Commissions
Navigate to the **Commissions** tab to see your commission summaries:
- **Pending** — Calculated but awaiting admin approval
- **Approved** — Reviewed and approved by admin, awaiting payment
- **Paid** — Payment has been issued
- **Cancelled** — Commission was cancelled

### Understanding Your Commission Statement
Each commission record shows:
- **Order** — The order that generated the commission
- **Organization** — The customer organization
- **Total Commission** — The full commission amount for the order
- **Distributor Commission** — Your portion of the commission
- **Sales Rep Commission** — The sales rep's portion
- **Company Rep Commission** — If applicable, the company rep's portion
- **Status** — Current commission status

### Commission Line Items
Click into a commission to see the per-product breakdown:
- Each product in the order has its own commission calculation
- See which commission rule was applied
- See the commission type and rate used
- See the effective price and margin used in the calculation

### Important Notes
- You cannot approve or pay commissions — only admins can do this
- Commissions are calculated automatically when an order is completed
- If a commission seems incorrect, contact your admin to review the audit trail
- Older commission records (before October 2025) may have NULL values in split columns — this is normal

---

## Understanding Commission Models

Your admin has configured your distributorship with one of two pricing models:

### Margin Split Model (Default)
How it works:
- **Margin** = Customer Price − Product Cost
- **Your Commission** = Commission Rate × Margin
- You earn a percentage of the profit margin on each sale

**Example:**
- Customer pays $100, product cost is $60
- Margin = $100 − $60 = $40
- If your commission rate is 45%: Commission = $40 × 45% = $18

### Wholesale Model
How it works:
- Your admin sets a **wholesale price** for each product
- **Your Commission** = Customer Price − Wholesale Price
- You keep the spread between what the customer pays and your wholesale cost

**Example:**
- Customer pays $100, your wholesale price is $75
- Commission = $100 − $75 = $25

### Five Commission Types
Depending on how your admin has configured your rules, your commission may be calculated as:

| Type | Description |
|------|-------------|
| **Percent of Margin** | Rate × (Customer Price − Product Cost) |
| **Percent of Gross Sales** | Rate × Customer Price |
| **Percent of Net Sales** | Rate × (Customer Price − Discounts) |
| **Flat per Order** | Fixed dollar amount per order |
| **Flat per Unit** | Fixed dollar amount per unit sold |

### Commission Rule Priority
If multiple rules could apply, the system uses the most specific rule:
1. **Customer + Product** — A rule set for a specific customer and specific product
2. **Customer + Category** — A rule for a specific customer and product category
3. **Product Only** — A rule for a specific product across all customers
4. **Category Only** — A rule for a product category across all customers
5. **Your Default Rate** — Your distributor-level default commission rate
6. **Org-Rep Rate** — The rate set on the sales rep's organization assignment

---

## Pricing for Your Customers

You can set custom pricing for your customers at multiple levels.

### Pricing Hierarchy
When a customer views a product, the system resolves the price in this order (first match wins):
1. **Location Pricing** — Specific to an organization's location
2. **Organization Pricing** — Specific to the organization
3. **Individual Contract Pricing** — Specific to an individual user
4. **Retail/List Price** — Default catalog price

### Setting Customer Pricing
1. Go to **My Customers**
2. Click on the customer
3. Navigate to the **Contract Pricing** sub-tab
4. Search for products to set custom prices
5. Enter the custom price for the customer
6. Save

### Important Notes
- Custom pricing affects what the customer sees and pays
- It also affects commission calculations (commission is typically based on the customer's effective price)
- Pricing changes take effect immediately
- You can set pricing at the organization level or per individual user

---

## Quick Reference

### Daily Workflow
1. Check the **Orders** tab for new customer orders
2. Review the **Commissions** tab for recent commission calculations
3. Address any customer inquiries through the portal

### Adding a New Customer
1. My Customers > Create New Customer
2. Fill in company details and save
3. Add user accounts for the customer's team
4. Add shipping/billing addresses
5. Set up custom pricing if needed
6. Send invitation to the customer contact

### Onboarding a New Sales Rep
1. My Sales Reps > Add Sales Rep
2. Enter their name, email, and phone
3. Choose a commission split type (Percentage of Distributor or Fixed with Override)
4. Set the commission rate(s)
5. Save — they will receive an invitation email

### Checking Commission Status
1. Navigate to Commissions
2. Filter by status to see pending, approved, or paid commissions
3. Click into any commission to view the per-product line item breakdown
4. Contact admin if you believe a commission is incorrect

### Key Contacts
- For commission questions or disputes → Contact your HS360 Admin
- For technical issues → Use the Support Ticket system
- For pricing or product questions → Contact your HS360 Admin
