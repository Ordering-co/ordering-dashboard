// Batch-scoped copy of playwright.config.mjs: same shared harness server and
// network boundary, limited to the delivery-3 spec on the batch port (3033).
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import { harnessOrigin } from './harness/runtime.cjs'
export default defineConfig({
  testDir: '../../e2e/brand-system',
  testMatch: /delivery-3-styles\.spec\.js$/,
  outputDir: '../../test-results/brand-system-delivery-3',
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: harnessOrigin, browserName: 'chromium', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --config scripts/brand-system/harness/vite.config.mjs',
    url: `${harnessOrigin}/scripts/brand-system/harness/delivery-3.html`,
    reuseExistingServer: false,
    timeout: 120000
  }
})
