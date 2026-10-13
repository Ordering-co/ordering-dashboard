import { describe, expect, it } from 'vitest'
import { buildSettingsHub } from '../settingsIa'
import {
  buildDashboardDestinationCatalog,
  buildDashboardDestinationPath,
  normalizeDashboardSearchRequest,
  resolveDashboardDestination,
  toDashboardEnvelope,
  toDashboardEnvelopeItem
} from '../dashboardDestinations'

const settingsHub = buildSettingsHub({
  categoryLists: {
    key_basic: [{
      id: 1,
      key: 'stripe',
      name: 'Payments',
      configs: [{ key: 'stripe_publishable', name: 'Stripe publishable key' }]
    }]
  },
  configs: {}
})

describe('buildDashboardDestinationCatalog', () => {
  it('shares navigation, dynamic Settings and integration entries in one catalog', () => {
    const catalog = buildDashboardDestinationCatalog({
      user: { id: 1, level: 0, user_system_id: 1 },
      configs: {},
      project: 'demo',
      settingsHub,
      integrations: [{ type: 'pos', name: 'Toast', key: 'toast' }]
    })

    expect(resolveDashboardDestination(catalog, 'nav:orders')?.path).toBe('/orders')
    expect(resolveDashboardDestination(catalog, 'settings-field:stripe_publishable')?.path)
      .toBe('/settings?group=payments&category=stripe&focus=stripe_publishable')
    expect(resolveDashboardDestination(catalog, 'integration:pos:toast')).toMatchObject({
      requires: 'business',
      target: 'pos_menu'
    })
  })

  it('keeps Settings hidden from owners and read-only admins', () => {
    const owner = buildDashboardDestinationCatalog({ user: { id: 2, level: 2 }, settingsHub })
    const readOnlyAdmin = buildDashboardDestinationCatalog({
      user: { id: 3, level: 0, readOnlyAdmin: true },
      settingsHub
    })

    expect(owner.settingsEntries).toEqual([])
    expect(readOnlyAdmin.settingsEntries).toEqual([])
    expect(resolveDashboardDestination(owner, 'nav:settings')).toBeNull()
  })

  it('does not expose paths in destination metadata and only builds canonical routes', () => {
    const catalog = buildDashboardDestinationCatalog({ user: { id: 1, level: 0 }, configs: {} })
    const entry = resolveDashboardDestination(catalog, 'nav:orders')
    const item = toDashboardEnvelopeItem(entry)

    expect(item).toMatchObject({ id: 'nav:orders', title: entry.title })
    expect(item).not.toHaveProperty('path')
    expect(buildDashboardDestinationPath(entry)).toBe('/orders')
    expect(resolveDashboardDestination(catalog, 'https://example.test')).toBeNull()
  })
})

describe('Dashboard destination protocol bounds', () => {
  it('accepts whitelisted search parameters and rejects oversized or invalid values', () => {
    expect(normalizeDashboardSearchRequest({
      query: ' orders ',
      business_query: ' Main ',
      destination_id: 'nav:orders',
      business_id: 12
    })).toEqual({
      query: 'orders',
      business_query: 'Main',
      destination_id: 'nav:orders',
      business_id: 12
    })
    expect(() => normalizeDashboardSearchRequest({ query: '', path: '/evil' })).toThrow('INVALID_SEARCH_FIELD')
    expect(() => normalizeDashboardSearchRequest({ query: 'x'.repeat(201) })).toThrow('QUERY_TOO_LONG')
    expect(() => normalizeDashboardSearchRequest({ query: '', business_query: 'x'.repeat(121) })).toThrow('BUSINESS_QUERY_TOO_LONG')
    expect(() => normalizeDashboardSearchRequest({ query: '', destination_id: 'x'.repeat(161) })).toThrow('DESTINATION_ID_TOO_LONG')
    expect(() => normalizeDashboardSearchRequest({ query: '', business_id: 2147483648 })).toThrow('INVALID_BUSINESS_ID')
  })

  it('requires object input and a string query while permitting the empty chooser query', () => {
    for (const input of [null, [], 'orders', {}, { query: 1 }, { query: null }, { query: '', business_query: null }, { query: '', destination_id: 7 }, { query: '', business_id: '12' }]) {
      expect(() => normalizeDashboardSearchRequest(input)).toThrow()
    }
    expect(normalizeDashboardSearchRequest({ query: '', destination_id: 'integration:pos:toast', business_query: '' }))
      .toEqual({ query: '', business_query: '', destination_id: 'integration:pos:toast' })
  })

  it('bounds envelope count, text and error metadata', () => {
    const result = toDashboardEnvelope({
      scope: 'opaque',
      revision: 'r1',
      items: Array.from({ length: 15 }, (_, index) => ({
        id: `item:${index}`,
        title: 'x'.repeat(200),
        subtitle: 'y'.repeat(300),
        path: '/not-included'
      })),
      errors: ['NETWORK']
    })

    expect(result.items).toHaveLength(12)
    expect(result.items[0].title).toHaveLength(160)
    expect(result.items[0].subtitle).toHaveLength(240)
    expect(result.items[0]).not.toHaveProperty('path')
  })

  it('marks store-dependent actions and only accepts bounded business ids', () => {
    const entry = resolveDashboardDestination(buildDashboardDestinationCatalog({
      user: { id: 1, level: 0 },
      integrations: [{ type: 'pos', name: 'Toast' }]
    }), 'integration:pos:toast')

    expect(toDashboardEnvelopeItem(entry, { requiresBusiness: true })).toMatchObject({
      id: 'integration:pos:toast',
      requires_business: true
    })
    expect(toDashboardEnvelopeItem(entry, { businessId: 2147483648 }).params).toBeUndefined()
  })
})
