/* eslint-disable import/first */
import { describe, expect, it, vi } from 'vitest'

vi.mock('posthog-js/react', () => ({
  useActiveFeatureFlags: () => []
}))

vi.mock('../../../../index.js', () => ({
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (key, fallback) => fallback || key],
  useSession: () => [{ user: {}, token: null }],
  CODES: {}
}))

import {
  getFeeAmount,
  getFeeKey,
  shouldShowFeeItem,
  shouldShowFeeRateDetails
} from '../feeBillUtils'
import {
  getTaxAmount,
  getTaxKey,
  getTaxesByTarget,
  shouldShowTaxBillRow,
  shouldShowTaxItem,
  shouldShowTaxRate
} from '../taxBillUtils'
import {
  getDefaultTemporalSiteUrl,
  getPreferredSiteDestinations,
  getPreferredSiteUrl,
  getSubscribedWebsiteProduct
} from '../getPreferredSiteUrl'
import {
  CONNECT_BUSINESS_OWNER_PAGES,
  getConnectAllowedLevels,
  isCalendlyUrl,
  isSetupCallIntegration,
  POS_SETUP_CALL_URL
} from '../connectAccess'

describe('feeBillUtils', () => {
  it('reads fee amount and visibility', () => {
    expect(getFeeAmount({ summary: { amount: 3 } })).toBe(3)
    expect(getFeeAmount({ summary: { fixed: 1, percentage: 2 } })).toBe(3)
    expect(shouldShowFeeRateDetails({ fixed: 1, percentage: 0 })).toBe(true)
    expect(shouldShowFeeItem({ summary: { amount: 0 } })).toBe(false)
    expect(getFeeKey({ type: 'service', id: 9, name: 'x' }, 1)).toContain('service-9')
  })
})

describe('taxBillUtils', () => {
  it('filters and keys taxes', () => {
    const taxes = [
      { id: 1, target: 'product', summary: { tax: 2 }, rate: 5, type: 2 },
      { id: 2, target: 'delivery', summary: { tax_after_discount: 1 }, rate: 0, type: 1 }
    ]
    expect(getTaxesByTarget(taxes, 'product')).toHaveLength(1)
    expect(getTaxAmount(taxes[0])).toBe(2)
    expect(getTaxAmount(taxes[1])).toBe(1)
    expect(shouldShowTaxRate(taxes[0])).toBe(true)
    expect(shouldShowTaxItem(taxes[0])).toBe(true)
    expect(shouldShowTaxBillRow(taxes[0])).toBe(true)
    expect(shouldShowTaxBillRow(taxes[1])).toBe(false)
    expect(getTaxKey(taxes[0], 0)).toContain('product-1')
  })
})

describe('getPreferredSiteUrl', () => {
  const base = {
    configurations: { subdomain: 'example' },
    configs: {},
    ordering: { project: 'demo' }
  }

  it('prefers marketplace site with ended SSL', () => {
    const url = getPreferredSiteUrl({
      ...base,
      sites: [
        { code: 'web_marketplace_26', domain: 'shop.tryordering.com', ssl_process_status: 'ended' }
      ]
    })
    expect(url).toBe('https://shop.example.com')
  })

  it('uses marketplace temporal_domain when SSL is not ended', () => {
    const url = getPreferredSiteUrl({
      ...base,
      configs: { site_url: { value: 'https://stale.example.com' } },
      sites: [
        {
          type: 'web_marketplace_26',
          temporal_domain: 'v26-demo.example.com',
          ssl_process_status: 'pending'
        }
      ]
    })
    expect(url).toBe('https://v26-demo.example.com')
  })

  it('uses the v26 host when marketplace has no custom domain or temporal_domain', () => {
    const url = getPreferredSiteUrl({
      ...base,
      configs: { site_url: { value: 'https://stale.example.com' } },
      sites: [
        { type: 'web_marketplace_26', ssl_process_status: 'pending' }
      ]
    })
    expect(url).toBe('https://v26-demo.example.com')
  })

  it('ignores stale site_url when there are no sites', () => {
    const url = getPreferredSiteUrl({
      ...base,
      configs: { site_url: { value: 'https://stale.example.com' } },
      sites: []
    })
    expect(url).toBe('https://v26-demo.example.com')
  })

  it('falls back to project subdomain', () => {
    const url = getPreferredSiteUrl({
      ...base,
      sites: []
    })
    expect(url).toBe('https://v26-demo.example.com')
  })

  it('returns no destination while the subscribed website product is unresolved', () => {
    expect(getPreferredSiteUrl({ ...base, websiteProduct: null, sites: [] })).toBeNull()
    expect(getPreferredSiteDestinations({ ...base, websiteProduct: null, sites: [] })).toEqual([])
  })

  it('prefers the subscribed franchise site and keeps its SSL custom domain', () => {
    const destinations = getPreferredSiteDestinations({
      ...base,
      websiteProduct: 'web_franchises_x',
      sites: [
        { type: 'web_marketplace_26', domain: 'marketplace.example.com', ssl_process_status: 'ended' },
        {
          type: 'franchiseweb',
          domain: 'shop.franchises.example.com',
          temporal_domain: 'demo.franchises.example.com',
          ssl_process_status: 'ended'
        }
      ]
    })
    expect(destinations).toEqual([
      { key: 'live', labelKey: 'LIVE_WEBSITE', url: 'https://shop.franchises.example.com' },
      { key: 'temporary', labelKey: 'TEMPORARY_WEBSITE', url: 'https://demo.franchises.example.com' }
    ])
  })

  it('keeps marketplace selection separate from franchise sites', () => {
    const destinations = getPreferredSiteDestinations({
      ...base,
      websiteProduct: 'web_marketplace_26',
      sites: [
        { type: 'franchiseweb', domain: 'franchise.example.com', ssl_process_status: 'ended' },
        {
          type: 'web_marketplace_26',
          domain: 'shop.example.com',
          temporal_domain: 'demo.example.com',
          ssl_process_status: 'ended'
        }
      ]
    })
    expect(destinations).toEqual([
      { key: 'live', labelKey: 'LIVE_WEBSITE', url: 'https://shop.example.com' },
      { key: 'temporary', labelKey: 'TEMPORARY_WEBSITE', url: 'https://v26-demo.example.com' }
    ])
  })
})

