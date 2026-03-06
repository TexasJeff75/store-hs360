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

function netlifyFunctionsPlugin() {
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
  plugins: [react(), netlifyFunctionsPlugin()],
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
    'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || '/.netlify/functions'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  }
})
