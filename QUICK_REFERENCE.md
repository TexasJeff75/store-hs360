# Quick Reference Guide

## Getting "required scope" Error?

**This error means your BigCommerce API token is missing permissions.**

### Quick Fix:

1. **Identify which token has the problem:**
   - Fetching products/categories? → **Storefront Token** issue
   - Creating cart/checkout? → **Access Token** issue

2. **Go to BigCommerce Admin:**
   - Advanced Settings > API Accounts
   - Find your API account or create a new one

3. **Check/Add these scopes:**

   **For Storefront Token (GraphQL):**
   - ✅ Products - Read-only
   - ✅ Categories - Read-only

   **For Access Token (REST API):**
   - ✅ Carts - Modify
   - ✅ Checkouts - Modify
   - ✅ Orders - Modify

4. **Update your `.env` file** with the new token

5. **Restart your dev server:** `npm run dev`

### Need more help?
See [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md) for complete guide.

---

## Environment Variable Cheat Sheet

### Frontend (browser-safe):
```bash
VITE_BC_STORE_HASH=your_store_hash
VITE_BC_STOREFRONT_TOKEN=eyJ...  # JWT token for GraphQL
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE=/.netlify/functions
```

### Backend (secure - never expose):
```bash
BC_STORE_HASH=your_store_hash
BC_STOREFRONT_TOKEN=eyJ...  # Same as VITE version
BC_ACCESS_TOKEN=abcd1234...  # REST API token - KEEP SECRET!
```

**Important:** Keep VITE_* and non-prefixed versions in sync!

---

## Common Issues

### 404 Error on API calls
**Problem:** Express server (port 4000) not running

**Fix:**
```bash
# Make sure you run this command (starts both servers):
npm run dev

# NOT this (only starts Vite):
npm run dev:vite
```

### "Missing credentials" error
**Fix:** Check your `.env` file exists and has all required variables

### CORS errors
**Fix:** Make sure both Vite (3000) and Express (4000) servers are running

---

## Useful Commands

```bash
# Start development (both servers)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Check API server health
curl http://localhost:4000/api/health

# Test GraphQL endpoint
curl http://localhost:4000/api/gql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ site { settings { storeName } } }"}'
```

---

## Documentation Index

- **[BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md)** - Token scope errors and permissions
- **[REST_API_CHECKOUT.md](./REST_API_CHECKOUT.md)** - REST API checkout flow (no redirects)
- **[ENV_SETUP.md](./ENV_SETUP.md)** - Complete environment variable setup
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development workflow and architecture
- **[README.md](./README.md)** - Project overview
- **[.env.example](./.env.example)** - Template for environment variables

---

## Quick Diagnosis

**See scope error?** → [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md)
**See 404 error?** → Check both servers are running (`npm run dev`)
**Missing credentials?** → Check `.env` file
**Need to set up from scratch?** → [ENV_SETUP.md](./ENV_SETUP.md)
**First time setup?** → [DEVELOPMENT.md](./DEVELOPMENT.md)
**Want to understand checkout?** → [REST_API_CHECKOUT.md](./REST_API_CHECKOUT.md)
