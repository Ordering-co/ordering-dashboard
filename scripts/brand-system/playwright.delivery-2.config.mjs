import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import './harness/delivery-2-port.cjs'
import { harnessOrigin, harnessPort } from './harness/runtime.cjs'

export default defineConfig({
  testDir: '../../e2e/brand-system',
  testMatch: 'delivery-2-styles.spec.js',
  outputDir: '../../test-results/brand-system-delivery-2',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: harnessOrigin, browserName: 'chromium', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: `node node_modules/vite/bin/vite.js --config scripts/brand-system/harness/delivery-2-vite.config.mjs --port ${harnessPort} --strictPort`,
    env: { BRAND_HARNESS_PORT: String(harnessPort) },
    url: `${harnessOrigin}/scripts/brand-system/harness/delivery-2-index.html`,
    reuseExistingServer: false,
    timeout: 60000
  }
})
