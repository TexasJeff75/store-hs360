# BigCommerce API Token Scopes Guide

## The "required scope" Error

If you see this error:
```
You don't have a required scope to access the endpoint
```

This means your API token doesn't have the necessary permissions for the operation you're trying to perform.

## Understanding BigCommerce Tokens

BigCommerce uses **two different types of tokens** for different purposes:

### 1. Storefront API Token (JWT)
- **Used for:** GraphQL queries to fetch products, categories, etc.
- **Environment variables:** `VITE_BC_STOREFRONT_TOKEN` / `BC_STOREFRONT_TOKEN`
- **Format:** Starts with `eyJ` (JWT token)
- **Exposed to:** Browser (safe to expose)

### 2. REST API Access Token
- **Used for:** Cart operations, checkout, orders (REST API v2/v3)
- **Environment variable:** `BC_ACCESS_TOKEN`
- **Format:** Alphanumeric string
- **Exposed to:** Backend only (never expose in browser)

## Required Scopes by Operation

### GraphQL Operations (Storefront Token)
These operations use the **Storefront API Token**:

| Operation | Required Scope |
|-----------|----------------|
| Fetch products | `Store Catalog - Read-only` |
| Fetch categories | `Store Catalog - Read-only` |
| Fetch product reviews | `Store Catalog - Read-only` |
| Search products | `Store Catalog - Read-only` |

### REST API Operations (Access Token)
These operations use the **REST API Access Token**:

| Operation | Required Scope |
|-----------|----------------|
| Create cart | `Carts - Modify` |
| Get cart | `Carts - Read-only` |
| Update cart | `Carts - Modify` |
| Delete cart | `Carts - Modify` |
| Create checkout | `Checkouts - Modify` |
| Get checkout | `Checkouts - Read-only` |
| Create order | `Orders - Modify` |
| Get order | `Orders - Read-only` |
| Manage customers | `Customers - Modify` |

## How to Create Tokens with Correct Scopes

### Creating a Storefront API Token

1. Log into your BigCommerce store admin
2. Go to **Advanced Settings > API Accounts**
3. Click **Create API Account**
4. Select **Storefront API Token** (not V2/V3 API Token)
5. Choose these scopes:
   - ✅ **Products** - Read-only
   - ✅ **Categories** - Read-only
   - ✅ **Product Reviews** - Read-only (if needed)
6. Click **Save**
7. Copy the JWT token (starts with `eyJ`)
8. Add to `.env`:
   ```
   VITE_BC_STOREFRONT_TOKEN=eyJ...
   BC_STOREFRONT_TOKEN=eyJ...
   ```

### Creating a REST API Access Token

1. Log into your BigCommerce store admin
2. Go to **Advanced Settings > API Accounts**
3. Click **Create API Account**
4. Select **V2/V3 API Token**
5. Name it (e.g., "Headless Storefront")
6. Choose these **OAuth Scopes**:

   **Required for Cart Operations:**
   - ✅ **Carts** - Modify

   **Required for Checkout:**
   - ✅ **Checkouts** - Modify

   **Required for Orders:**
   - ✅ **Orders** - Modify
   - ✅ **Orders** - Read-only

   **Required for Customer Management:**
   - ✅ **Customers** - Modify
   - ✅ **Customers** - Read-only

   **Recommended (for full functionality):**
   - ✅ **Products** - Read-only
   - ✅ **Store Information** - Read-only

