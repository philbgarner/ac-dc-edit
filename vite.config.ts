import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // prefer the ESM build over the browser (IIFE) build
    conditions: ['import', 'module', 'default'],
  },
})
