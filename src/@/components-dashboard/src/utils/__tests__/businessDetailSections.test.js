import { describe, expect, it, vi } from 'vitest'

import {
  BUSINESS_PALETTE_SECTIONS,
  STORE_SECTION_DEFS,
  STORE_SECTION_GROUPS,
  canAccessBusinessSection,
  canAccessBusinessSectionTab,
  canOpenStoreSection,
  getPaletteBusinessSections,
  getSectionAccess,
  isWhiteLabelSiteConfigured,
  isBusinessSectionEnabled,
  isCustomFieldsShortcutOffered,
  isSectionInRoleMenu,
  isStoreSectionInMenu,
  isStoreSectionKey,
  WHITE_LABEL_SITES_ENABLED
} from '../businessDetailSections'

const runtime = vi.hoisted(() => ({ projects: [] }))
vi.mock('~/config', () => ({
  default: { get dashboard_project_allowlists () { return { white_label_sites: runtime.projects } } }
}))

describe('White Label tenant opt-in', () => {
  it('defaults off, accepts explicit tenant lists and keeps the existing API flags', () => {
    const project = 'example-white-label'
    expect(isWhiteLabelSiteConfigured(project)).toBe(false)
    runtime.projects = [project]
    expect(isWhiteLabelSiteConfigured(project)).toBe(true)
    expect(isWhiteLabelSiteConfigured('example-other')).toBe(false)
    expect(isStoreSectionInMenu('white_label', { isAdmin: true, project })).toBe(false)
    expect(isStoreSectionInMenu('white_label', { isAdmin: false, project })).toBe(false)
    runtime.projects = project
    expect(isWhiteLabelSiteConfigured(project)).toBe(false)
    runtime.projects = []
    expect(isWhiteLabelSiteConfigured(project, { value: '1' })).toBe(true)
    expect(isWhiteLabelSiteConfigured(project, { value: true })).toBe(true)
    expect(isWhiteLabelSiteConfigured(project, { value: 'true' })).toBe(false)
  })
})

// redesign stores 4.A: one source for the store editor's menu, body and palette.

// The menu of main, verbatim: `businessConfigs` of Stores/BusinessSummary (:128-254) as storeSections.js had it at 3b8ebe15.
const mainMenu = (key, { isAdmin, isSelectedAccessRole, project, configs, hasSpoonity, hasBusinessConfigSections }) => {
  const isEnabled = (k) => isBusinessSectionEnabled(k, { isAdmin, isSelectedAccessRole, project, configs, hasSpoonity })
  const isShowMetafields = configs?.show_metafields && (configs?.show_metafields?.value || configs?.show_metafields?.value === '1')
  const isReservationsEnabled = configs?.reservation_enabled?.value === '1' && !!configs?.web_marketplace_26?.value
  // main: its menu reads WHITE_LABEL_SITES_ENABLED first
  const isWhiteLabelStoresEnabled = WHITE_LABEL_SITES_ENABLED && (configs?.whitelabel_stores_sites?.value === '1' || configs?.whitelabel_stores_sites?.value === true ||
    ['example-white-label', 'example-secondary'].includes(project))
  const rules = {
    overview: true,
    custom_fields: isEnabled('custom_fields') && isShowMetafields,
    personalization: false,
    places: false,
    spoonity_key: hasSpoonity,
    reservations: isReservationsEnabled,
    configs: isEnabled('configs') && isAdmin && hasBusinessConfigSections,
    markups: isEnabled('markups') && isAdmin,
    business_fees: isAdmin,
    business_payment_account: !isSelectedAccessRole,
    white_label: isAdmin && isWhiteLabelStoresEnabled,
    // not in main's menu; this mirror lists it off, as the menu has it without googleActionsVisible
    google_actions: false
  }
  return !!(key in rules ? rules[key] : isEnabled(key))
}

const product = (lists) => lists.reduce((acc, list) => acc.flatMap(prefix => list.map(item => [...prefix, item])), [[]])

