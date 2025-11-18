# Fixing 404 Errors in Development

## The Problem

You see this error in the browser console:
```
Server returned non-JSON response (404): <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page not found</title>
```

This specifically happens when trying to access:
- Secret Cost Management page
- Bulk Import features
- Any page that needs BigCommerce REST API product costs

## Root Cause

The application is trying to call `/.netlify/functions/bigcommerce-cart`, but **Netlify Functions are only available when running with Netlify Dev**.

If you're running the app with:
- ❌ `npm run dev:vite` - Functions NOT available
- ❌ Direct access to `http://localhost:5173` - Functions NOT available
- ✅ `npm run dev` - Functions ARE available at `http://localhost:8888`

## The Solution

### Step 1: Stop the Current Dev Server
Press `Ctrl+C` in the terminal where the dev server is running.

### Step 2: Start Netlify Dev
```bash
npm run dev
```

This will:
1. Start Vite dev server (port 5173)
2. Start Express GraphQL server (port 4000)
3. Start Netlify Dev proxy (port 8888)
4. Load all Netlify Functions from `netlify/functions/`

### Step 3: Access the Correct URL
**Always use:** http://localhost:8888

**Never use:** http://localhost:5173 (this bypasses Netlify Dev)

### Step 4: Verify Functions Are Working
Open your browser console and check for this log:
```
[BC REST API] Calling serverless function: /.netlify/functions/bigcommerce-cart
[BC REST API] Response status: 200
```

If you see `404`, you're likely still accessing the wrong port.

## Environment Variables

Netlify Functions need environment variables **without** the `VITE_` prefix:

### Required in .env file:
```bash
# Frontend variables (with VITE_ prefix)
VITE_BC_STORE_HASH=your_store_hash
VITE_BC_STOREFRONT_TOKEN=your_token
VITE_API_BASE=/.netlify/functions

# Backend variables (without VITE_ prefix) - for Netlify Functions
BC_STORE_HASH=your_store_hash
BC_STOREFRONT_TOKEN=your_token
BC_ACCESS_TOKEN=your_access_token
```

**Important:** You need BOTH versions of the variables!

## Quick Verification Checklist

- [ ] Running `npm run dev` (not `dev:vite`)
- [ ] Accessing `http://localhost:8888` (not `5173`)
- [ ] Terminal shows Netlify Dev is running
- [ ] `.env` file has both `VITE_*` and non-`VITE_*` variables
- [ ] Browser console shows 200 responses from `/.netlify/functions/`

## Testing the Function Directly

```bash
# Test from command line
curl http://localhost:8888/.netlify/functions/bigcommerce-cart \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"getProductCosts","data":{"productIds":[123,124,125]}}'
```

Expected response:
```json
{
  "123": {
    "id": 123,
    "name": "Product Name",
    "cost_price": 50.00,
    "price": 100.00
  }
}
```

## Still Getting 404?

### Check 1: Netlify CLI Installed
```bash
npx netlify --version
```

Should show version 23.6.0 or higher. If not:
```bash
npm install
```

### Check 2: netlify.toml Configuration
Verify this file exists and contains:
```toml
[build]
  functions = "netlify/functions"

[dev]
  command = "npm run dev:functions"
  targetPort = 5173
  port = 8888
```

### Check 3: Functions Directory
Verify this file exists:
```bash
ls -la netlify/functions/bigcommerce-cart.js
```

### Check 4: Port Conflicts
```bash
# Kill any process on port 8888
lsof -i :8888
kill -9 <PID>

# Restart
npm run dev
```

## Production Note

In production (deployed to Netlify), this all happens automatically:
- No need to run Netlify Dev
- Functions are served at `https://your-site.netlify.app/.netlify/functions/*`
- Environment variables are configured in Netlify dashboard
- Everything "just works"

This 404 issue is **development-only** and won't occur in production.
