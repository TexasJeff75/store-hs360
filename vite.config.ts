import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  define: {
    'import.meta.env.VITE_BC_STORE_HASH': JSON.stringify(process.env.VITE_BC_STORE_HASH),
    'import.meta.env.VITE_BC_ACCESS_TOKEN': JSON.stringify(process.env.VITE_BC_ACCESS_TOKEN),
  },
})