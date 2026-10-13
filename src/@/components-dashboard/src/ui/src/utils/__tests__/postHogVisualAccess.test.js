import { describe, expect, it } from 'vitest'

import { getConnectVisualAccess, isDashboardFeatureEnabled } from '../postHogVisualAccess'

describe('getConnectVisualAccess', () => {
  it('enables Campaign and Connect without PostHog flags', () => {
    const access = getConnectVisualAccess()

    expect(access.marketingCampaigns).toBe(true)
    expect(access.connectOverview).toBe(true)
    expect(access.showConnectTab).toBe(true)
  })
})

describe('isDashboardFeatureEnabled', () => {
  it('keeps school module off by default', () => {
    expect(isDashboardFeatureEnabled({ featureKey: 'schools' })).toBe(false)
  })

  it('turns school module on through school_module_enabled', () => {
    expect(isDashboardFeatureEnabled({
      featureKey: 'schools',
      configs: { school_module_enabled: { value: '1' } }
    })).toBe(true)
  })
})