7. Click **Save**
8. **IMPORTANT:** Copy the **Access Token** immediately (you can't view it again!)
9. Add to `.env`:
   ```
   BC_ACCESS_TOKEN=your_access_token_here
   ```

## Diagnosing Scope Issues

### Which token is causing the error?

**Check the operation:**
- If fetching products/categories → **Storefront Token** issue
- If creating cart/checkout → **Access Token** issue

### Testing Your Tokens

#### Test Storefront Token (GraphQL)
```bash
curl https://store-YOUR_STORE_HASH.mybigcommerce.com/graphql \
  -X POST \
  -H "Authorization: Bearer YOUR_STOREFRONT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ site { settings { storeName } } }"}'
```

**Success:** Returns store name
**Failure:** Returns scope error

#### Test Access Token (REST API)
```bash
curl https://api.bigcommerce.com/stores/YOUR_STORE_HASH/v3/catalog/products?limit=1 \
  -H "X-Auth-Token: YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Success:** Returns product data
**Failure:** Returns 401 or scope error

## Common Scope Errors and Solutions

### Error: "You don't have a required scope to access the endpoint"

**When fetching products:**
- ❌ Problem: Storefront token missing or doesn't have catalog scopes
- ✅ Solution: Create new Storefront API token with Products/Categories scopes

**When creating cart:**
- ❌ Problem: Access token missing or doesn't have Carts-Modify scope
- ✅ Solution: Create new V2/V3 API token with Carts-Modify scope

**When creating checkout:**
- ❌ Problem: Access token doesn't have Checkouts-Modify scope
- ✅ Solution: Add Checkouts-Modify to your API token

**When creating order:**
- ❌ Problem: Access token doesn't have Orders-Modify scope
- ✅ Solution: Add Orders-Modify to your API token

### Error: "Invalid token" or "Unauthorized"

- Token expired or was regenerated
- Token copied incorrectly (extra spaces, truncated)
- Wrong token type for the operation
- Token deleted in BigCommerce admin

**Solution:** Generate a new token with correct scopes

## Security Best Practices

### ⚠️ NEVER expose Access Token in frontend
```javascript
// ❌ WRONG - Don't do this!
const response = await fetch(url, {
  headers: {
    'X-Auth-Token': process.env.VITE_BC_ACCESS_TOKEN  // ❌ EXPOSED!
  }
});

// ✅ CORRECT - Proxy through backend
const response = await fetch('/.netlify/functions/cart', {
  method: 'POST',
  body: JSON.stringify({ action: 'createCart', data })
});
```

### Access Token = Full Store Access
The REST API Access Token has powerful permissions:
- Can modify orders
- Can access customer data
- Can change products
- Can delete data

**Always:**
- Store in environment variables (never in code)
- Use only in backend functions (never in frontend)
- Use minimal required scopes
- Rotate tokens regularly
- Use different tokens for dev/staging/production

### Storefront Token = Safe to Expose
The Storefront API Token (JWT) is designed to be used in the browser:
- Read-only access
- Limited to public catalog data
- Cannot modify anything
- Safe to include in frontend builds

## Scope Reference Table

| Scope Name | Access Level | Used For |
|------------|--------------|----------|
| **Storefront API** | | |
| Products | Read-only | Fetch product catalog |
| Categories | Read-only | Fetch category tree |
| **REST API (V2/V3)** | | |
| Carts | Read-only | View cart contents |
| Carts | Modify | Create/update/delete carts |
| Checkouts | Read-only | View checkout status |
| Checkouts | Modify | Create/update checkouts |
| Orders | Read-only | View orders |
| Orders | Modify | Create/update orders |
| Customers | Read-only | View customer data |
| Customers | Modify | Create/update customers |
| Products | Read-only | View product details |
| Products | Modify | Create/update products |
| Store Information | Read-only | Get store settings |

## Troubleshooting Checklist

When you see a scope error:

1. ✅ Identify which operation is failing
2. ✅ Check which token that operation uses (Storefront vs Access)
3. ✅ Verify the token is configured in `.env`
4. ✅ Check token hasn't expired
5. ✅ Log into BigCommerce and check token scopes
6. ✅ If scopes are wrong, create a new token with correct scopes
7. ✅ Update `.env` with new token
8. ✅ Restart dev server (`npm run dev`)
9. ✅ Clear browser cache and try again

## Need Help?

If you're still getting scope errors after following this guide:

1. Check the browser console or server logs for the exact endpoint being called
2. Look up the endpoint in [BigCommerce API docs](https://developer.bigcommerce.com/api-reference)
3. Verify your token has the required scope listed in the docs
4. Test the token directly using curl (see examples above)
