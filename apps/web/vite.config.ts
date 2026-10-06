import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In sviluppo /api va al server Fastify (npm run dev alla radice avvia entrambi), come in produzione
// fanno le rewrite di Vercel: stessa origine, quindi niente CORS e il cookie di sessione resta SameSite=Strict.
const API = process.env.API_URL ?? 'http://localhost:3100'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Raggiungibile dagli altri dispositivi della rete di casa.
  server: { host: true, proxy: { '/api': API } },
  preview: { host: true, proxy: { '/api': API } },
})
