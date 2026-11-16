import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConfig } from '../../../../../index'
// redesign deliveries F2-B3: the language context directly, as Shared/Product does (the board is also mounted without the whole index)
import { useLanguage } from '../../../../../contexts/LanguageContext'
import { useSession } from '../../../../../contexts/SessionContext'
import { canAssignDriverManually } from '../../../../../utils/dashboardFeatureAccess'
import { useBoardStacked } from '../../../hooks/useBoardStacked'
import { SegmentedControl, useSplitView } from '../../Shared/Product'
import { DeliveriesLocation } from '../DeliveriesLocation'
import { OrdersDashboardList } from '../OrdersDashboardList'
import { OrderStatusFilterBar } from '../OrderStatusFilterBar'
import { CUSTOMER_PICKUP_STATUSES, OrderStatusSubFilter } from '../OrderStatusSubFilter'
import { DeliveryBoardContext } from './DeliveryBoardContext'
import { DispatchToggles } from './DispatchToggles'
import './delivery-board.css'

import {
  DeliveryDashboardContainer,
  OrdersContainer,
  FilterContainer,
  WrapperOrderlist,
  WrapperDeliveriesLocation
} from './styles'

// redesign drivers-dashboard B4 (promotion): the stacked-board hook lives in hooks/useBoardStacked.js, shared with /drivers-dashboard

