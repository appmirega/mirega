import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Esto ayuda cuando alguna dependencia intenta resolver otra copia
    dedupe: ['react', 'react-dom'],
  },
})