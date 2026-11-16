// redesign DG-B4 (decision 1 | M-DG13): the sections of the group panel, with the same conditions and the same order as
// D/DriversGroupDetails:65-96 (main), and the map from main's `?tab=` keys. Pure: no React, no network.
import { describe, expect, it } from 'vitest'

import {
  GROUP_SECTION_IDS,
  discardTexts,
  groupSections,
  resolveSection,
  usesSectionNav
} from '../groupSections'

const t = (_key, fallback) => fallback
const group = { id: 975001, name: 'Downtown couriers', type: 0, autoassign_amount_drivers: 1, orders_group_max_orders: 1 }
const ids = (sections) => sections.map(section => section.id)

describe('groupSections', () => {
  it('level 0 with a group and advanced autoassign has the seven sections, in the order of main', () => {
    const sections = groupSections({ group, level: 0, autoassignType: 'advanced', t })
    expect(ids(sections)).toEqual(['general', 'businesses', 'paymethods', 'delivery_zones', 'schedule', 'advanced_logistics', 'logs'])
    expect(sections.map(section => section.label)).toEqual([
      'General', 'Businesses', 'Payment methods', 'Delivery zones', 'Schedule', 'Advanced logistics', 'Logs'
    ])
  })

  it('without a group (the add form) only General and Businesses', () => {
    expect(ids(groupSections({ group: null, level: 0, autoassignType: 'advanced', t }))).toEqual(['general', 'businesses'])
    expect(ids(groupSections({ group: undefined, level: 0, autoassignType: 'advanced', t }))).toEqual(['general', 'businesses'])
  })

  it('level 5 has no Payment methods, Delivery zones or Logs', () => {
    expect(ids(groupSections({ group, level: 5, autoassignType: 'advanced', t })))
      .toEqual(['general', 'businesses', 'schedule', 'advanced_logistics'])
  })

  it('any level other than 5 keeps the three (main only asked for !== 5)', () => {
    for (const level of [0, 1, 2, 3, 4, undefined, null]) {
      expect(ids(groupSections({ group, level, autoassignType: 'advanced', t }))).toContain('delivery_zones')
    }
  })

  it('a basic autoassign type has no Advanced logistics', () => {
    expect(ids(groupSections({ group, level: 0, autoassignType: 'basic', t })))
      .toEqual(['general', 'businesses', 'paymethods', 'delivery_zones', 'schedule', 'logs'])
  })

  it('a group with no autoassign drivers and no group orders hides Advanced logistics; one of the two is enough to show it', () => {
    const off = { ...group, autoassign_amount_drivers: 0, orders_group_max_orders: 0 }
    expect(ids(groupSections({ group: off, level: 0, autoassignType: 'advanced', t }))).not.toContain('advanced_logistics')
    for (const partial of [{ autoassign_amount_drivers: 0 }, { orders_group_max_orders: 0 }]) {
      expect(ids(groupSections({ group: { ...group, ...partial }, level: 0, autoassignType: 'advanced', t })))
        .toContain('advanced_logistics')
    }
  })

  it('an unset autoassign type (the config is not loaded) is not basic: Advanced logistics shows, as in main', () => {
    expect(ids(groupSections({ group, level: 0, autoassignType: undefined, t }))).toContain('advanced_logistics')
  })

  it('level 5 with a basic type is down to General, Businesses and Schedule', () => {
    expect(ids(groupSections({ group, level: 5, autoassignType: 'basic', t }))).toEqual(['general', 'businesses', 'schedule'])
  })

  it('takes the labels from t with the keys of main', () => {
    const keys = []
    groupSections({ group, level: 0, autoassignType: 'advanced', t: (key, fallback) => { keys.push(key); return fallback } })
    expect(keys).toEqual(['GENERAL', 'BUSINESSES', 'PAYMENT_METHODS', 'DELIVERY_ZONES_TITLE', 'SCHEDULE', 'ADVANCED_LOGISTICS', 'LOGS'])
  })
})

