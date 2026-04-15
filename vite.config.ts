import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png'
      ],

      manifest: {
        name: 'Mirega',
        short_name: 'Mirega',
        description: 'Sistema de gestión de ascensores',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        orientation: 'portrait',

        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },

      // 🔥 SOLUCIÓN AL ERROR DE BUILD
      workbox: {
        maximumFileSizeToCacheInBytes: 3000000
      }
    })
  ]
})