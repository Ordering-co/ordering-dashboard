// Gallery of the governed Product wrappers (orders pilot, wave 4).
//   pnpm ui:gallery  →  http://127.0.0.1:3032/scripts/product-ui/gallery.html
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('../../', import.meta.url))
export const GALLERY_PORT = 3032

export default defineConfig({
  root,
  configFile: false,
  envFile: false,
  cacheDir: 'node_modules/.vite-product-ui-gallery',
  publicDir: 'public',
  plugins: [
    react({
      include: /\.[jt]sx?$/,
      babel: {
        babelrc: false,
        configFile: false,
        presets: [['@babel/preset-react', { runtime: 'automatic' }]],
        plugins: [['babel-plugin-styled-components', { displayName: true, fileName: false }]]
      }
    })
  ],
  resolve: {
    alias: {
      '~': resolve(root, 'src'),
      '~components': resolve(root, 'src/@/components-dashboard/src'),
      '~ui': resolve(root, 'src/@/components-dashboard/src/ui')
    }
  },
  optimizeDeps: {
    entries: ['scripts/product-ui/gallery.html'],
    esbuildOptions: { loader: { '.js': 'jsx' } }
  },
  server: { host: '127.0.0.1', port: GALLERY_PORT, strictPort: true, open: false, hmr: false }
})
