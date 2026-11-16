// redesign SL-F1 (A1): the pure model of the stores list. The bulk actions call the controller as DashboardBusinessList defines it
// (handleEnableAllBusiness(value, isFeatured), handleDeleteMultiBusinesses()), the confirmations say the verb and the count (C8),
// and the filter values keep the shape of the BusinessFilter controller of main (replayed in legacyBusinessFilter.js), which is
// what the list reads.
import { describe, expect, it, vi } from 'vitest'

import { legacyBusinessFilter } from './legacyBusinessFilter'
import {
  BULK_ACTIONS,
  BULK_ACTION_IDS,
  availableBulkActions,
  bulkConfirmCopy,
  hasActiveFilters,
  initialFilterValues,
  nextFilterValues,
  readFilterValues,
  runBulkAction,
  sameFilterValues,
  toggleCityId
} from '../storesListModel'

const t = (_key, text) => text

describe('BULK_ACTIONS', () => {
  it('has the five actions, in the order of the bar', () => {
    expect(BULK_ACTION_IDS).toEqual(['enable', 'disable', 'feature', 'unfeature', 'delete'])
    expect(Object.keys(BULK_ACTIONS)).toEqual(BULK_ACTION_IDS)
  })

  it('maps each action to the arguments of handleEnableAllBusiness(value, isFeatured)', () => {
    expect(BULK_ACTIONS.enable).toMatchObject({ handler: 'handleEnableAllBusiness', args: [true, false] })
    expect(BULK_ACTIONS.disable).toMatchObject({ handler: 'handleEnableAllBusiness', args: [false, false] })
    expect(BULK_ACTIONS.feature).toMatchObject({ handler: 'handleEnableAllBusiness', args: [true, true] })
    expect(BULK_ACTIONS.unfeature).toMatchObject({ handler: 'handleEnableAllBusiness', args: [false, true] })
  })

  it('delete is handleDeleteMultiBusinesses with no arguments, behind ConfirmAdmin; the rest ask a dialog', () => {
    expect(BULK_ACTIONS.delete).toMatchObject({ handler: 'handleDeleteMultiBusinesses', args: [], confirm: 'admin' })
    expect(['enable', 'disable', 'feature', 'unfeature'].map(id => BULK_ACTIONS[id].confirm)).toEqual(['dialog', 'dialog', 'dialog', 'dialog'])
  })

  it('is frozen: nobody edits the arguments of an action', () => {
    expect(Object.isFrozen(BULK_ACTIONS)).toBe(true)
    expect(Object.isFrozen(BULK_ACTIONS.enable.args)).toBe(true)
  })
})

describe('availableBulkActions', () => {
  it('offers all five to a session that sees the Featured column', () => {
    expect(availableBulkActions()).toEqual(['enable', 'disable', 'feature', 'unfeature', 'delete'])
    expect(availableBulkActions({ isRestricted: false })).toEqual(BULK_ACTION_IDS)
  })

  it('leaves Feature and Unfeature out when the Featured column is restricted', () => {
    expect(availableBulkActions({ isRestricted: true })).toEqual(['enable', 'disable', 'delete'])
  })
})

describe('runBulkAction', () => {
  const handlers = () => ({ handleEnableAllBusiness: vi.fn(() => 'enabled'), handleDeleteMultiBusinesses: vi.fn(() => 'deleted') })

  it.each([
    ['enable', [true, false]],
    ['disable', [false, false]],
    ['feature', [true, true]],
    ['unfeature', [false, true]]
  ])('%s calls handleEnableAllBusiness once with %j', (id, args) => {
    const h = handlers()
    expect(runBulkAction(id, h)).toBe('enabled')
    expect(h.handleEnableAllBusiness).toHaveBeenCalledTimes(1)
    expect(h.handleEnableAllBusiness).toHaveBeenCalledWith(...args)
    expect(h.handleDeleteMultiBusinesses).not.toHaveBeenCalled()
  })

  it('delete calls handleDeleteMultiBusinesses once, with nothing', () => {
    const h = handlers()
    expect(runBulkAction('delete', h)).toBe('deleted')
    expect(h.handleDeleteMultiBusinesses).toHaveBeenCalledTimes(1)
    expect(h.handleDeleteMultiBusinesses).toHaveBeenCalledWith()
    expect(h.handleEnableAllBusiness).not.toHaveBeenCalled()
  })

  it('throws on an unknown action and on a missing handler', () => {
    expect(() => runBulkAction('archive', handlers())).toThrow('Unknown bulk action: archive')
    expect(() => runBulkAction('delete', {})).toThrow('Bulk action delete needs handleDeleteMultiBusinesses')
  })
})

