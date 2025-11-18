# Development Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your credentials
# See ENV_SETUP.md for detailed instructions on getting credentials
```

### 3. Start Development Server
```bash
npm run dev
```

This command starts **Netlify Dev**, which includes:
- **Vite Dev Server** (port 5173): http://localhost:5173
- **Express API Server** (port 4000): http://localhost:4000
- **Netlify Functions** (proxied through port 8888): http://localhost:8888

You should see output indicating all services are running.

### 4. Open Your Browser
Navigate to http://localhost:8888 (Netlify Dev proxy)

**Important:** Always use port 8888 in development, not 5173. This ensures:
- Netlify Functions are available at `/.netlify/functions/*`
- Environment variables are properly loaded
- The setup matches production behavior

## Architecture

### Development Mode (with Netlify Dev)
```
Browser → Netlify Dev (8888) → Vite Dev Server (5173) → React App
              ↓
        Netlify Functions (BigCommerce REST API)
              ↓
       Express Server (4000) → BigCommerce GraphQL API
```

**Request Flow:**
1. Browser connects to `http://localhost:8888`
2. Netlify Dev proxies requests:
   - Static files → Vite (5173)
   - `/.netlify/functions/*` → Local Netlify Functions
   - `/api/gql` → Express server (4000) → BigCommerce GraphQL
3. All environment variables are injected by Netlify Dev
4. Matches production behavior exactly

### Production Mode (Netlify)
```
Browser → Netlify CDN → Netlify Functions → BigCommerce
             ↓                ↓
         React App        GraphQL/REST APIs
```

## Available Scripts

### `npm run dev`
Starts Netlify Dev, which runs Vite, Express server, and Netlify Functions.
**Always use this for development!**

### `npm run dev:functions`
Starts Vite and Express servers without Netlify Dev.
(Use only if you need to bypass Netlify Functions)

### `npm run dev:vite`
Starts only the Vite dev server.
**Not recommended** - Netlify Functions and Express API will not be available.

### `npm run build`
Creates a production build in the `dist` folder.

### `npm run preview`
Previews the production build locally.

### `npm run lint`
Runs ESLint on the codebase.

## Testing API Endpoints

### Health Check
```bash
curl http://localhost:4000/api/health
```

### GraphQL Query
```bash
curl http://localhost:4000/api/gql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ site { settings { storeName } } }"}'
```

### Create Cart
```bash
curl http://localhost:4000/api/bigcommerce-cart \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "createCart",
    "data": {
      "line_items": [
        {
          "product_id": 123,
          "quantity": 1
        }
      ]
    }
  }'
```

## Troubleshooting

### Server Not Starting

**Problem:** Only one server starts, or neither starts.

**Solution:**
```bash
# Kill any processes on port 3000 or 4000
lsof -i :3000
lsof -i :4000
kill -9 <PID>

# Restart dev server
npm run dev
```

### API 404 Errors

**Problem:** `Server returned non-JSON response (404)` when accessing `/.netlify/functions/bigcommerce-cart`

**Causes:**
1. Not using Netlify Dev (ran `npm run dev:vite` or `npm run dev:functions` instead of `npm run dev`)
2. Accessing `http://localhost:5173` directly instead of `http://localhost:8888`
3. Netlify Functions not properly loaded

**Solution:**
1. **Always use `npm run dev`** to start the development server
2. **Always access the app at `http://localhost:8888`** (not 5173)
3. Verify Netlify Functions are loaded by checking terminal output
4. Check environment variables are set (both `VITE_*` and non-`VITE_*` versions)

**Quick Test:**
```bash
# Test Netlify Function
curl http://localhost:8888/.netlify/functions/bigcommerce-cart \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"getProductCosts","data":{"productIds":[123]}}'
```

### Missing Credentials Error

**Problem:** "Missing credentials" or "MISSING_CREDENTIALS" error

**Solution:**
1. Verify `.env` file exists in project root
2. Check that all variables are set (compare with `.env.example`)
3. Ensure no extra spaces or quotes around values
4. Restart dev server after editing `.env`

### CORS Errors

**Problem:** CORS policy blocks API requests

**Solution:**
This shouldn't happen in development because:
1. The Express server has CORS enabled for all origins
2. The Vite proxy forwards requests from the same origin

If you still see CORS errors:
1. Make sure requests go through Vite proxy (check Network tab)
2. Verify Express server is running and logs show CORS headers
3. Clear browser cache and hard reload

## Environment Variables

See `ENV_SETUP.md` for complete documentation on environment variables.

### Required for Development
- `VITE_BC_STORE_HASH` - Your BigCommerce store hash
- `VITE_BC_STOREFRONT_TOKEN` - BigCommerce Storefront API token (JWT)
- `BC_STORE_HASH` - Same as above (for backend)
- `BC_STOREFRONT_TOKEN` - Same as above (for backend)
- `BC_ACCESS_TOKEN` - BigCommerce REST API access token
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_API_BASE` - API base path (use `/.netlify/functions`)

## Project Structure

```
project/
├── src/
│   ├── components/     # React components
│   ├── services/       # API service modules
│   ├── config/         # Configuration (including env.ts)
│   ├── contexts/       # React contexts
│   └── hooks/          # Custom React hooks
├── server/
│   └── gql.cjs        # Local development API server
├── netlify/
│   └── functions/     # Netlify serverless functions
├── supabase/
│   └── migrations/    # Database migrations
└── dist/              # Production build output
```

## Deployment

### Netlify

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Configure environment variables in Netlify UI (see ENV_SETUP.md)
4. Deploy automatically on push to main branch

### Manual Build
```bash
npm run build
```

The `dist` folder contains the production-ready static files.

## Additional Resources

- [ENV_SETUP.md](./ENV_SETUP.md) - Complete environment variable setup guide
- [README.md](./README.md) - Project overview
- [BigCommerce API Docs](https://developer.bigcommerce.com/api-docs)
- [Supabase Docs](https://supabase.com/docs)
