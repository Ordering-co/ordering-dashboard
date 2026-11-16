// Batch-scoped copy of the harness dev server: same root and alias contract as
// scripts/brand-system/harness/vite.config.mjs, reduced to the modules this
// batch's style fixture imports, on the Delivery-2 port.
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import './delivery-2-port.cjs'
import { harnessPort } from './runtime.cjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))

export default defineConfig({
  root,
  configFile: false,
  envFile: false,
  cacheDir: `node_modules/.vite-brand-system-harness-${harnessPort}`,
  publicDir: false,
  resolve: { alias: { '~': resolve(root, 'src') } },
  plugins: [
    react({ include: /\.[jt]sx?$/, babel: { babelrc: false, configFile: false, presets: [['@babel/preset-react', { runtime: 'automatic' }]], plugins: [['babel-plugin-styled-components', { displayName: true, fileName: false }]] } })
  ],
  optimizeDeps: {
    entries: [resolve(root, 'scripts/brand-system/harness/delivery-2-index.html')],
    esbuildOptions: { loader: { '.js': 'jsx' } }
  },
  server: { host: '127.0.0.1', port: harnessPort, strictPort: true },
  preview: { host: '127.0.0.1', port: harnessPort, strictPort: true }
})
