import { describe, it, expect } from 'vitest'
import {
  POS_SETUP_CALL_PROVIDERS,
  POS_SETUP_CALL_URL,
  SALES_CHANNEL_CONTACT_URL
} from '../../../../utils/connectAccess'
import {
  catalogOptions,
  connectedPosLinks,
  disconnectCopy,
  fillName,
  isCalendlyRestricted,
  isPluginLinkRestricted,
  pluginLinkUrl,
  linkSetupState,
  posSummary,
  syncCopy
} from '../posMenuModel'

const square = {
  id: 10,
  name: 'Square',
  logo: 'square.png',
  key: 'square_pos_integration',
  type: 'pos',
  plugin_id: 5,
  plugin_root: 'https://square-pos.plugins.example.com',
  plugin: { root: 'https://square-pos.plugins.example.com', key: 'square_pos_integration', setup_url: 'https://square/setup' }
}
const clover = {
  id: 11,
  name: 'Clover',
  logo: 'clover.png',
  key: 'clover_integration',
  type: 'pos',
  plugin_id: 6,
  plugin_root: 'https://clover.plugins.example.com',
  plugin: { root: 'https://clover.plugins.example.com', key: 'clover_integration', links: { setup: 'https://clover/setup' } }
}
const simphony = {
  id: 12,
  name: 'Simphony',
  key: 'simphony_integration',
  type: 'pos',
  plugin_id: 7,
  plugin_root: 'https://simphony.plugins.example.com',
  plugin: { root: 'https://simphony.plugins.example.com', key: 'simphony_integration' }
}
const wansoftStub = {
  id: 'catalog:wansoft_integration',
  key: 'wansoft_integration',
  name: 'Wansoft',
  logo: 'wansoft.png',
  type: 'pos',
  plugin_id: null,
  plugin: null,
  plugin_root: 'https://wansoft.plugins.example.com',
  source: 'catalog'
}
const deliverect = {
  id: 13,
  name: 'Deliverect',
  key: 'deliverect',
  type: 'pos',
  plugin_id: 8,
  plugin_root: 'https://deliverect.plugins.example.com',
  plugin: { key: 'deliverect' }
}

const linkTo = (integration, extra = {}) => ({
  id: 1,
  setup_status: null,
  external_id: null,
  enabled: true,
  business_id: 1,
  third_party_integration_id: integration.id,
  third_party_integration: { id: integration.id, name: integration.name, logo: integration.logo, type: 'pos' },
  ...extra
})

const storeWith = (links) => ({ id: 1, name: 'Store', third_party_integrations: links })

describe('connectedPosLinks', () => {
  it('returns [] for a null business or one without links', () => {
    expect(connectedPosLinks(null, [square])).toEqual([])
    expect(connectedPosLinks(undefined, [square])).toEqual([])
    expect(connectedPosLinks({ id: 1 }, [square])).toEqual([])
  })

  it('resolves a link without nested third_party_integration through integrations', () => {
    const link = { id: 1, business_id: 1, enabled: true, third_party_integration_id: 10 }
    const result = connectedPosLinks(storeWith([link]), [clover, square])
    expect(result).toEqual([{ link, integration: square }])
  })

  it('falls back to the nested third_party_integration when integrations lacks it', () => {
    const link = linkTo(square)
    const result = connectedPosLinks(storeWith([link]), [])
    expect(result).toEqual([{ link, integration: link.third_party_integration }])
  })

  it('prefers the integration from integrations over the nested one', () => {
    const link = linkTo(square)
    const [first] = connectedPosLinks(storeWith([link]), [square])
    expect(first.integration).toBe(square)
  })

  it('tolerates integrations that is not an array', () => {
    const link = { id: 1, business_id: 1, third_party_integration_id: 99, third_party_integration: { id: 99, type: 'pos' } }
    const [first] = connectedPosLinks(storeWith([link]), null)
    expect(first.integration).toBe(link.third_party_integration)
  })

  it('ignores links of another business_id and accepts a null business_id', () => {
    const other = linkTo(square, { id: 2, business_id: 2 })
    const orphan = linkTo(clover, { id: 3, business_id: null })
    const result = connectedPosLinks(storeWith([other, orphan]), [square, clover])
    expect(result.map(r => r.link.id)).toEqual([3])
  })

  it('ignores sales channel links', () => {
    const channel = {
      id: 4,
      business_id: 1,
      third_party_integration_id: 50,
      third_party_integration: { id: 50, type: 'sales_channel' }
    }
    expect(connectedPosLinks(storeWith([channel]), [])).toEqual([])
    expect(connectedPosLinks(storeWith([channel]), [{ id: 50, type: 'sales_channel' }])).toEqual([])
  })

  it('keeps the order of business.third_party_integrations', () => {
    const a = linkTo(clover, { id: 7 })
    const b = linkTo(square, { id: 8 })
    const result = connectedPosLinks(storeWith([a, b]), [square, clover])
    expect(result.map(r => r.link.id)).toEqual([7, 8])
  })
})

