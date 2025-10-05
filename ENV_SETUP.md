# Environment Variables Setup Guide

This document explains how environment variables are configured in this project and ensures consistency across all environments.

## Overview

This project uses environment variables in two different contexts:

1. **Frontend (Vite)**: Variables prefixed with `VITE_` are bundled into the frontend build
2. **Backend (Netlify Functions & Node)**: Variables without the `VITE_` prefix are used in serverless functions

## Required Environment Variables

### BigCommerce Configuration

You need **both versions** of these variables (with and without `VITE_` prefix):

```bash
# Frontend (exposed to browser)
VITE_BC_STORE_HASH=your_store_hash
VITE_BC_STOREFRONT_TOKEN=your_storefront_jwt_token

# Backend (serverless functions only)
BC_STORE_HASH=your_store_hash
BC_STOREFRONT_TOKEN=your_storefront_jwt_token
BC_ACCESS_TOKEN=your_api_access_token
```

### Supabase Configuration

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### API Configuration

```bash
# For local dev: /api
# For production: /.netlify/functions
VITE_API_BASE=/.netlify/functions
```

## How to Get BigCommerce Credentials

> **⚠️ IMPORTANT:** If you get "required scope" errors, see [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md) for detailed troubleshooting.

### 1. Store Hash

1. Log into your BigCommerce store admin
2. Look at the URL: `https://store-{STORE_HASH}.mybigcommerce.com`
3. Copy the store hash from the URL

### 2. Storefront Token (GraphQL API)

This token is used for fetching products and categories (read-only operations).

1. Go to **Advanced Settings > API Accounts**
2. Click **"Create API Account"** > **"Storefront API Token"** (not V2/V3)
3. Name it (e.g., "Storefront API")
4. Select **Storefront API** scopes:
   - ✅ **Products** - Read-only
   - ✅ **Categories** - Read-only
5. Save and copy the generated JWT token (starts with `eyJ`)
6. This token is safe to expose in the browser

### 3. Access Token (REST API for Carts & Checkout)

This token is used for cart operations, checkout, and orders. **Never expose this in the browser!**

1. Same page as above (**API Accounts**)
2. Click **"Create API Account"** > **"V2/V3 API Token"**
3. Name it (e.g., "REST API - Carts & Orders")
4. Enable these **OAuth scopes** (critical - must have all):
   - ✅ **Carts** - Modify
   - ✅ **Checkouts** - Modify
   - ✅ **Orders** - Modify
   - ✅ **Customers** - Modify (if using customer features)
   - ✅ **Products** - Read-only (recommended)
5. Save and copy the **Access Token** immediately (you can't view it again!)
6. **Security:** This token has full access - use only in backend functions

**📖 For detailed scope requirements and troubleshooting, see [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md)**

## Local Development Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in all the values in `.env`

3. **Important**: Keep both `VITE_*` and non-prefixed versions in sync!

4. Restart your dev server after changing `.env`

## Netlify Deployment Setup

When deploying to Netlify, you need to configure environment variables in the Netlify UI:

### Via Netlify UI

1. Go to **Site Settings > Environment Variables**
2. Add these variables **without** the `VITE_` prefix:
   - `BC_STORE_HASH`
   - `BC_STOREFRONT_TOKEN`
   - `BC_ACCESS_TOKEN`

3. Add these variables **with** the `VITE_` prefix:
   - `VITE_BC_STORE_HASH`
   - `VITE_BC_STOREFRONT_TOKEN`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE` (set to `/.netlify/functions`)

### Via Netlify CLI

```bash
# BigCommerce (both versions)
netlify env:set VITE_BC_STORE_HASH "your_store_hash"
netlify env:set BC_STORE_HASH "your_store_hash"

netlify env:set VITE_BC_STOREFRONT_TOKEN "your_token"
netlify env:set BC_STOREFRONT_TOKEN "your_token"

netlify env:set BC_ACCESS_TOKEN "your_access_token"

# Supabase
netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your_anon_key"

# API Base
netlify env:set VITE_API_BASE "/.netlify/functions"
```

## Centralized Configuration

All frontend code should import environment variables from `src/config/env.ts`:

```typescript
import { ENV } from '../config/env';

// Use like this:
const storeHash = ENV.BC_STORE_HASH;
const apiBase = ENV.API_BASE;
```

This ensures:
- Type safety
- Centralized validation
- Consistent error handling
- Easy refactoring

## Troubleshooting

### 404 Error: "Server returned non-JSON response"

This usually means the local Express server (port 4000) isn't running or the proxy isn't working.

**Solution:**
1. Make sure you're running `npm run dev` (not just `npm run dev:vite`)
2. Check that you see TWO processes starting:
   - Vite dev server on port 3000
   - Local API server on port 4000
3. Test the API server directly: `curl http://localhost:4000/api/health`
4. If the API server isn't starting, check for port conflicts:
   ```bash
   lsof -i :4000
   ```
5. Kill any conflicting processes and restart

### "Missing credentials" error in development

1. Check that `.env` file exists in project root
2. Verify all required variables are set (see `.env.example`)
3. Restart your dev server: `npm run dev`
4. Check the API server startup logs - it will show if credentials are missing

### Functions not working in Netlify

1. Verify environment variables are set in Netlify UI
2. Make sure you set **both** `VITE_*` and non-prefixed versions
3. Redeploy after setting environment variables

### GraphQL errors

1. Check that `VITE_BC_STOREFRONT_TOKEN` is a valid JWT (starts with `eyJ`)
2. Verify the token has Storefront API scopes enabled
3. Check that `VITE_BC_STORE_HASH` matches your store
4. Test the GraphQL endpoint: `curl http://localhost:4000/api/gql -X POST -H "Content-Type: application/json" -d '{"query": "{ site { settings { storeName } } }"}'`

### Cart/Checkout errors

1. Verify `BC_ACCESS_TOKEN` is set (this is different from storefront token)
2. Check that the token has Carts and Checkouts modify permissions
3. Test the token directly using BigCommerce API documentation

### Dev Server Issues

**Both servers must run simultaneously:**
- **Vite** (port 3000): Serves the frontend and proxies API requests
- **Express** (port 4000): Handles backend API requests

If only one is running, API calls will fail. The `npm run dev` command uses `concurrently` to start both.

## Security Notes

- **Never commit `.env` to version control** (it's in `.gitignore`)
- The `VITE_*` variables are **exposed in the browser** - don't put secrets here
- Use `BC_ACCESS_TOKEN` (without VITE_) only in backend functions
- Rotate tokens regularly from BigCommerce admin
- Use different tokens for development and production environments
