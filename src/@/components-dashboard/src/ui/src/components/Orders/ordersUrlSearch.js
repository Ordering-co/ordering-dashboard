export const ORDER_STATUS_QUERY_VALUES = ['pending', 'inProgress', 'completed', 'cancelled']

export const getOrdersUrlSearchState = (search = '') => {
  const query = new URLSearchParams(typeof search === 'string' ? search : '')
  const id = query.get('id')
  const status = query.get('status')
  const orderId = id || null

  return {
    orderId,
    isDetailOpen: orderId != null,
    statusGroup: ORDER_STATUS_QUERY_VALUES.includes(status) ? status : null
  }
}

// (D-22): query params that open /orders and /deliveries already filtered. They are seeds: the page reads them
// once on mount, puts them in the filters and removes them from the address bar (useOrdersUrlFilterSeed).
export const ORDERS_URL_FILTER_PARAMS = ['business', 'unassigned', 'late']

const parseBusinessIds = (value) => {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(item => /^\d+$/.test(item))
    .map(Number)
    .filter(id => id > 0)
}

/**
 * Filter values carried by the URL: only the keys that are present and valid.
 * `?business=<id[,id…]>` -> businessIds, `?unassigned=1` -> assigned: 1, `?late=1` -> timeStatus: 'delayed'.
 */
export const getOrdersUrlFilterPatch = (search = '') => {
  const query = new URLSearchParams(typeof search === 'string' ? search : '')
  const patch = {}

  const businessIds = parseBusinessIds(query.get('business'))
  if (businessIds.length) patch.businessIds = businessIds
  if (query.get('unassigned') === '1') patch.assigned = 1
  if (query.get('late') === '1') patch.timeStatus = 'delayed'

  return patch
}
