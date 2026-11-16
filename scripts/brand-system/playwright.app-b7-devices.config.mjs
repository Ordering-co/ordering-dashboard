import { fileURLToPath } from 'node:url'

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '../../e2e/brand-system-app',
  // The batch owns one spec here; the shared 3018 suite keeps its own config.
  testMatch: 'l4-b7-devices.spec.js',
  outputDir: '../../test-results/brand-system-app-b7-devices',
  timeout: 120000,
  expect: { timeout: 90000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3091',
    browserName: 'chromium',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --config scripts/brand-system/app-b7-devices.vite.config.mjs',
    url: 'http://127.0.0.1:3091/stores/devices',
    reuseExistingServer: false,
    timeout: 120000
  }
})
