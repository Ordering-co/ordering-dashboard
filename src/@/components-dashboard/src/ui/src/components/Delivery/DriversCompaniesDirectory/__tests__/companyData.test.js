import { describe, expect, it } from 'vitest'

import { PRIORITY_VALUES, companyName, filterCompanies, isIntegration, priorityLabel } from '../companyData'

// redesign DC-B2 (decision 2 | M-DC12): what the driver companies list reads from a company the API returns
const t = (_key, fallback) => fallback

describe('companyName', () => {
  it('is the name without stray spaces', () => {
    expect(companyName({ name: 'Uber Direct' }, t)).toBe('Uber Direct')
    expect(companyName({ name: '  Uber   Direct ' }, t)).toBe('Uber Direct')
  })

  it('a company with no name (or a blank one) says «No name» with its key', () => {
    const keys = []
    const spy = (key, fallback) => { keys.push(key); return fallback }
    expect(companyName({ name: '   ' }, spy)).toBe('No name')
    expect(companyName({ name: null }, t)).toBe('No name')
    expect(companyName({}, t)).toBe('No name')
    expect(companyName(null, t)).toBe('No name')
    expect(companyName(undefined, t)).toBe('No name')
    expect(keys).toEqual(['DRIVERS_COMPANIES_NO_NAME'])
  })

  it('reads a numeric name as text', () => {
    expect(companyName({ name: 7 }, t)).toBe('7')
  })
})

describe('priorityLabel', () => {
  it('names the four priorities of main: Low, Normal, High, Urgent', () => {
    expect(PRIORITY_VALUES).toEqual([-1, 0, 1, 2])
    expect(PRIORITY_VALUES.map(value => priorityLabel(value, t))).toEqual(['Low', 'Normal', 'High', 'Urgent'])
  })

  it('reads a string like the API may send it (parseInt, as main)', () => {
    expect(priorityLabel('-1', t)).toBe('Low')
    expect(priorityLabel('0', t)).toBe('Normal')
    expect(priorityLabel('1', t)).toBe('High')
    expect(priorityLabel('2', t)).toBe('Urgent')
  })

  it('anything else is «Unknown», as main', () => {
    expect(priorityLabel(7, t)).toBe('Unknown')
    expect(priorityLabel(undefined, t)).toBe('Unknown')
    expect(priorityLabel(null, t)).toBe('Unknown')
    expect(priorityLabel('high', t)).toBe('Unknown')
  })

  it('asks for the keys main already has', () => {
    const keys = []
    const spy = (key, fallback) => { keys.push(key); return fallback }
    ;[-1, 0, 1, 2, 9].forEach(value => priorityLabel(value, spy))
    expect(keys).toEqual(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'UNKNOWN'])
  })
})

describe('isIntegration (M-DC12)', () => {
  it('is true only for owner_type system', () => {
    expect(isIntegration({ owner_type: 'system' })).toBe(true)
    expect(isIntegration({ owner_type: 'user' })).toBe(false)
    expect(isIntegration({ owner_type: 'System' })).toBe(false)
    expect(isIntegration({})).toBe(false)
    expect(isIntegration(null)).toBe(false)
    expect(isIntegration(undefined)).toBe(false)
  })
})

describe('filterCompanies', () => {
  const uber = { id: 1, name: 'Uber Direct' }
  const door = { id: 2, name: 'DoorDash' }
  const nameless = { id: 3 }
  const list = [uber, door, nameless]

  it('filters by name, ignoring case, keeping the order', () => {
    expect(filterCompanies(list, 'uber')).toEqual([uber])
    expect(filterCompanies(list, 'DOOR')).toEqual([door])
    expect(filterCompanies(list, 'r')).toEqual([uber, door])
  })

  it('an empty or blank search returns the list', () => {
    expect(filterCompanies(list, '')).toBe(list)
    expect(filterCompanies(list, '   ')).toBe(list)
    expect(filterCompanies(list, undefined)).toBe(list)
    expect(filterCompanies(list, null)).toBe(list)
  })

  it('a company with no name never matches a search', () => {
    expect(filterCompanies([nameless], 'a')).toEqual([])
  })

  it('searches by the name, not by the id or the timezone', () => {
    expect(filterCompanies([{ id: 5, name: 'Rappi', timezone: 'America/Bogota' }], 'bogota')).toEqual([])
    expect(filterCompanies([{ id: 5, name: 'Rappi' }], '5')).toEqual([])
  })

  it('tolerates a missing list', () => {
    expect(filterCompanies(undefined, 'a')).toEqual([])
    expect(filterCompanies(null, '')).toEqual([])
  })

  it('does not change the list it is given', () => {
    const copy = [...list]
    filterCompanies(list, 'uber')
    expect(list).toEqual(copy)
  })
})
