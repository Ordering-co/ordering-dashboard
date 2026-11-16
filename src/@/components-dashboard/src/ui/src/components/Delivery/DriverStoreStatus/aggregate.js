export const isConnected = (driver) => !!(driver?.enabled && driver?.available)

const driverGroupIdsOf = (driver) =>
  (driver?.drivergroups || []).map(group => group?.id ?? group).filter(id => id != null)

// (row 29, driver-store-status P-4): `businesses` are the active stores read apart from the groups. Each enabled one
// that no group lists joins with no groups (`ungrouped`): nobody is assigned to it, so it has 0 drivers. One that a group lists
// is not added again. Without `businesses` the stores are the groups' alone, as before.
const buildStores = (groups, businesses) => {
  const stores = new Map()
  for (const group of groups || []) {
    const members = group.business || group.businesses || []
    for (const business of members) {
      const id = business?.id
      if (id == null) continue
      if (!stores.has(id)) {
        stores.set(id, { id, name: business.name, enabled: business.enabled, groupIds: new Set() })
      }
      stores.get(id).groupIds.add(group.id)
    }
  }
  for (const business of businesses || []) {
    const id = business?.id
    if (id == null || !business.enabled || stores.has(id)) continue
    stores.set(id, { id, name: business.name, enabled: true, groupIds: new Set(), ungrouped: true })
  }
  return stores
}

// numeric ids sort as numbers ('3' before '12'), anything else as text, so the ids in a link keep one order whatever order the API lists the groups in
const byId = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })

// (review M4): the /deliveries tab that holds the store's «Active unassigned» orders. They are pending (0) or in progress (the
// rest), so the in-progress tab if the store has any in-progress one, else Pending when it has pending ones, else today's In progress.
// Without the in-progress counts there is nothing to tell the groups apart: In progress, as before.
const unassignedTabOf = (activeOrders, inProgressByBusiness, businessId) => {
  if (!inProgressByBusiness || !activeOrders) return 'inProgress'
  return (inProgressByBusiness.get(businessId) || 0) > 0 ? 'inProgress' : 'pending'
}

export const buildStoreRows = ({ groups, businesses, drivers, activeByBusiness, activeInProgressByBusiness, finishedTodayByBusiness, order } = {}) => {
  const rows = []
  for (const store of buildStores(groups, businesses).values()) {
    if (!store.enabled) continue
    const serving = (drivers || []).filter(driver =>
      driverGroupIdsOf(driver).some(id => store.groupIds.has(id)))
    // (review L1): the groups of the store that an enabled driver belongs to; the drivers board lists drivers, so a group
    // with none would show its raw id in the Driver group pill
    const driverGroupIds = [...store.groupIds].filter(groupId =>
      serving.some(driver => driver.enabled && driverGroupIdsOf(driver).includes(groupId))).sort(byId)
    const connected = serving.filter(isConnected)
    // (row 31, driver-store-status P-9): busy counts only among the connected drivers (a disabled or offline busy
    // driver is not working the store); with none connected, 0 === 0 is not «all busy»
    const busyDrivers = connected.filter(driver => driver.busy).length
    const activeOrders = activeByBusiness?.get(store.id) || 0
    rows.push({
      businessId: store.id,
      name: store.name,
      totalDrivers: serving.filter(driver => driver.enabled).length,
      connectedDrivers: connected.length,
      busyDrivers,
      allBusy: connected.length > 0 && busyDrivers === connected.length,
      activeOrders,
      finishedToday: finishedTodayByBusiness?.get(store.id) || 0,
      // (row 28, driver-store-status P-1, D-22): the store's delivery groups (sorted, no repeats; empty when ungrouped)
      groupIds: [...store.groupIds].sort(byId),
      driverGroupIds, // (review L1): the ones with an enabled driver, for «View drivers» (none: no link)
      unassignedTab: unassignedTabOf(activeOrders, activeInProgressByBusiness, store.id), // (review M4)
      ...(store.ungrouped && { ungrouped: true }) // (row 29): the UI tags it «Not in any delivery group»
    })
  }
  // (row 30, driver-store-status P-8): with `order` (businessIds) the rows keep that place and only their figures are
  // current; a store that is not in it (it appeared) goes after them, by attention among themselves. Without it, today's order.
  if (!order?.length) return rows.sort(byAttention)
  const place = new Map(order.map((id, index) => [id, index]))
  return rows.sort((a, b) => {
    const pa = place.get(a.businessId)
    const pb = place.get(b.businessId)
    if (pa !== undefined && pb !== undefined) return pa - pb
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return byAttention(a, b)
  })
}

// redesign driver-store-status (decision 2): what needs attention comes first, also across pages. Stores with
// no online driver, then the most active unassigned orders, then the fewest online (main's only key), then the name in
// the reader's collation, so equal rows keep a steady place.
// (rows 28-29, live check): a store in no delivery group with nothing waiting goes after every other row (by name among
// themselves): nobody is meant to serve it, and on a project where most stores are ungrouped they would otherwise tie with the grouped
// stores that lack online drivers and fill the first pages. With active unassigned orders it keeps its place above: nobody can deliver them.
const isIdleUngrouped = row => Boolean(row.ungrouped) && !row.activeOrders
const byAttention = (a, b) =>
  Number(isIdleUngrouped(a)) - Number(isIdleUngrouped(b)) ||
  Number(a.connectedDrivers > 0) - Number(b.connectedDrivers > 0) ||
  b.activeOrders - a.activeOrders ||
  a.connectedDrivers - b.connectedDrivers ||
  String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { sensitivity: 'base' })

// redesign driver-store-status (decision 1): today's two order columns, added up for the figure above the table
export const buildOrderTotals = (rows = []) => rows.reduce((totals, row) => ({
  activeUnassigned: totals.activeUnassigned + (row.activeOrders || 0),
  finishedToday: totals.finishedToday + (row.finishedToday || 0)
}), { activeUnassigned: 0, finishedToday: 0 })

export const buildGlobalKpis = ({ groups, businesses, drivers } = {}) => {
  let totalStores = 0
  for (const store of buildStores(groups, businesses).values()) {
    if (store.enabled) totalStores++
  }

  const enabledDrivers = (drivers || []).filter(driver => driver.enabled)
  const online = enabledDrivers.filter(driver => driver.available)

  return {
    totalStores,
    totalDrivers: enabledDrivers.length,
    connectedDrivers: online.length,
    busyDrivers: online.filter(driver => driver.busy).length,
    offlineDrivers: enabledDrivers.filter(driver => !driver.available).length
  }
}
