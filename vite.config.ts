import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
  plugins: [react()],
  server: {
    proxy: {
      '/graphql': {
        target: env.VITE_BIGCOMMERCE_STOREFRONT_API_URL || 'https://store-hash.mybigcommerce.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/graphql/, '/graphql'),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('GraphQL Proxy Debug:', {
              originalUrl: req.url,
              targetUrl: proxyReq.path,
              target: env.VITE_BIGCOMMERCE_STOREFRONT_API_URL,
              hasToken: !!env.VITE_BIGCOMMERCE_STOREFRONT_API_TOKEN,
              tokenPreview: env.VITE_BIGCOMMERCE_STOREFRONT_API_TOKEN ? 
                `${env.VITE_BIGCOMMERCE_STOREFRONT_API_TOKEN.substring(0, 10)}...` : 'NONE'
            });
            
            const token = env.VITE_BIGCOMMERCE_STOREFRONT_API_TOKEN;
            if (token && token.trim() !== '') {
              proxyReq.setHeader('Authorization', `Bearer ${token}`);
              console.log('✅ Added Authorization Bearer header:', `${token.substring(0, 10)}...`);
            } else {
              console.log('❌ No valid Storefront API token found for proxy');
            }
            
            // Set required headers for GraphQL
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Accept', 'application/json');
            
            console.log('Final headers being sent:', {
              'Authorization': proxyReq.getHeader('Authorization') ? 'SET' : 'MISSING',
              'Content-Type': proxyReq.getHeader('Content-Type'),
              'Accept': proxyReq.getHeader('Accept')
            });
          });
          
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('GraphQL Proxy Response:', {
              status: proxyRes.statusCode,
              statusMessage: proxyRes.statusMessage,
              responseHeaders: proxyRes.headers,
              url: req.url
            });
          });
          
          proxy.on('error', (err, req, res) => {
            console.error('GraphQL Proxy Error:', err);
          });
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  };
});