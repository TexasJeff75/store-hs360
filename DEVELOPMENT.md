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

This command starts **two servers simultaneously**:
- **Vite Dev Server** (port 3000): http://localhost:3000
- **Express API Server** (port 4000): http://localhost:4000

You should see output like this:
```
[0]
[0]   VITE v5.4.20  ready in 1234 ms
[0]
[0]   ➜  Local:   http://localhost:3000/
[1]
[1] ============================================================
[1] Local API server running on http://localhost:4000
[1] ============================================================
[1]   GraphQL proxy: https://store-xxx.mybigcommerce.com/graphql
[1]   Cart API: /api/bigcommerce-cart
[1]   Health check: /api/health
[1]
[1] Configuration:
[1]   Store Hash: ✅ CONFIGURED
[1]   Storefront Token: ✅ CONFIGURED
[1]   Access Token: ✅ CONFIGURED
[1] ============================================================
```

### 4. Open Your Browser
Navigate to http://localhost:3000

## Architecture

### Development Mode
```
Browser → Vite Dev Server (3000) → Express API Server (4000) → BigCommerce
                ↓                            ↓
            React App                   GraphQL/REST APIs
```

**Request Flow:**
1. Frontend makes request to `/.netlify/functions/gql`
2. Vite proxy intercepts and rewrites to `/api/gql`
3. Vite proxy forwards to Express server at `http://localhost:4000/api/gql`
4. Express server forwards to BigCommerce API
5. Response flows back through the chain

### Production Mode (Netlify)
```
Browser → Netlify CDN → Netlify Functions → BigCommerce
             ↓                ↓
         React App        GraphQL/REST APIs
```

## Available Scripts

### `npm run dev`
Starts both Vite and Express servers concurrently for development.

### `npm run dev:vite`
Starts only the Vite dev server (not recommended - API calls will fail).

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

**Problem:** `Server returned non-JSON response (404)`

**Causes:**
1. Express server (port 4000) isn't running
2. You ran `npm run dev:vite` instead of `npm run dev`
3. Port conflict preventing Express from starting

**Solution:**
1. Check that you see TWO servers in the terminal output
2. Test the Express server directly: `curl http://localhost:4000/api/health`
3. If it doesn't respond, check for port conflicts and restart

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
