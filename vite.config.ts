import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
}

function sendJson(res: any, statusCode: number, data: any) {
  res.writeHead(statusCode, CORS_HEADERS)
  res.end(JSON.stringify(data))
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

function handleGqlProxy(env: Record<string, string>) {
  return async (req: any, res: any) => {
    const body = await readBody(req)
    try {
      const requestBody = JSON.parse(body)
      const BC_STORE_HASH = env.VITE_BC_STORE_HASH || env.BC_STORE_HASH
      const BC_STOREFRONT_TOKEN = env.VITE_BC_STOREFRONT_TOKEN || env.BC_STOREFRONT_TOKEN

      if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
        sendJson(res, 500, { errors: [{ message: 'Missing BigCommerce credentials' }] })
        return
      }

      const ENDPOINT = `https://store-${BC_STORE_HASH}.mybigcommerce.com/graphql`

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BC_STOREFRONT_TOKEN}`
        },
        body: JSON.stringify(requestBody)
      })

      const responseText = await response.text()
      res.writeHead(response.status, {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=60'
      })
      res.end(responseText)
    } catch (error) {
      sendJson(res, 500, { errors: [{ message: 'Internal server error' }] })
    }
  }
}

function netlifyFunctionsPlugin(env: Record<string, string>) {
  return {
    name: 'netlify-functions-dev',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = req.url?.split('?')[0]

        if (req.method === 'OPTIONS' && pathname?.startsWith('/.netlify/functions/')) {
          res.writeHead(200, CORS_HEADERS)
          res.end()
          return
        }

        if (pathname === '/.netlify/functions/gql' && req.method === 'POST') {
          await handleGqlProxy(env)(req, res)
          return
        }

        if (pathname === '/.netlify/functions/quickbooks-oauth' || pathname === '/.netlify/functions/quickbooks-api') {
          sendJson(res, 501, {
            error: 'QuickBooks functions require Netlify CLI in dev mode. Run: npm run dev:netlify'
          })
          return
        }

        next()
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
  plugins: [react(), netlifyFunctionsPlugin(env)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      external: []
    }
  },
  server: {
    host: true,
    port: 3000,
    strictPort: false
  },
  preview: {
    host: true,
    port: 3000,
    strictPort: true
  },
  define: {
    'import.meta.env.VITE_BC_STORE_HASH': JSON.stringify(env.VITE_BC_STORE_HASH),
    'import.meta.env.VITE_BC_STOREFRONT_TOKEN': JSON.stringify(env.VITE_BC_STOREFRONT_TOKEN),
    'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || '/.netlify/functions'),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
  },
  }
})
