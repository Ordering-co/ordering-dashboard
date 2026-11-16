import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import { harnessOrigin, harnessPort } from './harness/runtime.cjs'
const production = process.env.BRAND_HARNESS_PRODUCTION === '1'
export default defineConfig({
  testDir: '../../e2e/brand-system',
  outputDir: production ? '/tmp/ordering-brand-system-production-results' : '../../test-results/brand-system',
  workers: 2,
  retries: 0,
  // fila 48 (W0-T-05): a cold dev server compiled each fixture on its first spec; the setup warms every surface first
  globalSetup: './harness-warmup.mjs',
  reporter: [['list']],
  use: { baseURL: harnessOrigin, browserName: 'chromium', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    command: production
      ? `node node_modules/vite/bin/vite.js build --config scripts/brand-system/harness/vite.config.mjs --base /pilot/ && node node_modules/vite/bin/vite.js preview --config scripts/brand-system/harness/vite.config.mjs --base /pilot/ --host 127.0.0.1 --port ${harnessPort} --strictPort`
      : 'node node_modules/vite/bin/vite.js --config scripts/brand-system/harness/vite.config.mjs',
    url: `${harnessOrigin}/${production ? 'pilot/' : ''}scripts/brand-system/harness/index.html`,
    reuseExistingServer: false,
    timeout: 60000
  }
})