export const DeliveryDashboard = (props) => {
  const {
    driversList,
    ordersStatusGroup,
    selectedSubOrderStatus,
    handleOrdersStatusGroupFilter,
    handleSelectedSubOrderStatus,
    ordersAmountByStatus,
    setOrdersAmountByStatus,
    isUseQuery,
    filterValues,
    handleChangeFilterValues,
    setTimeStatus,
    readOnlyBusinessOwner
  } = props

  const [{ configs }] = useConfig()
  const [{ user }] = useSession()
  const [, t] = useLanguage()
  const canAssignDriver = !readOnlyBusinessOwner && canAssignDriverManually({ level: user?.level, configs })

  const ordersDashboardListProps = {
    ...props,
    ...((configs?.optimize_order_data && configs.optimize_order_data.value === '1')
      ? { propsToFetch: ['app_id', 'business', 'business_id', 'created_at', 'customer', 'customer_id', 'delivery_type', 'driver_group_id', 'driver_id', 'driver', 'delivery_datetime', 'delivery_datetime_utc', 'external_id', 'eta_time', 'id', 'logistic_status', 'logistic_attemps', 'uuid', 'order_group', 'order_group_id', 'priority', 'summary', 'status', 'time_status', 'total', 'metadata', 'external_driver', 'external_driver_id', 'driver_company', 'driver_company_id'] }
      : {})
  }

  const [interActionMapOrder, setInterActionMapOrder] = useState(null)
  const [focusCandidatesToken, setFocusCandidatesToken] = useState(0)
  // redesign deliveries F2-B3 (decision 7): List | Map below 1024px; from there up both columns are drawn and `view` is not used.
  const isStacked = useBoardStacked()
  const [view, setView] = useState('list')
  // redesign deliveries F2-B3 (decision 6, DV-07): the board lives in SplitView's list. With the order panel beside it (from 1280px) the map
  // column hides (it stays mounted) and the list takes the width that is left. In the overlay and full modes the panel is over the board.
  const { mode: splitMode, open: isPanelOpen, requestClose } = useSplitView()
  const isMapHidden = isPanelOpen && splitMode === 'split'
  // an «Assign» asked while the panel hid the map column, to focus the candidates once the column is back
  const pendingCandidatesFocus = useRef(false)
  useEffect(() => {
    if (isMapHidden || !pendingCandidatesFocus.current) return
    pendingCandidatesFocus.current = false
    setFocusCandidatesToken(token => token + 1)
  }, [isMapHidden])

  // redesign deliveries R1 (finding 3): the driver the board assigned to an order, by order id, until the list says it too. The list keeps a
  // copy of the order without a driver until that order's own update arrives; every list change used to put that copy back on the strip, which
  // went back to «Candidates» with «Assign» on an order that already had its driver.
  const assignedDrivers = useRef(new Map())

  // The order as the board knows it: the list's copy with the remembered driver on it while the list has none. Once the list's copy carries a
  // driver_id (this driver or another one) the list is right and the memory is dropped.
  const withAssignedDriver = (order) => {
    const known = order ? assignedDrivers.current.get(order.id) : undefined
    if (!known) return { ...order }
    if (order.driver_id) {
      assignedDrivers.current.delete(order.id)
      return { ...order }
    }
    return { ...order, driver_id: known.id, driver: known }
  }

  const handleUpdateDriverLocation = (order) => {
    setInterActionMapOrder(withAssignedDriver(order))
  }

  // redesign deliveries R1 (finding 4): below 1024px choosing a card hides the list, where the focus was. It goes to the strip title of the
  // Map view (or, without a strip, to the switch) instead of falling to <body>.
  const mapColumnRef = useRef(null)
  const viewRef = useRef(null)
  const [focusMapToken, setFocusMapToken] = useState(0)
  useEffect(() => {
    if (!focusMapToken) return
    const target = mapColumnRef.current?.querySelector('.odc-dock-title') || viewRef.current?.querySelector('button[aria-pressed="true"], select')
    target?.focus()
  }, [focusMapToken])

  const handleLocation = (order) => {
    if (isStacked) {
      // redesign deliveries F2-B3 (decision 7): choosing a card below 1024px shows it on the map; a second tap keeps it chosen
      const next = withAssignedDriver(order)
      setInterActionMapOrder(previous => (previous?.id === order?.id ? previous : next))
      if (view !== 'map') setFocusMapToken(token => token + 1)
      setView('map')
      return
    }
    if (interActionMapOrder?.id === order?.id) {
      setInterActionMapOrder(null)
    } else {
      setInterActionMapOrder(withAssignedDriver(order))
    }
  }

  // redesign deliveries F2-B3 (decision 3): what the board hands its cards, through DeliveryBoardContext. The rule is the order panel's
  // (OrderContactInformation: no driver company, not a read-only business owner) plus «the order has no driver of any kind».
  // redesign deliveries R1 fix (finding 3, card side): an order this board just assigned offers no «Assign» on its card either, until
  // the list brings its driver_id (the version makes the cards re-read the rule when an assignment is remembered).
  const [assignedVersion, setAssignedVersion] = useState(0)
  const canAssign = useCallback((order) => (
    canAssignDriver && !!order && !order.driver_company_id && !order.external_driver && !order.driver_id &&
    !assignedDrivers.current.has(order.id)
  ), [canAssignDriver, assignedVersion])

  // Chooses the order (an already chosen one stays chosen: handleLocation would let it go), asks the dock to move the focus to its
  // candidates and, below 1024px, shows the map where they are.
  // (review R2): from 1280px the order panel beside the list hides the map column, where the candidates are, so «Assign»
  // showed nothing. It asks the panel to close through its own way out (unsaved text is still asked about) and focuses the
  // candidates when the column is back. When the panel asks first (unsaved text), nothing is chosen and nothing waits: the user
  // keeps editing or discards, and presses Assign again.
  const requestAssign = useCallback((order) => {
    if (isMapHidden) {
      if (requestClose() === false) return
      pendingCandidatesFocus.current = true
    }
    const known = assignedDrivers.current.get(order?.id)
    const next = known && !order.driver_id ? { ...order, driver_id: known.id, driver: known } : { ...order }
    setInterActionMapOrder(previous => (previous?.id === order?.id ? previous : next))
    if (isMapHidden) return
    setFocusCandidatesToken(token => token + 1)
    if (isStacked) setView('map')
  }, [isStacked, isMapHidden, requestClose])

  const handleAssigned = useCallback((order, driver) => {
    if (order?.id !== undefined && driver) {
      assignedDrivers.current.set(order.id, driver)
      setAssignedVersion(version => version + 1)
    }
    setInterActionMapOrder(previous => (
      previous?.id === order?.id && driver ? { ...previous, driver_id: driver.id, driver } : previous
    ))
  }, [])

  const driversById = useMemo(
    () => new Map((driversList?.drivers ?? []).map(driver => [driver.id, driver])),
    [driversList?.drivers]
  )

  const boardContext = useMemo(
    () => ({ canAssign, requestAssign, driversById }),
    [canAssign, requestAssign, driversById]
  )

  const isListHidden = isStacked && view === 'map'
  const isMapColumnHidden = isMapHidden || (isStacked && view === 'list')

  return (
    <DeliveryDashboardContainer
      className='odb-board'
      data-view={isStacked ? view : undefined}
      data-map-hidden={isMapHidden ? '' : undefined}
    >
      {isStacked && (
        <div className='odb-view' ref={viewRef}>
          <SegmentedControl
            label={t('VIEW', 'View')}
            value={view}
            onValueChange={setView}
            options={[
              { value: 'list', label: t('LIST', 'List') },
              { value: 'map', label: t('MAP', 'Map') }
            ]}
          />
        </div>
      )}
      <OrdersContainer className='odb-list' hidden={isListHidden}>
        <FilterContainer>
          <OrderStatusFilterBar
            isUseQuery={isUseQuery}
            selectedOrderStatus={ordersStatusGroup}
            changeOrderStatus={handleOrdersStatusGroupFilter}
            ordersAmountByStatus={ordersAmountByStatus}
          />
          <div className='odb-tools'>
            <DispatchToggles
              filterValues={filterValues}
              handleChangeFilterValues={handleChangeFilterValues}
              setTimeStatus={setTimeStatus}
            />
            <OrderStatusSubFilter
              ordersStatusGroup={ordersStatusGroup}
              selectedSubOrderStatus={selectedSubOrderStatus}
              handleSelectedSubOrderStatus={handleSelectedSubOrderStatus}
              // redesign deliveries-followups P2 (DV-11): the board only lists delivery_type 1 and 7
              hiddenStatuses={CUSTOMER_PICKUP_STATUSES}
            />
          </div>
        </FilterContainer>
        <WrapperOrderlist id='cardOrders'>
          <DeliveryBoardContext.Provider value={boardContext}>
            <OrdersDashboardList
              {...ordersDashboardListProps}
              isUseQuery={isUseQuery}
              orderListView='card'
              selectedOrderCard={interActionMapOrder}
              handleOrderCardClick={handleLocation}
              handleUpdateDriverLocation={handleUpdateDriverLocation}
              isDelivery
              setOrdersAmountByStatus={setOrdersAmountByStatus}
            />
          </DeliveryBoardContext.Provider>
        </WrapperOrderlist>
      </OrdersContainer>
      <WrapperDeliveriesLocation className='odb-map' hidden={isMapColumnHidden} ref={mapColumnRef}>
        <DeliveriesLocation
          driversList={driversList}
          interActionMapOrder={interActionMapOrder}
          canAssign={canAssign}
          focusCandidatesToken={focusCandidatesToken}
          onAssigned={handleAssigned}
        />
      </WrapperDeliveriesLocation>
    </DeliveryDashboardContainer>
  )
}
