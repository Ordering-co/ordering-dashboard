import { describe, expect, it } from 'vitest'
import {
  buildNavigationEntries,
  buildSettingsHubEntries,
  buildStaticSettingsEntries,
  canOpenSettings
} from '../commandPaletteCatalog'
import { buildSettingsHub } from '../settingsIa'
import { rankCommandEntries } from '../commandPaletteSearch'

const ids = (entries) => entries.map(entry => entry.id)

describe('buildNavigationEntries', () => {
  it('gives the admin sidebar and footer destinations with aliases', () => {
    const entries = buildNavigationEntries({ user: { level: 0, user_system_id: 1 }, configs: {} })
    expect(ids(entries)).toEqual(expect.arrayContaining(['nav:home', 'nav:orders', 'nav:businesses', 'nav:customers', 'nav:settings', 'nav:open_source_code', 'nav:purchase_addons']))
    const stores = entries.find(entry => entry.id === 'nav:businesses')
    expect(stores.path).toBe('/stores/list')
    expect(stores.aliases).toContain('negocios')
    const sourceCode = entries.find(entry => entry.id === 'nav:open_source_code')
    expect(sourceCode.path).toBe('/open-source-code')
    expect(rankCommandEntries(entries, 'codigo fuente')[0].id).toBe('nav:open_source_code')
  })

  it('drops destinations that the route guard would reject', () => {
    const entries = buildNavigationEntries({ user: { level: 2 }, configs: {} })
    expect(ids(entries)).toEqual(expect.arrayContaining(['nav:orders', 'nav:businesses', 'nav:store']))
    expect(ids(entries)).not.toContain('nav:devices')
    expect(ids(entries)).not.toContain('nav:customers')
    expect(ids(entries)).not.toContain('nav:settings')
    expect(ids(entries)).not.toContain('nav:open_source_code')
  })

  it('gives drivers managers only their pages', () => {
    const entries = buildNavigationEntries({ user: { level: 5 }, configs: {} })
    expect(ids(entries)).not.toContain('nav:home')
    expect(ids(entries)).not.toContain('nav:messages')
    expect(ids(entries)).not.toContain('nav:open_source_code')
    expect(ids(entries)).toContain('nav:delivery_drivers')
  })

  it('finds Connect pages by the integrations they offer', () => {
    const entries = buildNavigationEntries({ user: { level: 0 }, configs: {} })
    expect(rankCommandEntries(entries, 'deliverect')[0].id).toBe('nav:pos_menu')
    expect(rankCommandEntries(entries, 'gloriafood')[0].id).toBe('nav:importers')
    expect(rankCommandEntries(entries, 'lalamove')[0].id).toBe('nav:delivery_services')
    expect(rankCommandEntries(entries, 'uber eats').map(entry => entry.id)).toEqual(expect.arrayContaining(['nav:importers', 'nav:sales_channels']))
  })

  it('resolves a Spanish alias', () => {
    const entries = buildNavigationEntries({ user: { level: 0 }, configs: {} })
    expect(rankCommandEntries(entries, 'clientes')[0].id).toBe('nav:customers')
  })
})

describe('canOpenSettings', () => {
  it('is for editing admins only', () => {
    expect(canOpenSettings({ level: 0 })).toBe(true)
    expect(canOpenSettings({ level: 0, readOnlyAdmin: true })).toBe(false)
    expect(canOpenSettings({ level: 2 })).toBe(false)
  })
})

describe('buildStaticSettingsEntries', () => {
  it('lists groups and special screens with hub links', () => {
    const entries = buildStaticSettingsEntries()
    const payments = entries.find(entry => entry.id === 'settings-group:payments')
    expect(payments.path).toBe('/settings?group=payments')
    expect(ids(entries)).not.toContain('settings-group:more')
    const developers = entries.find(entry => entry.id === 'settings-section:developers')
    expect(developers.path).toBe('/settings?group=developers&category=developers')
    expect(rankCommandEntries(entries, 'pagos')[0].id).toBe('settings-group:payments')
  })
})

describe('buildSettingsHubEntries', () => {
  const categoryLists = {
    key_basic: [{
      id: 1,
      key: 'stripe',
      name: 'Stripe',
      configs: [
        { key: 'stripe_publishable', name: 'Stripe publishable key', rank: 1 },
        { key: 'general_hour_format', name: 'Hidden hour format', rank: 2 }
      ]
    }],
    key_addon: [{ id: 2, key: 'addon_gift_cards', name: 'Gift cards', configs: [{ key: 'gift_card_x', name: 'Gift card x' }] }]
  }

  it('links fields to the canonical editor with focus', () => {
    const hub = buildSettingsHub({ categoryLists, configs: {} })
    const entries = buildSettingsHubEntries({ hub })
    const field = entries.find(entry => entry.id === 'settings-field:stripe_publishable')
    expect(field.path).toBe('/settings?group=payments&category=stripe&focus=stripe_publishable')
    expect(ids(entries)).toContain('settings-task:stripe_keys')
    expect(rankCommandEntries(entries, 'tarjeta').map(entry => entry.id)).toContain('settings-field:stripe_publishable')
  })

  it('keeps hidden configs out and lists addon sections for every project', () => {
    const entries = buildSettingsHubEntries({ hub: buildSettingsHub({ categoryLists, configs: {} }) })
    expect(ids(entries)).not.toContain('settings-field:general_hour_format')
    expect(ids(entries)).toContain('settings-section:addon_gift_cards')
  })

  it('indexes WhatsApp support under developers', () => {
    const hub = buildSettingsHub({
      categoryLists: {
        key_pro: [{
          id: 9,
          key: 'pro_integrations',
          name: 'Integrations',
          configs: [],
          children: [{
            id: 10,
            key: 'whatsapp_support',
            name: 'WhatsApp support',
            configs: [
              { key: 'whatsapp_support_enabled', name: 'WhatsApp support button', rank: 1 },
              { key: 'whatsapp_support_phone', name: 'WhatsApp phone number', rank: 2 }
            ]
          }]
        }]
      },
      configs: {}
    })
    const entries = buildSettingsHubEntries({ hub })
    const section = entries.find(entry => entry.id === 'settings-section:whatsapp_support')
    expect(section.path).toBe('/settings?group=developers&category=whatsapp_support')
    expect(rankCommandEntries(entries, 'whatsapp')[0].id).toBe('settings-section:whatsapp_support')
  })

  it('handles an empty hub', () => {
    expect(buildSettingsHubEntries({ hub: null })).toEqual([])
  })
})
