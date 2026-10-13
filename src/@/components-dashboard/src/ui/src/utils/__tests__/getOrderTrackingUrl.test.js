import { describe, expect, it } from 'vitest'

import {
  findTrackingDomainOption,
  getDefaultTrackingDomain,
  getOrderTrackingUrl,
  getTrackingDomainOptions,
  getTrackingDomainStorageKey,
  normalizeTrackingDomain,
  readStoredTrackingDomain
} from '../getOrderTrackingUrl'

const base = {
  configurations: { subdomain: 'orderingplus' },
  ordering: { project: 'rokys' }
}

describe('normalizeTrackingDomain', () => {
  it('returns null for empty or invalid values', () => {
    expect(normalizeTrackingDomain('')).toBeNull()
    expect(normalizeTrackingDomain('   ')).toBeNull()
    expect(normalizeTrackingDomain(undefined)).toBeNull()
    expect(normalizeTrackingDomain('http://')).toBeNull()
  })

  it('adds https and strips the trailing slash', () => {
    expect(normalizeTrackingDomain('tracking.example.com')).toBe('https://tracking.example.com')
    expect(normalizeTrackingDomain('https://tracking.example.com/')).toBe('https://tracking.example.com')
    expect(normalizeTrackingDomain('  http://tracking.example.com  ')).toBe('http://tracking.example.com')
  })

  it('keeps a subpath and drops query or hash', () => {
    expect(normalizeTrackingDomain('https://x.com/track/')).toBe('https://x.com/track')
    expect(normalizeTrackingDomain('https://x.com/track?a=1#b')).toBe('https://x.com/track')
  })
})

describe('getDefaultTrackingDomain', () => {
  it('uses the custom domain when its SSL is ready', () => {
    const domain = getDefaultTrackingDomain({
      ...base,
      sites: [{ type: 'web_marketplace_26', domain: 'shop.rokys.com', temporal_domain: 'v26-rokys.tryordering.com', ssl_process_status: 'ended' }]
    })
    expect(domain).toBe('https://shop.rokys.com')
  })

  it('skips the custom domain while its SSL is pending', () => {
    const domain = getDefaultTrackingDomain({
      ...base,
      sites: [{ type: 'web_marketplace_26', domain: 'shop.rokys.com', temporal_domain: 'v26-rokys.tryordering.com', ssl_process_status: 'pending' }]
    })
    expect(domain).toBe('https://v26-rokys.orderingplus.com')
  })

  it('builds the v26 host when the preferred site is the marketplace v26', () => {
    const domain = getDefaultTrackingDomain({
      ...base,
      sites: [{ type: 'web_marketplace_26', ssl_process_status: 'pending' }]
    })
    expect(domain).toBe('https://v26-rokys.orderingplus.com')
  })

  it('uses the temporal domain of the preferred site when present', () => {
    const domain = getDefaultTrackingDomain({
      ...base,
      sites: [{ type: 'web_marketplace_26', temporal_domain: 'v26-rokys.tryordering.com/' }]
    })
    expect(domain).toBe('https://v26-rokys.orderingplus.com')
  })

  it('builds the franchise host for franchise sites', () => {
    const domain = getDefaultTrackingDomain({
      ...base,
      websiteProduct: 'web_franchises_x',
      sites: [{ type: 'franchiseweb' }]
    })
    expect(domain).toBe('https://rokys.franchises.orderingplus.com')
  })

  it('builds the v26 host when there are no marketplace sites', () => {
    expect(getDefaultTrackingDomain({ ...base, sites: [] })).toBe('https://v26-rokys.orderingplus.com')
    expect(getDefaultTrackingDomain({ ...base })).toBe('https://v26-rokys.orderingplus.com')
  })

  it('returns null without project or subdomain', () => {
    expect(getDefaultTrackingDomain({ sites: [], configurations: {}, ordering: {} })).toBeNull()
    expect(getDefaultTrackingDomain({ sites: [], configurations: { subdomain: 'orderingplus' }, ordering: {} })).toBeNull()
  })

  it('returns null while the website product is unresolved', () => {
    expect(getDefaultTrackingDomain({ ...base, websiteProduct: null, sites: [] })).toBeNull()
  })
})

