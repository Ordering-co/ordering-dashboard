import { it, expect } from 'vitest'
import { onboardingWebsiteCandidates, onboardingWebsiteUrl } from '../storeOnboardingWebsite'
import { getRestaurantUrl } from '../storeOnboarding'
const root = 'https://api.orderingplus.com/v400/en/tenant'
const sites = [{ id: 34, code: 'website', url: 'https://tenant.orderingplus.com' }, { id: 133, type: 'franchiseweb', code: 'web_franchises_x', ssl_process_status: 'ended' }]
it('uses installed subscription identity, not catalog order or an unrelated app', () => {
  expect(onboardingWebsiteCandidates(sites, { websiteProduct: 'web_franchises_x', allowMarketplace: true })).toEqual([sites[1]])
  expect(onboardingWebsiteCandidates(sites, { websiteProduct: 'web_marketplace_26' })).toEqual([sites[0]])
  expect(onboardingWebsiteCandidates(sites, { websiteProduct: null })).toEqual([])
  expect(onboardingWebsiteCandidates(sites, { websiteProduct: 'unknown_product' })).toEqual([])
  expect(onboardingWebsiteCandidates([sites[0]], { websiteProduct: 'web_franchises_x', allowMarketplace: true })).toEqual([])
})
it('uses the same franchise temporal domain rule as My Products for both final link and preview', () => {
  const options = { root, websiteProduct: 'web_franchises_x', allowMarketplace: true }
  expect(onboardingWebsiteUrl(sites[1], options)).toBe('https://tenant.franchises.orderingplus.com')
  expect(getRestaurantUrl(sites, 'my restaurant', options)).toBe('https://tenant.franchises.orderingplus.com/store/my%20restaurant')
  expect(getRestaurantUrl([sites[0]], 'my restaurant', options)).toBeNull()
  expect(onboardingWebsiteUrl({ ...sites[1], temporal_domain: 'v26-tenant.orderingplus.com' }, options)).toBe('https://tenant.franchises.orderingplus.com')
  expect(onboardingWebsiteUrl({ ...sites[1], domain: 'live.example', temporal_domain: 'tenant.franchises.orderingplus.com' }, options)).toBe('https://live.example')
  expect(onboardingWebsiteUrl({ ...sites[1], domain: 'pending.example', ssl_process_status: 'pending' }, options)).toBe('https://tenant.franchises.orderingplus.com')
})
it('preserves explicit custom temporal domains and rejects credentials or unsafe URL schemes', () => {
  expect(onboardingWebsiteUrl({ ...sites[1], temporal_domain: 'custom.example' }, { root })).toBe('https://custom.example')
  for (const temporalDomain of ['javascript:alert(1)', 'https://user:pass@private.example', 'http://insecure.example']) expect(onboardingWebsiteUrl({ type: 'franchiseweb', temporal_domain: temporalDomain })).toBeNull()
})
it('rejects ambiguous installed websites regardless of catalog order without legacy fallback', () => {
  const pending = { ...sites[1], id: 100, ssl_process_status: 'pending' }
  const ready = { ...sites[1], id: 133, domain: 'live-franchise.example' }
  const options = { root, websiteProduct: 'web_franchises_x', allowMarketplace: true }
  for (const candidates of [[pending, ready], [ready, pending]]) expect(getRestaurantUrl(candidates, 'restaurant', options)).toBeNull()
  expect(getRestaurantUrl([pending], 'restaurant', options)).toBe('https://tenant.franchises.orderingplus.com/store/restaurant')
  expect(getRestaurantUrl([ready], 'restaurant', options)).toBe('https://live-franchise.example/store/restaurant')
  expect(getRestaurantUrl([pending, ready], 'restaurant', { root })).toBeNull()
  expect(getRestaurantUrl([{ ...sites[0], id: 1 }, { ...sites[0], id: 2 }], 'restaurant', { root, websiteProduct: 'web_marketplace_26' })).toBeNull()
})
