# Production Deployment Checklist

## The 404 Error: Root Cause

When you see a 404 error with HTML content (instead of JSON), it means the Netlify Function is not being reached. The SPA fallback is returning the `index.html` page.

## Required Steps to Fix

### 1. Check Netlify Environment Variables

**Required variables (set in Netlify UI → Site Settings → Environment Variables):**

✅ **Backend/Function Variables (NO `VITE_` prefix):**
- `BC_STORE_HASH` - Your BigCommerce store hash
- `BC_ACCESS_TOKEN` - Your BigCommerce API access token
- `BC_STOREFRONT_TOKEN` - Your BigCommerce storefront token

✅ **Frontend Variables (WITH `VITE_` prefix):**
- `VITE_BC_STORE_HASH` - Same as BC_STORE_HASH
- `VITE_BC_STOREFRONT_TOKEN` - Same as BC_STOREFRONT_TOKEN
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

❌ **DO NOT SET:**
- `VITE_API_BASE` - Leave this unset to allow auto-detection

### 2. Verify Function Deployment

After deploying, check your Netlify deploy log:

1. Go to **Netlify Dashboard → Your Site → Deploys → [Latest Deploy]**
2. Scroll down to find the **"Function bundling"** section
3. You should see:
   ```
   ◈ Functions bundling
     - bigcommerce-cart.cjs
     - gql.cjs
   ```

If you **don't see this**, the functions aren't deploying. Common causes:
- Syntax error in function file
- Missing dependencies
- Wrong functions directory path in `netlify.toml`

### 3. Test Function Directly

After deployment, test the function with curl:

```bash
curl -X POST https://YOUR-SITE.netlify.app/.netlify/functions/bigcommerce-cart \
  -H "Content-Type: application/json" \
  -d '{"action":"getProductCosts","data":{"productIds":[]}}'
```

**Expected Result:**
- ✅ JSON response: `{"message": "success"}` or an error in JSON
- ❌ HTML response: Function isn't deployed or SPA redirect is catching it

### 4. Check netlify.toml Configuration

Your `netlify.toml` should have:

```toml
[build]
  functions = "netlify/functions"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false  # CRITICAL: Must be false
```

The `force = false` is **critical**. If it's `true` or missing, the SPA redirect will override function routes.

### 5. Redeploy After Configuration Changes

After making ANY of these changes:
- Setting/changing environment variables
- Updating `netlify.toml`
- Modifying function files

**You MUST trigger a new deployment** for changes to take effect:

1. Go to **Netlify Dashboard → Deploys**
2. Click **"Trigger deploy" → "Clear cache and deploy site"**

Environment variables are **only** applied during build time, not runtime.

### 6. Review Function Logs

If the function is deploying but still not working:

1. Go to **Netlify Dashboard → Functions → bigcommerce-cart**
2. Click to view function details
3. Check the **"Function log"** tab in real-time
4. Trigger the checkout in your app
5. Watch for errors in the function log

Common errors:
- **"Missing environment variables"** → Not set in Netlify UI
- **"Unauthorized" or "Invalid token"** → Wrong BC_ACCESS_TOKEN or expired
- **"Insufficient scopes"** → Token doesn't have Carts/Checkouts permissions

### 7. Verify bigcommerce-cart.cjs File Exists

Ensure the file is in your repository:
```
netlify/
  functions/
    bigcommerce-cart.cjs  ← Must exist
    gql.cjs               ← Must exist
```

If these files are missing from your repository, they won't deploy.

### 8. Check .gitignore

Make sure `netlify/functions/` is **NOT** in your `.gitignore` file. The functions must be committed to git to deploy.

```bash
# In your project directory:
cat .gitignore | grep "netlify/functions"
```

If it returns anything, remove that line from `.gitignore`.

## Common Issues

### Issue: "Module not found" or "Cannot find module"
**Solution:** Functions must use CommonJS (`.cjs`) and can't import from outside the functions directory without bundling.

### Issue: Functions work locally but not in production
**Solution:**
- Local uses `netlify dev` which simulates production
- Ensure environment variables are set in Netlify UI (not just `.env`)
- Redeploy after setting variables

### Issue: "fetch is not defined" in function
**Solution:** You're using Node 16 or below. Set `NODE_VERSION = "18"` in `netlify.toml` or Netlify UI.

### Issue: CORS errors in browser
**Solution:** Function must return proper CORS headers (already implemented in `bigcommerce-cart.cjs`).

## Quick Debug Steps

**Step 1:** Visit `https://YOUR-SITE.netlify.app/.netlify/functions/bigcommerce-cart`
- If you see HTML: Function not deployed or SPA redirect catching it
- If you see JSON error: Function is deployed but has runtime error
- If you see 404 JSON from Netlify: Function didn't deploy

**Step 2:** Check deploy logs for "Functions bundling" section

**Step 3:** Verify environment variables in Netlify UI

**Step 4:** Redeploy with cache cleared

**Step 5:** Check function logs during checkout attempt

## Still Not Working?

If you've followed all steps and it's still not working:

1. **Check the browser console** for the exact error and the URL being called
2. **Check the Network tab** in browser DevTools to see the actual request/response
3. **Share the deploy log** (especially the Functions bundling section)
4. **Share the function log** from Netlify dashboard when you trigger checkout
5. **Verify your BigCommerce API token** works by testing it with curl directly:

```bash
curl -X GET \
  "https://api.bigcommerce.com/stores/YOUR_STORE_HASH/v3/catalog/products?limit=1" \
  -H "X-Auth-Token: YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

If this curl command doesn't work, your token is invalid or has insufficient scopes.