describe('getTrackingDomainOptions', () => {
  it('lists the default first and then every site domain without duplicates', () => {
    const sites = [
      { id: 1, name: 'Marketplace', type: 'web_marketplace_26', domain: 'shop.rokys.com', temporal_domain: 'v26-rokys.tryordering.com', ssl_process_status: 'ended' },
      { id: 2, name: 'Old website', code: 'website', domain: 'shop.rokys.com', temporal_domain: 'rokys.tryordering.com' },
      { id: 3, name: 'No domains', type: 'app' }
    ]
    const options = getTrackingDomainOptions({ ...base, sites })
    expect(options.map(option => option.key)).toEqual(['default', 'site-1-temporal', 'site-2-temporal'])
    expect(options.map(option => option.url)).toEqual([
      'https://shop.rokys.com',
      'https://v26-rokys.orderingplus.com',
      'https://rokys.orderingplus.com'
    ])
    expect(options[0].site).toBeNull()
    expect(options[1].site.name).toBe('Marketplace')
  })

  it('only offers the default when there are no sites', () => {
    const options = getTrackingDomainOptions({ ...base, sites: [] })
    expect(options).toEqual([{ key: 'default', url: 'https://v26-rokys.orderingplus.com', site: null }])
  })

  it('keeps explicit domains from both site families when the product is unresolved', () => {
    const sites = [
      {
        id: 1,
        name: 'Marketplace',
        type: 'web_marketplace_26',
        domain: 'shop.rokys.com',
        temporal_domain: 'legacy-marketplace.rokys.com'
      },
      {
        id: 2,
        name: 'Franchise',
        type: 'franchiseweb',
        domain: 'shop.franchise.rokys.com',
        temporal_domain: 'legacy-franchise.rokys.com'
      }
    ]
    const options = getTrackingDomainOptions({ ...base, sites, websiteProduct: null })

    expect(options.map(option => option.key)).toEqual([
      'site-1-domain',
      'site-1-temporal',
      'site-2-domain',
      'site-2-temporal'
    ])
    expect(options.map(option => option.url)).toEqual([
      'https://shop.rokys.com',
      'https://legacy-marketplace.rokys.com',
      'https://shop.franchise.rokys.com',
      'https://legacy-franchise.rokys.com'
    ])
  })
})

describe('findTrackingDomainOption', () => {
  const options = getTrackingDomainOptions({
    ...base,
    sites: [{ id: 1, name: 'Marketplace', type: 'web_marketplace_26', domain: 'shop.rokys.com' }]
  })

  it('matches by host ignoring protocol and trailing slash', () => {
    expect(findTrackingDomainOption(options, 'http://shop.rokys.com/').key).toBe('site-1-domain')
    expect(findTrackingDomainOption(options, 'https://v26-rokys.orderingplus.com').key).toBe('default')
  })

  it('returns null for unknown or empty urls', () => {
    expect(findTrackingDomainOption(options, 'https://tracking.example.com')).toBeNull()
    expect(findTrackingDomainOption(options, '')).toBeNull()
  })
})

describe('getTrackingDomainStorageKey', () => {
  it('namespaces the key by project', () => {
    expect(getTrackingDomainStorageKey('rokys')).toBe('tracking_domain:rokys')
    expect(getTrackingDomainStorageKey()).toBe('tracking_domain:default')
  })
})

describe('getOrderTrackingUrl', () => {
  const order = { uuid: '7d53a28a-8256-44ae-8a55-2f1814610d2b', hash_key: '05548530de54' }

  it('keeps the order path and hash', () => {
    expect(getOrderTrackingUrl({ domain: 'https://tracking.example.com', order }))
      .toBe('https://tracking.example.com/orders/7d53a28a-8256-44ae-8a55-2f1814610d2b?hash=05548530de54')
  })

  it('returns null without domain, uuid or hash', () => {
    expect(getOrderTrackingUrl({ domain: null, order })).toBeNull()
    expect(getOrderTrackingUrl({ domain: 'https://x.com', order: { uuid: order.uuid } })).toBeNull()
    expect(getOrderTrackingUrl({ domain: 'https://x.com', order: { hash_key: order.hash_key } })).toBeNull()
  })
})

describe('readStoredTrackingDomain', () => {
  const storageWith = (values) => ({ getItem: (key) => values[key] ?? null })

  it('prefers the per-project value over the legacy global one', () => {
    const storage = storageWith({ 'tracking_domain:rokys': 'https://new.rokys.com', tracking_domain: 'https://old.example.com' })
    expect(readStoredTrackingDomain(storage, 'rokys')).toBe('https://new.rokys.com')
  })

  it('falls back to the legacy global value saved by the previous version', () => {
    const storage = storageWith({ tracking_domain: 'https://old.example.com' })
    expect(readStoredTrackingDomain(storage, 'rokys')).toBe('https://old.example.com')
  })

  it('ignores the legacy value once the project explicitly chose the default', () => {
    const storage = storageWith({ 'tracking_domain:rokys': 'default', tracking_domain: 'https://old.example.com' })
    expect(readStoredTrackingDomain(storage, 'rokys')).toBe('')
  })

  it('returns an empty string when nothing is stored or storage fails', () => {
    expect(readStoredTrackingDomain(storageWith({}), 'rokys')).toBe('')
    expect(readStoredTrackingDomain({ getItem: () => { throw new Error('blocked') } }, 'rokys')).toBe('')
    expect(readStoredTrackingDomain(undefined, 'rokys')).toBe('')
  })
})
