import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { storeOnboardingTranslationsPlugin } from '../storeOnboardingTranslations.mjs'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('../../', import.meta.url))

export default defineConfig({
  root,
  cacheDir: 'node_modules/.vite-brand-system-app-3080',
  base: '/',
  configFile: false,
  envFile: false,
  publicDir: 'public',
  plugins: [
    // main's store onboarding (merged 2026-10-09) imports virtual:store-onboarding-translations
    storeOnboardingTranslationsPlugin(),
    {
      name: 'strip-node-protocol',
      enforce: 'pre',
      resolveId (source) {
        if (source?.startsWith('node:')) return source.slice(5)
      }
    },
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
    entries: ['index.html'],
    // W0-E-05: scan the current source on every start. The cache is keyed by the lockfile and this
    // config, not by the source, so a cache left by older code misses newer imports (the W0-7
    // wrappers' @base-ui entrypoints); Vite then re-optimizes after the first load, answers 504
    // to the old deps and its reload never arrives, and the first test stays on «Loading».
    force: true,
    // Prepare the adopted public entrypoints before the isolated browser starts.
    // Its network boundary blocks HMR, so late re-optimization cannot reload it.
    include: [
      '@base-ui/react/alert-dialog',
      '@base-ui/react/button',
      '@base-ui/react/collapsible',
      '@base-ui/react/input',
      '@base-ui/react/select',
      '@base-ui/react/tooltip'
    ],
    esbuildOptions: { loader: { '.js': 'jsx' } }
  },
  server: {
    host: '127.0.0.1',
    port: 3080,
    strictPort: true,
    open: false
  }
})
