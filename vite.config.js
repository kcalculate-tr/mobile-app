import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg'],
      srcDir: 'src',
      filename: 'sw.js',
      manifest: {
        id: '/',
        name: 'Kcal App',
        short_name: 'Kcal',
        description: 'Sağlıklı Yemek Siparişi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F0F0F0',
        theme_color: '#98CD00',
        lang: 'tr',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          },
          {
            src: '/icons/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // 1 MB'ın altındaki chunk'lar için uyarı gösterme
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // React çekirdeği — her sayfanın ihtiyaç duyduğu en küçük runtime
          if (
            id.includes('react/') ||
            id.includes('react-dom') ||
            id.includes('react-router-dom') ||
            id.includes('scheduler')
          ) return 'vendor-react';

          // Animasyon + ikon kütüphaneleri — sayfa geçişlerinde kullanılır
          if (id.includes('framer-motion') || id.includes('lucide-react')) {
            return 'vendor-ui';
          }

          // Supabase — realtime websocket dahil büyük bir paket
          if (id.includes('@supabase')) return 'vendor-supabase';

          // Kalan tüm node_modules (date-fns, uuid, vb.)
          return 'vendor';
        },
      },
    },
  },
})
