# store-hs360

## 🚨 Common Issues

### "Cannot GET /" on Netlify
If deployed site shows "Cannot GET /":
1. Check Netlify Dashboard → Deploys (build must succeed)
2. Verify publish directory is `dist`
3. Trigger "Clear cache and deploy site"
4. See [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) for full fix

### 404 Errors on Secret Cost Management (Production)
If deployed site shows `Server returned non-JSON response (404)` on Secret Cost Management page:
1. Test function: `https://your-site.netlify.app/.netlify/functions/bigcommerce-cart`
2. Should show 405 error (not 404) - means function exists
3. If 404: Functions not deployed - check build logs
4. 👉 See [NETLIFY_FUNCTIONS_DIAGNOSTIC.md](./NETLIFY_FUNCTIONS_DIAGNOSTIC.md) for step-by-step fix

### 404 Errors in Development
If you see `Server returned non-JSON response (404)` errors locally:
- **✅ Solution:** Use `npm run dev` and access `http://localhost:8888`
- **❌ Don't use:** `npm run dev:vite` or `http://localhost:5173`
- 👉 See [TROUBLESHOOTING_404.md](./TROUBLESHOOTING_404.md) for complete fix

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see ENV_SETUP.md)
cp .env.example .env
# Edit .env with your credentials

# 3. Start development server
npm run dev

# 4. Open browser
# http://localhost:8888 (NOT 5173!)
```

## Documentation

### Development
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Complete development guide
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variable setup
- [TROUBLESHOOTING_404.md](./TROUBLESHOOTING_404.md) - Fix 404 errors in development

### Deployment
- [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) - Netlify deployment guide & troubleshooting
- [NETLIFY_FUNCTIONS_DIAGNOSTIC.md](./NETLIFY_FUNCTIONS_DIAGNOSTIC.md) - Fix 404 errors on Netlify Functions

### Reference
- [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md) - API token scopes
- [PCI_COMPLIANCE.md](./PCI_COMPLIANCE.md) - Payment security
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick reference guide
