import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),

    // ── Brotli compression (primary — modern browsers) ──────────────────
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024, // only compress files > 1 KB
    }),

    // ── Gzip compression (fallback — older clients / CDNs) ──────────────
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolves ../../../config/* imports from inside frontend/src
      '@@config': path.resolve(__dirname, '../config'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    // Target modern baseline — avoids unnecessary polyfill bloat
    target: 'es2019',
    // Use esbuild for fastest, smallest minification
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Stable asset filenames with content-hash for long-lived CDN caching
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui:     ['lucide-react', 'zustand'],
          // Split ~500 KB icons pack into its own lazy chunk so it only loads
          // when a component that uses it is rendered (e.g. PlatformIcon)
          icons:  ['@icons-pack/react-simple-icons'],
        },
      },
    },
  },
})
