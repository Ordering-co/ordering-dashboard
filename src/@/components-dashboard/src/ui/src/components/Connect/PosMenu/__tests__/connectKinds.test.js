// redesign SC-A: the integration kind (pos | sales_channel) and what the model does with it.
import { describe, it, expect } from 'vitest'
import { CONNECT_KINDS, connectKind } from '../connectKinds'
import {
  catalogOptions,
  connectedLinks,
  connectedPosLinks,
  fillName,
  linkedIntegrations,
  syncCopy
} from '../posMenuModel'

const uber = {
  id: 40,
  key: 'uber_eats_integration',
  name: 'Uber Eats',
  logo: 'uber.png',
  type: 'sales_channel',
  plugin_id: 9,
  plugin_root: 'https://uber.plugins.example.com',
  plugin: { root: 'https://uber.plugins.example.com', key: 'uber_eats_integration', setup_url: 'https://uber/setup' }
}
const doorDash = {
  id: 41,
  key: 'doordash_integration',
  name: 'DoorDash',
  type: 'sales_channel',
  plugin_id: null,
  plugin: null,
  plugin_root: 'https://doordash.plugins.example.com'
}
// A call provider (isSetupCallIntegration) whose catalog type is sales_channel
const checkmate = {
  id: 42,
  key: 'checkmate_integration',
  name: 'Checkmate',
  type: 'sales_channel',
  plugin_id: 10,
  plugin_root: 'https://checkmate.plugins.example.com',
  plugin: { root: 'https://checkmate.plugins.example.com', key: 'checkmate_integration' }
}
const square = {
  id: 10,
  key: 'square_pos_integration',
  name: 'Square',
  type: 'pos',
  plugin_id: 5,
  plugin_root: 'https://square-pos.plugins.example.com',
  plugin: { root: 'https://square-pos.plugins.example.com', key: 'square_pos_integration', setup_url: 'https://square/setup' }
}

describe('connectKind', () => {
  it('is pos by default and for an unknown kind', () => {
    expect(connectKind()).toBe(CONNECT_KINDS.pos)
    expect(connectKind('printer')).toBe(CONNECT_KINDS.pos)
    expect(connectKind(null)).toBe(CONNECT_KINDS.pos)
  })

  it('pos is what /connect/pos-menu uses today', () => {
    expect(connectKind('pos')).toEqual({
      kind: 'pos',
      integrationType: 'pos',
      storageKey: 'pos-menu-panel',
      callProviders: true,
      columns: ['id', 'business', 'pos', 'status'],
      lockedColumns: ['id', 'pos'],
      actions: ['sync_menu', 'sync_business'],
      externalIdEditable: false
    })
  })

  it('sales_channel has no call providers, one fixed column, Push menu and an editable external id', () => {
    expect(connectKind('sales_channel')).toEqual({
      kind: 'sales_channel',
      integrationType: 'sales_channel',
      storageKey: 'sales-channels-panel',
      callProviders: false,
      columns: ['id', 'business', 'pos', 'sales_channels'],
      lockedColumns: ['id'],
      actions: ['push_menu'],
      externalIdEditable: true
    })
  })

  it('is frozen, arrays included', () => {
    for (const config of Object.values(CONNECT_KINDS)) {
      expect(Object.isFrozen(config)).toBe(true)
      expect(Object.isFrozen(config.columns)).toBe(true)
      expect(Object.isFrozen(config.lockedColumns)).toBe(true)
      expect(Object.isFrozen(config.actions)).toBe(true)
    }
  })
})

