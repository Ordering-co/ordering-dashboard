/**
 * Single source of truth for "the orders list is being narrowed by filters or search".
 * Used by the «Filters applied» warning (OrdersFilterBar) and by the empty state
 * of the orders list (OrdersListing), so both always agree.
 *
 * redesign F6c-2 (Q2-01): the Status sub filter of the tab is a filter too. It lives outside the
 * shared filter context (`selectedSubOrderStatus`, one list of order statuses per tab), so callers
 * hand it in as `subStatus = { ordersStatusGroup, selectedSubOrderStatus }`; «every sub status
 * selected» is the neutral state.
 */
import { getSubOrderStatuses, isAllSubStatuses, nextSelectedSubOrderStatus } from '../OrderStatusSubFilter'

// Only the keys are needed here, never the words.
const keysOnly = (_key, text) => text

/** The value of a filter is set: 0 is a value (Driver status «Assigned»), an empty list, text or null is not. */
const isFilterValueSet = (value) => Array.isArray(value)
  ? value.length > 0
  : value !== undefined && value !== null && value !== '' && value !== false

/**
 * True when any value of the shared filter context is set.
 * @param {object} filterValues Values from useFilterValues()
 */
export const hasActiveFilterValues = (filterValues) => {
  if (!filterValues || Object.keys(filterValues).length === 0) return false
  return Object.values(filterValues).some(isFilterValueSet)
}

/**
 * True when the Status sub filter of the current tab is not «all».
 * @param {{ ordersStatusGroup?: string, selectedSubOrderStatus?: object }} [subStatus]
 */
export const hasActiveSubStatus = (subStatus) => {
  const { ordersStatusGroup, selectedSubOrderStatus } = subStatus || {}
  const selected = selectedSubOrderStatus?.[ordersStatusGroup]
  const statuses = getSubOrderStatuses(keysOnly)[ordersStatusGroup]
  if (!Array.isArray(selected) || !statuses) return false
  return !isAllSubStatuses(statuses, selected)
}

/**
 * True when filters, a search text or the Status sub filter are active (the «Filters applied» condition).
 */
export const hasActiveOrdersNarrowing = (filterValues, searchValue, subStatus) => (
  hasActiveFilterValues(filterValues) || !!searchValue || hasActiveSubStatus(subStatus)
)

/**
 * Same result as the «Clear filters» link of the warning: empties the search text,
 * resets the shared filter context and the manager filter values, and puts the Status sub filter
 * of the tab back to «all» (`ordersStatusGroup`, `selectedSubOrderStatus` and
 * `handleSelectedSubOrderStatus` come together or not at all).
 */
export const clearOrdersNarrowing = ({
  filterValues,
  searchValue,
  handleChangeSearch,
  handleFilterValues,
  handleChangeFilterValues,
  ordersStatusGroup,
  selectedSubOrderStatus,
  handleSelectedSubOrderStatus
}) => {
  if (searchValue) handleChangeSearch && handleChangeSearch('')
  if (hasActiveFilterValues(filterValues)) {
    const cleared = {}
    Object.keys(filterValues).forEach(key => {
      cleared[key] = Array.isArray(filterValues[key]) ? [] : null
    })
    handleFilterValues && handleFilterValues(cleared)
    handleChangeFilterValues && handleChangeFilterValues({})
  }
  if (handleSelectedSubOrderStatus && hasActiveSubStatus({ ordersStatusGroup, selectedSubOrderStatus })) {
    handleSelectedSubOrderStatus(nextSelectedSubOrderStatus({
      statusKey: 'all',
      ordersStatusGroup,
      selectedSubOrderStatus,
      statuses: getSubOrderStatuses(keysOnly)
    }))
  }
}
