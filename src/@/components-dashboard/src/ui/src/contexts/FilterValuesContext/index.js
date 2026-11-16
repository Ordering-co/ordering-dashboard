import React, { useState, createContext } from 'react'
/**
 * Create FilterValuesContext
 * This context will manage the info between pages and provide an easy interface
 */
export const FilterValuesContext = createContext()

// (D-22, review M3): the neutral filters. The provider starts from them and a seeded deep link
// (useOrdersUrlFilterSeed) starts from them plus its seed, so the two cannot drift. Frozen: state takes a fresh copy
// (createDefaultFilterValues), so no filter list is ever shared between the provider, a seed and this template.
export const DEFAULT_FILTER_VALUES = Object.freeze({
  orderId: null,
  externalId: null,
  groupTypes: [],
  groupTypesUnassigned: [],
  dateType: null,
  deliveryFromDatetime: null,
  deliveryEndDatetime: null,
  businessIds: [],
  driverIds: [],
  driverGroupIds: [],
  cityIds: [],
  statuses: [],
  deliveryTypes: [],
  paymethodIds: [],
  countryCode: [],
  currency: [],
  metafield: [],
  logisticStatus: null,
  assigned: null,
  driverGroupBusinessIds: [],
  customerName: null,
  customerEmail: null,
  customerCellphone: null,
  customerLastname: null,
  coupon: null,
  offerId: null,
  administratorIds: [],
  timeStatus: null
})

/** A fresh copy of the neutral filters (new lists each time). */
export const createDefaultFilterValues = () => Object.fromEntries(
  Object.entries(DEFAULT_FILTER_VALUES).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
)

/**
  * Custom provider to mange shared info
  * @param {props} props
  */
export const FilterValuesProvider = ({ children }) => {
  const [filterValues, setFilterValues] = useState(createDefaultFilterValues)

  const handleFilterValues = (filterValues) => {
    setFilterValues(filterValues)
  }

  const functions = {
    handleFilterValues
  }

  return (
    <FilterValuesContext.Provider value={[filterValues, functions]}>
      {children}
    </FilterValuesContext.Provider>
  )
}

// hook context

export function useFilterValues () {
  const filterValuesManager = React.useContext(FilterValuesContext)
  return filterValuesManager || [{}, () => {}]
}
