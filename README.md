# store-hs360

## 🚨 Important: Getting 404 Errors?

If you see `Server returned non-JSON response (404)` errors:

**✅ Solution:** Use `npm run dev` and access `http://localhost:8888`

**❌ Don't use:** `npm run dev:vite` or `http://localhost:5173`

👉 See [TROUBLESHOOTING_404.md](./TROUBLESHOOTING_404.md) for complete fix.

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

### Reference
- [BIGCOMMERCE_SCOPES.md](./BIGCOMMERCE_SCOPES.md) - API token scopes
- [PCI_COMPLIANCE.md](./PCI_COMPLIANCE.md) - Payment security
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Quick reference guide
