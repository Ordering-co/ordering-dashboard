// redesign DG-B3 (decision 2 | M-DG36): what the delivery groups list reads from a group the API returns. Pure: no React.
//
// A group of GET /drivergroups: { id, name, type (0 in-house drivers, 1 driver companies), enabled, priority, administrator_id,
// administrators: [{ id, name, lastname, email, photo }], drivers: [...], business: [...], driver_companies: [...] }.
// It carries no `administrator` (the old list read that and drew an empty column); `group.administrator` is only a fallback.

const cleanText = (value) => (value === null || value === undefined ? '' : String(value)).replace(/\s+/g, ' ').trim()

// «name lastname»; a manager with no name at all shows the email rather than vanishing (it would read as «No manager»)
const personName = (person) => {
  const full = cleanText([person?.name, person?.lastname].map(cleanText).filter(Boolean).join(' '))
  return full || cleanText(person?.email)
}

export const managerNames = (group) => {
  const list = Array.isArray(group?.administrators) && group.administrators.length > 0
    ? group.administrators
    : (group?.administrator ? [group.administrator] : [])
  return list.map(personName).filter(Boolean)
}

// «Ana Ruiz», «Ana Ruiz +1» (the rest are counted, not listed) or «No manager»
export const managerText = (group, t) => {
  const names = managerNames(group)
  if (names.length === 0) return t('DRIVERS_GROUPS_NO_MANAGER', 'No manager')
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
}

const typeOf = (group) => {
  const type = parseInt(group?.type, 10)
  return type === 0 || type === 1 ? type : null
}

const countOf = (list) => (Array.isArray(list) ? list.length : 0)

const plural = (count, one, other) => (count === 1 ? one : other).replace('_count_', count)

// Who the group assigns orders to: its drivers (in house) or its driver companies. Each type counts its own list only.
export const assignsTo = (group, t) => {
  const type = typeOf(group)
  if (type === 0) {
    const count = countOf(group.drivers)
    return plural(count, t('DRIVERS_GROUPS_DRIVERS_COUNT_ONE', '_count_ driver'), t('DRIVERS_GROUPS_DRIVERS_COUNT_OTHER', '_count_ drivers'))
  }
  if (type === 1) {
    const count = countOf(group.driver_companies)
    return plural(count, t('DRIVERS_GROUPS_COMPANIES_COUNT_ONE', '_count_ company'), t('DRIVERS_GROUPS_COMPANIES_COUNT_OTHER', '_count_ companies'))
  }
  return ''
}

export const storesCount = (group) => countOf(group?.business)

// «1 store» / «3 stores»: the keys the stores list already has
export const storesText = (group, t) => {
  const count = storesCount(group)
  return count === 1
    ? t('STORES_COUNT_ONE', '1 store')
    : t('STORES_COUNT_OTHER', '_count_ stores').replace('_count_', count)
}

// The two labels of today's list
export const typeLabel = (group, t) => {
  const type = typeOf(group)
  if (type === 0) return t('IN_HOUSE_DRIVERS', 'In house drivers')
  if (type === 1) return t('DRIVER_COMPANIES', 'Driver companies')
  return ''
}

export const groupName = (group, t) => cleanText(group?.name) || t('DRIVERS_GROUPS_NO_NAME', 'No name')
