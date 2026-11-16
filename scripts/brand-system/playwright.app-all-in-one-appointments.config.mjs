import { fileURLToPath } from 'node:url'

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '../../e2e/brand-system-app',
  // The batch owns one spec here; the shared 3018 suite keeps its own config.
  testMatch: 'l3-all-in-one-appointments.spec.js',
  outputDir: '../../test-results/brand-system-app-all-in-one-appointments',
  timeout: 120000,
  expect: { timeout: 90000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3046',
    browserName: 'chromium',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --config scripts/brand-system/app-all-in-one-appointments.vite.config.mjs',
    url: 'http://127.0.0.1:3046/login',
    reuseExistingServer: false,
    timeout: 120000
  }
})
