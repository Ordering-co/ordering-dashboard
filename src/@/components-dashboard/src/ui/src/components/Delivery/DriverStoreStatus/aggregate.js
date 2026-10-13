export const FINISHED_STATUSES = [1, 9]

export const isConnected = (driver) => !!(driver?.enabled && driver?.available)

const driverGroupIdsOf = (driver) =>
  (driver?.drivergroups || []).map(group => group?.id ?? group).filter(id => id != null)

const buildStores = (groups) => {
  const stores = new Map()
  for (const group of groups || []) {
    const businesses = group.business || group.businesses || []
    for (const business of businesses) {
      const id = business?.id
      if (id == null) continue
      if (!stores.has(id)) {
        stores.set(id, { id, name: business.name, enabled: business.enabled, groupIds: new Set() })
      }
      stores.get(id).groupIds.add(group.id)
    }
  }
  return stores
}

export const buildStoreRows = ({ groups, drivers, activeByBusiness, finishedTodayByBusiness } = {}) => {
  const rows = []
  for (const store of buildStores(groups).values()) {
    if (!store.enabled) continue
    const serving = (drivers || []).filter(driver =>
      driverGroupIdsOf(driver).some(id => store.groupIds.has(id)))
    rows.push({
      businessId: store.id,
      name: store.name,
      totalDrivers: serving.filter(driver => driver.enabled).length,
      connectedDrivers: serving.filter(isConnected).length,
      activeOrders: activeByBusiness?.get(store.id) || 0,
      finishedToday: finishedTodayByBusiness?.get(store.id) || 0
    })
  }
  return rows.sort((a, b) => a.connectedDrivers - b.connectedDrivers)
}

export const buildGlobalKpis = ({ groups, drivers } = {}) => {
  let totalStores = 0
  for (const store of buildStores(groups).values()) {
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