describe('getSubscribedWebsiteProduct', () => {
  it.each([
    ['active plan.plan.products', { status: 'active', plan: { plan: { products: [{ product: { builder_product_unit: 'web_franchises_x' } }] } } }],
    ['trialing plan.plan.products', { status: 'trialing', plan: { plan: { products: [{ product: { builder_product_unit: 'web_franchises_x' } }] } } }],
    ['plan.products', { status: 'active', plan: { products: [{ product: { builder_product_unit: 'web_franchises_x' } }] } }],
    ['addon products', { status: 'active', products: [{ enabled: true, product: { builder_product_unit: 'web_franchises_x' } }] }]
  ])('selects the franchise product from %s', (_, subscription) => {
    expect(getSubscribedWebsiteProduct([subscription])).toBe('web_franchises_x')
  })

  it('falls back to marketplace when franchise subscriptions are canceled or disabled', () => {
    expect(getSubscribedWebsiteProduct([
      {
        status: 'canceled',
        products: [{ product: { builder_product_unit: 'web_franchises_x' } }]
      },
      {
        status: 'active',
        products: [{ enabled: false, product: { builder_product_unit: 'web_franchises_x' } }]
      }
    ])).toBe('web_marketplace_26')
    expect(getSubscribedWebsiteProduct([])).toBe('web_marketplace_26')
  })
})

describe('getPreferredSiteDestinations', () => {
  const base = {
    configurations: { subdomain: 'example' },
    configs: { site_url: { value: 'https://stale.example.com' } },
    ordering: { project: 'demo' }
  }

  it('returns live only when SSL ended and the temporary host is the same', () => {
    const destinations = getPreferredSiteDestinations({
      ...base,
      sites: [
        {
          type: 'web_marketplace_26',
          domain: 'shop.example.com',
          temporal_domain: 'shop.example.com',
          ssl_process_status: 'ended'
        }
      ]
    })
    expect(destinations).toEqual([
      { key: 'live', labelKey: 'LIVE_WEBSITE', url: 'https://shop.example.com' }
    ])
  })

  it('returns temporary only when SSL is not ended', () => {
    const destinations = getPreferredSiteDestinations({
      ...base,
      sites: [
        {
          type: 'web_marketplace_26',
          temporal_domain: 'v26-demo.example.com',
          ssl_process_status: 'pending'
        }
      ]
    })
    expect(destinations).toEqual([
      { key: 'temporary', labelKey: 'TEMPORARY_WEBSITE', url: 'https://v26-demo.example.com' }
    ])
  })

  it('returns live and temporary when hosts differ', () => {
    const destinations = getPreferredSiteDestinations({
      ...base,
      sites: [
        {
          type: 'web_marketplace_26',
          domain: 'shop.tryordering.com',
          temporal_domain: 'v26-demo.example.com',
          ssl_process_status: 'ended'
        }
      ]
    })
    expect(destinations).toEqual([
      { key: 'live', labelKey: 'LIVE_WEBSITE', url: 'https://shop.example.com' },
      { key: 'temporary', labelKey: 'TEMPORARY_WEBSITE', url: 'https://v26-demo.example.com' }
    ])
  })

  it('ignores stale site_url', () => {
    const destinations = getPreferredSiteDestinations({
      ...base,
      sites: []
    })
    expect(destinations.map(item => item.url)).not.toContain('https://stale.example.com')
    expect(destinations).toEqual([
      { key: 'temporary', labelKey: 'TEMPORARY_WEBSITE', url: 'https://v26-demo.example.com' }
    ])
  })
})