describe('usesSectionNav', () => {
  it('more than four sections is the vertical SectionNav; four or fewer are Tabs', () => {
    const level0 = groupSections({ group, level: 0, autoassignType: 'advanced', t })
    const level5 = groupSections({ group, level: 5, autoassignType: 'advanced', t })
    const add = groupSections({ group: null, level: 0, autoassignType: 'advanced', t })
    const basic = groupSections({ group, level: 0, autoassignType: 'basic', t })
    expect(usesSectionNav(level0)).toBe(true)
    expect(usesSectionNav(basic)).toBe(true) // six
    expect(usesSectionNav(level5)).toBe(false) // four
    expect(usesSectionNav(add)).toBe(false) // two
  })

  it('five is a SectionNav and four is not (owner decision 35: «more than four»)', () => {
    const make = count => Array.from({ length: count }, (_, index) => ({ id: `s${index}`, label: `S${index}` }))
    expect(usesSectionNav(make(4))).toBe(false)
    expect(usesSectionNav(make(5))).toBe(true)
  })
})

describe('resolveSection', () => {
  const level5 = groupSections({ group, level: 5, autoassignType: 'advanced', t })

  it('a section of the list passes through', () => {
    expect(resolveSection('schedule', level5)).toBe('schedule')
  })

  // (owner decision D-69, drivers-groups P-3): main drew Logs, Payment methods and Delivery zones for a level 5
  // link to ?tab=logs; a section the level does not have is General now, as in Stores 11
  it('a ?tab= of a section the level does not have is general', () => {
    for (const tab of ['logs', 'paymethods', 'delivery_zones']) expect(resolveSection(tab, level5)).toBe('general')
  })

  it('the same holds before the group loads (the list of the add form) for level 5', () => {
    const loadingLevel5 = groupSections({ group: null, level: 5, autoassignType: 'advanced', t })
    for (const tab of ['logs', 'paymethods', 'delivery_zones']) expect(resolveSection(tab, loadingLevel5)).toBe('general')
    expect(resolveSection('schedule', loadingLevel5)).toBe('schedule')
  })

  it('other levels keep those sections, and a known ?tab= the list lacks for other reasons is still respected', () => {
    const admin = groupSections({ group, level: 0, autoassignType: 'advanced', t })
    for (const tab of ['logs', 'paymethods', 'delivery_zones']) expect(resolveSection(tab, admin)).toBe(tab)
    const loadingAdmin = groupSections({ group: null, level: 0, autoassignType: 'advanced', t })
    expect(resolveSection('logs', loadingAdmin)).toBe('logs')
    const basic = groupSections({ group, level: 5, autoassignType: 'basic', t })
    expect(resolveSection('advanced_logistics', basic)).toBe('advanced_logistics')
  })

  it('nothing, an unknown key or a non-string is general', () => {
    for (const tab of [undefined, null, '', 'nope', 'GENERAL', 'zones', 42, {}, ['logs']]) {
      expect(resolveSection(tab, level5)).toBe('general')
    }
  })

  it('knows the seven ids of main', () => {
    expect(GROUP_SECTION_IDS).toEqual(['general', 'businesses', 'paymethods', 'delivery_zones', 'schedule', 'advanced_logistics', 'logs'])
    for (const id of GROUP_SECTION_IDS) expect(resolveSection(id, [])).toBe(id)
  })
})

describe('discardTexts', () => {
  it('is the four texts of the guard (decision 17), the keys of the drivers guard', () => {
    const keys = []
    const texts = discardTexts((key, fallback) => { keys.push(key); return fallback })
    expect(texts).toEqual({
      discardTitle: 'Discard your changes?',
      discardDescription: 'What you changed here is not saved yet.',
      discardConfirmLabel: 'Discard',
      keepEditingLabel: 'Keep editing'
    })
    expect(keys).toEqual(['ORDER_PANEL_DISCARD_TITLE', 'DRIVERS_DISCARD_BODY', 'DISCARD', 'KEEP_EDITING'])
  })
})