describe('posSummary (PM-01; , main #390/#394, owner decision D1 = C)', () => {
  // D1 (option C): the links made before api-core#3587 have no reported status and are connected
  it('a link with null setup_status is connected', () => {
    const summary = posSummary(storeWith([linkTo(square)]), [square])
    expect(summary).toMatchObject({
      state: 'connected',
      statusKey: 'INTEGRATION_STATUS_CONNECTED',
      statusDefault: 'Connected',
      family: 'done'
    })
    expect(summary.pos).toEqual([{ id: 10, name: 'Square', logo: 'square.png' }])
  })

  it('pending is a setup pending', () => {
    const summary = posSummary(storeWith([linkTo(square, { setup_status: 'pending' })]), [square])
    expect(summary).toMatchObject({ state: 'pending', statusKey: 'INTEGRATION_STATUS_PENDING', family: 'pending' })
  })

  it('success and the old completed are connected, whatever the case', () => {
    for (const setupStatus of ['success', 'Completed', ' complete ']) {
      const summary = posSummary(storeWith([linkTo(square, { setup_status: setupStatus })]), [square])
      expect(summary).toMatchObject({ state: 'connected', statusKey: 'INTEGRATION_STATUS_CONNECTED', statusDefault: 'Connected', family: 'done' })
    }
  })

  it('failed and error need attention, never connected', () => {
    for (const setupStatus of ['failed', 'ERROR']) {
      const summary = posSummary(storeWith([linkTo(square, { setup_status: setupStatus })]), [square])
      expect(summary).toMatchObject({ state: 'failed', statusKey: 'INTEGRATION_STATUS_FAILED', statusDefault: 'Needs attention', family: 'cancel' })
    }
  })

  it('a blank setup_status is connected (D1 option C); an unknown word is a setup pending', () => {
    expect(posSummary(storeWith([linkTo(square, { setup_status: '   ' })]), [square]).state).toBe('connected')
    expect(posSummary(storeWith([linkTo(square, { setup_status: 'waiting for the owner' })]), [square]).state).toBe('pending')
  })

  it('off when enabled is false, even with a setup_status', () => {
    const summary = posSummary(storeWith([linkTo(square, { enabled: false, setup_status: 'pending' })]), [square])
    expect(summary).toMatchObject({
      state: 'off',
      statusKey: 'POS_MENU_STATUS_OFF',
      statusDefault: 'Turned off',
      family: 'cancel'
    })
  })

  it('enabled missing is not off', () => {
    const link = linkTo(square)
    delete link.enabled
    expect(posSummary(storeWith([link]), [square]).state).toBe('connected')
  })

  it('none without a pos', () => {
    expect(posSummary(storeWith([]), [square])).toEqual({
      state: 'none',
      statusKey: 'BUSINESS_POS_STATUS_NOT_CONNECTED',
      statusDefault: 'Not connected',
      family: null,
      pos: []
    })
    expect(posSummary(null, [])).toMatchObject({ state: 'none', pos: [] })
  })

  it('takes the state from the first pos and lists all of them', () => {
    const first = linkTo(square, { id: 1, setup_status: 'pending' })
    const second = linkTo(clover, { id: 2, enabled: false })
    const summary = posSummary(storeWith([first, second]), [square, clover])
    expect(summary.state).toBe('pending')
    expect(summary.pos.map(p => p.name)).toEqual(['Square', 'Clover'])
  })

  it('names an unresolved pos "POS"', () => {
    const link = { id: 1, business_id: 1, third_party_integration_id: 3, third_party_integration: { id: 3, type: 'pos' } }
    expect(posSummary(storeWith([link]), []).pos).toEqual([{ id: 3, name: 'POS', logo: null }])
  })
})

