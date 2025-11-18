# Netlify Functions Diagnostic Guide

## Current Issue

Your deployed Netlify site shows this error on the Secret Cost Management page:
```
Server returned non-JSON response (404): <!DOCTYPE html>...
```

This means the BigCommerce REST API function at `/.netlify/functions/bigcommerce-cart` is returning a 404.

## Step-by-Step Diagnosis

### Step 1: Check If Function Is Deployed

1. **Go to Netlify Dashboard** → Your Site → **Functions** tab

2. **Look for these functions:**
   - `bigcommerce-cart`
   - `gql`

3. **If functions are NOT listed:**
   - Functions didn't deploy properly
   - Continue to Step 2

4. **If functions ARE listed:**
   - Click on `bigcommerce-cart`
   - Check function logs for errors
   - Continue to Step 3

### Step 2: Verify Build Configuration

1. **Check Build Logs:**
   - Deploysystem → Latest Deploy → View build log

2. **Look for this line:**
   ```
   ◈ Packaging Functions from netlify/functions directory:
      - bigcommerce-cart.cjs
      - gql.cjs
   ```

3. **Check for warnings:**
   ```
   ▲ [WARNING] The CommonJS "exports" variable is treated as a global variable...
   ```

   **If you see this warning:**
   - Functions are using `.js` extension but package.json has `"type": "module"`
   - **FIX:** Rename function files from `.js` to `.cjs`:
     ```bash
     cd netlify/functions
     mv bigcommerce-cart.js bigcommerce-cart.cjs
     mv gql.js gql.cjs
     git add .
     git commit -m "Fix: Rename Netlify Functions to .cjs extension"
     git push
     ```

4. **If you DON'T see functions being packaged:**
   - Functions directory not detected
   - **FIX:** Update `netlify.toml`:
     ```toml
     [build]
       functions = "netlify/functions"

     [functions]
       directory = "netlify/functions"
     ```

5. **If you see "No functions found":**
   - Check that `netlify/functions/` directory exists in your repo
   - Verify files have `.cjs` or `.js` extension (not `.ts`)
   - Functions must be committed to git

### Step 3: Test Function Directly

Open a new browser tab and navigate to:
```
https://your-site.netlify.app/.netlify/functions/bigcommerce-cart
```

**Expected Results:**

❌ **404 Page Not Found** = Function not deployed
- Go back to Step 1 & 2

✅ **405 Method Not Allowed** or **Error: Method not allowed** = Function IS deployed!
- This is GOOD! It means the function exists
- The function only accepts POST, so GET returns 405
- Continue to Step 4

### Step 4: Check Environment Variables

If function exists but returns errors:

1. **Go to:** Site Settings → Environment Variables

2. **Verify ALL these are set:**
   ```
   VITE_BC_STORE_HASH
   VITE_BC_STOREFRONT_TOKEN
   VITE_API_BASE
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY

   BC_STORE_HASH
   BC_STOREFRONT_TOKEN
   BC_ACCESS_TOKEN
   ```

3. **CRITICAL:** You need BOTH `VITE_*` and non-`VITE_*` versions!

4. **If any are missing:**
   - Add them
   - Trigger new deploy (variables don't auto-redeploy)

### Step 5: Test Function with cURL

```bash
curl https://your-site.netlify.app/.netlify/functions/bigcommerce-cart \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"getProductCosts","data":{"productIds":[123]}}'
```

**Expected Results:**

✅ **JSON Response** = Function works!
```json
{
  "123": {
    "id": 123,
    "name": "Product Name",
    ...
  }
}
```

❌ **HTML 404 Response** = Function not found
- Return to Step 1

❌ **Error: Missing BigCommerce credentials** = Environment variables issue
- Return to Step 4

❌ **Error: Unauthorized** or **Scope Error** = BC_ACCESS_TOKEN missing scopes
- See BIGCOMMERCE_SCOPES.md
- Token needs: Products (read), Carts (modify)

### Step 6: Check Redirects

1. **View your `netlify.toml`** in your repository

2. **Verify the catch-all redirect has `force = false`:**
   ```toml
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
     force = false  # CRITICAL!
   ```

3. **If `force = true` or missing:**
   - It's overriding the functions
   - Change to `force = false`
   - Commit and push

## Common Fixes

### Fix 1: Functions Not Deploying

**Problem:** Build logs show "No functions found"

**Solution:**
1. Verify `netlify.toml` has:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
     functions = "netlify/functions"

   [functions]
     directory = "netlify/functions"
     node_bundler = "esbuild"
   ```

2. Commit changes:
   ```bash
   git add netlify.toml
   git commit -m "Fix Netlify functions configuration"
   git push
   ```

3. Wait for deploy to complete

### Fix 2: Missing Environment Variables

**Problem:** Function deployed but returns "Missing credentials"

**Solution:**
1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add missing variables (see Step 4 above)
3. Trigger new deploy: Deploys → Trigger deploy → Deploy site

### Fix 3: Redirects Overriding Functions

**Problem:** Functions deployed but return 404 HTML

**Solution:**
1. Edit `netlify.toml`:
   ```toml
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
     force = false  # Add this!
   ```

2. Commit and push:
   ```bash
   git add netlify.toml
   git commit -m "Fix redirects to allow functions"
   git push
   ```

### Fix 4: Old Deployment Cached

**Problem:** Made changes but still seeing old errors

**Solution:**
1. Go to Netlify Dashboard → Deploys
2. Click "Trigger deploy" → "Clear cache and deploy site"
3. Wait for new deployment
4. Hard refresh browser (Ctrl+Shift+R)

## Verification Checklist

After applying fixes:

- [ ] Build logs show "Functions bundled successfully"
- [ ] Functions tab in Netlify shows `bigcommerce-cart` function
- [ ] Direct URL test shows 405 (not 404)
- [ ] cURL test returns JSON (not HTML)
- [ ] Secret Cost Management page loads without errors
- [ ] Browser console shows 200 responses (not 404)

## Still Not Working?

### Check Function Logs

1. Netlify Dashboard → Functions → `bigcommerce-cart`
2. Click "Function log" tab
3. Look for errors or missing environment variables

### Common Log Errors

**"Missing environment variables"**
- BC_STORE_HASH, BC_STOREFRONT_TOKEN, or BC_ACCESS_TOKEN not set
- Fix: Add in Site Settings → Environment Variables

**"Unauthorized" or "403 Forbidden"**
- BC_ACCESS_TOKEN doesn't have required scopes
- Fix: Create new token with Products (read) + Carts (modify) scopes

**"ECONNREFUSED" or "Network error"**
- BigCommerce API unreachable
- Check BC_STORE_HASH is correct
- Verify token hasn't expired

## Quick Reference

**Function URL Format:**
```
https://your-site.netlify.app/.netlify/functions/FUNCTION_NAME
```

**Test in Browser:**
```
https://your-site.netlify.app/.netlify/functions/bigcommerce-cart
```
Should return 405, NOT 404

**Test with cURL:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"getProductCosts","data":{"productIds":[123]}}' \
  https://your-site.netlify.app/.netlify/functions/bigcommerce-cart
```

Should return JSON, NOT HTML
