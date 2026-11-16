// redesign DS-B3 (decisions 1, 5, 17 | M-DS13, M-DS22): the sections of the provider panel, the map from `?tab=`, the texts of the
// discard guard and the keys the autoassignment block saves on change. Pure: no React, no network.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  AUTOSAVE_KEYS,
  PROVIDER_SECTION_IDS,
  autosaveChanges,
  discardTexts,
  providerSections,
  resolveSection
} from '../providerSections'

const t = (_key, fallback) => fallback
const recordingT = () => {
  const keys = []
  const translate = (key, fallback) => { keys.push(key); return fallback }
  return { keys, translate }
}

const labels = (sections) => sections.map(section => section.label)
const ids = (sections) => sections.map(section => section.id)

describe('providerSections (decision 1, decision 5)', () => {
  it('has the five sections in the order of the panel, with the ?tab= keys of main', () => {
    const sections = providerSections({ availableModifyData: true, t })
    expect(ids(sections)).toEqual(['general', 'businesses', 'schedule', 'paymethods', 'delivery_zones'])
    expect(PROVIDER_SECTION_IDS).toEqual(['general', 'businesses', 'schedule', 'paymethods', 'delivery_zones'])
  })

  it('names General «Credentials» (decision 5) and keeps the rest of the names', () => {
    const sections = providerSections({ availableModifyData: true, t })
    expect(labels(sections)).toEqual(['Credentials', 'Businesses', 'Schedule', 'Payment methods', 'Delivery zones'])
  })

  it('asks for every text with its key: the new ones prefixed, the old ones with their canonical text', () => {
    const { keys, translate } = recordingT()
    providerSections({ availableModifyData: false, t: translate })
    expect(keys).toEqual(expect.arrayContaining([
      'DELIVERY_SERVICES_CREDENTIALS',
      'BUSINESSES',
      'SCHEDULE',
      'PAYMENT_METHODS',
      'DELIVERY_ZONES_TITLE',
      'DELIVERY_SERVICES_COMPLETE_CREDENTIALS_FIRST'
    ]))
  })

  it('without the credentials complete the other four are disabled and say why (M-DS22)', () => {
    const sections = providerSections({ availableModifyData: false, t })
    const [general, ...others] = sections
    expect(general.disabled).toBeFalsy()
    expect(general.description).toBeUndefined()
    expect(others).toHaveLength(4)
    for (const section of others) {
      expect(section.disabled).toBe(true)
      expect(section.description).toBe('Complete the credentials first')
    }
  })

  it('with the credentials complete nothing is disabled and nothing carries the reason', () => {
    for (const section of providerSections({ availableModifyData: true, t })) {
      expect(section.disabled).toBeFalsy()
      expect(section.description).toBeUndefined()
    }
  })

  it('an availableModifyData that is not true (undefined, null, 0) counts as incomplete', () => {
    for (const value of [undefined, null, 0, '']) {
      const sections = providerSections({ availableModifyData: value, t })
      expect(sections.slice(1).every(section => section.disabled === true)).toBe(true)
    }
  })
})

describe('resolveSection (decision 1 | M-DS21, M-DS22)', () => {
  const open = providerSections({ availableModifyData: true, t })
  const closed = providerSections({ availableModifyData: false, t })

  it.each(PROVIDER_SECTION_IDS)('a known and enabled ?tab=%s is respected', (tab) => {
    expect(resolveSection(tab, open)).toBe(tab)
  })

  it('General is respected even when the others are disabled', () => {
    expect(resolveSection('general', closed)).toBe('general')
  })

  it.each(['businesses', 'schedule', 'paymethods', 'delivery_zones'])('a known but disabled %s is General', (tab) => {
    expect(resolveSection(tab, closed)).toBe('general')
  })

  it.each([['an unknown key', 'nope'], ['an empty string', ''], ['undefined', undefined], ['null', null], ['a number', 3], ['an array', ['schedule']]])(
    '%s is General',
    (_label, tab) => {
      expect(resolveSection(tab, open)).toBe('general')
    }
  )

  it('a key main did not have for providers (logs, advanced_logistics) is General', () => {
    expect(resolveSection('logs', open)).toBe('general')
    expect(resolveSection('advanced_logistics', open)).toBe('general')
  })
})