// Level 0, a store owner and the selected access role; on a plain project, EatStreet and a white label project; with each config on or off
const ROLES = [
  { isAdmin: true, isSelectedAccessRole: false },
  { isAdmin: false, isSelectedAccessRole: false },
  { isAdmin: false, isSelectedAccessRole: true },
  { isAdmin: true, isSelectedAccessRole: true } // not a real session; kept so the order of the rules is pinned too
]
const PROJECTS = ['ordering', 'example-backoffice', 'example-secondary', 'example-white-label']
const CONFIGS = [
  {},
  { white_label_module: { value: '1' } },
  { show_metafields: { value: '1' }, reservation_enabled: { value: '1' }, web_marketplace_26: { value: true } },
  { show_metafields: { value: '0' }, whitelabel_stores_sites: { value: '1' } },
  { white_label_module: { value: '1' }, show_metafields: { value: true }, whitelabel_stores_sites: { value: true } }
]
const KEYS = STORE_SECTION_DEFS.map(def => def.key)

describe('store editor sections: one source', () => {
  // Personalization, which main's menu never showed, was deleted (decision 8, n.º 22): 24 of the 25 remain.
  // plus Order with Google (Channels).
  it('lists 24 of the 25 sections of BusinessSummary, Order with Google and the Overview, each in one of the five groups', () => {
    expect(KEYS).toHaveLength(26)
    expect(new Set(KEYS).size).toBe(26)
    expect(KEYS).not.toContain('personalization')
    expect(KEYS).not.toContain('support')
    expect(STORE_SECTION_GROUPS).toEqual(['store', 'orders', 'payments', 'channels', 'integrations'])
    STORE_SECTION_DEFS.forEach(def => expect(STORE_SECTION_GROUPS).toContain(def.group))
  })

  it('knows its keys: an old link to support, personalization or an unknown key is not a section', () => {
    KEYS.forEach(key => expect([key, isStoreSectionKey(key)]).toEqual([key, key !== 'white_label' || WHITE_LABEL_SITES_ENABLED]))
    // main hides White Label for every project, so an old link to it is an old link, not a missing permission
    expect(isStoreSectionKey('white_label')).toBe(WHITE_LABEL_SITES_ENABLED)
    ;['support', 'personalization', 'no_such_section', undefined, null, ''].forEach(key => expect(isStoreSectionKey(key)).toBe(false))
  })

  it('the menu equals main\'s for every role, project and config, except QR Codes for a non-admin with white_label_module', () => {
    const differences = []
    product([ROLES, PROJECTS, CONFIGS, [false, true], [false, true]]).forEach(([role, project, configs, hasSpoonity, hasBusinessConfigSections]) => {
      const ctx = { ...role, project, configs, hasSpoonity, hasBusinessConfigSections }
      KEYS.forEach(key => {
        const now = isStoreSectionInMenu(key, { ...role, project }, { configs, hasSpoonity, hasBusinessConfigSections })
        if (now !== mainMenu(key, ctx)) differences.push({ key, ...role, wl: !!configs.white_label_module, metafields: configs.show_metafields?.value, now })
      })
    })
    // G1-26: main listed QR Codes and opened an empty body (it needs level 0). main read `show_metafields = '0'` as on.
    // Every other case is the same.
    expect(differences.length).toBeGreaterThan(0)
    differences.forEach(difference => {
      if (difference.key === 'custom_fields') {
        expect(difference).toMatchObject({ metafields: '0', now: false })
        return
      }
      expect(difference).toMatchObject({ key: 'publishing', isAdmin: false, isSelectedAccessRole: false, wl: true, now: false })
    })
  })

  it('a section the menu shows always opens (the body never refuses what the menu offers)', () => {
    product([ROLES, PROJECTS, CONFIGS]).forEach(([role, project, configs]) => {
      KEYS.forEach(key => {
        if (isStoreSectionInMenu(key, { ...role, project }, { configs, hasSpoonity: true, hasBusinessConfigSections: true })) {
          expect(canAccessBusinessSection(key, { ...role, project })).toBe(true)
        }
      })
    })
  })
})

