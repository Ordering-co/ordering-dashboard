// redesign drivers-dashboard B1 (decisions 3, 6, 8, DD-07, DD-11: pure driver state)
// Pure functions over the drivers the API returns. No React, no translations.
import { minutesSince } from '../../../../../utils/relativeTime'

// redesign DL-B2 (decision 3): the name and the state live in C/utils now, shared with /delivery/drivers-list
import { driverState } from '../../../../../utils/driverState'
export { driverState, fullName } from '../../../../../utils/driverState'

export const SIGNAL_STALE_MINUTES = 15
export const DRIVER_LOADS = ['all', 'notBusy', 'busy']

// Same membership as main (DriversList, both sub-filters on): disabled drivers are in neither list
export const isOnline = (driver) => !!(driver?.enabled && driver?.available)
export const isOffline = (driver) => !!(driver?.enabled && !driver?.available)

// Decision 8: keeps the order the API gave
export const splitDrivers = (drivers) => {
  const list = Array.isArray(drivers) ? drivers : []
  return {
    online: list.filter(isOnline),
    offline: list.filter(isOffline)
  }
}

export const applyLoad = (list, load) => {
  const drivers = Array.isArray(list) ? list : []
  if (load === 'busy') return drivers.filter((driver) => !!driver?.busy)
  if (load === 'notBusy') return drivers.filter((driver) => !driver?.busy)
  return drivers
}

export const countLoad = (list) => {
  const drivers = Array.isArray(list) ? list : []
  const busy = drivers.filter((driver) => !!driver?.busy).length
  return { all: drivers.length, busy, notBusy: drivers.length - busy }
}

// DD-07: the API names the groups both ways depending on the endpoint
export const driverGroups = (driver) => {
  const primary = driver?.drivergroups
  const source = Array.isArray(primary) && primary.length > 0
    ? primary
    : (Array.isArray(driver?.driver_groups) ? driver.driver_groups : [])
  return source
    .filter((group) => !!group?.name)
    .map((group) => ({ id: group.id, name: group.name }))
}

// (row 26, drivers-dashboard P1, D-33): the groups as the API sent them, the unnamed ones included (driverGroups above drops them
// because it is for display; a filter must still be able to choose them)
const rawGroups = (driver) => {
  const primary = driver?.drivergroups
  if (Array.isArray(primary) && primary.length > 0) return primary
  return Array.isArray(driver?.driver_groups) ? driver.driver_groups : []
}
const hasGroupId = (group) => group?.id !== undefined && group?.id !== null

// the options of the group filter, from ALL the drivers loaded: each group once, by name; an unnamed one reads «#id»
export const groupOptions = (drivers) => {
  const list = Array.isArray(drivers) ? drivers : []
  const byId = new Map()
  list.forEach((driver) => {
    rawGroups(driver).filter(hasGroupId).forEach((group) => {
      if (!byId.has(group.id)) byId.set(group.id, { id: group.id, name: group.name ? String(group.name) : `#${group.id}` })
    })
  })
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

// the drivers that belong to ANY of the chosen groups; with none chosen, the list itself. Keeps the order of the API.
export const filterByGroups = (drivers, ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return drivers
  const list = Array.isArray(drivers) ? drivers : []
  return list.filter((driver) => rawGroups(driver).some((group) => hasGroupId(group) && ids.includes(group.id)))
}

// (row 28, driver-store-status P-1): the driver groups a link asks for, from `?groups=1,199` (the «View drivers» exit of a store).
// Comma-separated positive integers; any other part is ignored, repeats count once, the order is kept. No param, no groups.
export const parseGroupIds = (search) => {
  const raw = new URLSearchParams(typeof search === 'string' ? search : '').get('groups')
  if (!raw) return []
  const ids = []
  raw.split(',').forEach((part) => {
    const text = part.trim()
    if (!/^\d+$/.test(text)) return
    const id = Number(text)
    if (Number.isSafeInteger(id) && id > 0 && !ids.includes(id)) ids.push(id)
  })
  return ids
}

// Decision 6: only a connected driver can have a stale signal
export const signalOf = (driver, now = Date.now()) => {
  const minutes = driver?.last_location_at ? minutesSince(driver.last_location_at, now) : null
  if (minutes === null) return { kind: 'none', minutes: null }
  const stale = driverState(driver) !== 'offline' && minutes > SIGNAL_STALE_MINUTES
  return { kind: stale ? 'stale' : 'fresh', minutes }
}