describe('discardTexts (decision 17)', () => {
  it('are the four texts of the drivers panel guard, with its keys', () => {
    const { keys, translate } = recordingT()
    expect(discardTexts(translate)).toEqual({
      discardTitle: 'Discard your changes?',
      discardDescription: 'What you changed here is not saved yet.',
      discardConfirmLabel: 'Discard',
      keepEditingLabel: 'Keep editing'
    })
    expect(keys).toEqual(['ORDER_PANEL_DISCARD_TITLE', 'DRIVERS_DISCARD_BODY', 'DISCARD', 'KEEP_EDITING'])
  })
})

// The keys are the ones the three pieces that write the autoassignment really write: this test reads the sources, so a key that
// is not in them (an invented one) or a source that stops writing one is red.
const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

describe('AUTOSAVE_KEYS (M-DS13)', () => {
  const logistics = source('../../DriversGroupsLogisticsService/index.js')
  const autoassignService = source('../../DriversGroupAutoassignService/index.js')
  const autoassignController = source('../../../../../../components/DriversGroupAutoassign/index.js')

  it('is exactly the keys the autoassignment block and its controller write', () => {
    expect([...AUTOSAVE_KEYS].sort()).toEqual([
      'autoassign_amount_drivers',
      'autoassign_autoassign_driver',
      'autoassign_autoreject_time',
      'autoassign_increment_radius',
      'autoassign_initial_radius',
      'autoassign_max_azimuth_diff',
      'autoassign_max_radius',
      'autoreject_after_expiration',
      'orders_group_start_in_status'
    ])
  })

  it('every key is written by one of the three sources (none is invented)', () => {
    const sources = [logistics, autoassignService, autoassignController].join('\n')
    for (const key of AUTOSAVE_KEYS) {
      expect(sources, key).toContain(key)
    }
  })

  it('the start status is written by DriversGroupsLogisticsService and the two checkboxes by DriversGroupAutoassignService', () => {
    expect(logistics).toContain('orders_group_start_in_status')
    expect(autoassignService).toContain('autoassign_autoassign_driver')
    expect(autoassignService).toContain('autoreject_after_expiration')
  })

  it('does not include the keys of the sections that share changesState', () => {
    for (const key of ['business', 'allowed_paymethods', 'enabled', 'name', 'schedule']) {
      expect(AUTOSAVE_KEYS).not.toContain(key)
    }
  })
})

describe('autosaveChanges (M-DS13)', () => {
  it('keeps only the autoassignment keys, with their values (false and 0 too)', () => {
    expect(autosaveChanges({
      business: '[1,2]',
      allowed_paymethods: '[3]',
      orders_group_start_in_status: 4,
      autoassign_autoassign_driver: false,
      autoreject_after_expiration: true,
      autoassign_autoreject_time: 0
    })).toEqual({
      orders_group_start_in_status: 4,
      autoassign_autoassign_driver: false,
      autoreject_after_expiration: true,
      autoassign_autoreject_time: 0
    })
  })

  it('is empty when only the other sections have pending changes (so nothing is sent)', () => {
    expect(autosaveChanges({ business: '[1]', allowed_paymethods: '[]' })).toEqual({})
  })

  it.each([[undefined], [null], [{}]])('is empty for %s', (value) => {
    expect(autosaveChanges(value)).toEqual({})
  })

  it('does not change the state it is given', () => {
    const state = { business: '[1]', autoreject_after_expiration: true }
    const copy = { ...state }
    autosaveChanges(state)
    expect(state).toEqual(copy)
  })
})
