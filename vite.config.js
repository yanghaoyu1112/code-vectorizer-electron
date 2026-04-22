import { defineConfig } from 'vite'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern'
      }
    }
  },
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.js',
        vite: {
          build: {
            sourcemap: true,
            rollupOptions: {
              external: ['electron', 'pg'],
              output: {
                format: 'esm'
              }
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.mjs'),
        vite: {
          build: {
            sourcemap: true,
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'esm'
              }
            }
          }
        }
      },
      renderer: {}
    })
  ],
  build: {
    assetsDir: 'assets',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
})