describe('bulkConfirmCopy', () => {
  it('says the verb and the count in the title and the button: «Disable 2 stores?»', () => {
    const copy = bulkConfirmCopy('disable', ['Sample Burgers', 'Demo Bakery'], t)
    expect(copy.title).toBe('Disable 2 stores?')
    expect(copy.confirmLabel).toBe('Disable 2 stores')
    expect(copy.description).toBe('Sample Burgers, Demo Bakery will be disabled.')
  })

  it('names up to three stores and counts the rest as «+N more»', () => {
    const copy = bulkConfirmCopy('disable', ['A', 'B', 'C', 'D', 'E', 'F'], t)
    expect(copy.title).toBe('Disable 6 stores?')
    expect(copy.description).toBe('A, B, C +3 more will be disabled.')
    expect(bulkConfirmCopy('enable', ['A', 'B', 'C'], t).description).toBe('A, B, C will be enabled.')
  })

  it('counts the stores whose name the caller does not know (a selection that spans pages)', () => {
    const copy = bulkConfirmCopy('delete', ['A', 'B'], t, 7)
    expect(copy.title).toBe('Delete 7 stores?')
    expect(copy.confirmLabel).toBe('Delete 7 stores')
    expect(copy.description).toBe('A, B +5 more will be deleted.')
  })

  it('uses the singular for one store (_ONE) and the plural for the rest (_OTHER)', () => {
    const keys = []
    const spy = (key, text) => { keys.push(key); return text }
    expect(bulkConfirmCopy('feature', ['Sample Burgers'], spy)).toEqual({
      title: 'Feature 1 store?',
      description: 'Sample Burgers will be featured.',
      confirmLabel: 'Feature 1 store'
    })
    expect(keys).toEqual(expect.arrayContaining(['STORES_BULK_FEATURE_TITLE_ONE', 'STORES_BULK_FEATURE_CONFIRM_ONE']))
    expect(keys.some(key => key.endsWith('_OTHER'))).toBe(false)
    keys.length = 0
    bulkConfirmCopy('feature', ['A', 'B'], spy)
    expect(keys).toEqual(expect.arrayContaining(['STORES_BULK_FEATURE_TITLE_OTHER', 'STORES_BULK_FEATURE_CONFIRM_OTHER']))
    expect(keys.some(key => key.endsWith('_ONE'))).toBe(false)
  })

  it.each([
    ['enable', 'Enable 3 stores?', 'Enable 3 stores', 'A, B, C will be enabled.'],
    ['disable', 'Disable 3 stores?', 'Disable 3 stores', 'A, B, C will be disabled.'],
    ['feature', 'Feature 3 stores?', 'Feature 3 stores', 'A, B, C will be featured.'],
    ['unfeature', 'Unfeature 3 stores?', 'Unfeature 3 stores', 'A, B, C will no longer be featured.'],
    ['delete', 'Delete 3 stores?', 'Delete 3 stores', 'A, B, C will be deleted.']
  ])('%s: title, button and description', (action, title, confirmLabel, description) => {
    expect(bulkConfirmCopy(action, ['A', 'B', 'C'], t)).toEqual({ title, description, confirmLabel })
  })

  it('does not read «+4 more will be disabled» when no name is known: it says how many', () => {
    expect(bulkConfirmCopy('disable', [], t, 4).description).toBe('4 stores will be disabled.')
    expect(bulkConfirmCopy('disable', [], t, 1).description).toBe('1 store will be disabled.')
  })

  it('ignores empty names and fills the count placeholders of a translated text', () => {
    const translated = (key, text) => (key === 'STORES_BULK_DISABLE_TITLE_OTHER' ? '¿Desactivar _count_ tiendas?' : text)
    const copy = bulkConfirmCopy('disable', ['A', '', null, 'B'], translated)
    expect(copy.title).toBe('¿Desactivar 2 tiendas?')
    expect(copy.description).toBe('A, B will be disabled.')
  })

  it('throws on an unknown action', () => {
    expect(() => bulkConfirmCopy('archive', ['A'], t)).toThrow('Unknown bulk action: archive')
  })
})

// What the old filter modal held: the state of the BusinessFilter controller of main.
const modalState = legacyBusinessFilter

