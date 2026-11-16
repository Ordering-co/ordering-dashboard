// redesign driver-store-status (decision 2 and 1): the stores that need attention come first, and the two
// order columns of today add up to the figures above the table.
import { describe, expect, it } from 'vitest'

import { buildGlobalKpis, buildOrderTotals, buildStoreRows } from '../aggregate'

const store = (id, name) => ({ id, name, enabled: true })
const groups = [
  { id: 1, business: [store(10, 'Bravo'), store(11, 'Alpha'), store(12, 'Charlie'), store(13, 'Delta'), store(14, 'Echo')] }
]
// Bravo: 2 online · Alpha: 0 online · Charlie: 1 online · Delta: 0 online · Echo: 1 online
const driversFor = (onlineByStore) => Object.entries(onlineByStore).flatMap(([storeId, online], index) =>
  Array.from({ length: online }, (_, n) => ({ id: index * 10 + n, enabled: true, available: true, drivergroups: [`g${storeId}`] })))
const perStoreGroups = [10, 11, 12, 13, 14].map(id => ({ id: `g${id}`, business: [groups[0].business.find(b => b.id === id)] }))

describe('buildStoreRows · attention order (decision 2)', () => {
  const drivers = driversFor({ 10: 2, 11: 0, 12: 1, 13: 0, 14: 1 })

  it('puts the stores without online drivers first, then the most unassigned orders, then the fewest online, then the name', () => {
    const activeByBusiness = new Map([[13, 3], [14, 2], [10, 5]])
    const rows = buildStoreRows({ groups: perStoreGroups, drivers, activeByBusiness })
    expect(rows.map(row => row.name)).toEqual(['Delta', 'Alpha', 'Bravo', 'Echo', 'Charlie'])
  })

  it('without orders it is main\'s order (fewest online first) with ties by name', () => {
    const rows = buildStoreRows({ groups: perStoreGroups, drivers })
    expect(rows.map(row => row.name)).toEqual(['Alpha', 'Delta', 'Charlie', 'Echo', 'Bravo'])
  })

  it('compares names in the reader\'s collation and never by id', () => {
    const accents = [{ id: 'g', business: [store(1, 'Éclair'), store(2, 'eagle'), store(3, 'Zeta')] }]
    expect(buildStoreRows({ groups: accents, drivers: [] }).map(row => row.name)).toEqual(['eagle', 'Éclair', 'Zeta'])
  })
})

describe('buildOrderTotals (decision 1)', () => {
  it('adds the active unassigned and finished today of the stores the table lists', () => {
    const rows = [
      { businessId: 1, activeOrders: 2, finishedToday: 4 },
      { businessId: 2, activeOrders: 0, finishedToday: 1 }
    ]
    expect(buildOrderTotals(rows)).toEqual({ activeUnassigned: 2, finishedToday: 5 })
  })

  it('is zero for no rows', () => {
    expect(buildOrderTotals([])).toEqual({ activeUnassigned: 0, finishedToday: 0 })
    expect(buildOrderTotals()).toEqual({ activeUnassigned: 0, finishedToday: 0 })
  })
})

