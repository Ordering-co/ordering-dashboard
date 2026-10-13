import { describe, expect, it } from 'vitest'
import * as worker from '../../worker/index.js'

describe('Worker PostHog runtime configuration', () => {
  it('lets the deployment environment override the analytics kill switch', () => {
    expect(worker.mergeBaseConfigWithEnv({
      posthog_analytics_enabled: true,
      api: { url: 'https://api.example.com' }
    }, {
      POSTHOG_ANALYTICS_ENABLED: 'false'
    }).posthog_analytics_enabled).toBe(false)
  })

  it('injects the resolved kill switch into the browser runtime config', () => {
    expect(worker.buildRuntimeConfig({
      project: 'demo',
      posthog_analytics_enabled: false,
      api: { url: 'https://api.example.com' }
    }, { siteId: 9, disablePoweredBy: false })).toMatchObject({
      project: 'demo',
      site_id: 9,
      posthog_analytics_enabled: false
    })
  })
})