// redesign IM-A: the kind of /connect/importers. It keeps no columns to manage and no status on the card.
describe('connectKind importer', () => {
  it('is what /connect/importers uses: ID and Business, nothing to call, no actions', () => {
    expect(connectKind('importer')).toEqual({
      kind: 'importer',
      integrationType: null,
      storageKey: 'importers-panel',
      callProviders: false,
      columns: ['id', 'business'],
      lockedColumns: ['id'],
      actions: [],
      externalIdEditable: false,
      columnManager: false,
      cardStatus: false
    })
    expect(connectKind('importer')).toBe(CONNECT_KINDS.importer)
  })

  it('an unknown kind is still pos', () => {
    expect(connectKind('importers')).toBe(CONNECT_KINDS.pos)
  })

  it('columnManager and cardStatus are only on importer: pos and sales_channel read undefined as true', () => {
    for (const name of ['pos', 'sales_channel']) {
      expect(Object.prototype.hasOwnProperty.call(CONNECT_KINDS[name], 'columnManager')).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(CONNECT_KINDS[name], 'cardStatus')).toBe(false)
      expect(connectKind(name).columnManager !== false).toBe(true)
      expect(connectKind(name).cardStatus !== false).toBe(true)
    }
    expect(connectKind('importer').columnManager).toBe(false)
    expect(connectKind('importer').cardStatus).toBe(false)
  })

  it('the controller gets no integrationType for importer: null becomes undefined', () => {
    expect(connectKind('importer').integrationType ?? undefined).toBeUndefined()
    expect(connectKind('pos').integrationType ?? undefined).toBe('pos')
    expect(connectKind('sales_channel').integrationType ?? undefined).toBe('sales_channel')
  })
})

describe('connectedLinks', () => {
  const store = {
    id: 7,
    third_party_integrations: [
      { business_id: 7, third_party_integration_id: 40, third_party_integration: { type: 'sales_channel' } },
      { business_id: 7, third_party_integration_id: 41 },
      { business_id: 7, third_party_integration_id: 10 },
      { business_id: 8, third_party_integration_id: 41 },
      null
    ]
  }

  it('keeps the links of the type: nested type, type resolved by the catalog', () => {
    const links = connectedLinks(store, [uber, doorDash, square], 'sales_channel')
    expect(links.map(({ link }) => link.third_party_integration_id)).toEqual([40, 41])
    expect(links[0].integration).toBe(uber)
    expect(links[1].integration).toBe(doorDash)
  })

  it('leaves out a link of another type and one that belongs to another store', () => {
    const ids = connectedLinks(store, [uber, doorDash, square], 'sales_channel').map(({ link }) => link.third_party_integration_id)
    expect(ids).not.toContain(10)
    expect(connectedLinks(store, [uber, doorDash, square], 'sales_channel').every(({ link }) => link.business_id === 7)).toBe(true)
  })

  it('a link nested with a type paints without the catalog', () => {
    const [only] = connectedLinks(store, [], 'sales_channel')
    expect(only.link.third_party_integration_id).toBe(40)
    expect(only.integration).toEqual({ type: 'sales_channel' })
  })

  it('gives nothing for no store', () => {
    expect(connectedLinks(null, [uber], 'sales_channel')).toEqual([])
  })

  it('connectedPosLinks is connectedLinks with pos', () => {
    expect(connectedPosLinks(store, [uber, doorDash, square])).toEqual(connectedLinks(store, [uber, doorDash, square], 'pos'))
    expect(connectedPosLinks(store, [uber, doorDash, square]).map(({ link }) => link.third_party_integration_id)).toEqual([10])
  })
})

describe('linkedIntegrations', () => {
  it('lists id, name, logo and enabled per link of the type', () => {
    const store = {
      id: 7,
      third_party_integrations: [
        { business_id: 7, third_party_integration_id: 40, enabled: true },
        { business_id: 7, third_party_integration_id: 41, enabled: false },
        { business_id: 7, third_party_integration_id: 10 }
      ]
    }
    expect(linkedIntegrations(store, [uber, doorDash, square], 'sales_channel')).toEqual([
      { id: 40, name: 'Uber Eats', logo: 'uber.png', enabled: true },
      { id: 41, name: 'DoorDash', logo: null, enabled: false }
    ])
  })

  it('enabled is false only with false', () => {
    const store = {
      id: 7,
      third_party_integrations: [
        { business_id: 7, third_party_integration_id: 40, enabled: 0 },
        { business_id: 7, third_party_integration_id: 41, enabled: null },
        { business_id: 7, third_party_integration_id: 42 }
      ]
    }
    expect(linkedIntegrations(store, [uber, doorDash, checkmate], 'sales_channel').map(item => item.enabled)).toEqual([true, true, true])
  })

  it('falls back to the link id and a null name when the catalog has no entry', () => {
    const store = {
      id: 7,
      third_party_integrations: [{ business_id: 7, third_party_integration_id: 99, third_party_integration: { type: 'sales_channel' } }]
    }
    expect(linkedIntegrations(store, [], 'sales_channel')).toEqual([{ id: 99, name: null, logo: null, enabled: true }])
  })
})

