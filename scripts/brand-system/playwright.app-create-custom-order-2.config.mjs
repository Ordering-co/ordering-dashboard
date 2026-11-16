import { fileURLToPath } from 'node:url'

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '../../e2e/brand-system-app',
  testMatch: 'l3-create-custom-order-2.spec.js',
  outputDir: '../../test-results/brand-system-app-create-custom-order-2',
  timeout: 120000,
  expect: { timeout: 90000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3045',
    browserName: 'chromium',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --config scripts/brand-system/app-create-custom-order-2.vite.config.mjs',
    url: 'http://127.0.0.1:3045/login',
    reuseExistingServer: false,
    timeout: 120000
  }
})
