/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// redesign SL-F2 (B1)
const mocks = vi.hoisted(() => ({
  configs: {},
  project: 'ordering',
  isSelectedAccessRole: false
}))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{ configs: mocks.configs }],
  useApi: () => [{ project: mocks.project }]
}))

vi.mock('../../../../hooks/useUserSelectedAccess', () => ({
  useSelectedAccessRole: () => mocks.isSelectedAccessRole
}))

vi.mock('../../../../hooks/useGoogleActionsVisibility', () => ({
  useGoogleActionsVisibility: () => ({ visible: false })
}))

import { buildStoreSections, buildStoreSectionGroups, useStoreSections, STORE_SECTION_QUERY_KEYS, STORE_OVERVIEW_ID } from '../storeSections'

// Labels of BusinessSummary:128-254 (`businessConfigs`), in the grouped order of decision 2 (stores 4.A, ):
// Store · Orders & delivery · Payments & fees · Channels · Integrations & activity
const SUMMARY_SECTIONS = [
  ['store_details', 'STORE_DETAILS', 'Store details', 'store'],
  ['schedule', 'SCHEDULE', 'Schedule', 'store'],
  ['custom_fields', 'CUSTOM_FIELDS', 'Custom fields', 'store'],
  ['menu', 'MENU_V21', 'Menu', 'orders'],
  ['delivery_pickup_more', 'DELIVERY_PICKUP_MORE', 'Delivery, pickup & more', 'orders'],
  ['preorder', 'PREORDERS_SETTING', 'Preorders and lead times', 'orders'],
  ['reservations', 'RESERVATIONS', 'Reservations', 'orders'],
  ['notifications', 'NOTIFICATIONS', 'Notifications', 'orders'],
  ['places', 'PLACES', 'Places', 'orders'],
  ['payment_methods', 'PAYMENTS_METHODS', 'Payment methods', 'payments'],
  ['tax_fees', 'TAX_AND_FEES', 'Tax & fees', 'payments'],
  ['promotions', 'PROMOTIONS', 'Promotions', 'payments'],
  ['markups', 'MARKUPS', 'Markups', 'payments'],
  ['business_fees', 'BUSINESS_FEES_TITLE', 'Business fees', 'payments'],
  ['business_payment_account', 'BUSINESS_PAYMENT_ACCOUNT_TITLE', 'Business payment account', 'payments'],
  ['ordering_channels', 'ORDERING_CHANNELS', 'Ordering channels', 'channels'],
  ['publishing', 'QR_CODES', 'QR Codes', 'channels'],
  ['sales_channels', 'SALES_CHANNELS_TITLE', 'Sales channels', 'channels'],
  ['google_actions', 'ORDER_WITH_GOOGLE', 'Order with Google', 'channels'],
  ['layout', 'LAYOUT', 'Layout', 'channels'],
  ['white_label', 'WHITE_LABEL', 'White Label', 'channels'],
  ['webhooks', 'WEBHOOKS', 'Webhooks', 'integrations'],
  ['configs', 'INTEGRATIONS_SETTINGS', 'Integrations settings', 'integrations'],
  ['spoonity_key', 'SPOONITY_KEY', 'Spoonity key', 'integrations'],
  ['logs', 'LOGS', 'Logs', 'integrations']
]
const SECTION_IDS = SUMMARY_SECTIONS.map(([id]) => id)

// Overview is always on; the cases below cover the 24 sections (Personalization, never in main's menu, was deleted)
const enabledIds = (sections) => sections.filter(section => section.enabled && section.id !== STORE_OVERVIEW_ID).map(section => section.id)
const ofIds = (ids) => SECTION_IDS.filter(id => ids.includes(id))
const without = (ids, ...removed) => ids.filter(id => !removed.includes(id))
const t = (_key, fallback) => fallback

// Level 0 with no optional config. (G1-32): preorder no longer needs addon_catering, as BusinessSummary:171-173 in main
// and the palette (businessDetailSections.js:57)
const ADMIN_BASE = [
  'store_details', 'schedule', 'menu', 'delivery_pickup_more', 'notifications', 'payment_methods', 'tax_fees',
  'promotions', 'preorder', 'ordering_channels', 'publishing', 'sales_channels', 'layout', 'webhooks', 'logs', 'markups',
  'business_fees', 'business_payment_account'
]
// Level 2 with no optional config: no publishing, spoonity, personalization or markups; no admin-only sections
const OWNER_BASE = without(ADMIN_BASE, 'publishing', 'markups', 'business_fees')

const pedidosyaConfigs = [
  { id: 1, key: 'wallet_cash_enabled', value: '1' },
  { id: 2, key: 'pedidosya_integration_api_token', value: 'token' }
]

