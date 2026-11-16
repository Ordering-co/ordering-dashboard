// redesign drivers-dashboard B1 (decisions 3, 6, 8, DD-07, DD-11: pure driver state)
import { describe, expect, it } from 'vitest'

import {
  DRIVER_LOADS,
  SIGNAL_STALE_MINUTES,
  applyLoad,
  countLoad,
  driverGroups,
  driverState,
  filterByGroups,
  fullName,
  groupOptions,
  isOffline,
  isOnline,
  parseGroupIds,
  signalOf,
  splitDrivers
} from '../driverState'

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0)

const availableFree = { id: 1, name: 'Ana', lastname: 'Free', enabled: true, available: true, busy: false }
const availableBusy = { id: 2, name: 'Beto', lastname: 'Busy', enabled: true, available: true, busy: true }
const offlineFree = { id: 3, name: 'Carla', lastname: 'Off', enabled: true, available: false, busy: false }
const offlineBusy = { id: 4, name: 'Dani', lastname: 'OffBusy', enabled: true, available: false, busy: true }
const disabled = { id: 5, name: 'Eva', lastname: 'Disabled', enabled: false, available: true, busy: false }
const spaced = { id: 6, name: 'Marco ', lastname: ' Test', enabled: true, available: true, busy: false }
const drivers = [availableFree, offlineFree, availableBusy, disabled, offlineBusy, spaced]

describe('constants', () => {
  it('exposes the stale threshold and the load options', () => {
    expect(SIGNAL_STALE_MINUTES).toBe(15)
    expect(DRIVER_LOADS).toEqual(['all', 'notBusy', 'busy'])
  })
})

describe('fullName', () => {
  it('trims and collapses inner spaces', () => {
    expect(fullName(spaced)).toBe('Marco Test')
    expect(fullName({ name: '  Ana   María ', lastname: 'Pérez  ' })).toBe('Ana María Pérez')
  })

  it('handles missing parts', () => {
    expect(fullName({ name: 'Ana' })).toBe('Ana')
    expect(fullName({ lastname: 'Pérez' })).toBe('Pérez')
    expect(fullName({})).toBe('')
    expect(fullName(null)).toBe('')
  })
})

describe('driverState / isOnline / isOffline', () => {
  it('maps each driver to its state', () => {
    expect(driverState(availableFree)).toBe('available')
    expect(driverState(availableBusy)).toBe('busy')
    expect(driverState(offlineFree)).toBe('offline')
    expect(driverState(offlineBusy)).toBe('offline')
    expect(driverState(spaced)).toBe('available')
  })

  it('follows main rules for membership', () => {
    expect(isOnline(availableFree)).toBe(true)
    expect(isOnline(availableBusy)).toBe(true)
    expect(isOnline(offlineFree)).toBe(false)
    expect(isOnline(disabled)).toBe(false)
    expect(isOffline(offlineFree)).toBe(true)
    expect(isOffline(offlineBusy)).toBe(true)
    expect(isOffline(availableFree)).toBe(false)
    expect(isOffline(disabled)).toBe(false)
    expect(isOnline(null)).toBe(false)
    expect(isOffline(undefined)).toBe(false)
  })
})

describe('splitDrivers', () => {
  it('splits enabled drivers 2 online / 2 offline keeping the input order', () => {
    const { online, offline } = splitDrivers(drivers)
    expect(online.map(d => d.id)).toEqual([1, 2, 6])
    expect(offline.map(d => d.id)).toEqual([3, 4])
  })

  it('leaves out disabled drivers', () => {
    const { online, offline } = splitDrivers(drivers)
    expect([...online, ...offline]).not.toContain(disabled)
  })

  it('returns empty lists for null', () => {
    expect(splitDrivers(null)).toEqual({ online: [], offline: [] })
    expect(splitDrivers(undefined)).toEqual({ online: [], offline: [] })
  })
})

describe('applyLoad', () => {
  const { online, offline } = splitDrivers(drivers)

  it('all returns the list', () => {
    expect(applyLoad(online, 'all')).toEqual(online)
    expect(applyLoad(offline, 'all')).toEqual(offline)
  })

  it('busy keeps only busy drivers', () => {
    expect(applyLoad(online, 'busy').map(d => d.id)).toEqual([2])
    expect(applyLoad(offline, 'busy').map(d => d.id)).toEqual([4])
  })

  it('notBusy keeps only not busy drivers', () => {
    expect(applyLoad(online, 'notBusy').map(d => d.id)).toEqual([1, 6])
    expect(applyLoad(offline, 'notBusy').map(d => d.id)).toEqual([3])
  })

  it('any other value behaves as all', () => {
    expect(applyLoad(online, 'whatever')).toEqual(online)
    expect(applyLoad(online, undefined)).toEqual(online)
  })

  it('tolerates a missing list', () => {
    expect(applyLoad(null, 'busy')).toEqual([])
  })
})

describe('countLoad', () => {
  it('counts all, busy and not busy', () => {
    const { online, offline } = splitDrivers(drivers)
    expect(countLoad(online)).toEqual({ all: 3, busy: 1, notBusy: 2 })
    expect(countLoad(offline)).toEqual({ all: 2, busy: 1, notBusy: 1 })
    expect(countLoad([])).toEqual({ all: 0, busy: 0, notBusy: 0 })
    expect(countLoad(null)).toEqual({ all: 0, busy: 0, notBusy: 0 })
  })
})

