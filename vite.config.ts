import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import apiRoutes from 'vite-plugin-api-routes'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    apiRoutes(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