describe('buildStoreSections', () => {
  it('lists Overview first, then 24 of the 25 sections of BusinessSummary and Order with Google, in five groups (decision 2)', () => {
    const sections = buildStoreSections({ isAdmin: true }, t)

    expect(sections).toHaveLength(26)
    expect(sections[0]).toEqual({ id: STORE_OVERVIEW_ID, label: 'Overview', group: 'store', enabled: true })
    expect(sections.slice(1).map(section => section.id)).toEqual(SECTION_IDS)
    expect(sections.slice(1).map(section => section.group)).toEqual(SUMMARY_SECTIONS.map(([, , , group]) => group))
    expect(SECTION_IDS).toHaveLength(25)
  })

  it('lists Order with Google only while the project shows Google', () => {
    const enabled = (ctx) => buildStoreSections(ctx, t).find(section => section.id === 'google_actions').enabled
    expect(enabled({ isAdmin: true })).toBe(false)
    expect(enabled({ isAdmin: true, googleActionsVisible: true })).toBe(true)
    expect(enabled({ isAdmin: false, googleActionsVisible: true })).toBe(true)
  })

  it('names the five groups in order, translated', () => {
    const translate = vi.fn((_key, fallback) => fallback)
    expect(buildStoreSectionGroups(translate)).toEqual([
      { id: 'store', label: 'Store' },
      { id: 'orders', label: 'Orders & delivery' },
      { id: 'payments', label: 'Payments & fees' },
      { id: 'channels', label: 'Channels' },
      { id: 'integrations', label: 'Integrations & activity' }
    ])
    expect(translate.mock.calls.map(([key]) => key)).toEqual([
      'STORE_SECTION_GROUP_STORE', 'STORE_SECTION_GROUP_ORDERS', 'STORE_SECTION_GROUP_PAYMENTS', 'STORE_SECTION_GROUP_CHANNELS',
      'STORE_SECTION_GROUP_INTEGRATIONS'
    ])
  })

  it('every group is one run (SectionNav draws one title per run)', () => {
    const groups = buildStoreSections({ isAdmin: true }, t).map(section => section.group)
    const runs = groups.filter((group, index) => index === 0 || group !== groups[index - 1])
    expect(runs).toEqual(['store', 'orders', 'payments', 'channels', 'integrations'])
  })

  it('labels each section with the same t() key and default as BusinessSummary', () => {
    const translate = vi.fn((_key, fallback) => fallback)
    const sections = buildStoreSections({ isAdmin: true }, translate)

    const sectionCalls = translate.mock.calls.filter(([key]) => key !== 'STORE_OVERVIEW')
    expect(sectionCalls).toEqual(SUMMARY_SECTIONS.map(([, key, label]) => [key, label]))
    expect(sections.slice(1).map(section => section.label)).toEqual(SUMMARY_SECTIONS.map(([, , label]) => label))
  })

  it('always returns booleans in enabled', () => {
    const sections = buildStoreSections({
      isAdmin: false,
      configs: { addon_catering: { value: '1' }, show_metafields: { value: '1' } },
      spoonityConfig: { id: 1, key: 'spoonity_integration_api_key' }
    }, t)

    sections.forEach(section => expect(typeof section.enabled).toBe('boolean'))
  })

  it('never enables places, whatever the role (personalization is gone)', () => {
    const configs = { white_label_module: { value: '' }, addon_catering: { value: '1' } }
    ;[true, false].forEach(isAdmin => {
      const ids = enabledIds(buildStoreSections({ isAdmin, configs }, t))
      expect(ids).not.toContain('personalization')
      expect(ids).not.toContain('places')
    })
  })

  // Rules of BusinessSummary:95-101 (isEnabled) and :128-254, one row per case
  const cases = [
    ['admin, no optional config', { isAdmin: true }, ADMIN_BASE],
    ['level 2 owner, no optional config', { isAdmin: false }, OWNER_BASE],
    ['level 2 owner with spoonity', { isAdmin: false, spoonityConfig: { id: 7 } }, ofIds([...OWNER_BASE, 'spoonity_key'])],
    ['admin with spoonity', { isAdmin: true, spoonityConfig: { id: 7 } }, ofIds([...ADMIN_BASE, 'spoonity_key'])],
    // main an EatStreet owner has every owner section
    ['level 2 owner on EatStreet', { isAdmin: false, project: 'eatstreet' }, OWNER_BASE],
    ['level 2 owner on example-secondary', { isAdmin: false, project: 'example-secondary' }, OWNER_BASE],
    ['admin on EatStreet keeps every section', { isAdmin: true, project: 'eatstreet' }, ADMIN_BASE],
    [
      'selected access role (not admin)',
      { isAdmin: false, isSelectedAccessRole: true },
      ['delivery_pickup_more', 'payment_methods']
    ],
    [
      'selected access role with spoonity: spoonity_key ignores the role',
      { isAdmin: false, isSelectedAccessRole: true, spoonityConfig: { id: 7 } },
      ['delivery_pickup_more', 'payment_methods', 'spoonity_key']
    ],
    [
      'selected access role with reservations: reservations ignore the role',
      {
        isAdmin: false,
        isSelectedAccessRole: true,
        configs: { reservation_enabled: { value: '1' }, web_marketplace_26: { value: true } }
      },
      ['delivery_pickup_more', 'payment_methods', 'reservations']
    ],
    [
      'selected access role with admin flag still loses configs, markups and business payment account',
      { isAdmin: true, isSelectedAccessRole: true, businessConfigs: pedidosyaConfigs },
      ['delivery_pickup_more', 'payment_methods', 'business_fees']
    ],
    [
      // isBusinessSectionEnabled returned on white_label_module before its owner exclusions, so BusinessSummary listed
      // QR Codes for an owner whose body was empty (it needs isAdmin). stores 4.A (G1-26): the menu follows the body.
      'white_label_module drops sales_channels (owner) and no longer lists QR Codes for an owner',
      { isAdmin: false, configs: { white_label_module: { value: '1' } } },
      without(OWNER_BASE, 'sales_channels')
    ],
    [
      'white_label_module drops sales_channels (admin) and keeps the rest',
      { isAdmin: true, configs: { white_label_module: { value: '1' } } },
      without(ADMIN_BASE, 'sales_channels')
    ],
    [
      'white_label_module without value does nothing',
      { isAdmin: false, configs: { white_label_module: { value: '' } } },
      OWNER_BASE
    ],
    [
      'white_label_module with an owner on EatStreet only hides Sales channels, as on any project',
      { isAdmin: false, project: 'eatstreet', configs: { white_label_module: { value: '1' } } },
      without(OWNER_BASE, 'sales_channels')
    ],
    [
      'show_metafields "1" enables custom_fields',
      { isAdmin: false, configs: { show_metafields: { value: '1' } } },
      ofIds([...OWNER_BASE, 'custom_fields'])
    ],
    [
      'show_metafields true enables custom_fields',
      { isAdmin: true, configs: { show_metafields: { value: true } } },
      ofIds([...ADMIN_BASE, 'custom_fields'])
    ],
    // redesign bugs C: BusinessSummary read '0' as truthy and listed it
    ['show_metafields "0" keeps custom_fields off', { isAdmin: true, configs: { show_metafields: { value: '0' } } }, ADMIN_BASE],
    ['show_metafields 0 keeps custom_fields off', { isAdmin: true, configs: { show_metafields: { value: 0 } } }, ADMIN_BASE],
    ['show_metafields empty keeps custom_fields off', { isAdmin: true, configs: { show_metafields: { value: '' } } }, ADMIN_BASE],
    ['show_metafields missing value keeps custom_fields off', { isAdmin: true, configs: { show_metafields: {} } }, ADMIN_BASE],
    ['preorder without addon_catering (level 2 owner)', { isAdmin: false, configs: {} }, OWNER_BASE],
    ['addon_catering empty keeps preorder on', { isAdmin: true, configs: { addon_catering: { value: '' } } }, ADMIN_BASE],
    ['addon_catering "1" changes nothing', { isAdmin: false, configs: { addon_catering: { value: '1' } } }, OWNER_BASE],
    [
      'selected access role keeps preorder off, with or without addon_catering',
      { isAdmin: false, isSelectedAccessRole: true, configs: { addon_catering: { value: '1' } } },
      ['delivery_pickup_more', 'payment_methods']
    ],
    [
      'reservation_enabled "1" + web_marketplace_26 enables reservations',
      { isAdmin: false, configs: { reservation_enabled: { value: '1' }, web_marketplace_26: { value: true } } },
      ofIds([...OWNER_BASE, 'reservations'])
    ],
    [
      'reservation_enabled "1" without web_marketplace_26 keeps reservations off',
      { isAdmin: true, configs: { reservation_enabled: { value: '1' } } },
      ADMIN_BASE
    ],
    [
      'web_marketplace_26 without reservation_enabled keeps reservations off',
      { isAdmin: true, configs: { web_marketplace_26: { value: true } } },
      ADMIN_BASE
    ],
    [
      'reservation_enabled "0" keeps reservations off',
      { isAdmin: true, configs: { reservation_enabled: { value: '0' }, web_marketplace_26: { value: true } } },
      ADMIN_BASE
    ],
    [
      'reservation_enabled true (not "1") keeps reservations off',
      { isAdmin: true, configs: { reservation_enabled: { value: true }, web_marketplace_26: { value: true } } },
      ADMIN_BASE
    ],
    [
      'pedidosya configs enable the integrations section for admin',
      { isAdmin: true, businessConfigs: pedidosyaConfigs },
      ofIds([...ADMIN_BASE, 'configs'])
    ],
    ['pedidosya configs do nothing for a level 2 owner', { isAdmin: false, businessConfigs: pedidosyaConfigs }, OWNER_BASE],
    [
      'admin without pedidosya configs keeps the integrations section off',
      { isAdmin: true, businessConfigs: [{ id: 1, key: 'wallet_cash_enabled', value: '1' }] },
      ADMIN_BASE
    ],
    ['admin with business.configs missing keeps the integrations section off', { isAdmin: true, businessConfigs: undefined }, ADMIN_BASE],
    // main, White Label sites are hidden (WHITE_LABEL_SITES_ENABLED false): no config or project lists it
    [
      'whitelabel_stores_sites "1" no longer enables white_label for admin (hidden by main)',
      { isAdmin: true, configs: { whitelabel_stores_sites: { value: '1' } } },
      ADMIN_BASE
    ],
    [
      'whitelabel_stores_sites true no longer enables white_label for admin (hidden by main)',
      { isAdmin: true, configs: { whitelabel_stores_sites: { value: true } } },
      ADMIN_BASE
    ],
    [
      'whitelabel_stores_sites "true" (string) keeps white_label off',
      { isAdmin: true, configs: { whitelabel_stores_sites: { value: 'true' } } },
      ADMIN_BASE
    ],
    [
      'whitelabel_stores_sites "0" keeps white_label off',
      { isAdmin: true, configs: { whitelabel_stores_sites: { value: '0' } } },
      ADMIN_BASE
    ],
    [
      'whitelabel_stores_sites "1" does nothing for a level 2 owner',
      { isAdmin: false, configs: { whitelabel_stores_sites: { value: '1' } } },
      OWNER_BASE
    ],
    [
      'project example-white-label no longer enables white_label for admin (hidden by main)',
      { isAdmin: true, project: 'example-white-label' },
      ADMIN_BASE
    ],
    [
      'project example-secondary no longer enables white_label for admin (hidden by main)',
      { isAdmin: true, project: 'example-secondary' },
      ADMIN_BASE
    ],
    [
      'project eatstreet (not staging) does not enable white_label',
      { isAdmin: true, project: 'eatstreet' },
      ADMIN_BASE
    ],
    [
      'project example-white-label does nothing for a level 2 owner',
      { isAdmin: false, project: 'example-white-label' },
      OWNER_BASE
    ],
    [
      'admin with everything on',
      {
        isAdmin: true,
        project: 'example-white-label',
        spoonityConfig: { id: 7 },
        businessConfigs: pedidosyaConfigs,
        configs: {
          addon_catering: { value: '1' },
          show_metafields: { value: '1' },
          reservation_enabled: { value: '1' },
          web_marketplace_26: { value: true }
        }
      },
      without(SECTION_IDS, 'places', 'white_label', 'google_actions') // main: White Label sites hidden; Google needs googleActionsVisible
    ]
  ]

  it.each(cases)('%s', (_name, ctx, expected) => {
    expect(enabledIds(buildStoreSections(ctx, t))).toEqual(ofIds(expected))
  })
})