describe('driverGroups', () => {
  it('reads drivergroups', () => {
    expect(driverGroups({ drivergroups: [{ id: 1, name: 'North' }, { id: 2, name: 'South' }] }))
      .toEqual([{ id: 1, name: 'North' }, { id: 2, name: 'South' }])
  })

  it('falls back to driver_groups', () => {
    expect(driverGroups({ driver_groups: [{ id: 3, name: 'East' }] })).toEqual([{ id: 3, name: 'East' }])
  })

  it('never returns undefined', () => {
    expect(driverGroups({})).toEqual([])
    expect(driverGroups(null)).toEqual([])
    expect(driverGroups({ drivergroups: null })).toEqual([])
  })

  it('drops groups without a name', () => {
    expect(driverGroups({ drivergroups: [{ id: 1, name: 'North' }, { id: 2 }, { id: 3, name: '' }] }))
      .toEqual([{ id: 1, name: 'North' }])
  })
})

// (row 26, drivers-dashboard P1, D-33): the filter by driver group
describe('groupOptions', () => {
  it('lists each group once, sorted by name, from drivergroups with driver_groups as the fallback', () => {
    const list = [
      { id: 1, drivergroups: [{ id: 20, name: 'South' }, { id: 10, name: 'North' }] },
      { id: 2, drivergroups: [{ id: 10, name: 'North' }] },
      { id: 3, driver_groups: [{ id: 30, name: 'East' }] }
    ]
    expect(groupOptions(list)).toEqual([
      { id: 30, name: 'East' },
      { id: 10, name: 'North' },
      { id: 20, name: 'South' }
    ])
  })

  it('keeps a group without a name, as «#id»', () => {
    expect(groupOptions([{ id: 1, drivergroups: [{ id: 7 }, { id: 8, name: '' }] }])).toEqual([
      { id: 7, name: '#7' },
      { id: 8, name: '#8' }
    ])
  })

  it('is empty when no driver has a group or the input is not a list', () => {
    expect(groupOptions([{ id: 1, drivergroups: [] }, { id: 2 }])).toEqual([])
    expect(groupOptions(null)).toEqual([])
    expect(groupOptions(undefined)).toEqual([])
  })
})

describe('filterByGroups', () => {
  const list = [
    { id: 1, drivergroups: [{ id: 10, name: 'North' }] },
    { id: 2, drivergroups: [{ id: 20, name: 'South' }, { id: 10, name: 'North' }] },
    { id: 3, driver_groups: [{ id: 30, name: 'East' }] },
    { id: 4, drivergroups: [] }
  ]

  it('returns every driver when no group is chosen', () => {
    expect(filterByGroups(list, [])).toBe(list)
    expect(filterByGroups(list, undefined)).toBe(list)
  })

  it('keeps the drivers that belong to any of the chosen groups, in the order of the API', () => {
    expect(filterByGroups(list, [10]).map((driver) => driver.id)).toEqual([1, 2])
    expect(filterByGroups(list, [20, 30]).map((driver) => driver.id)).toEqual([2, 3])
  })

  it('returns nothing for a group nobody belongs to, and tolerates a bad list', () => {
    expect(filterByGroups(list, [99])).toEqual([])
    expect(filterByGroups(null, [10])).toEqual([])
  })
})

// (row 28, driver-store-status P-1): the «View drivers» exit of a store links to /drivers-dashboard?groups=<id[,id…]>
describe('parseGroupIds', () => {
  it('reads comma-separated positive integers from the search, in order', () => {
    expect(parseGroupIds('?groups=1,199')).toEqual([1, 199])
    expect(parseGroupIds('?id=7&groups=5')).toEqual([5])
    expect(parseGroupIds('groups=3,4')).toEqual([3, 4])
  })

  it('ignores invalid parts and repeats', () => {
    expect(parseGroupIds('?groups=1,abc,,0,-2,3.5,1e2,%2012, 7 ,7')).toEqual([1, 12, 7])
  })

  it('returns an empty list without the param, with an empty one, or with a bad search', () => {
    expect(parseGroupIds('')).toEqual([])
    expect(parseGroupIds('?id=7')).toEqual([])
    expect(parseGroupIds('?groups=')).toEqual([])
    expect(parseGroupIds('?groups=x,y')).toEqual([])
    expect(parseGroupIds(undefined)).toEqual([])
    expect(parseGroupIds(null)).toEqual([])
  })
})

describe('signalOf', () => {
  it('is fresh for an online driver seen 3 minutes ago', () => {
    expect(signalOf({ ...availableFree, last_location_at: '2026-10-09 11:57:00' }, NOW))
      .toEqual({ kind: 'fresh', minutes: 3 })
  })

  it('is stale for an online driver seen 20 minutes ago', () => {
    expect(signalOf({ ...availableFree, last_location_at: '2026-10-09 11:40:00' }, NOW))
      .toEqual({ kind: 'stale', minutes: 20 })
    expect(signalOf({ ...availableBusy, last_location_at: '2026-10-09 11:40:00' }, NOW).kind).toBe('stale')
  })

  it('does not warn at the threshold itself', () => {
    expect(signalOf({ ...availableFree, last_location_at: '2026-10-09 11:45:00' }, NOW))
      .toEqual({ kind: 'fresh', minutes: 15 })
  })

  it('does not warn for an offline driver seen 3 days ago', () => {
    expect(signalOf({ ...offlineFree, last_location_at: '2026-10-06 12:00:00' }, NOW))
      .toEqual({ kind: 'fresh', minutes: 4320 })
  })

  it('is none without a location', () => {
    expect(signalOf(availableFree, NOW)).toEqual({ kind: 'none', minutes: null })
    expect(signalOf({ ...availableFree, last_location_at: null }, NOW)).toEqual({ kind: 'none', minutes: null })
    expect(signalOf({ ...availableFree, last_location_at: 'garbage' }, NOW)).toEqual({ kind: 'none', minutes: null })
  })
})
