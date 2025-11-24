# Netlify Functions Troubleshooting Guide

## Issue: 404 Error on `/.netlify/functions/bigcommerce-cart` in Production

If you're seeing a 404 error with HTML content in production, follow these steps:

### 1. Verify Function Deployment

After deploying to Netlify, check your deploy logs:

1. Go to Netlify Dashboard → Your Site → Deploys → Latest Deploy
2. Look for "Functions bundling" or "Netlify Functions" section
3. Verify that `bigcommerce-cart` function is listed

Expected output:
```
Functions bundled:
  - bigcommerce-cart
  - gql
```

### 2. Check Environment Variables

The function requires these environment variables in Netlify (without VITE_ prefix):

**Required:**
- `BC_STORE_HASH` - Your BigCommerce store hash
- `BC_ACCESS_TOKEN` - Your BigCommerce API access token

**To set them:**
1. Go to Site Settings → Environment Variables
2. Add each variable with the correct value
3. Redeploy the site after adding variables

### 3. Verify Function Accessibility

After deployment, test the function directly:

**Using curl:**
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/bigcommerce-cart \
  -H "Content-Type: application/json" \
  -d '{"action":"createCart","data":{"line_items":[]}}'
```

**Expected response:**
- Should return JSON (not HTML)
- If environment variables are missing, you'll get a JSON error message
- If function isn't deployed, you'll get HTML (404 page)

### 4. Common Issues and Solutions

#### Issue: HTML instead of JSON response
**Cause:** Function not deployed or SPA redirect catching the request
**Solution:**
- Verify `netlify.toml` has `force = false` on the SPA redirect
- Check that `functions = "netlify/functions"` is set in `[build]` section
- Ensure functions are .cjs or .js files (not .ts)

#### Issue: "Missing environment variables" error
**Cause:** Environment variables not set in Netlify
**Solution:**
- Set `BC_STORE_HASH` and `BC_ACCESS_TOKEN` in Netlify UI
- Note: Use the non-VITE_ prefix for server-side variables
- Redeploy after adding variables

#### Issue: Function works locally but not in production
**Cause:** Different configuration between local and production
**Solution:**
- Local: Use `npm run dev:netlify` (not `npm run dev`)
- Ensure `.env` doesn't have `VITE_API_BASE=/.netlify/functions` hardcoded
- Let the code auto-detect: dev uses `http://localhost:8888/.netlify/functions`, production uses `/.netlify/functions`

### 5. Verify netlify.toml Configuration

Your `netlify.toml` should have:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false  # IMPORTANT: false allows functions to work
```

### 6. Check Function File Structure

Ensure your function file:
- Is located at `netlify/functions/bigcommerce-cart.cjs`
- Has `exports.handler` defined
- Uses CommonJS syntax (not ES modules)
- Has no syntax errors

### 7. Review Build Logs

In your Netlify deploy logs, look for:
- ✅ "Functions bundled successfully"
- ❌ "Function bundling failed" or syntax errors
- ❌ Missing dependencies warnings

### 8. Test in Netlify Dev Locally

Before deploying, test with Netlify Dev:

```bash
npm run dev:netlify
```

This simulates the production environment locally and will catch:
- Function syntax errors
- Missing dependencies
- Environment variable issues

### 9. Function Logs

To debug in production:
1. Go to Netlify Dashboard → Functions → bigcommerce-cart
2. View real-time function logs
3. Check for errors when the function is invoked

### 10. Quick Checklist

- [ ] Functions directory exists: `netlify/functions/`
- [ ] Function file exists: `bigcommerce-cart.cjs`
- [ ] Environment variables set in Netlify UI (no VITE_ prefix)
- [ ] `netlify.toml` has `force = false` on SPA redirect
- [ ] Build logs show "Functions bundled"
- [ ] Site redeployed after environment variable changes
- [ ] Function accessible at `/.netlify/functions/bigcommerce-cart`
- [ ] Function returns JSON (not HTML)

## Still Having Issues?

If you've followed all steps and still have issues:

1. Check the Netlify Community Forums
2. Review Netlify's Function documentation
3. Verify your BigCommerce API credentials are valid
4. Test the BigCommerce API directly with curl to ensure credentials work
