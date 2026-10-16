import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Permite que los túneles rápidos de Cloudflare accedan al servidor de desarrollo
  server: { allowedHosts: ['.trycloudflare.com'] },
})