// (row 31, driver-store-status P-9): per store, how many of its connected drivers are busy, and whether all of them are
describe('buildStoreRows · busy drivers (P-9)', () => {
  const busyGroups = [{ id: 1, business: [store(10, 'North'), store(11, 'South')] }, { id: 2, business: [store(12, 'East')] }]
  const driver = (id, over, group = 1) => ({ id, enabled: true, available: true, busy: false, drivergroups: [group], ...over })
  const rowOf = (rows, name) => rows.find(row => row.name === name)

  it('counts connected AND busy drivers, and flags allBusy when every connected driver is busy', () => {
    const rows = buildStoreRows({ groups: busyGroups, drivers: [driver(1, { busy: true }), driver(2, { busy: true }), driver(3, { busy: true }, 2), driver(4, {}, 2)] })
    expect(rowOf(rows, 'North')).toMatchObject({ connectedDrivers: 2, busyDrivers: 2, allBusy: true })
    expect(rowOf(rows, 'East')).toMatchObject({ connectedDrivers: 2, busyDrivers: 1, allBusy: false })
  })

  it('a store with no connected drivers is never allBusy (0 === 0 is not «all busy»)', () => {
    const rows = buildStoreRows({ groups: busyGroups, drivers: [] })
    rows.forEach(row => expect(row).toMatchObject({ connectedDrivers: 0, busyDrivers: 0, allBusy: false }))
  })

  it('does not count a busy driver that is disabled or offline', () => {
    const rows = buildStoreRows({
      groups: busyGroups,
      drivers: [driver(1, { busy: true, enabled: false }), driver(2, { busy: true, available: false }), driver(3, { busy: false })]
    })
    // the only connected driver is free; the disabled and the offline busy ones are not counted
    expect(rowOf(rows, 'North')).toMatchObject({ connectedDrivers: 1, busyDrivers: 0, allBusy: false })
  })

  it('stays false when the only busy drivers are not connected, and true when the lone connected one is busy', () => {
    const offlineOnly = buildStoreRows({ groups: busyGroups, drivers: [driver(1, { busy: true, available: false })] })
    expect(rowOf(offlineOnly, 'North')).toMatchObject({ connectedDrivers: 0, busyDrivers: 0, allBusy: false })
    const lone = buildStoreRows({ groups: busyGroups, drivers: [driver(1, { busy: true }), driver(2, { busy: true, available: false })] })
    expect(rowOf(lone, 'North')).toMatchObject({ connectedDrivers: 1, busyDrivers: 1, allBusy: true })
  })

  it('does not change the attention order: busy or free, the same stores come first', () => {
    const orderWith = busy => buildStoreRows({
      groups: busyGroups,
      drivers: [driver(1, { busy }), driver(2, {}), driver(3, { busy }, 2)]
    }).map(row => row.name)
    expect(orderWith(true)).toEqual(['East', 'North', 'South']) // fewest online first (East 1; North and South 2), then the name
    expect(orderWith(false)).toEqual(orderWith(true))
  })
})

// (row 30, driver-store-status P-8): the screen freezes the order between loads; buildStoreRows can take it
describe('buildStoreRows · frozen order (P-8)', () => {
  const drivers = driversFor({ 10: 2, 11: 0, 12: 1, 13: 0, 14: 1 })
  const namesOf = rows => rows.map(row => row.name)

  it('without `order` it is today\'s attention order', () => {
    expect(namesOf(buildStoreRows({ groups: perStoreGroups, drivers }))).toEqual(['Alpha', 'Delta', 'Charlie', 'Echo', 'Bravo'])
    expect(namesOf(buildStoreRows({ groups: perStoreGroups, drivers, order: undefined }))).toEqual(['Alpha', 'Delta', 'Charlie', 'Echo', 'Bravo'])
  })

  it('with `order` the rows follow it, whatever the attention order says now', () => {
    const order = [10, 12, 14, 11, 13] // Bravo, Charlie, Echo, Alpha, Delta
    expect(namesOf(buildStoreRows({ groups: perStoreGroups, drivers, order }))).toEqual(['Bravo', 'Charlie', 'Echo', 'Alpha', 'Delta'])
  })

  it('keeps the figures current while the rows keep their place', () => {
    const order = [10, 12, 14, 11, 13]
    const rows = buildStoreRows({ groups: perStoreGroups, drivers, activeByBusiness: new Map([[13, 9]]), order })
    expect(namesOf(rows)).toEqual(['Bravo', 'Charlie', 'Echo', 'Alpha', 'Delta'])
    expect(rows.find(row => row.name === 'Delta').activeOrders).toBe(9)
  })

  it('puts the stores that are not in `order` after those that are, by attention among themselves', () => {
    const order = [10, 12] // Bravo, Charlie; Alpha, Delta and Echo appeared
    expect(namesOf(buildStoreRows({ groups: perStoreGroups, drivers, order }))).toEqual(['Bravo', 'Charlie', 'Alpha', 'Delta', 'Echo'])
  })

  it('ignores ids of `order` that no longer exist, and an empty `order` is the attention order of the unknown', () => {
    expect(namesOf(buildStoreRows({ groups: perStoreGroups, drivers, order: [999, 12, 10] }))).toEqual(['Charlie', 'Bravo', 'Alpha', 'Delta', 'Echo'])
    expect(namesOf(buildStoreRows({ groups: perStoreGroups, drivers, order: [] }))).toEqual(['Alpha', 'Delta', 'Charlie', 'Echo', 'Bravo'])
  })
})