describe('Order with Google', () => {
  it('sits in Channels, after Sales channels', () => {
    const keys = STORE_SECTION_DEFS.filter(def => def.group === 'channels').map(def => def.key)
    expect(keys.indexOf('google_actions')).toBe(keys.indexOf('sales_channels') + 1)
  })

  it('is in the menu only while the project shows Google', () => {
    const owner = { isAdmin: false, isSelectedAccessRole: false, project: 'ordering' }
    const admin = { isAdmin: true, isSelectedAccessRole: false, project: 'ordering' }
    for (const access of [owner, admin]) {
      expect(isStoreSectionInMenu('google_actions', access, { configs: {} })).toBe(false)
      expect(isStoreSectionInMenu('google_actions', access, { configs: {}, googleActionsVisible: true })).toBe(true)
    }
  })

  it('stays out of the selected access role\'s menu', () => {
    const selected = { isAdmin: false, isSelectedAccessRole: true, project: 'ordering' }
    expect(isStoreSectionInMenu('google_actions', selected, { configs: {}, googleActionsVisible: true })).toBe(false)
  })
})

describe('canAccessBusinessSection (decision 11)', () => {
  const owner = getSectionAccess({ user: { level: 2 }, project: 'ordering' })
  const admin = getSectionAccess({ user: { level: 0 }, project: 'ordering' })
  const selected = getSectionAccess({ user: { level: 2, selected_access: true }, project: 'ordering' })
  const eatstreetOwner = getSectionAccess({ user: { level: 2 }, project: 'example-backoffice' })

  // main, white label is closed to everyone while White Label sites are hidden
  it('closes white label by address while White Label sites are hidden', () => {
    expect(WHITE_LABEL_SITES_ENABLED).toBe(false)
    for (const access of [admin, owner, selected]) expect(canAccessBusinessSection('white_label', access)).toBe(false)
    expect(canOpenStoreSection({ section: 'white_label' }, admin)).toBe(false)
  })

  it('keeps business fees, markups, QR codes and integrations settings for level 0', () => {
    ;['business_fees', 'markups', 'publishing', 'configs'].forEach(key => {
      expect(canAccessBusinessSection(key, admin)).toBe(true)
      expect(canAccessBusinessSection(key, owner)).toBe(false)
      expect(canAccessBusinessSection(key, selected)).toBe(false)
    })
  })

  it('closes the business payment account to the selected access role only', () => {
    expect(canAccessBusinessSection('business_payment_account', admin)).toBe(true)
    expect(canAccessBusinessSection('business_payment_account', owner)).toBe(true)
    expect(canAccessBusinessSection('business_payment_account', eatstreetOwner)).toBe(true)
    expect(canAccessBusinessSection('business_payment_account', selected)).toBe(false)
  })

  // redesign bugs C: the address follows the menu's role rules too; main (and 4.A) opened the rest by address
  it('the selected access role opens by address only the sections its menu gives it', () => {
    const inMenu = KEYS.filter(key => isSectionInRoleMenu(key, selected))
    expect(inMenu).toEqual(['overview', 'delivery_pickup_more', 'reservations', 'places', 'payment_methods', 'spoonity_key'])
    KEYS.forEach(key => {
      expect([key, canAccessBusinessSection(key, selected)]).toEqual([key, inMenu.includes(key)])
    })
    ;['store_details', 'schedule', 'custom_fields', 'menu', 'notifications'].forEach(key => {
      expect(canOpenStoreSection({ section: key }, selected)).toBe(false)
    })
  })

  // main 441a22ccd: the EatStreet owner sees and opens what any owner does
  it('an EatStreet owner opens Taxes, Layout, Webhooks and Logs as any owner', () => {
    const eatstreetAdmin = getSectionAccess({ user: { level: 0 }, project: 'example-backoffice' })
    ;['tax_fees', 'layout', 'webhooks', 'logs'].forEach(key => {
      expect(isSectionInRoleMenu(key, eatstreetOwner)).toBe(true)
      expect(isSectionInRoleMenu(key, eatstreetAdmin)).toBe(true)
      expect(canAccessBusinessSection(key, eatstreetOwner)).toBe(true)
      expect(canOpenStoreSection({ section: key }, eatstreetOwner)).toBe(true)
      expect(canOpenStoreSection({ section: key }, eatstreetAdmin)).toBe(true)
      expect(canOpenStoreSection({ section: key }, owner)).toBe(true)
    })
  })

  it('no level or role gains or loses a menu entry: what opens by address is what the menu offers by role', () => {
    // the three real sessions (the fourth role is not one: level 0 never has the selected access role)
    product([ROLES.slice(0, 3), PROJECTS]).forEach(([role, project]) => {
      KEYS.forEach(key => {
        const access = { ...role, project }
        const roleMenu = isSectionInRoleMenu(key, access) && (!['business_fees', 'markups', 'publishing', 'configs', 'white_label'].includes(key) || role.isAdmin) &&
          (key !== 'business_payment_account' || !role.isSelectedAccessRole) &&
          (key !== 'white_label' || WHITE_LABEL_SITES_ENABLED) // main: hidden
        expect([key, role, project, canAccessBusinessSection(key, access)]).toEqual([key, role, project, roleMenu])
      })
    })
  })

  it('leaves config-only sections and places open by URL, as in main', () => {
    ;['reservations', 'spoonity_key', 'custom_fields', 'places', 'sales_channels'].forEach(key => {
      expect(canAccessBusinessSection(key, owner)).toBe(true)
    })
  })
  it('the config rules stay in the menu only: an address still opens them (Custom fields with show_metafields = \'0\' too)', () => {
    expect(canOpenStoreSection({ section: 'custom_fields' }, owner)).toBe(true)
    expect(canOpenStoreSection({ section: 'custom_fields' }, admin)).toBe(true)
  })
})