describe('linkSetupState', () => {
  it('turned off goes before any setup state', () => {
    expect(linkSetupState({ enabled: false, setup_status: 'failed' })).toEqual({ state: 'off', statusKey: 'POS_MENU_STATUS_OFF', statusDefault: 'Turned off', family: 'cancel' })
  })

  it('never throws on a missing link or a status that is not text', () => {
    expect(linkSetupState(undefined).state).toBe('connected')
    expect(linkSetupState({ setup_status: 42 }).state).toBe('pending')
  })
})

describe('catalogOptions', () => {
  const base = {
    business: storeWith([]),
    integrations: [],
    isBusinessOwner: false,
    installingPluginRoot: null,
    formLoading: false,
    businessLoading: false
  }
  const run = (over = {}) => catalogOptions({ ...base, ...over })
  const byName = (options, name) => options.find(o => o.integration?.name === name || o.name === name)

  it('puts the call providers first, then the API integrations and stubs in their order', () => {
    const options = run({ integrations: [square, deliverect, clover, wansoftStub] })
    expect(options.map(o => o.kind)).toEqual(['call', 'call', 'integration', 'integration', 'integration'])
    expect(options.slice(0, 2).map(o => o.name)).toEqual(POS_SETUP_CALL_PROVIDERS.map(p => p.name))
    expect(options.slice(2).map(o => o.integration.name)).toEqual(['Square', 'Clover', 'Wansoft'])
  })

  // main #399: the install state of a plugin
  it('a plugin still installing offers Check again, busy only while its own check runs', () => {
    const pending = { ...wansoftStub, pending_plugin: { id: 40, root: wansoftStub.plugin_root, install_status: 'installing' } }
    expect(byName(run({ integrations: [pending] }), 'Wansoft')).toMatchObject({
      action: 'check_again',
      installState: 'installing',
      checking: false,
      noteKey: 'INTEGRATION_PLUGIN_INSTALLING_NOTE'
    })
    const checking = run({ integrations: [pending, clover], checkingPluginRoot: wansoftStub.plugin_root })
    expect(byName(checking, 'Wansoft')).toMatchObject({ checking: true, disabled: true })
    expect(byName(checking, 'Clover')).toMatchObject({ action: 'connect', disabled: true }) // one check at a time
  })

  it('a plugin whose install failed keeps Connect off and carries the reason of the API', () => {
    const failed = { ...clover, plugin: { ...clover.plugin, install_status: 'failed', install_message: 'Missing scope' } }
    expect(byName(run({ integrations: [failed] }), 'Clover')).toMatchObject({
      action: 'connect',
      disabled: true,
      installState: 'failed',
      installMessage: 'Missing scope',
      noteKey: 'INTEGRATION_PLUGIN_INSTALL_FAILED_HELP'
    })
  })

  it('a null install_status reads as ready (main #399 ships before the API)', () => {
    const ready = { ...clover, plugin: { ...clover.plugin, install_status: null } }
    expect(byName(run({ integrations: [ready] }), 'Clover')).toMatchObject({ action: 'connect', disabled: false, installState: null })
  })

  // main #394
  it('an installed POS whose plugin is disabled cannot be connected and says why', () => {
    const disabled = { ...clover, plugin: { ...clover.plugin, enabled: false } }
    expect(byName(run({ integrations: [disabled] }), 'Clover')).toMatchObject({
      action: 'connect',
      disabled: true,
      noteKey: 'INTEGRATION_PLUGIN_DISABLED_NOTE',
      noteDefault: 'Plugin disabled'
    })
  })

  it('a store keeps one POS: another installed POS cannot be connected, installing one still can', () => {
    const options = run({ business: storeWith([linkTo(square)]), integrations: [square, clover, wansoftStub] })
    expect(byName(options, 'Clover')).toMatchObject({ action: 'connect', disabled: true, blockedByPos: true })
    expect(byName(options, 'Wansoft')).toMatchObject({ action: 'install', disabled: false })
    expect(byName(options, 'Square')).toMatchObject({ connected: true })
  })

  it('a sales channel store can have several channels', () => {
    const uber = { id: 30, name: 'Uber Eats', type: 'sales_channel', plugin_id: 9, plugin_root: 'https://uber.example', plugin: { root: 'https://uber.example' } }
    const doordash = { id: 31, name: 'DoorDash', type: 'sales_channel', plugin_id: 10, plugin_root: 'https://dd.example', plugin: { root: 'https://dd.example' } }
    const link = { ...linkTo(uber), third_party_integration: { id: 30, type: 'sales_channel' } }
    const options = run({ business: storeWith([link]), integrations: [uber, doordash], kind: 'sales_channel' })
    expect(byName(options, 'DoorDash')).toMatchObject({ action: 'connect', disabled: false })
    expect(byName(options, 'DoorDash').blockedByPos).toBeUndefined()
  })

  describe('Rappi and Uber Eats', () => {
    const rappiStub = { id: 40, name: 'Rappi', type: 'sales_channel', plugin_id: null, plugin: null, plugin_root: 'https://rappi.example' }
    const rappi = { id: 40, name: 'Rappi', type: 'sales_channel', plugin_id: 12, plugin_root: 'https://rappi.example', plugin: { key: 'rappi_integration', root: 'https://rappi.example' } }
    const uberEats = { id: 41, name: 'Uber Eats', type: 'sales_channel', plugin_id: 13, plugin_root: 'https://uber-eats.example', plugin: { key: 'uber_eats_integration', root: 'https://uber-eats.example', enabled: false } }
    const doordash = { id: 42, name: 'DoorDash', type: 'sales_channel', plugin_id: null, plugin: null, plugin_root: 'https://dd.example' }
    const contactUs = {
      action: 'contact_us',
      href: SALES_CHANNEL_CONTACT_URL,
      disabled: false,
      restricted: false,
      noteKey: 'SALES_CHANNELS_NOTE_CONTACT_US'
    }

    it('are a Contact us link, installed or not, and never Install or Connect', () => {
      const options = run({ integrations: [rappiStub, uberEats, doordash], kind: 'sales_channel' })
      expect(byName(options, 'Rappi')).toMatchObject(contactUs)
      expect(byName(options, 'Uber Eats')).toMatchObject(contactUs)
      expect(byName(options, 'DoorDash')).toMatchObject({ action: 'install' })
    })

    it('stay a link while another request is running', () => {
      const options = run({ integrations: [rappi, uberEats], kind: 'sales_channel', formLoading: true, installingPluginRoot: 'https://dd.example' })
      expect(byName(options, 'Rappi')).toMatchObject({ ...contactUs, busy: false })
      expect(byName(options, 'Uber Eats')).toMatchObject({ ...contactUs, busy: false })
    })

    it('a store already connected keeps its channel as it was', () => {
      const link = { ...linkTo(rappi), third_party_integration: { id: 40, type: 'sales_channel' } }
      const options = run({ business: storeWith([link]), integrations: [rappi, uberEats], kind: 'sales_channel' })
      expect(byName(options, 'Rappi')).toMatchObject({ connected: true })
      expect(byName(options, 'Rappi').action).not.toBe('contact_us')
      expect(byName(options, 'Uber Eats')).toMatchObject(contactUs)
    })

    it('only applies to sales channels', () => {
      const options = run({ integrations: [{ ...rappi, type: 'pos' }] })
      expect(byName(options, 'Rappi')).toMatchObject({ action: 'connect' })
    })
  })

  it('always lists the call providers, even without integrations', () => {
    expect(run({ integrations: undefined }).map(o => o.name)).toEqual(['Checkmate', 'Deliverect'])
  })

  it('describes a call option (for an administrator: main , )', () => {
    const [checkmate] = run({ isAdmin: true })
    expect(checkmate).toMatchObject({
      kind: 'call',
      action: 'book_call',
      href: POS_SETUP_CALL_URL,
      name: 'Checkmate',
      logoKey: 'ItsaCheckmateLogo',
      connected: false,
      restricted: false,
      disabled: false,
      busy: false,
      noteKey: 'POS_MENU_NOTE_SETUP_CALL',
      noteDefault: 'We set it up with you on a call'
    })
  })

  it('level 2 without a plugin: contact_admin, never disabled', () => {
    const [, , option] = run({
      integrations: [wansoftStub],
      isBusinessOwner: true,
      installingPluginRoot: 'https://other',
      formLoading: true,
      businessLoading: true
    })
    expect(option).toMatchObject({
      action: 'contact_admin',
      disabled: false,
      noteKey: 'CONTACT_ADMINISTRATOR',
      noteDefault: 'Contact administrator'
    })
  })

  it('level 0 without a plugin: install', () => {
    const [, , option] = run({ integrations: [wansoftStub] })
    expect(option).toMatchObject({
      action: 'install',
      connected: false,
      noteKey: 'POS_MENU_NOTE_NOT_INSTALLED',
      noteDefault: 'Not installed · installs for the whole project'
    })
  })

  it('installed and not connected: connect', () => {
    const [, , option] = run({ integrations: [square] })
    expect(option).toMatchObject({
      action: 'connect',
      connected: false,
      link: null,
      noteKey: 'POS_MENU_NOTE_INSTALLED',
      noteDefault: 'Installed'
    })
  })

  it('level 2 installed and not connected: connect', () => {
    const [, , option] = run({ integrations: [square], isBusinessOwner: true })
    expect(option.action).toBe('connect')
  })

  it('connected with plugin.setup_url: setup', () => {
    const link = linkTo(square)
    const [, , option] = run({ business: storeWith([link]), integrations: [square] })
    expect(option).toMatchObject({ connected: true, link, action: 'setup' })
  })

  it('connected with plugin.links.setup: setup', () => {
    const link = linkTo(clover)
    const [, , option] = run({ business: storeWith([link]), integrations: [clover] })
    expect(option).toMatchObject({ connected: true, link, action: 'setup' })
  })

  it('connected without a setup path: null action', () => {
    const link = linkTo(simphony)
    const [, , option] = run({ business: storeWith([link]), integrations: [simphony] })
    expect(option).toMatchObject({ connected: true, link, action: null })
  })

  it('marks busy only the option whose plugin_root is installing', () => {
    const options = run({ integrations: [wansoftStub, square], installingPluginRoot: wansoftStub.plugin_root })
    const wansoft = byName(options, 'Wansoft')
    const sq = byName(options, 'Square')
    expect(wansoft.busy).toBe(true)
    expect(sq.busy).toBe(false)
    expect(options.filter(o => o.kind === 'call').every(o => o.busy === false)).toBe(true)
  })

  it('disables every integration while any install is in progress', () => {
    const options = run({ integrations: [wansoftStub, square], installingPluginRoot: 'https://anything' })
    expect(options.filter(o => o.kind === 'integration').every(o => o.disabled)).toBe(true)
    expect(options.filter(o => o.kind === 'integration').every(o => o.busy === false)).toBe(true)
  })

  it('disables integrations while the form or the business is loading', () => {
    expect(run({ integrations: [square], formLoading: true })[2].disabled).toBe(true)
    expect(run({ integrations: [square], businessLoading: true })[2].disabled).toBe(true)
    expect(run({ integrations: [square] })[2].disabled).toBe(false)
  })

  it('does not duplicate setup-call integrations that come from the API', () => {
    const options = run({ integrations: [deliverect, square] })
    expect(options.filter(o => o.integration?.name === 'Deliverect')).toEqual([])
    expect(options).toHaveLength(3)
  })

  it('gives each option a unique key', () => {
    const keys = run({ integrations: [square, clover, wansoftStub] }).map(o => o.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('tolerates a null business', () => {
    const [, , option] = run({ business: null, integrations: [square] })
    expect(option).toMatchObject({ connected: false, action: 'connect' })
  })
})

describe('syncCopy', () => {
  it('sync_menu', () => {
    expect(syncCopy('sync_menu')).toEqual({
      buttonKey: 'SYNC_MENU',
      buttonDefault: 'Sync menu',
      titleKey: 'POS_MENU_SYNC_MENU_TITLE',
      titleDefault: "Sync _store_'s menu with _pos_?",
      bodyKey: 'POS_MENU_SYNC_MENU_BODY',
      bodyDefault: "Ordering asks _pos_ to sync this store's menu now. The menu your customers see can change.",
      confirmKey: 'POS_MENU_SYNC_MENU_CONFIRM',
      confirmDefault: 'Sync menu with _pos_',
      doneKey: 'MENU_SYNC_STARTED',
      doneDefault: 'Menu sync started. It can take a few minutes.'
    })
  })

  it('sync_business', () => {
    expect(syncCopy('sync_business')).toEqual({
      buttonKey: 'SYNC_BUSINESS',
      buttonDefault: 'Sync business',
      titleKey: 'POS_MENU_SYNC_BUSINESS_TITLE',
      titleDefault: "Sync _store_'s details with _pos_?",
      bodyKey: 'POS_MENU_SYNC_BUSINESS_BODY',
      bodyDefault: "Ordering asks _pos_ to sync this store's details now. The details your customers see can change.",
      confirmKey: 'POS_MENU_SYNC_BUSINESS_CONFIRM',
      confirmDefault: 'Sync details with _pos_',
      doneKey: 'BUSINESS_SYNC_STARTED',
      doneDefault: 'Business sync started. It can take a few minutes.'
    })
  })

  it('returns null for an unknown action', () => {
    expect(syncCopy('nope')).toBeNull()
    expect(syncCopy(undefined)).toBeNull()
  })
})

// redesign D-8 (owner, 2026-10-19): Disconnect asks first (C8); one copy for a POS and a sales channel (_pos_ is its name)
describe('disconnectCopy', () => {
  it('has the approved texts and keys', () => {
    expect(disconnectCopy()).toEqual({
      titleKey: 'POS_MENU_DISCONNECT_TITLE',
      titleDefault: 'Disconnect _store_ from _pos_?',
      bodyKey: 'POS_MENU_DISCONNECT_BODY',
      bodyDefault: '_store_ stops syncing with _pos_. To connect it again you will need its credentials.',
      confirmKey: 'POS_MENU_DISCONNECT_CONFIRM',
      confirmDefault: 'Disconnect _pos_'
    })
  })

  it('returns a copy each time', () => {
    disconnectCopy().titleDefault = 'changed'
    expect(disconnectCopy().titleDefault).toBe('Disconnect _store_ from _pos_?')
  })

  it('fills the store and the POS in every text', () => {
    const copy = disconnectCopy()
    const names = { store: 'Cafe', pos: 'Clover' }
    expect(fillName(copy.titleDefault, names)).toBe('Disconnect Cafe from Clover?')
    expect(fillName(copy.bodyDefault, names)).toBe('Cafe stops syncing with Clover. To connect it again you will need its credentials.')
    expect(fillName(copy.confirmDefault, names)).toBe('Disconnect Clover')
  })
})

describe('fillName', () => {
  it('replaces every _pos_ and _store_', () => {
    expect(fillName('_pos_ <- _store_ -> _pos_', { store: 'Main St', pos: 'Square' }))
      .toBe('Square <- Main St -> Square')
  })

  it('fills the real sync copy', () => {
    expect(fillName(syncCopy('sync_menu').titleDefault, { store: 'Cafe', pos: 'Clover' }))
      .toBe("Sync Cafe's menu with Clover?")
  })

  it('does not interpret $ patterns in the names', () => {
    expect(fillName('_store_', { store: "$& $1 $'", pos: 'X' })).toBe("$& $1 $'")
  })

  it('tolerates missing values and templates', () => {
    expect(fillName('a _pos_ b', {})).toBe('a  b')
    expect(fillName(undefined, { store: 's', pos: 'p' })).toBe('')
  })
})

// main, absolute plugin links are used as they are; a Calendly link is for administrators only
describe('pluginLinkUrl', () => {
  it('joins the root and a relative link', () => {
    expect(pluginLinkUrl('https://square.example', '/general')).toBe('https://square.example/general')
  })

  it('uses an absolute link as it is, with or without the root', () => {
    expect(pluginLinkUrl('https://square.example', 'https://other.example/general')).toBe('https://other.example/general')
    expect(pluginLinkUrl('https://square.example', 'HTTP://other.example/general')).toBe('HTTP://other.example/general')
    expect(pluginLinkUrl(undefined, 'https://other.example/general')).toBe('https://other.example/general')
  })

  it('uses a protocol-relative link as it is', () => {
    expect(pluginLinkUrl('https://square.example', '//cdn.example/general')).toBe('//cdn.example/general')
  })
})

describe('Calendly restriction (main , )', () => {
  const calendlySetup = {
    id: 40,
    name: 'Booked',
    type: 'pos',
    plugin_id: 9,
    plugin_root: 'https://booked.example',
    plugin: { root: 'https://booked.example', setup_url: 'https://calendly.com/team/setup' }
  }
  const calendlyStub = {
    id: 'catalog:booked',
    name: 'Booked stub',
    type: 'pos',
    plugin_id: null,
    plugin: null,
    plugin_root: 'https://calendly.com/team/setup'
  }
  // a relative setup path that resolves against a Calendly root
  const calendlyRoot = {
    id: 41,
    name: 'Rooted',
    type: 'pos',
    plugin_id: 10,
    plugin_root: 'https://calendly.com',
    plugin: { root: 'https://calendly.com', links: { setup: '/team/setup' } }
  }
  const base = { integrations: [], business: storeWith([]) }
  const asAdmin = { isAdmin: true }
  const asOther = { isAdmin: false }

  describe('isCalendlyRestricted', () => {
    it('restricts a setup path to Calendly for someone who is not an administrator', () => {
      expect(isCalendlyRestricted(calendlySetup, asOther)).toBe(true)
      expect(isCalendlyRestricted(calendlyRoot, asOther)).toBe(true)
    })

    it('restricts an integration with no plugin whose plugin_root is Calendly', () => {
      expect(isCalendlyRestricted(calendlyStub, asOther)).toBe(true)
    })

    it('does not restrict an administrator', () => {
      expect(isCalendlyRestricted(calendlySetup, asAdmin)).toBe(false)
      expect(isCalendlyRestricted(calendlyStub, asAdmin)).toBe(false)
    })

    it('does not restrict a sales channel, for anyone', () => {
      expect(isCalendlyRestricted(calendlySetup, { ...asOther, kind: 'sales_channel' })).toBe(false)
      expect(isCalendlyRestricted(calendlyStub, { ...asOther, kind: 'sales_channel' })).toBe(false)
    })

    it('does not restrict an ordinary integration, nor a plugin_root of Calendly when the plugin is installed (main: !plugin_id)', () => {
      expect(isCalendlyRestricted(square, asOther)).toBe(false)
      expect(isCalendlyRestricted(wansoftStub, asOther)).toBe(false)
      expect(isCalendlyRestricted({ ...square, plugin_root: 'https://calendly.com/x' }, asOther)).toBe(false)
      expect(isCalendlyRestricted(null, asOther)).toBe(false)
    })

    it('does not take a host that only contains the word as Calendly', () => {
      expect(isCalendlyRestricted({ ...calendlySetup, plugin: { root: 'https://x.example', setup_url: 'https://notcalendly.com/a' } }, asOther)).toBe(false)
    })
  })

  describe('isPluginLinkRestricted', () => {
    const plugin = { root: 'https://booked.example' }

    it('restricts an absolute Calendly link for someone who is not an administrator', () => {
      expect(isPluginLinkRestricted(plugin, 'https://calendly.com/team/help', asOther)).toBe(true)
      expect(isPluginLinkRestricted(plugin, '//calendly.com/team/help', asOther)).toBe(true)
      expect(isPluginLinkRestricted({ root: 'https://calendly.com' }, '/team/help', asOther)).toBe(true)
    })

    it('does not restrict an administrator, a sales channel or a link elsewhere', () => {
      expect(isPluginLinkRestricted(plugin, 'https://calendly.com/team/help', asAdmin)).toBe(false)
      expect(isPluginLinkRestricted(plugin, 'https://calendly.com/team/help', { ...asOther, kind: 'sales_channel' })).toBe(false)
      expect(isPluginLinkRestricted(plugin, '/general', asOther)).toBe(false)
      expect(isPluginLinkRestricted(plugin, undefined, asOther)).toBe(false)
    })
  })

  describe('catalogOptions', () => {
    const run = (over = {}) => catalogOptions({ ...base, ...over })
    const rowOf = (options, id) => options.find(option => option.integration?.id === id)

    it('book_call rows are for administrators; anyone else gets them restricted', () => {
      const admin = run({ ...asAdmin })
      expect(admin.filter(o => o.kind === 'call').map(o => [o.restricted, o.disabled])).toEqual([[false, false], [false, false]])
      const other = run({ ...asOther })
      expect(other.filter(o => o.kind === 'call').map(o => [o.action, o.restricted, o.disabled])).toEqual([
        ['book_call', true, true],
        ['book_call', true, true]
      ])
      // no isAdmin at all is not an administrator
      expect(run().filter(o => o.kind === 'call').every(o => o.restricted)).toBe(true)
    })

    it('a connected integration whose setup is Calendly: restricted and disabled for a non-administrator, setup for an administrator', () => {
      const store = storeWith([linkTo(calendlySetup)])
      const other = rowOf(run({ business: store, integrations: [calendlySetup], ...asOther }), 40)
      expect(other).toMatchObject({ connected: true, action: 'setup', restricted: true, disabled: true })
      const admin = rowOf(run({ business: store, integrations: [calendlySetup], ...asAdmin }), 40)
      expect(admin).toMatchObject({ connected: true, action: 'setup', restricted: false, disabled: false })
    })

    it('an installable integration with a Calendly plugin_root: restricted instead of Install, even for a store owner', () => {
      const other = rowOf(run({ integrations: [calendlyStub], ...asOther }), 'catalog:booked')
      expect(other).toMatchObject({ action: 'install', restricted: true, disabled: true })
      const owner = rowOf(run({ integrations: [calendlyStub], isBusinessOwner: true, ...asOther }), 'catalog:booked')
      expect(owner).toMatchObject({ action: 'contact_admin', restricted: true })
      const admin = rowOf(run({ integrations: [calendlyStub], ...asAdmin }), 'catalog:booked')
      expect(admin).toMatchObject({ action: 'install', restricted: false, disabled: false })
    })

    it('an installed integration whose setup is Calendly is restricted on Connect too (main: the one button)', () => {
      const other = rowOf(run({ integrations: [calendlySetup], ...asOther }), 40)
      expect(other).toMatchObject({ action: 'connect', restricted: true, disabled: true })
    })

    it('nothing is restricted for a sales channel', () => {
      const store = storeWith([linkTo(calendlySetup)])
      const options = run({ business: store, integrations: [calendlySetup, calendlyStub], kind: 'sales_channel', ...asOther })
      expect(options.every(o => o.restricted === false)).toBe(true)
      expect(rowOf(options, 40)).toMatchObject({ action: 'setup', disabled: false })
      expect(rowOf(options, 'catalog:booked')).toMatchObject({ action: 'install', disabled: false })
    })

    it('ordinary integrations are never restricted', () => {
      const options = run({ integrations: [square, wansoftStub], ...asOther })
      expect(options.filter(o => o.kind === 'integration').every(o => o.restricted === false)).toBe(true)
    })
  })
})
