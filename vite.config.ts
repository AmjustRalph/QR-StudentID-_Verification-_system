import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Lets a Cloudflare quick tunnel (npx cloudflared tunnel --url ...) reach
    // this dev server for phone-camera testing — its hostname changes each
    // run, so the whole subdomain is allowed rather than one fixed value.
    allowedHosts: ['.trycloudflare.com'],
  },
})
