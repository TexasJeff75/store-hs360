import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api/graphql': {
          target: env.VITE_BIGCOMMERCE_STOREFRONT_API_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          headers: {
            'Authorization': `Bearer ${env.VITE_BIGCOMMERCE_STOREFRONT_API_TOKEN}`,
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react']
    },
  };
});