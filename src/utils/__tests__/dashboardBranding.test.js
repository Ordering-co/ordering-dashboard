import { describe, expect, it } from 'vitest'

import {
  ORDERING_FAVICON,
  getDashboardFaviconUrl,
  getDashboardLogoUrl,
  getDashboardNotificationIconUrl,
  isOfficialOrderingDashboardHost
} from '../dashboardBranding'
import {
  isOfficialOrderingDashboardHost as isOfficialOrderingDashboardWorkerHost
} from '../../../worker/seo'

const officialHosts = [
  'dashboard.orderingplus.com',
  'dashboard.tryordering.com',
  'dashboard.ordering.co',
  'dashboardcf.orderingplus.com'
]

const nonOfficialHosts = [
  'customer.orderingplus.com',
  'dashboard.orderingplus.com.example.org',
  'custom.example.com',
  ''
]

const orderingLogo = '/assets/logotype.svg'
const orderingIcon = '/assets/isotype.svg'

const projectBranding = {
  dashboard_logo: { value: 'https://cloud-assets.orderingplus.com/luisv4plus/logo.png' },
  dashboard_favicon: { value: 'https://cloud-assets.orderingplus.com/luisv4plus/favicon.png' }
}

const noBranding = {
  dashboard_logo: { value: '' },
  dashboard_favicon: { value: '' }
}

describe('host detection stays in sync with the worker', () => {
  it.each(officialHosts)('recognizes official host %s', hostname => {
    expect(isOfficialOrderingDashboardHost(hostname)).toBe(true)
    expect(isOfficialOrderingDashboardWorkerHost(hostname)).toBe(true)
  })

  it.each(nonOfficialHosts)('rejects non-official host %s', hostname => {
    expect(isOfficialOrderingDashboardHost(hostname)).toBe(false)
    expect(isOfficialOrderingDashboardWorkerHost(hostname)).toBe(false)
  })
})

const anyHosts = [...officialHosts, ...nonOfficialHosts, 'localhost']

describe('Ordering.co is the default on every host', () => {
  it('falls back to the Ordering.co logo, favicon and icon without project branding', () => {
    expect(getDashboardLogoUrl(noBranding, orderingLogo)).toBe(orderingLogo)
    expect(getDashboardFaviconUrl(noBranding)).toBe(ORDERING_FAVICON)
    expect(getDashboardNotificationIconUrl(noBranding, orderingIcon)).toBe(orderingIcon)
    expect(getDashboardLogoUrl({}, orderingLogo)).toBe(orderingLogo)
    expect(getDashboardFaviconUrl(undefined)).toBe(ORDERING_FAVICON)
  })

  it('lets the project branding win', () => {
    expect(getDashboardLogoUrl(projectBranding, orderingLogo)).toBe(projectBranding.dashboard_logo.value)
    expect(getDashboardFaviconUrl(projectBranding)).toBe(projectBranding.dashboard_favicon.value)
    expect(getDashboardNotificationIconUrl(projectBranding, orderingIcon)).toBe(projectBranding.dashboard_favicon.value)
  })

  it('keeps the favicon then logo fallback chain for the notification icon', () => {
    expect(getDashboardNotificationIconUrl({
      dashboard_favicon: { value: '' },
      dashboard_logo: { value: 'https://tenant.example/logo.png' }
    }, orderingIcon)).toBe('https://tenant.example/logo.png')
  })

  it.each(anyHosts)('never uses the old white-label placeholders on %s', hostname => {
    window.history.replaceState(null, '', '/')
    const logo = getDashboardLogoUrl(noBranding, orderingLogo, hostname)
    expect(logo).not.toMatch(/default-logo/)
    expect(getDashboardFaviconUrl(noBranding, hostname)).not.toMatch(/default-favicon/)
  })

  it('keeps localhost out of the official hosts used by analytics', () => {
    expect(isOfficialOrderingDashboardHost('localhost')).toBe(false)
  })
})