describe('filter values', () => {
  it('the empty shape is the one the BusinessFilter controller starts from', () => {
    expect(initialFilterValues()).toEqual(modalState().values)
  })

  it('every call gives a fresh object, so a refetch always sees a new one', () => {
    const a = initialFilterValues()
    a.cityIds.push(1)
    expect(initialFilterValues().cityIds).toEqual([])
    expect(readFilterValues({})).not.toBe(readFilterValues({}))
  })

  it('a city change produces what handleChangeCity then Accept gave', () => {
    const modal = modalState()
    modal.change(p => p.handleChangeCity(10))
    expect(nextFilterValues({}, { cityIds: toggleCityId([], 10) })).toEqual(modal.values)
    modal.change(p => p.handleChangeCity(11))
    expect(nextFilterValues(modal.values, { cityIds: [10, 11] })).toEqual(modal.values)
    modal.change(p => p.handleChangeCity(10)) // a second press removes it
    expect(toggleCityId([10, 11], 10)).toEqual(modal.values.cityIds)
  })

  it('Featured, Name and External ID produce what handleChangeValue then Accept gave', () => {
    const modal = modalState()
    modal.change(p => p.handleChangeValue({ featured: true }))
    expect(nextFilterValues({}, { featured: true })).toEqual(modal.values)
    modal.change(p => p.handleChangeValue({ featured: false, name: 'Bur', externalId: '77' }))
    expect(nextFilterValues({}, { featured: false, name: 'Bur', externalId: '77' })).toEqual(modal.values)
  })

  it('keeps the other filters when one changes', () => {
    const current = nextFilterValues({}, { cityIds: [10], featured: true })
    expect(nextFilterValues(current, { name: 'Bur' })).toEqual({ ...initialFilterValues(), cityIds: [10], featured: true, name: 'Bur' })
  })

  it('«Clear» is {}: when the last filter goes, the result is {} and not the empty shape', () => {
    const current = nextFilterValues({}, { featured: true })
    expect(nextFilterValues(current, { featured: null })).toEqual({})
    expect(nextFilterValues({ ...initialFilterValues(), cityIds: [3] }, { cityIds: [] })).toEqual({})
  })

  it('an empty text or only spaces goes back to null, the empty value of the shape', () => {
    const current = nextFilterValues({}, { name: 'Bur', featured: true })
    expect(nextFilterValues(current, { name: '' }).name).toBeNull()
    expect(nextFilterValues(current, { name: '   ' }).name).toBeNull()
    expect(nextFilterValues(current, { externalId: '' }).externalId).toBeNull()
    expect(nextFilterValues({}, { name: '  ' })).toEqual({})
  })

  it('hasActiveFilters is false for {} and the empty shape, true for any filter in use', () => {
    expect(hasActiveFilters(undefined)).toBe(false)
    expect(hasActiveFilters({})).toBe(false)
    expect(hasActiveFilters(initialFilterValues())).toBe(false)
    expect(hasActiveFilters({ ...initialFilterValues(), featured: false })).toBe(true)
    expect(hasActiveFilters({ ...initialFilterValues(), enabled: true })).toBe(true)
    expect(hasActiveFilters({ ...initialFilterValues(), cityIds: [1] })).toBe(true)
    expect(hasActiveFilters({ ...initialFilterValues(), name: 'a' })).toBe(true)
    expect(hasActiveFilters({ ...initialFilterValues(), externalId: 'a' })).toBe(true)
    expect(hasActiveFilters({ ...initialFilterValues(), menus: { value: '3', condition: '>' } })).toBe(true)
  })
})

// redesign stores 1.C, G1-06: a change that leaves the filters as they are must not reach the list (each new object is
// a request of the list), so the bar compares before it sends.
describe('sameFilterValues', () => {
  it('{} and the empty shape are the same: no filter either way', () => {
    expect(sameFilterValues({}, {})).toBe(true)
    expect(sameFilterValues({}, initialFilterValues())).toBe(true)
    expect(sameFilterValues(undefined, {})).toBe(true)
    expect(sameFilterValues(nextFilterValues({}, { name: '' }), {})).toBe(true)
    expect(sameFilterValues(nextFilterValues({}, { externalId: '   ' }), {})).toBe(true)
  })

  it('the same filters in a new object are the same; any other value is not', () => {
    const current = { ...initialFilterValues(), name: 'bur', cityIds: [10, 11] }
    expect(sameFilterValues(nextFilterValues(current, { name: 'bur' }), current)).toBe(true)
    expect(sameFilterValues(nextFilterValues(current, { name: 'burg' }), current)).toBe(false)
    expect(sameFilterValues(nextFilterValues(current, { cityIds: [10] }), current)).toBe(false)
    expect(sameFilterValues(nextFilterValues(current, { featured: false }), current)).toBe(false)
    expect(sameFilterValues(nextFilterValues(current, { name: null, cityIds: [] }), current)).toBe(false)
  })
})
