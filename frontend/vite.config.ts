import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import path from 'path'

export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    vuetify({ autoImport: true })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:3081',
        changeOrigin: true
      },
      '/api/zalo': {
        target: 'http://127.0.0.1:3081',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/zalo/, '/api/v1')
      },
      '/uploads': {
        target: 'http://127.0.0.1:3081',
        changeOrigin: true
      },
      '/storage': {
        target: 'http://127.0.0.1:3081',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3081',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vuetify')) return 'vendor-vuetify';
            if (id.includes('apexcharts') || id.includes('vue3-apexcharts')) return 'vendor-charts';
            if (id.includes('socket.io-client')) return 'vendor-socket';
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) return 'vendor-vue-core';
            return 'vendor-libs';
          }
        }
      }
    }
  }
})
