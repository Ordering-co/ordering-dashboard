import { describe, expect, it } from 'vitest'

import { assignsTo, groupName, managerNames, managerText, storesCount, storesText, typeLabel } from '../groupData'

// redesign DG-B3 (decision 2 | M-DG36): what the groups list reads from a group the API returns
const t = (_key, fallback) => fallback

const ana = { id: 1, name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com', photo: null }
const bruno = { id: 2, name: 'Bruno', lastname: 'Paz', email: 'bruno@example.com' }

describe('managerNames (M-DG36)', () => {
  it('reads group.administrators as «name lastname»', () => {
    expect(managerNames({ administrators: [ana, bruno] })).toEqual(['Ana Ruiz', 'Bruno Paz'])
  })

  it('falls back to group.administrator when administrators is empty or missing', () => {
    expect(managerNames({ administrators: [], administrator: ana })).toEqual(['Ana Ruiz'])
    expect(managerNames({ administrator: bruno })).toEqual(['Bruno Paz'])
  })

  it('prefers administrators over administrator', () => {
    expect(managerNames({ administrators: [bruno], administrator: ana })).toEqual(['Bruno Paz'])
  })

  it('is [] when there is nobody, and tolerates a missing group', () => {
    expect(managerNames({ administrators: [] })).toEqual([])
    expect(managerNames({})).toEqual([])
    expect(managerNames(null)).toEqual([])
    expect(managerNames(undefined)).toEqual([])
  })

  it('cleans stray spaces and a missing lastname; a manager with no name shows the email, not nothing', () => {
    expect(managerNames({ administrators: [{ name: ' Ana ', lastname: null }] })).toEqual(['Ana'])
    expect(managerNames({ administrators: [{ name: '  Ana   Maria ', lastname: 'Ruiz' }] })).toEqual(['Ana Maria Ruiz'])
    expect(managerNames({ administrators: [{ name: '', lastname: '', email: 'x@example.com' }] })).toEqual(['x@example.com'])
    expect(managerNames({ administrators: [{ name: '', lastname: '' }] })).toEqual([])
  })
})

describe('managerText', () => {
  it('one manager: the name', () => {
    expect(managerText({ administrators: [ana] }, t)).toBe('Ana Ruiz')
  })

  it('two or more: the first and «+N» for the rest', () => {
    expect(managerText({ administrators: [ana, bruno] }, t)).toBe('Ana Ruiz +1')
    expect(managerText({ administrators: [ana, bruno, { name: 'Carla' }] }, t)).toBe('Ana Ruiz +2')
  })

  it('none: «No manager»', () => {
    expect(managerText({ administrators: [] }, t)).toBe('No manager')
    expect(managerText({}, t)).toBe('No manager')
  })
})

describe('assignsTo', () => {
  it('type 0 counts drivers, with a plural', () => {
    expect(assignsTo({ type: 0, drivers: new Array(12).fill({}) }, t)).toBe('12 drivers')
    expect(assignsTo({ type: 0, drivers: [{}] }, t)).toBe('1 driver')
    expect(assignsTo({ type: 0, drivers: [] }, t)).toBe('0 drivers')
  })

  it('type 1 counts driver companies, with a plural', () => {
    expect(assignsTo({ type: 1, driver_companies: [{}] }, t)).toBe('1 company')
    expect(assignsTo({ type: 1, driver_companies: [{}, {}, {}] }, t)).toBe('3 companies')
  })

  it('reads the type from a string too, and counts the list of its own type only', () => {
    expect(assignsTo({ type: '1', drivers: [{}, {}], driver_companies: [{}] }, t)).toBe('1 company')
    expect(assignsTo({ type: '0', drivers: [{}, {}], driver_companies: [{}] }, t)).toBe('2 drivers')
  })

  it('a missing list is zero; an unknown type says nothing', () => {
    expect(assignsTo({ type: 0 }, t)).toBe('0 drivers')
    expect(assignsTo({ type: 1 }, t)).toBe('0 companies')
    expect(assignsTo({ type: 7, drivers: [{}] }, t)).toBe('')
    expect(assignsTo(null, t)).toBe('')
  })

  it('asks for the plural keys _ONE and _OTHER', () => {
    const keys = []
    const spy = (key, fallback) => { keys.push(key); return fallback }
    assignsTo({ type: 0, drivers: [{}] }, spy)
    assignsTo({ type: 0, drivers: [{}, {}] }, spy)
    assignsTo({ type: 1, driver_companies: [{}] }, spy)
    assignsTo({ type: 1, driver_companies: [{}, {}] }, spy)
    expect([...new Set(keys)].sort()).toEqual([
      'DRIVERS_GROUPS_COMPANIES_COUNT_ONE',
      'DRIVERS_GROUPS_COMPANIES_COUNT_OTHER',
      'DRIVERS_GROUPS_DRIVERS_COUNT_ONE',
      'DRIVERS_GROUPS_DRIVERS_COUNT_OTHER'
    ])
  })
})

describe('storesCount and storesText', () => {
  it('counts group.business; missing is 0', () => {
    expect(storesCount({ business: [{}, {}, {}] })).toBe(3)
    expect(storesCount({ business: [] })).toBe(0)
    expect(storesCount({})).toBe(0)
    expect(storesCount(null)).toBe(0)
  })

  it('says «1 store» or «N stores» with the keys the stores list already has', () => {
    expect(storesText({ business: [{}] }, t)).toBe('1 store')
    expect(storesText({ business: [{}, {}] }, t)).toBe('2 stores')
    expect(storesText({}, t)).toBe('0 stores')
  })
})

describe('typeLabel and groupName', () => {
  it('names the two types with the keys of today', () => {
    const keys = []
    const spy = (key, fallback) => { keys.push(key); return fallback }
    expect(typeLabel({ type: 0 }, spy)).toBe('In house drivers')
    expect(typeLabel({ type: '1' }, spy)).toBe('Driver companies')
    expect(keys).toEqual(['IN_HOUSE_DRIVERS', 'DRIVER_COMPANIES'])
    expect(typeLabel({ type: 9 }, t)).toBe('')
  })

  it('a group with no name says so', () => {
    expect(groupName({ name: 'Downtown A' }, t)).toBe('Downtown A')
    expect(groupName({ name: '  ' }, t)).toBe('No name')
    expect(groupName({}, t)).toBe('No name')
  })
})
