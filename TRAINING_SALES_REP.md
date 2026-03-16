# HS360 Sales Rep Training Guide

This guide covers everything a Sales Representative needs to know to manage their assigned customers, view orders, track commissions, and set pricing on the HS360 platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Sales Rep Dashboard Overview](#sales-rep-dashboard-overview)
3. [Managing Your Customers](#managing-your-customers)
4. [Customer User Management](#customer-user-management)
5. [Customer Address Management](#customer-address-management)
6. [Setting Customer Pricing](#setting-customer-pricing)
7. [Viewing Orders](#viewing-orders)
8. [Understanding Your Commissions](#understanding-your-commissions)
9. [How Commissions Are Calculated](#how-commissions-are-calculated)
10. [Quick Reference](#quick-reference)

---

## Getting Started

When you log in with your sales rep credentials, you are taken to the **Sales Rep Dashboard**. This is your home base for managing the customer organizations assigned to you.

Your primary tab is:
- **My Customers** — View and manage all organizations assigned to you

You also have access to:
- **Orders** — View orders from your assigned customers
- **Commissions** — Track your commission earnings and payouts

### Your Distributor Relationship
As a sales rep, you may operate in one of two ways:
- **Under a distributor** — Your commissions are split with your distributor based on pre-configured split rules
- **Independent** — You receive commissions directly based on your organization assignment rates

---

## Sales Rep Dashboard Overview

### Dashboard Statistics
At the top of your dashboard, you will see:
- **Total Customers** — Number of organizations assigned to you
- **Active Customers** — Currently active organizations
- **Total Customer Users** — Sum of all users across your assigned organizations
- **Pending Commissions** — Dollar amount of commissions awaiting approval

These stats give you a quick snapshot of your book of business.

---

## Managing Your Customers

Navigate to the **My Customers** tab.

### Viewing Your Customer List
- Browse all organizations assigned to you
- Search by organization name
- See at-a-glance stats for each customer: user count, address count, pending commission amount

### Creating a New Customer
1. Click **Create New Customer**
2. Fill in the organization details:
   - **Name** — The company name
   - **Code** — A short identifier (auto-generated from name, or manually override)
   - **Contact Person** — Primary point of contact
   - **Email** — Contact email
   - **Phone** — Contact phone number
   - **Address** — City, State, ZIP
   - **Description** — Optional notes
3. Click **Save**
4. The new organization is automatically linked to your distributor (if you have one)

### Editing a Customer
- Click on any customer to open their detail view
- Update organization details as needed
- Changes are saved immediately

### Customer Detail View
When you click into a customer, you see three management sub-tabs:
- **Users** — Manage who has access to this customer's account
- **Addresses** — Manage shipping and billing addresses
- **Pricing** — Set custom product pricing for this customer

---

## Customer User Management

From a customer's detail view, navigate to the **Users** sub-tab.

### Adding Users
1. Click **Add User**
2. Enter the user's email address
3. Set their organization-level role:
   - **Admin** — Full control within the organization (manage users, orders, settings)
   - **Manager** — Can manage orders and view team activity
   - **Member** — Can browse products and place orders
   - **Viewer** — Read-only access to the organization's data
4. Save

### Managing Users
- View all users in the organization with their roles
- Change a user's role as needed
- Remove users who no longer need access

### Important Notes
- Users must be approved by an admin before they can log in
- A user can belong to multiple organizations
- The role you set here only affects what they can do within this specific organization

---

## Customer Address Management

From a customer's detail view, navigate to the **Addresses** sub-tab.

### Adding Addresses
1. Click **Add Address**
2. Enter the address details (street, city, state, ZIP)
3. Specify the address type (shipping, billing, or both)
4. Save

### Managing Addresses
- Edit existing addresses to keep information current
- Delete outdated addresses
- Customers will select from these addresses when placing orders at checkout

### Locations
If a customer has multiple locations (branches, warehouses, offices):
- Each location can have its own address
- Locations can have their own pricing tiers (see Pricing section)
- This is useful for large customers with multiple facilities

---

## Setting Customer Pricing

From a customer's detail view, navigate to the **Pricing** sub-tab.

You can set custom pricing for your customers so they see negotiated prices instead of the default retail/list price.

### Pricing Levels
The system supports three tiers of custom pricing (first match wins):
1. **Location Pricing** — Price specific to an organization's location
2. **Organization Pricing** — Price for the entire organization
3. **Individual Contract Pricing** — Price for a specific user

### Setting a Custom Price
1. Search for the product you want to price
2. Enter the custom price
3. Save

### Important Notes
- Custom pricing takes effect immediately
- The customer will see the custom price instead of the retail price when browsing
- Custom pricing also affects commission calculations — your commission is typically based on the price the customer actually pays
- If you set organization-level pricing, it applies to all users in that organization unless overridden by a more specific rule

---

## Viewing Orders

Navigate to the **Orders** tab.

### What You Can See
- All orders placed by customers in your assigned organizations
- Order details including: items, quantities, prices, and totals
- Order status: pending, processing, completed, cancelled

### Order Details
Click on any order to see:
- Complete list of items ordered with quantities and prices
- Shipping and billing addresses
- Payment status
- Order timeline

### Recurring Orders
If your customers have subscription/recurring orders:
- View active recurring orders
- See when the next order is scheduled
- Track recurring order status

### Important Notes
- You can view orders from your assigned organizations only
- You cannot modify order status — that is handled by admins
- If a customer has an issue with an order, coordinate with your admin

---

## Understanding Your Commissions

Navigate to the **Commissions** tab.

### Commission Lifecycle
Your commissions go through the following stages:
1. **Calculated** — When a customer's order is marked as completed, the system automatically calculates your commission
2. **Pending** — The commission is waiting for admin review and approval
3. **Approved** — An admin has reviewed and approved your commission
4. **Paid** — Payment has been issued to you
5. **Cancelled** — The commission was cancelled (rare; usually due to a returned order)

### Viewing Your Commissions
- See all your commissions with status filters (pending, approved, paid)
- View commission amounts broken down by:
  - **Your Commission** — The amount you earn
  - **Distributor Commission** — Your distributor's portion (if applicable)
  - **Total Commission** — The full commission on the order
- Click into any commission for the per-product line item breakdown

### Commission Line Items
Each order's commission includes per-product detail:
- **Product** — Which product the commission applies to
- **Rule Source** — Which commission rule was used (helps you understand why a rate was applied)
- **Commission Type** — How the commission was calculated
- **Commission Rate** — The percentage or flat amount applied
- **Effective Price** — The customer price used in the calculation
- **Your Commission Amount** — What you earn on this line item

### Important Notes
- You cannot approve or modify commissions — only admins can do this
- If you believe a commission is incorrect, contact your admin and reference the order number
- Commissions from older orders (before October 2025) may show some fields as blank — this is normal for historical data

---

## How Commissions Are Calculated

Understanding how your commissions are calculated helps you forecast your earnings and identify opportunities.

### If You Work Under a Distributor

Your total commission depends on two factors:
1. **The distributor's commission on the order** — calculated based on the distributor's commission rules
2. **Your split with the distributor** — configured when the distributor added you

#### Split Type: Percentage of Distributor
You receive a percentage of the distributor's total commission.

**Example:**
- Order margin (customer price − cost): $100
- Distributor commission rate: 45% → Distributor earns $45
- Your split: 50% of distributor → You earn $22.50

#### Split Type: Fixed with Override
You and the distributor each receive independent percentages of the margin.

**Example:**
- Order margin: $100
- Your rate: 40% → You earn $40
- Distributor override: 5% → Distributor earns $5

### If You Work Independently (No Distributor)

Your commission is based on the rate set in your organization assignment:
- **Commission** = Assignment Rate × Margin (or other commission type)

**Example:**
- Order margin: $100
- Your assignment rate: 30% → You earn $30

### Commission Types
Your commission may be calculated using one of these methods:

| Type | How It's Calculated |
|------|-------------------|
| **Percent of Margin** | Rate × (Customer Price − Product Cost) |
| **Percent of Gross Sales** | Rate × Customer Price |
| **Percent of Net Sales** | Rate × (Customer Price − Discounts) |
| **Flat per Order** | Fixed dollar amount for the entire order |
| **Flat per Unit** | Fixed dollar amount for each unit sold |

### Which Rule Applies?
When multiple commission rules could apply, the system uses the most specific one:
1. **Customer + Product** — A rule for this specific customer and this specific product (most specific)
2. **Customer + Category** — A rule for this customer and the product's category
3. **Product Only** — A rule for this product across all customers
4. **Category Only** — A rule for the product's category across all customers
5. **Distributor Default** — The distributor's default commission rate
6. **Your Org Assignment Rate** — The rate set when you were assigned to this customer

The line items in your commission view show which rule was applied, so you can always understand why a specific rate was used.

### Maximizing Your Commissions
- Higher-margin products generally mean higher commissions (with margin-based calculations)
- Custom pricing you set for customers affects the effective price used in commission calculations
- Review your commission line items regularly to understand which products and customers generate the most earnings
- If a rule seems incorrect, ask your admin or distributor to review the commission configuration

---

## Quick Reference

### Daily Workflow
1. Log in and check your **Dashboard** stats
2. Review the **Orders** tab for new customer orders
3. Check the **Commissions** tab for recently calculated commissions
4. Respond to any customer needs (pricing, users, addresses)

### Onboarding a New Customer
1. My Customers > Create New Customer
2. Fill in company name, code, contact info, and address
3. Add user accounts for the customer's team (Users sub-tab)
4. Add shipping and billing addresses (Addresses sub-tab)
5. Set up custom pricing if negotiated (Pricing sub-tab)
6. Confirm the customer can log in and browse products

### Adding a User to a Customer
1. Go to My Customers > select the customer
2. Navigate to the Users sub-tab
3. Click Add User and enter their email
4. Set their role (admin, manager, member, or viewer)
5. The user will need admin approval before they can log in

### Setting Custom Pricing
1. Go to My Customers > select the customer
2. Navigate to the Pricing sub-tab
3. Search for the product
4. Enter the negotiated price
5. Save — the customer will see the new price immediately

### Checking Your Commission on an Order
1. Go to the Commissions tab
2. Find the order in question
3. Click to view line items
4. Review: rule source, commission type, rate, and your amount
5. If something looks wrong, note the order number and contact your admin

### Key Contacts
- **Commission questions or disputes** → Contact your distributor or HS360 admin
- **Technical issues with the platform** → Submit a support ticket
- **Customer onboarding help** → Contact your distributor or HS360 admin
- **Pricing questions** → Contact your distributor or HS360 admin
