import { describe, expect, it } from 'vitest'
import { buildDeliveryCompaniesUrl, buildIntegrationEntries } from '../commandPaletteIntegrations'
import { rankCommandEntries } from '../commandPaletteSearch'

const integrations = [
  { id: 1, name: 'Simphony', type: 'pos', logo: 'simphony.png' },
  { id: 2, name: 'Wansoft', type: 'pos' },
  { id: 3, name: 'Clover', type: 'pos' },
  { id: 4, name: 'clover', type: 'pos' },
  { id: 5, name: 'Rappi', type: 'sales_channel' },
  { id: 6, name: 'Uber Eats', type: 'sales_channel' },
  { id: 7, name: '', type: 'pos' },
  { id: 8, name: 'Other', type: 'unknown' }
]
const deliveryCompanies = [
  { id: 1, name: 'Doordash' },
  { id: 34, name: 'Uber Direct' },
  { id: 67, name: 'Shipday' },
  { name: 'No id' }
]
const allowAll = () => true

describe('buildIntegrationEntries', () => {
  it('indexes API providers by name with the Connect page they belong to', () => {
    const entries = buildIntegrationEntries({ can: allowAll, integrations, deliveryCompanies })
    const byId = Object.fromEntries(entries.map(entry => [entry.id, entry]))
    expect(byId['integration:pos:simphony']).toMatchObject({ requires: 'business', target: 'pos_menu', logo: 'simphony.png' })
    expect(byId['integration:sales_channel:rappi']).toMatchObject({ requires: 'business', target: 'sales_channels' })
    expect(byId['integration:delivery:67'].path).toBe('/connect/delivery-services?id=67')
    expect(entries.filter(entry => entry.id === 'integration:pos:clover')).toHaveLength(1)
    expect(entries.some(entry => entry.title === 'Other' || entry.title === 'No id')).toBe(false)
    expect(rankCommandEntries(entries, 'shipday')[0].id).toBe('integration:delivery:67')
    expect(rankCommandEntries(entries, 'wansoft')[0].id).toBe('integration:pos:wansoft')
  })

  it('only offers the Connect pages the user can open', () => {
    const posOnly = buildIntegrationEntries({ can: url => url === '/connect/pos-menu', integrations, deliveryCompanies })
    expect(posOnly.every(entry => entry.id.startsWith('integration:pos:'))).toBe(true)
    expect(buildIntegrationEntries({ integrations, deliveryCompanies })).toEqual([])
    expect(buildIntegrationEntries({ can: allowAll, integrations: null, deliveryCompanies: null })).toEqual([])
  })

  it('builds the delivery companies request like the Connect page', () => {
    expect(buildDeliveryCompaniesUrl('https://api.test')).toBe('https://api.test/driver_companies?where=[{"attribute":"owner_type","value":"system"}]')
  })
})

describe('builder apps', () => {
  it('lists My products apps for editing admins only', () => {
    const apps = [{ id: 9, name: 'Driver App' }, { name: 'No id' }]
    const entries = buildIntegrationEntries({ builderApps: apps, canMyProducts: true })
    expect(entries).toEqual([expect.objectContaining({ id: 'product-app:9', path: '/my-products?id=9', group: 'navigation' })])
    expect(buildIntegrationEntries({ builderApps: apps })).toEqual([])
  })
})
