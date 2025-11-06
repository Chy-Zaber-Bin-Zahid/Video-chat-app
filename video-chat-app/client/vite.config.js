import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  host: true,
  allowedHosts: ['all'],
  plugins: [react(),  tailwindcss()],
  proxy: {
    '/socket.io': {
      target: 'http://localhost:3001',
      ws: true,
      changeOrigin: true
    },
  },
})
