import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Pecah vendor besar ke chunk terpisah supaya bundle utama lebih kecil
        // dan bisa diunduh paralel + di-cache lebih awet (jarang berubah).
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/supabase-js')) {
            return 'supabase'
          }
          if (
            id.includes('node_modules/react-router-dom') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/')
          ) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