describe('getDefaultTemporalSiteUrl', () => {
  const ordering = { project: 'demo' }
  const configurations = { subdomain: 'example' }

  it('uses temporal_domain when present', () => {
    expect(getDefaultTemporalSiteUrl({
      site: { temporal_domain: 'v26-demo.example.com' },
      ordering,
      configurations
    })).toBe('https://v26-demo.example.com')
  })

  it('uses the v26 host for marketplace sites', () => {
    expect(getDefaultTemporalSiteUrl({
      site: { type: 'web_marketplace_26' },
      ordering,
      configurations
    })).toBe('https://v26-demo.example.com')
  })

  it('discards known legacy or opposite-product platform hosts', () => {
    expect(getDefaultTemporalSiteUrl({
      site: { type: 'web_marketplace_26', temporal_domain: 'demo.example.com' },
      ordering,
      configurations
    })).toBe('https://v26-demo.example.com')
    expect(getDefaultTemporalSiteUrl({
      site: { type: 'franchiseweb', temporal_domain: 'v26-demo.example.com' },
      ordering,
      configurations,
      isFranchise: true
    })).toBe('https://demo.franchises.example.com')
  })

  it('preserves the temporal target for an explicitly selected site', () => {
    expect(getDefaultTemporalSiteUrl({
      site: { type: 'franchiseweb', temporal_domain: 'demo.example.com' },
      ordering,
      configurations,
      preserveExplicitSite: true
    })).toBe('https://demo.example.com')
  })

  it('returns null when project or subdomain is missing', () => {
    expect(getDefaultTemporalSiteUrl({
      site: { type: 'web_marketplace_26' },
      ordering: {},
      configurations
    })).toBeNull()
  })
})

describe('connectAccess helpers', () => {
  it.each([
    ['https://calendly.com/meet', undefined, true],
    ['https://WWW.CALENDLY.COM/meet', undefined, true],
    ['/meet', 'https://calendly.com', true],
    ['https://calendly.com/meet', 'legacy-root', true],
    ['//calendly.com/meet', 'https://plugin.test', true],
    ['//calendly.com/meet', undefined, true],
    ['/setup', 'https://square.test', false],
    ['https://calendly.com.example.org/setup', undefined, false],
    ['https://plugin.test/setup?next=calendly.com', undefined, false],
    ['not a url', undefined, false],
    [null, 'https://calendly.com', false]
  ])('identifies Calendly by hostname for %s with root %s', (url, root, expected) => {
    expect(isCalendlyUrl(url, root)).toBe(expected)
  })

  it('detects POS setup-call providers by name, plugin root, or key', () => {
    expect(isSetupCallIntegration({ name: 'ItsaCheckmate' })).toBe(true)
    expect(isSetupCallIntegration({ name: 'Deliverect POS' })).toBe(true)
    expect(isSetupCallIntegration({ plugin_root: 'deliverect_plugin' })).toBe(true)
    expect(isSetupCallIntegration({ plugin: { key: 'itsa_checkmate' } })).toBe(true)
    expect(isSetupCallIntegration({ name: 'Clover' })).toBe(false)
    expect(POS_SETUP_CALL_URL).toContain('calendly.com/mauricio-ordering')
  })

  it('opens POS & Menu Sync to admins and business owners', () => {
    expect(CONNECT_BUSINESS_OWNER_PAGES).toEqual(['pos_menu'])
    expect(getConnectAllowedLevels('pos_menu')).toEqual([0, 2])
  })

  it('keeps every other connect page admin only', () => {
    expect(getConnectAllowedLevels('connect_overview')).toEqual([0])
    expect(getConnectAllowedLevels('delivery_services')).toEqual([0])
    expect(getConnectAllowedLevels('importers')).toEqual([0])
    expect(getConnectAllowedLevels('sales_channels')).toEqual([0])
    expect(getConnectAllowedLevels(undefined)).toEqual([0])
  })
})