// redesign bugs C: `show_metafields` is on/off, not truthy ('0' used to show it)
describe('Custom fields and show_metafields', () => {
  const admin = getSectionAccess({ user: { level: 0 }, project: 'ordering' })
  const owner = getSectionAccess({ user: { level: 2 }, project: 'ordering' })
  const selected = getSectionAccess({ user: { level: 2, selected_access: true }, project: 'ordering' })
  const menu = (value) => ({ configs: { show_metafields: { value } } })

  it('the menu lists it only when the project has it on', () => {
    ;[admin, owner].forEach(access => {
      expect(isStoreSectionInMenu('custom_fields', access, menu('1'))).toBe(true)
      expect(isStoreSectionInMenu('custom_fields', access, menu(true))).toBe(true)
      expect(isStoreSectionInMenu('custom_fields', access, menu('0'))).toBe(false)
      expect(isStoreSectionInMenu('custom_fields', access, menu(false))).toBe(false)
      expect(isStoreSectionInMenu('custom_fields', access, menu(''))).toBe(false)
      expect(isStoreSectionInMenu('custom_fields', access, menu(null))).toBe(false)
      expect(isStoreSectionInMenu('custom_fields', access, {})).toBe(false)
    })
  })

  it('⌘K offers it only when the project has it on', () => {
    const offered = (value, user = { level: 0 }) => getPaletteBusinessSections({ user, project: 'ordering', configs: menu(value).configs })
      .some(entry => entry.key === 'custom_fields')
    expect(offered('1')).toBe(true)
    expect(offered('0')).toBe(false)
    expect(offered('0', { level: 2 })).toBe(false)
  })

  it('the «⋯» shortcut is offered unless the project turned it off or the role cannot open it', () => {
    expect(isCustomFieldsShortcutOffered(admin, menu('1').configs)).toBe(true)
    expect(isCustomFieldsShortcutOffered(owner, menu('1').configs)).toBe(true)
    expect(isCustomFieldsShortcutOffered(admin, menu('0').configs)).toBe(false)
    expect(isCustomFieldsShortcutOffered(owner, menu(false).configs)).toBe(false)
    expect(isCustomFieldsShortcutOffered(selected, menu('1').configs)).toBe(false)
    // no config at all, or an unset value: the shortcut stays, as main had it (the menu entry needs the config on)
    expect(isCustomFieldsShortcutOffered(owner, {})).toBe(true)
    expect(isCustomFieldsShortcutOffered(owner, menu(null).configs)).toBe(true)
    expect(isCustomFieldsShortcutOffered(owner, menu('').configs)).toBe(true)
    expect(isCustomFieldsShortcutOffered(admin, menu(0).configs)).toBe(false)
  })
})

