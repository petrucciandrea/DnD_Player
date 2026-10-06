import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { apiPersonaggio } from '../api/src/api.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiPersonaggio(),
  ],
  // Raggiungibile dagli altri dispositivi della rete di casa.
  server: { host: true },
  preview: { host: true },
})
