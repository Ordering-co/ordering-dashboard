import { describe, expect, it, vi } from 'vitest'
import {
  POS_PLUGIN_CATALOG,
  findConnectedPosIntegration,
  findInstalledIntegration,
  getPluginSetupPath,
  getPosCatalogItem,
  isCatalogIntegration,
  mergePosIntegrationsWithCatalog,
  waitForInstalledIntegration
} from '../posPluginCatalog'

describe('posPluginCatalog', () => {
  it('covers the POS integrations a new project can install in one click', () => {
    expect(POS_PLUGIN_CATALOG.map(item => item.key)).toEqual([
      'square_pos_integration',
      'clover_integration',
      'simphony_integration',
      'wansoft_integration'
    ])
    expect(getPosCatalogItem('square_pos_integration').installUrl).toBe('https://square-pos.plugins.orderingplus.com')
    expect(getPosCatalogItem('deliverect')).toBeNull()
  })

  it('adds installable rows for the POS integrations the project does not have yet', () => {
    const merged = mergePosIntegrationsWithCatalog([])

    expect(merged).toHaveLength(4)
    expect(merged[0]).toMatchObject({
      id: 'catalog:square_pos_integration',
      key: 'square_pos_integration',
      name: 'Square',
      type: 'pos',
      plugin_id: null,
      plugin_root: 'https://square-pos.plugins.orderingplus.com',
      source: 'catalog'
    })
    expect(merged.every(isCatalogIntegration)).toBe(true)
  })

  it('keeps the API rows and only fills in the missing ones', () => {
    const clover = { id: 364, key: 'clover_integration', name: 'Clover', plugin_id: null, plugin_root: 'https://clover.plugins.orderingplus.com' }
    const square = { id: 430, key: 'square_pos_integration', name: 'Square POS Integration', plugin_id: 2477 }
    const custom = { id: 9, key: 'custom_pos', name: 'Custom POS', plugin_id: 12 }

    const merged = mergePosIntegrationsWithCatalog([clover, square, custom])

    expect(merged.slice(0, 3)).toEqual([clover, square, custom])
    expect(merged.slice(3).map(item => item.key)).toEqual(['simphony_integration', 'wansoft_integration'])
    expect(merged.filter(item => item.key === 'clover_integration')).toHaveLength(1)
  })

  it('tolerates a missing integrations list', () => {
    expect(mergePosIntegrationsWithCatalog(undefined)).toHaveLength(4)
    expect(mergePosIntegrationsWithCatalog(null)).toHaveLength(4)
  })

  it('uses the setup link when the plugin has no setup_url', () => {
    expect(getPluginSetupPath({ setup_url: '/views/setup' })).toBe('/views/setup')
    expect(getPluginSetupPath({ setup_url: null, links: { setup: '/views/setup?b=1' } })).toBe('/views/setup?b=1')
    expect(getPluginSetupPath({ links: { general_settings: '/views/settings' } })).toBeNull()
    expect(getPluginSetupPath(null)).toBeNull()
  })
})

describe('waitForInstalledIntegration', () => {
  const pending = { id: 1, key: 'simphony_integration', plugin_id: null, plugin_root: 'https://simphony.test' }
  const ready = { ...pending, plugin_id: 7 }

  it('waits until the plugin finishes linking itself to the integration', async () => {
    const responses = [[pending], [pending], [ready]]
    const loadIntegrations = vi.fn(async () => responses.shift())
    const sleep = vi.fn(async () => {})

    const installed = await waitForInstalledIntegration(loadIntegrations, { key: 'simphony_integration' }, { sleep })

    expect(installed).toEqual(ready)
    expect(loadIntegrations).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(1500)
  })

  it('gives up after the last attempt without sleeping again', async () => {
    const loadIntegrations = vi.fn(async () => [pending])
    const sleep = vi.fn(async () => {})

    const installed = await waitForInstalledIntegration(loadIntegrations, { key: 'simphony_integration' }, { attempts: 3, sleep })

    expect(installed).toBeNull()
    expect(loadIntegrations).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('matches by plugin root when the integration has no key', async () => {
    const installed = await waitForInstalledIntegration(async () => [{ id: 2, plugin_id: 9, plugin_root: 'https://custom.test' }], { pluginRoot: 'https://custom.test' })
    expect(installed).toMatchObject({ id: 2 })
    expect(findInstalledIntegration([{ id: 2, plugin_id: null, plugin_root: 'https://custom.test' }], { pluginRoot: 'https://custom.test' })).toBeNull()
  })
})

describe('findConnectedPosIntegration', () => {
  const integrations = [
    { id: 133, type: 'pos', name: 'Simphony' },
    { id: 67, type: 'sales_channel', name: 'Rappi' },
    { id: 'catalog:square_pos_integration', type: 'pos', name: 'Square' }
  ]

  it('returns the POS the store is already connected to', () => {
    const business = { third_party_integrations: [{ third_party_integration_id: 67 }, { third_party_integration_id: 133 }] }
    expect(findConnectedPosIntegration(business, integrations)).toMatchObject({ id: 133, name: 'Simphony' })
  })

  it('ignores sales channels and stores without a POS', () => {
    expect(findConnectedPosIntegration({ third_party_integrations: [{ third_party_integration_id: 67 }] }, integrations)).toBeNull()
    expect(findConnectedPosIntegration({ third_party_integrations: [] }, integrations)).toBeNull()
    expect(findConnectedPosIntegration(null, integrations)).toBeNull()
  })
})
