import { describe, expect, it } from 'vitest'
import { orderingAssets } from '../assets'
import lock from '../ordering-brand.lock.json'
import { getDashboardLogoUrl, getDashboardNotificationIconUrl } from '../../utils/dashboardBranding'

describe('governed identity roles', () => {
  it('only exposes released, checksum-governed public assets', () => {
    const paths = [...Object.values(orderingAssets.logos), ...Object.values(orderingAssets.symbols), ...Object.values(orderingAssets.appIcons), orderingAssets.favicon, orderingAssets.faviconIco, orderingAssets.appleTouchIcon]
    for (const path of paths) {
      const output = lock.managedOutputs[`public${path}`]
      expect(output?.kind).toBe('asset')
      expect(output?.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(output?.sha256).toBe(output?.upstreamSha256)
    }
    expect(Object.isFrozen(orderingAssets.logos)).toBe(true)
  })

  it('uses complete masters for identity and preserves tenant precedence through existing resolvers', () => {
    expect(orderingAssets.logos.light).toContain('ordering-lockup-color.svg')
    expect(orderingAssets.logos.dark).toContain('ordering-lockup-color-reversed.svg')
    expect(getDashboardLogoUrl({}, orderingAssets.logos.light, 'dashboard.ordering.co')).toBe(orderingAssets.logos.light)
    expect(getDashboardLogoUrl({ dashboard_logo: { value: 'https://tenant.example/logo.svg' } }, orderingAssets.logos.light, 'dashboard.ordering.co')).toBe('https://tenant.example/logo.svg')
    // Ordering.co is the default on every host (no white-label fallback)
    expect(getDashboardLogoUrl({}, orderingAssets.logos.light, 'tenant.example')).toBe(orderingAssets.logos.light)
    expect(getDashboardNotificationIconUrl({}, orderingAssets.favicon, 'dashboard.ordering.co')).toBe(orderingAssets.favicon)
  })
})
