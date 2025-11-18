# Netlify Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables in Netlify Dashboard

Go to: **Site Settings → Environment Variables**

You need to set **TWO SETS** of environment variables:

#### Frontend Variables (with VITE_ prefix)
These are injected into the React app at build time:

```
VITE_BC_STORE_HASH=your_store_hash
VITE_BC_STOREFRONT_TOKEN=your_storefront_token
VITE_API_BASE=/.netlify/functions
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Backend Variables (without VITE_ prefix)
These are used by Netlify Functions at runtime:

```
BC_STORE_HASH=your_store_hash
BC_STOREFRONT_TOKEN=your_storefront_token
BC_ACCESS_TOKEN=your_access_token
```

**⚠️ CRITICAL:** You need BOTH sets! The frontend uses `VITE_*` variables, and Netlify Functions use the non-`VITE_*` versions.

### 2. Netlify Build Settings

In: **Site Settings → Build & Deploy → Build Settings**

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Functions directory:** `netlify/functions`

These should match `netlify.toml`, but explicitly setting them in the dashboard can prevent issues.

### 3. Node Version

In: **Site Settings → Build & Deploy → Environment**

Set `NODE_VERSION` to `18` or higher.

This is also configured in `netlify.toml`, but setting it in the dashboard ensures consistency.

## Common Deployment Issues

### Issue 1: 404 on Netlify Functions

**Symptom:**
```
Server returned non-JSON response (404)
[BC REST API] Request failed
```

**Causes:**
1. Functions directory not detected during build
2. Missing environment variables in Netlify dashboard
3. Catch-all redirect overriding function routes

**Solution:**
1. Verify `netlify.toml` has:
   ```toml
   [build]
     functions = "netlify/functions"

   [functions]
     directory = "netlify/functions"
   ```

2. Check Netlify build logs for:
   ```
   ✔ Functions bundled successfully
   ```

3. Test function directly:
   ```
   https://your-site.netlify.app/.netlify/functions/bigcommerce-cart
   ```
   Should return `{"error":"Method not allowed"}` (not 404)

### Issue 2: Missing Environment Variables

**Symptom:**
```
Missing BigCommerce credentials
Server configuration error
```

**Solution:**
1. Go to Site Settings → Environment Variables
2. Verify ALL variables are set (both `VITE_*` and non-`VITE_*`)
3. Redeploy after adding variables (builds don't auto-trigger)

### Issue 3: Build Succeeds but Functions Don't Work

**Symptom:**
- Build shows "✔ Functions bundled successfully"
- Deployment succeeds
- But functions return 404 in production

**Solution:**
Check the function file format:

```javascript
// ✅ Correct format
exports.handler = async (event, context) => {
  // function code
};

// ❌ Wrong format (ES modules not supported)
export default async (event, context) => {
  // function code
};
```

All Netlify Functions must use CommonJS (`exports.handler`), not ES modules.

### Issue 4: CORS Errors

**Symptom:**
```
Access-Control-Allow-Origin error
CORS policy blocked
```

**Solution:**
Verify each function returns CORS headers:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// In all responses
return {
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(data)
};
```

## Verifying Deployment

### 1. Check Build Logs

In Netlify dashboard, open the latest deploy logs and verify:

```
✔ Build completed
✔ Functions bundled successfully
✔ Deploy succeeded
```

### 2. Test Functions Directly

```bash
# Test bigcommerce-cart function
curl https://your-site.netlify.app/.netlify/functions/bigcommerce-cart \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"getProductCosts","data":{"productIds":[123]}}'

# Should return JSON with product costs, not HTML 404
```

### 3. Test in Browser

1. Open browser DevTools → Network tab
2. Navigate to Secret Cost Management page
3. Look for request to `/.netlify/functions/bigcommerce-cart`
4. Status should be `200`, not `404`

## Environment Variable Reference

### Where to Get These Values

#### BigCommerce Variables

1. **BC_STORE_HASH**
   - Found in store URL: `https://store-{STORE_HASH}.mybigcommerce.com`
   - Example: `jf6xblp97c`

2. **BC_STOREFRONT_TOKEN**
   - Go to: Advanced Settings → API Accounts → Create API Account
   - Select "Storefront API Token"
   - Copy the JWT token

3. **BC_ACCESS_TOKEN**
   - Same location as above
   - Select "REST API Token" with required scopes
   - See `BIGCOMMERCE_SCOPES.md` for required scopes

#### Supabase Variables

1. **SUPABASE_URL**
   - Supabase Dashboard → Project Settings → API
   - Project URL (e.g., `https://abc123.supabase.co`)

2. **SUPABASE_ANON_KEY**
   - Same location
   - Copy "anon public" key

## Troubleshooting Checklist

- [ ] All environment variables set in Netlify dashboard
- [ ] Both `VITE_*` and non-`VITE_*` versions configured
- [ ] Build settings correct: `dist` publish, `npm run build` command
- [ ] Functions directory: `netlify/functions`
- [ ] Build logs show "Functions bundled successfully"
- [ ] Can access functions directly (not 404)
- [ ] Browser console shows 200 responses from functions
- [ ] No CORS errors in browser console

## Redeploying

After changing environment variables or code:

1. **Code Changes:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
   Netlify auto-deploys on push.

2. **Environment Variable Changes:**
   - Update in Netlify dashboard
   - Click "Trigger deploy → Deploy site"
   - Variables are NOT updated in existing deployments automatically

3. **Force Clean Deploy:**
   - Deploys → Click "..." → "Rebuild"
   - Or: Settings → Build & Deploy → "Clear cache and deploy site"

## Support

If you're still experiencing issues:

1. Check Netlify community forum
2. Review build logs for errors
3. Test functions locally with `netlify dev`
4. Verify environment variables are actually set (not just visible)
5. Check Netlify status page for service issues

## Additional Resources

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Environment Variables Guide](https://docs.netlify.com/environment-variables/overview/)
- [Build Configuration](https://docs.netlify.com/configure-builds/overview/)
- [TROUBLESHOOTING_404.md](./TROUBLESHOOTING_404.md) - Local development 404s