describe('canAccessBusinessSectionTab', () => {
  it('owner tab: not for level 2; agents, driver group and custom slug are open to every owner (main )', () => {
    const level2 = getSectionAccess({ user: { level: 2 }, project: 'ordering' })
    const restricted = getSectionAccess({ user: { level: 2 }, project: 'example-backoffice' })
    const admin = getSectionAccess({ user: { level: 0 }, project: 'example-backoffice' })

    expect(canAccessBusinessSectionTab('store_details', 'owner', level2)).toBe(false)
    expect(canAccessBusinessSectionTab('store_details', 'owner', admin)).toBe(true)
    expect(canAccessBusinessSectionTab('store_details', 'agents', level2)).toBe(true)
    expect(canAccessBusinessSectionTab('store_details', 'agents', restricted)).toBe(true)
    expect(canAccessBusinessSectionTab('delivery_pickup_more', 'driver_delivery_group', restricted)).toBe(true)
    expect(canAccessBusinessSectionTab('delivery_pickup_more', 'driver_delivery_group', admin)).toBe(true)
    expect(canAccessBusinessSectionTab('ordering_channels', 'custom_slug', restricted)).toBe(true)
    expect(canAccessBusinessSectionTab('store_details', 'images', restricted)).toBe(true)
    expect(canAccessBusinessSectionTab('store_details', null, level2)).toBe(true)
  })

  it('canOpenStoreSection needs both the section and the tab', () => {
    const level2 = getSectionAccess({ user: { level: 2 }, project: 'ordering' })
    expect(canOpenStoreSection({ section: 'store_details', tab: 'owner' }, level2)).toBe(false)
    expect(canOpenStoreSection({ section: 'store_details', tab: 'location' }, level2)).toBe(true)
    expect(canOpenStoreSection({ section: 'markups' }, level2)).toBe(false)
    expect(canOpenStoreSection({ section: 'schedule' }, level2)).toBe(true)
  })

  it('the deep link follows only the tab rules decision 11 names; custom_slug opens its section, which shows Widgets', () => {
    const restricted = getSectionAccess({ user: { level: 2 }, project: 'example-backoffice' })
    expect(canOpenStoreSection({ section: 'store_details', tab: 'agents' }, restricted)).toBe(true)
    expect(canOpenStoreSection({ section: 'delivery_pickup_more', tab: 'driver_delivery_group' }, restricted)).toBe(true)
    expect(canOpenStoreSection({ section: 'ordering_channels', tab: 'custom_slug' }, restricted)).toBe(true)
  })
})

describe('the palette offers what the menu shows', () => {
  const USERS = [{ level: 0 }, { level: 2 }, { level: 2, selected_access: true }]

  it('each section entry is offered exactly when the menu lists it (store-level sections aside)', () => {
    product([USERS, PROJECTS, CONFIGS]).forEach(([user, project, configs]) => {
      const offered = new Set(getPaletteBusinessSections({ user, configs, project }).map(entry => entry.key))
      const access = getSectionAccess({ user, project })
      BUSINESS_PALETTE_SECTIONS.filter(entry => !entry.target && !entry.detailOnly && !entry.tab).forEach(entry => {
        expect([entry.key, user, project, offered.has(entry.key)])
          .toEqual([entry.key, user, project, isStoreSectionInMenu(entry.key, access, { configs })])
      })
    })
  })

  it('a fixed tab follows its section and the tab rule', () => {
    const keys = (user, project) => getPaletteBusinessSections({ user, project }).map(entry => entry.key)
    expect(keys({ level: 2 }, 'ordering')).not.toContain('store_details:owner')
    expect(keys({ level: 0 }, 'ordering')).toContain('store_details:owner')
    expect(keys({ level: 2 }, 'example-backoffice')).toContain('store_details:agents')
    expect(keys({ level: 2 }, 'example-backoffice')).toContain('delivery_pickup_more:driver_delivery_group')
    expect(keys({ level: 2 }, 'ordering')).toContain('delivery_pickup_more:driver_delivery_group')
  })

  it('offers reservations to the selected access role when the project has them, as its menu does', () => {
    const configs = { reservation_enabled: { value: '1' }, web_marketplace_26: { value: true } }
    const keys = getPaletteBusinessSections({ user: { level: 2, selected_access: true }, configs }).map(entry => entry.key)
    expect(keys).toContain('reservations')
  })
})
