import { useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { removeQueryToUrl } from '../utils'
import { createDefaultFilterValues, useFilterValues } from '../contexts/FilterValuesContext'
import { ORDERS_URL_FILTER_PARAMS, getOrdersUrlFilterPatch } from '../components/Orders/ordersUrlSearch'

/**
 * (D-22): /orders and /deliveries open already filtered from `?business=`, `?unassigned=1` and `?late=1`.
 *
 * The URL is read once, on mount (a later URL change is not a seed). A seeded link is a deep link that promises a list
 * (D-22, review M3): it starts from the neutral filters plus the seed, not from whatever the shared filters
 * held after an earlier visit. Without a seed nothing changes and the shared filters persist as before.
 *
 * The values go into the first state of the controller, so the first fetch is already filtered, and once into the shared
 * filters (chips, toggles and the Filters sheet read them). That happens in a layout effect, before the controller mounts
 * (D-22, review M2): OrdersHeaderFilterGroup pushes the shared filters into the controller on mount, so an
 * unseeded context would send the controller back to an unfiltered fetch. The page renders the controller only when
 * `ready`; the re-render after a layout effect happens before paint. The consumed params leave the address bar, so a
 * reload or clearing a chip does not bring them back. `status`, `id` and the page params stay.
 *
 * Returns `{ ready, filterPatch, seededFilterValues, defaultTimeStatus }`. `ready` is true at once when the URL carries no
 * seed; `seededFilterValues` and `defaultTimeStatus` are null when it carries none.
 */
export const useOrdersUrlFilterSeed = () => {
  const { search } = useLocation()
  const [, { handleFilterValues }] = useFilterValues()
  const [seed] = useState(() => {
    const filterPatch = getOrdersUrlFilterPatch(search)
    const hasPatch = Object.keys(filterPatch).length > 0
    return {
      filterPatch,
      hasPatch,
      seededFilterValues: hasPatch ? { ...createDefaultFilterValues(), ...filterPatch } : null,
      hasParams: ORDERS_URL_FILTER_PARAMS.some(param => new URLSearchParams(search).has(param))
    }
  })
  const [ready, setReady] = useState(!seed.hasPatch)

  useLayoutEffect(() => {
    if (seed.hasPatch) handleFilterValues(seed.seededFilterValues)
    if (seed.hasParams) removeQueryToUrl(ORDERS_URL_FILTER_PARAMS)
    setReady(true)
  }, [])

  return {
    ready,
    filterPatch: seed.filterPatch,
    seededFilterValues: seed.seededFilterValues,
    defaultTimeStatus: seed.filterPatch.timeStatus || null
  }
}