describe('catalogOptions by kind', () => {
  const store = { id: 7, third_party_integrations: [{ business_id: 7, third_party_integration_id: 40 }] }
  const catalog = [uber, doorDash, checkmate]

  it('sales_channel has no call options and does not filter the call integrations out', () => {
    const options = catalogOptions({ business: store, integrations: catalog, kind: 'sales_channel' })
    expect(options.some(option => option.kind === 'call')).toBe(false)
    expect(options.map(option => option.key)).toEqual(['integration:40', 'integration:41', 'integration:42'])
  })

  it('keeps the action, the note, disabled and busy of each option', () => {
    const options = catalogOptions({
      business: store,
      integrations: catalog,
      kind: 'sales_channel',
      installingPluginRoot: 'https://doordash.plugins.example.com'
    })
    const [connected, notInstalled, installed] = options
    expect(connected).toMatchObject({ connected: true, action: 'setup', disabled: true, busy: false })
    expect(notInstalled).toMatchObject({ connected: false, action: 'install', noteKey: 'POS_MENU_NOTE_NOT_INSTALLED', busy: true })
    expect(installed).toMatchObject({ connected: false, action: 'connect', noteKey: 'POS_MENU_NOTE_INSTALLED' })
  })

  it('without kind it is what it was: the call providers first, then the rest without the call ones', () => {
    const options = catalogOptions({ business: store, integrations: [...catalog, square] })
    expect(options.slice(0, 2).map(option => option.kind)).toEqual(['call', 'call'])
    expect(options.map(option => option.key)).toEqual(['call:checkmate', 'call:deliverect', 'integration:40', 'integration:41', 'integration:10'])
    expect(catalogOptions({ business: store, integrations: [...catalog, square], kind: 'pos' })).toEqual(options)
  })
})

describe('syncCopy push_menu', () => {
  it('has its own keys (the existing PUSH_MENU is mistranslated in the catalog)', () => {
    expect(syncCopy('push_menu')).toEqual({
      buttonKey: 'SALES_CHANNELS_PUSH_MENU',
      buttonDefault: 'Push menu',
      titleKey: 'SALES_CHANNELS_PUSH_MENU_TITLE',
      titleDefault: "Push _store_'s menu to _pos_?",
      bodyKey: 'SALES_CHANNELS_PUSH_MENU_BODY',
      bodyDefault: "Ordering sends this store's menu to _pos_. The menu customers see on _pos_ can change.",
      confirmKey: 'SALES_CHANNELS_PUSH_MENU_CONFIRM',
      confirmDefault: 'Push menu to _pos_',
      doneKey: 'MENU_PUSH_STARTED',
      doneDefault: 'Menu push started. It can take a few minutes.'
    })
  })

  it('fills the store and the channel', () => {
    const copy = syncCopy('push_menu')
    expect(fillName(copy.titleDefault, { store: 'Fast Bite', pos: 'Uber Eats' })).toBe("Push Fast Bite's menu to Uber Eats?")
    expect(fillName(copy.confirmDefault, { pos: 'Uber Eats' })).toBe('Push menu to Uber Eats')
  })

  it('leaves sync_menu and sync_business as they were', () => {
    expect(syncCopy('sync_menu').buttonKey).toBe('SYNC_MENU')
    expect(syncCopy('sync_business').doneKey).toBe('BUSINESS_SYNC_STARTED')
    expect(syncCopy('nope')).toBeNull()
  })
})
