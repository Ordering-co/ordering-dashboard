import React, { useEffect, useState } from 'react'

// redesign 5.2 (df9ce417): the External ID search sits in a Product popover whose rules (orders-filter-bar.css) read
// the --od-x-* tokens the app loads from src/index.js; without them the input keeps no room for its clear button.
import '../../../src/brand/candidates.css'

import { OrdersHeaderFilterGroup } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersHeaderFilterGroup'
import { FilterBar } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Product'
import { ConfigFileContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/ConfigFileContext'
import { FilterValuesProvider, useFilterValues } from '../../../src/@/components-dashboard/src/ui/src/contexts/FilterValuesContext'

const configFile = [{ app_internal_name: 'fixture' }]
const searchConfig = [{ configs: { filter_order_options: { value: 'external_id' } }, loading: false }]

const OrdersSearchConsumer = () => {
  const [filterValues, { handleFilterValues }] = useFilterValues()
  const [filterEvents, setFilterEvents] = useState([])

  return (
    <main data-testid='orders-header-search-consumer' style={{ boxSizing: 'border-box', minWidth: 0, padding: 24, width: '100%' }}>
      <button
        type='button'
        onClick={() => handleFilterValues({ ...filterValues, externalId: 'REMOTE-42' })}
      >
        Apply external filter
      </button>
      {/* redesign 5.2: OrdersHeaderFilterGroup now renders pills for the `filters` slot of the
          Product FilterBar (OrdersFilterBar mounts it there), so the fixture mounts it the same way:
          a bare pill would not scroll sideways at 320px like the real bar does. */}
      <div data-testid='orders-header-search-row'>
        <FilterBar
          label='Order filters'
          filters={
            <OrdersHeaderFilterGroup
              driversList={{ loading: false, drivers: [] }}
              driverGroupList={{ loading: false, groups: [] }}
              assignableDriverGroupList={null}
              isSelectedOrders={false}
              disableSocketRoomDriver
              handleChangeFilterValues={nextFilters => setFilterEvents(current => [...current, nextFilters])}
            />
          }
        />
      </div>
      <output data-testid='orders-header-filter-value' style={{ display: 'block', overflowWrap: 'anywhere' }}>{JSON.stringify(filterValues)}</output>
      <output data-testid='orders-header-filter-events' style={{ display: 'block', overflowWrap: 'anywhere' }}>{JSON.stringify(filterEvents)}</output>
    </main>
  )
}

export const SearchBarConsumerFixture = () => {
  globalThis.__OD_SEARCH_BAR_CONSUMER_CONFIG__ = searchConfig

  useEffect(() => () => {
    delete globalThis.__OD_SEARCH_BAR_CONSUMER_CONFIG__
  }, [])

  return (
    <FilterValuesProvider>
      <ConfigFileContext.Provider value={configFile}>
        <OrdersSearchConsumer />
      </ConfigFileContext.Provider>
    </FilterValuesProvider>
  )
}
