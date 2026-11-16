// Browser tests for gallery behavior, layout modes and accessibility.
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const origin = 'http://127.0.0.1:3032'

export default defineConfig({
  testDir: '../../e2e/product-ui',
  outputDir: '../../test-results/product-ui',
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: origin, browserName: 'chromium', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure', deviceScaleFactor: 1 },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --config scripts/product-ui/vite.config.mjs',
    url: `${origin}/scripts/product-ui/gallery.html`,
    reuseExistingServer: false,
    timeout: 120000
  }
})