// (row 29, driver-store-status P-4): the active stores that are in no delivery group are listed too
describe('buildStoreRows and buildGlobalKpis · stores in no delivery group (P-4)', () => {
  const grouped = [{ id: 1, business: [store(10, 'Bravo'), store(11, 'Alpha')] }]
  const loose = { id: 20, name: 'Loose', enabled: true }
  const rowOf = (rows, name) => rows.find(row => row.name === name)
  const driver = { id: 1, enabled: true, available: true, busy: false, drivergroups: [1] }

  it('adds an enabled business that is in no group, once, with 0 drivers and ungrouped: true', () => {
    const rows = buildStoreRows({ groups: grouped, businesses: [loose, loose], drivers: [driver] })
    expect(rows.filter(row => row.businessId === 20)).toHaveLength(1)
    expect(rowOf(rows, 'Loose')).toEqual({
      businessId: 20,
      name: 'Loose',
      totalDrivers: 0,
      connectedDrivers: 0,
      busyDrivers: 0,
      allBusy: false,
      activeOrders: 0,
      finishedToday: 0,
      groupIds: [], // (row 28, driver-store-status P-1, D-22): a store of no group has none, so «View drivers» is not offered
      driverGroupIds: [], // (review L1)
      unassignedTab: 'inProgress', // (review M4): nothing waiting, the default tab
      ungrouped: true
    })
  })

  it('does not add a disabled business', () => {
    const rows = buildStoreRows({ groups: grouped, businesses: [{ id: 21, name: 'Closed', enabled: false }] })
    expect(rows.map(row => row.name).sort()).toEqual(['Alpha', 'Bravo'])
  })

  it('does not duplicate a store that is in a group and in the businesses, and does not mark it ungrouped', () => {
    const rows = buildStoreRows({ groups: grouped, businesses: [{ id: 10, name: 'Bravo', enabled: true }, loose], drivers: [driver] })
    expect(rows.filter(row => row.name === 'Bravo')).toHaveLength(1)
    expect(rowOf(rows, 'Bravo').ungrouped).toBeUndefined()
    expect(rowOf(rows, 'Bravo').connectedDrivers).toBe(1)
    expect(rows).toHaveLength(3)
  })

  it('counts the ungrouped store in the figure of total active stores', () => {
    expect(buildGlobalKpis({ groups: grouped, businesses: [loose, { id: 21, name: 'Closed', enabled: false }, { id: 10, name: 'Bravo', enabled: true }], drivers: [] }).totalStores).toBe(3)
  })

  it('without businesses it is exactly today (rows and KPIs, with no `ungrouped` key)', () => {
    const today = buildStoreRows({ groups: grouped, drivers: [driver] })
    expect(buildStoreRows({ groups: grouped, businesses: undefined, drivers: [driver] })).toEqual(today)
    expect(buildStoreRows({ groups: grouped, businesses: [], drivers: [driver] })).toEqual(today)
    today.forEach(row => expect(row).not.toHaveProperty('ungrouped'))
    expect(buildGlobalKpis({ groups: grouped, drivers: [driver] }).totalStores).toBe(2)
    expect(buildGlobalKpis({ groups: grouped, businesses: [], drivers: [driver] }).totalStores).toBe(2)
  })

  it('lists the businesses when no group came (groups failed): the page then works from the businesses alone', () => {
    expect(buildStoreRows({ groups: [], businesses: [loose] }).map(row => row.name)).toEqual(['Loose'])
  })

  it('is attention-ordered: an ungrouped store with active unassigned orders leads (nobody can deliver them); with none it goes last (live check)', () => {
    const online = [driver, { ...driver, id: 2 }] // Bravo and Alpha: 2 online each
    const activeByBusiness = new Map([[20, 4]])
    expect(buildStoreRows({ groups: grouped, businesses: [loose], drivers: online }).map(row => row.name)).toEqual(['Alpha', 'Bravo', 'Loose'])
    expect(buildStoreRows({ groups: grouped, businesses: [loose], drivers: online, activeByBusiness }).map(row => row.name)).toEqual(['Loose', 'Alpha', 'Bravo'])
    // against another store with no online driver, the one with more active unassigned orders comes first
    const offline = buildStoreRows({ groups: grouped, businesses: [loose], drivers: [], activeByBusiness })
    expect(offline[0].name).toBe('Loose')
    expect(offline[0].activeOrders).toBe(4)
  })

  it('keeps the frozen order working: a store that appears goes after those in `order`', () => {
    const rows = buildStoreRows({ groups: grouped, businesses: [loose], drivers: [driver], order: [11, 10] })
    expect(rows.map(row => row.name)).toEqual(['Alpha', 'Bravo', 'Loose'])
  })
})

