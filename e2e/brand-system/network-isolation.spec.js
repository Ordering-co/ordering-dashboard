import { test, expect } from '@playwright/test'
import { installNetworkBoundary, fixtureUrl } from './fixtures'
import { harnessOrigin } from '../../scripts/brand-system/harness/runtime.cjs'

test('boundary rejects deliberate external reads, local API reads and writes', async ({ context, page }) => {
  const blocked = await installNetworkBoundary(context)
  await page.goto(fixtureUrl())
  const outcomes = await page.evaluate(async () => Promise.all([
    fetch('https://example.invalid/brand-boundary'),
    fetch('/api/brand-boundary'),
    fetch('/scripts/brand-system/harness/index.html', { method: 'POST', body: 'synthetic-test' })
  ].map(request => request.then(() => 'escaped', () => 'blocked'))))
  expect(outcomes).toEqual(['blocked', 'blocked', 'blocked'])
  expect(blocked).toEqual(expect.arrayContaining([
    'GET https://example.invalid/brand-boundary',
    `GET ${harnessOrigin}/api/brand-boundary`,
    `POST ${harnessOrigin}/scripts/brand-system/harness/index.html`
  ]))
  expect(blocked).toHaveLength(3)
})

test('boundary permits only local country SVG assets and still blocks other paths and methods', async ({ context, page }) => {
  const blocked = await installNetworkBoundary(context)
  await page.goto(fixtureUrl())
  const prefix = process.env.BRAND_HARNESS_PRODUCTION === '1' ? '/pilot' : ''
  const result = await page.evaluate(async prefix => {
    const response = await fetch(`${prefix}/brand-fixture-flags/US.svg`)
    const body = await response.text()
    const rejected = await Promise.all([
      fetch(`${prefix}/brand-fixture-flags/US.txt`),
      fetch(`${prefix}/brand-fixture-flags/US.svg`, { method: 'POST', body: 'synthetic-test' }),
      fetch('https://example.invalid/brand-fixture-flags/US.svg')
    ].map(request => request.then(() => 'escaped', () => 'blocked')))
    return { status: response.status, type: response.headers.get('content-type'), svg: body.includes('<svg'), rejected }
  }, prefix)
  expect(result.status).toBe(200)
  expect(result.type).toContain('image/svg+xml')
  expect(result.svg).toBe(true)
  expect(result.rejected).toEqual(['blocked', 'blocked', 'blocked'])
  expect(blocked).toHaveLength(3)
})
