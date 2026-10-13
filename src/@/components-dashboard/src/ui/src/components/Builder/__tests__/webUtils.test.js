import { describe, expect, it } from 'vitest'

import {
  BUILDER_TYPE_OPTIONS,
  getDomainErrorMessage,
  getDomainUrl,
  getOwnDomainError,
  getProductDomains,
  getRecordName,
  getProductKind,
  getTypeFilterLabel,
  getTypeLabel,
  isRootDomain,
  normalizeDomain,
  sortCatalogBases
} from '../utils'

describe('Builder website helpers', () => {
  it('names the website types', () => {
    expect(getTypeLabel('marketplace_website')).toBe('Marketplace website')
    expect(getTypeLabel('franchise_website')).toBe('Franchise website')
    expect(getTypeLabel('dashboard')).toBe('Dashboard')
    expect(BUILDER_TYPE_OPTIONS.filter(option => option.kind === 'web').map(option => option.value))
      .toEqual(['marketplace_website', 'franchise_website', 'dashboard'])
  })

  it('reads the kind from the product, else from its type', () => {
    expect(getProductKind({ kind: 'web', product_type: 'marketplace_app' })).toBe('web')
    expect(getProductKind({ product_type: 'dashboard' })).toBe('web')
    expect(getProductKind({ product_type: 'driver_app' })).toBe('app')
    expect(getProductKind(null)).toBe('app')
  })

  it('lists its own domain before the temporary one', () => {
    expect(getProductDomains({ domain: null, temporal_domain: 'abc-stores.my-sites.app' }))
      .toEqual([{ domain: 'abc-stores.my-sites.app', temporary: true }])
    expect(getProductDomains({ domain: 'shop.brand.com', temporal_domain: 'abc-stores.my-sites.app' }).map(item => item.domain))
      .toEqual(['shop.brand.com', 'abc-stores.my-sites.app'])
    expect(getProductDomains({ domain: null, temporal_domain: null })).toEqual([])
  })

  it('links a domain over https unless it brings its scheme', () => {
    expect(getDomainUrl('abc-stores.my-sites.app')).toBe('https://abc-stores.my-sites.app')
    expect(getDomainUrl('http://localhost:8787')).toBe('http://localhost:8787')
  })

  it('says what the type filter shows', () => {
    expect(getTypeFilterLabel([])).toBe('All')
    expect(getTypeFilterLabel(['dashboard'])).toBe('Dashboard')
    expect(getTypeFilterLabel(['marketplace_website', 'franchise_website', 'dashboard'])).toBe('Websites')
    expect(getTypeFilterLabel(['marketplace_app', 'franchise_app', 'store_app', 'driver_app', 'kiosk_app'])).toBe('Apps')
    expect(getTypeFilterLabel(['driver_app', 'dashboard'])).toBe('2 types')
  })

  it('keeps the apps before the websites in the catalog', () => {
    const catalog = [
      { id: null, product_type: 'dashboard', kind: 'web' },
      { id: 14, product_type: 'driver_app', kind: 'app' },
      { id: null, product_type: 'marketplace_website', kind: 'web' },
      { id: 11, product_type: 'marketplace_app', kind: 'app' }
    ]
    expect(sortCatalogBases(catalog).map(item => item.product_type))
      .toEqual(['marketplace_app', 'driver_app', 'marketplace_website', 'dashboard'])
  })
})

describe('Builder own domain helpers', () => {
  it('keeps the host of what was typed, as the API does', () => {
    expect(normalizeDomain(' https://Shop.Example.com/menu?x=1 ')).toBe('shop.example.com')
    expect(normalizeDomain('www.brand.com.')).toBe('www.brand.com')
    expect(normalizeDomain('shop.brand.com:443')).toBe('shop.brand.com')
    expect(normalizeDomain(null)).toBe('')
  })

  it('tells a root domain from a subdomain', () => {
    expect(isRootDomain('burgertown.com')).toBe(true)
    expect(isRootDomain('https://burgertown.com.mx/')).toBe(true)
    expect(isRootDomain('brand.co.uk')).toBe(true)
    expect(isRootDomain('shop.burgertown.com')).toBe(false)
    expect(isRootDomain('www.brand.com.mx')).toBe(false)
    expect(isRootDomain('localhost')).toBe(false)
  })

  it('names the CNAME record by what comes before the domain', () => {
    expect(getRecordName('shop.burgertown.com')).toBe('shop')
    expect(getRecordName('order.shop.brand.com.mx')).toBe('order.shop')
    expect(getRecordName('burgertown.com')).toBe('')
  })

  it('says what a refused domain needs, in the field or in a banner', () => {
    expect(getDomainErrorMessage(['domain.required'])).toEqual({ message: 'Enter a domain.', inField: true })
    expect(getDomainErrorMessage(['domain.max']).message).toBe('Enter a valid domain, like www.yourbrand.com.')
    expect(getDomainErrorMessage(['domain.taken']).message).toBe('This domain is already used by another website.')
    expect(getDomainErrorMessage(['domain.cname_missing'], 'shop.burgertown.com').message).toBe('We couldn’t find a CNAME record for shop.burgertown.com.')
    expect(getDomainErrorMessage(['domain.cname_missing'], 'burgertown.com').message).toBe('burgertown.com is a root domain, and a root domain can’t have a CNAME record.')
    expect(getDomainErrorMessage(['domain.unsupported'])).toEqual({ message: 'This website’s domain is managed by support. Contact support to change it.', inField: false })
    expect(getDomainErrorMessage(['save.failed'])).toEqual({ message: 'We couldn’t save the domain. Try again.', inField: false })
  })

  it('explains each failure of an own domain', () => {
    expect(getOwnDomainError('create_failed', 'shop.burgertown.com').title).toBe('shop.burgertown.com wasn’t accepted')
    expect(getOwnDomainError('hostname_not_found', 'shop.burgertown.com').title).toBe('The setup of shop.burgertown.com was lost')
    expect(getOwnDomainError('validation_timeout', 'shop.burgertown.com').title).toBe('We couldn’t verify shop.burgertown.com in time')
    expect(getOwnDomainError(null, 'shop.burgertown.com').title).toBe('We couldn’t verify shop.burgertown.com in time')
  })
})