// (row 28, driver-store-status P-1, D-22): the row carries the store's delivery groups, for the «View drivers» exit
describe('buildStoreRows · groupIds (row 28)', () => {
  const shared = store(10, 'Shared')
  const solo = store(11, 'Solo')
  const multi = [
    { id: 12, business: [shared] },
    { id: 3, business: [shared, solo] },
    { id: 12, business: [shared] } // the same group listed twice adds the id once
  ]
  const rowOf = (rows, name) => rows.find(row => row.name === name)

  it('exposes the ids of every group that lists the store, as a sorted array with no repeats', () => {
    const rows = buildStoreRows({ groups: multi, drivers: [] })
    expect(rowOf(rows, 'Shared').groupIds).toEqual([3, 12])
    expect(rowOf(rows, 'Solo').groupIds).toEqual([3])
    expect(Array.isArray(rowOf(rows, 'Solo').groupIds)).toBe(true)
  })

  it('is empty for a store of no group (businesses read apart from the groups)', () => {
    const rows = buildStoreRows({ groups: multi, businesses: [{ id: 20, name: 'Loose', enabled: true }], drivers: [] })
    expect(rowOf(rows, 'Loose').groupIds).toEqual([])
  })
})

// (review M4): «View unassigned orders» opens the /deliveries tab that holds the store's orders. «Active unassigned» counts
// pending (0) and in-progress orders alike, so a store whose orders are all pending must not land on an empty «In progress» tab.
describe('buildStoreRows · unassignedTab (review M4)', () => {
  const tabs = (activeByBusiness, activeInProgressByBusiness) => {
    const rows = buildStoreRows({ groups, drivers: [], activeByBusiness, activeInProgressByBusiness })
    return Object.fromEntries(rows.map(row => [row.businessId, row.unassignedTab]))
  }

  it('is «inProgress» when the store has any in-progress unassigned order, even with pending ones', () => {
    expect(tabs(new Map([[10, 3]]), new Map([[10, 1]]))[10]).toBe('inProgress')
    expect(tabs(new Map([[11, 2]]), new Map([[11, 2]]))[11]).toBe('inProgress')
  })

  it('is «pending» when every unassigned order of the store is pending', () => {
    expect(tabs(new Map([[10, 2]]), new Map())[10]).toBe('pending')
    expect(tabs(new Map([[10, 2], [11, 1]]), new Map([[11, 1]]))[10]).toBe('pending')
  })

  it('keeps today\'s «inProgress» when the in-progress counts are not given (nothing to tell the groups apart)', () => {
    expect(tabs(new Map([[10, 2]]), undefined)[10]).toBe('inProgress')
  })

  it('defaults to «inProgress» when the store has no unassigned order', () => {
    const result = tabs(new Map([[10, 2]]), new Map())
    expect(result[11]).toBe('inProgress')
    expect(tabs(undefined, undefined)[10]).toBe('inProgress')
  })
})

