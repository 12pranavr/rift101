import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    // Force a single React instance — prevents "Invalid hook call" from
    // libraries (recharts, zustand) that might bundle their own React copy
    dedupe: ['react', 'react-dom'],
  },
})
