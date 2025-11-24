import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadEnv } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function netlifyFunctionsPlugin(env: Record<string, string>) {
  return {
    name: 'netlify-functions-dev',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/.netlify/functions/gql' && req.method === 'POST') {
          console.log('🔧 Intercepting GraphQL request in Vite dev server');

          let body = '';
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });

          req.on('end', async () => {
            try {
              const requestBody = JSON.parse(body);
              const BC_STORE_HASH = env.VITE_BC_STORE_HASH || env.BC_STORE_HASH;
              const BC_STOREFRONT_TOKEN = env.VITE_BC_STOREFRONT_TOKEN || env.BC_STOREFRONT_TOKEN;

              if (!BC_STORE_HASH || !BC_STOREFRONT_TOKEN) {
                console.error('❌ Missing BigCommerce credentials in environment');
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ errors: [{ message: 'Missing BigCommerce credentials' }] }));
                return;
              }

              const ENDPOINT = `https://store-${BC_STORE_HASH}.mybigcommerce.com/graphql`;
              console.log('📡 Proxying to:', ENDPOINT);

              const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${BC_STOREFRONT_TOKEN}`
                },
                body: JSON.stringify(requestBody)
              });

              const responseText = await response.text();

              res.writeHead(response.status, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=60'
              });
              res.end(responseText);

              console.log('✅ GraphQL request proxied successfully');
            } catch (error) {
              console.error('❌ Error proxying GraphQL request:', error);
              res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ errors: [{ message: 'Internal server error' }] }));
            }
          });
        } else if (req.url === '/.netlify/functions/gql' && req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end();
        } else {
          next();
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
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