// (review L1): the drivers board filters by group; a group no driver serves the store from would show its raw id in the pill
describe('buildStoreRows · driverGroupIds (review L1)', () => {
  const shared = store(10, 'Shared')
  const multi = [
    { id: 12, business: [shared] },
    { id: 3, business: [shared] },
    { id: 7, business: [shared] }
  ]
  const member = (id, groupIds, enabled = true) => ({ id, enabled, available: true, drivergroups: groupIds })
  const rowOf = rows => rows.find(row => row.name === 'Shared')

  it('keeps only the store groups that have at least one enabled driver, sorted', () => {
    const rows = buildStoreRows({ groups: multi, drivers: [member(1, [12]), member(2, [{ id: 3 }]), member(3, [7], false)] })
    expect(rowOf(rows).driverGroupIds).toEqual([3, 12])
    expect(rowOf(rows).groupIds).toEqual([3, 7, 12]) // the store's own groups are unchanged
  })

  it('is empty for a store with no enabled driver in any of its groups, and for an ungrouped store', () => {
    expect(rowOf(buildStoreRows({ groups: multi, drivers: [member(1, [99]), member(2, [7], false)] })).driverGroupIds).toEqual([])
    expect(rowOf(buildStoreRows({ groups: multi, drivers: [] })).driverGroupIds).toEqual([])
    const loose = buildStoreRows({ groups: multi, businesses: [{ id: 20, name: 'Loose', enabled: true }], drivers: [member(1, [12])] })
    expect(loose.find(row => row.name === 'Loose').driverGroupIds).toEqual([])
  })
})

// (rows 28-29, live check): an ungrouped store with nothing waiting is not a problem to act on (nobody is meant to serve it),
// so it must not push the grouped stores that really lack online drivers off the first page
describe('buildStoreRows · ungrouped stores with no active orders go last (live check)', () => {
  const grouped = [{ id: 1, business: [store(10, 'Bravo'), store(11, 'Alpha')] }]
  const looseA = { id: 20, name: 'Aaa Loose', enabled: true } // sorts before every grouped store by name
  const looseZ = { id: 21, name: 'Zzz Loose', enabled: true }
  const driver = { id: 1, enabled: true, available: true, busy: false, drivergroups: [1] }
  const namesOf = rows => rows.map(row => row.name)

  it('puts an ungrouped store with 0 active orders after a grouped store with online drivers, whatever its name', () => {
    expect(namesOf(buildStoreRows({ groups: grouped, businesses: [looseA], drivers: [driver] }))).toEqual(['Alpha', 'Bravo', 'Aaa Loose'])
  })

  it('puts it after a grouped store with no online drivers too, and orders the ungrouped by name among themselves', () => {
    expect(namesOf(buildStoreRows({ groups: grouped, businesses: [looseZ, looseA], drivers: [] }))).toEqual(['Alpha', 'Bravo', 'Aaa Loose', 'Zzz Loose'])
  })

  it('keeps its attention place with active unassigned orders: nobody can deliver them', () => {
    const activeByBusiness = new Map([[21, 2]])
    expect(namesOf(buildStoreRows({ groups: grouped, businesses: [looseA, looseZ], drivers: [driver], activeByBusiness }))).toEqual(['Zzz Loose', 'Alpha', 'Bravo', 'Aaa Loose'])
  })

  it('a frozen `order` still wins; the stores that are not in it follow the new attention order', () => {
    expect(namesOf(buildStoreRows({ groups: grouped, businesses: [looseA, looseZ], drivers: [driver], order: [20] }))).toEqual(['Aaa Loose', 'Alpha', 'Bravo', 'Zzz Loose'])
  })
})
