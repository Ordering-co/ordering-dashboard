import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDashboardLogoDefaults, getDashboardThemeLogo } from '../identity'
import { orderingAssets } from '../assets'
import { getDashboardLogoUrl } from '../../utils/dashboardBranding'

describe('dashboard identity defaults', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('preserves all five compatibility keys with governed full, compact and print assets', () => {
    expect(createDashboardLogoDefaults()).toEqual({
      logotype: orderingAssets.logos.light,
      logotypeInvert: orderingAssets.logos.onDark,
      isotype: orderingAssets.symbols.light,
      isotypeInvert: orderingAssets.symbols.dark,
      logoPdf: orderingAssets.logos.print
    })
  })

  it('resolves a subpath once through both direct consumers and branding resolvers', () => {
    vi.stubEnv('BASE_URL', '/pilot/')
    const logos = createDashboardLogoDefaults()
    expect(logos.logoPdf).toBe(`/pilot${orderingAssets.logos.print}`)
    expect(getDashboardLogoUrl({}, logos.logotype, 'dashboard.ordering.co')).toBe(`/pilot${orderingAssets.logos.light}`)
    expect(getDashboardLogoUrl({ dashboard_logo: { value: 'https://tenant.example/logo.svg' } }, logos.logotype, 'dashboard.ordering.co')).toBe('https://tenant.example/logo.svg')
    // Ordering.co is the default on every host (no white-label fallback)
    expect(getDashboardLogoUrl({}, logos.logotype, 'tenant.example')).toBe(`/pilot${orderingAssets.logos.light}`)
  })

  it('uses the reversed master on Dark while keeping explicit theme and tenant images', () => {
    const theme = { ordering: { mode: 'dark' }, images: { logos: createDashboardLogoDefaults() } }
    expect(getDashboardThemeLogo(theme)).toBe(orderingAssets.logos.dark)
    expect(getDashboardThemeLogo({ ...theme, images: { logos: { logotype: '/tenant.svg' } } })).toBe('/tenant.svg')
    expect(getDashboardLogoUrl({ dashboard_logo: { value: '/customer.svg' } }, getDashboardThemeLogo(theme), 'dashboard.ordering.co')).toBe('/customer.svg')
    expect(getDashboardThemeLogo({ ...theme, ordering: { mode: 'light' } })).toBe(orderingAssets.logos.light)
  })
})