describe('useStoreSections', () => {
  beforeEach(() => {
    mocks.configs = {}
    mocks.project = 'ordering'
    mocks.isSelectedAccessRole = false
  })

  it('reads configs, project and role from the app context and business.configs from the argument', () => {
    mocks.configs = { addon_catering: { value: '1' } }
    mocks.project = 'example-white-label'

    const { result } = renderHook(() => useStoreSections({
      business: { id: 1, configs: pedidosyaConfigs },
      spoonityConfig: { id: 7 },
      isAdmin: true
    }))

    expect(result.current[0]).toEqual({ id: 'overview', label: 'Overview', group: 'store', enabled: true })
    expect(enabledIds(result.current)).toEqual(ofIds([...ADMIN_BASE, 'spoonity_key', 'configs'])) // main: no White label
  })

  it('applies the selected access role from useSelectedAccessRole', () => {
    mocks.isSelectedAccessRole = true

    const { result } = renderHook(() => useStoreSections({ business: { id: 1 }, isAdmin: false }))

    expect(enabledIds(result.current)).toEqual(['delivery_pickup_more', 'payment_methods'])
  })

  it('works before the business loads', () => {
    const { result } = renderHook(() => useStoreSections({ isAdmin: false }))

    expect(enabledIds(result.current)).toEqual(ofIds(OWNER_BASE))
  })
})

describe('STORE_SECTION_QUERY_KEYS', () => {
  it('is the list handleCloseExtraOpen clears today, in the same order', () => {
    expect(STORE_SECTION_QUERY_KEYS).toEqual([
      'section', 'tab', 'business_type', 'paymethod', 'paymethod_tab', 'setting_tab', 'menu', 'zone', 'zone_tab', 'wallet'
    ])
  })
})
