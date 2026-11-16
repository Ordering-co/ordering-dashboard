import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, useConfig, useWebsocket, DriversList as DriversController } from '../../../../../index'
import { DriversDashboard } from '../DriversDashboard'
import { parseGroupIds } from '../DriversDashboard/driverState'
import { IN_PROGRESS_STATUSES } from '../DriversDashboard/DriverPanel' // redesign drivers-dashboard B4 (decision 5)
import { ContactOrdersSheet } from '../ContactOrdersSheet' // redesign W1-1 (T1-2)
import { LearnDropDown } from '../../Shared'
// redesign W1-4 (T1-4-4a): P/ head, search, notice and buttons; Lucide icons (was bootstrap-icons, meronex and the legacy Buttons)
import { Button, FilterBar, IconButton, InlineNotice, PageHeader, SearchField } from '../../Shared/Product'
import { Menu as MenuIcon, TriangleAlert } from '../../Shared/Icon'
import { learnOptionsValues, removeQueryToUrl } from '../../../utils'
import { OrderNotificationSlot } from '../OrderNotification'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { GoogleMapsApiKeySettingButton } from '../GoogleMapsApiKeySettingButton'
import { WebsocketStatus } from '../WebsocketStatus'

import {
  DriversHeader,
  DriversContainer,
  DriversContent
} from './styles'

// The same wait the old SearchBar used with `lazyLoad` (and OrdersFilterBar keeps).
const SEARCH_DEBOUNCE_MS = 750

// redesign drivers-dashboard B4 (decision 6): the age of each location is read against this clock, which moves every minute
const CLOCK_TICK_MS = 60000
// redesign drivers-dashboard B4 (decision 5): the longest the sheet waits for the orders of the driver it was asked for
const ORDERS_OPEN_WAIT_MS = 8000
const NO_ASSIGNED_ORDERS = { loading: false, error: null, orders: [] }

// redesign drivers-dashboard B4 (decision 5, DD-06): the tab the sheet opens in. «In progress» if any order is in progress, else «Pending»;
// with an error there is nothing to go by (no group: the sheet opens in Pending, as it did).
const groupOfOrders = (assigned) => {
  if (assigned?.error) return undefined
  const orders = Array.isArray(assigned?.orders) ? assigned.orders : []
  return orders.some(order => IN_PROGRESS_STATUSES.includes(Number(order.status))) ? 'inProgress' : 'pending'
}

const DriversManagerUI = (props) => {
  const {
    onDriverRedirect,
    handleChangeSearch,
    searchValue,
    driversIsOnline,
    selectedDriver,
    setSelectedDriver
  } = props

  const { drivers, loading } = props.driversList
  const assignedOrders = props.assignedOrders || NO_ASSIGNED_ORDERS

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [configState] = useConfig()
  const socket = useWebsocket()
  const googleMapsApiKey = configState?.configs?.google_maps_api_key?.value

  const { search: urlSearch } = useLocation()
  const query = new URLSearchParams(urlSearch)
  const [isOpenDriverOrders, setIsOpenDriverOrders] = useState(false)
  const [openDriver, setOpenDriver] = useState(null)
  // redesign drivers-dashboard B4 (decision 5): the tab the sheet opens in (undefined = as before) and the opening that is waiting
  // for the orders of the chosen driver: { id, sawLoading }
  const [sheetGroup, setSheetGroup] = useState(undefined)
  const [pendingOpen, setPendingOpen] = useState(null)
  const learnOptions = learnOptionsValues(['drivers_dashboard'], t)

  // redesign drivers-dashboard B4 (decision 6): the clock the rows read their «3 minutes ago» against
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  // redesign drivers-dashboard B4 (decision 4): the status of each order of the chosen driver follows update_order; a reload of the
  // orders (which brings the right statuses) clears what the socket put. No request.
  const [statusOverlay, setStatusOverlay] = useState({})
  const assignedList = assignedOrders.orders
  const assignedListRef = useRef(assignedList)
  assignedListRef.current = assignedList
  useEffect(() => {
    setStatusOverlay(previous => (Object.keys(previous).length > 0 ? {} : previous))
  }, [assignedList])
  useEffect(() => {
    if (!socket) return
    const handleUpdateOrder = (order) => {
      if (order?.id === undefined || order.status === undefined) return
      const known = Array.isArray(assignedListRef.current) && assignedListRef.current.some(assigned => assigned.id === order.id)
      if (!known) return
      setStatusOverlay(previous => (previous[order.id] === order.status ? previous : { ...previous, [order.id]: order.status }))
    }
    socket.on('update_order', handleUpdateOrder)
    return () => socket.off('update_order', handleUpdateOrder)
  }, [socket])
  const boardAssignedOrders = useMemo(() => {
    if (Object.keys(statusOverlay).length === 0 || !Array.isArray(assignedList)) return assignedOrders
    return {
      ...assignedOrders,
      orders: assignedList.map(order => (statusOverlay[order.id] !== undefined ? { ...order, status: statusOverlay[order.id] } : order))
    }
  }, [assignedOrders, assignedList, statusOverlay])

  const handleBackRedirect = () => {
    setIsOpenDriverOrders(false)
    setPendingOpen(null) // redesign drivers-dashboard B4 (decision 5)
    onDriverRedirect()
  }

  const handleChangeDriver = (driver) => {
    if (selectedDriver?.id === driver.id) {
      setSelectedDriver(null)
    } else {
      setSelectedDriver(driver)
    }
  }

  // redesign drivers-dashboard B4 (DD-14): the × of the panel lets go of the chosen driver
  const handleClosePanel = () => setSelectedDriver(null)

  const showSheet = (group) => {
    setSheetGroup(group)
    setIsOpenDriverOrders(true)
    setPendingOpen(null)
  }

  // redesign drivers-dashboard B4 (decision 5, DD-06): opens the sheet in the tab of the group that holds the driver's orders.
  // `statusGroup` comes from the panel, which already worked it out: open at once. Without it, if the driver is the chosen one and its orders
  // are not loading, work it out now; otherwise choose it and wait (the opening stays pending, the button busy).
  // `writeUrl` is false for the ?id= that is already in the address bar.
  const openOrders = (driver, statusGroup, writeUrl = true) => {
    if (writeUrl) onDriverRedirect(driver?.id)
    setOpenDriver(driver)
    if (statusGroup !== undefined) {
      showSheet(statusGroup)
      return
    }
    if (selectedDriver?.id === driver?.id && !assignedOrders.loading) {
      showSheet(groupOfOrders(boardAssignedOrders))
      return
    }
    if (selectedDriver?.id !== driver?.id) setSelectedDriver(driver)
    setPendingOpen({ id: driver?.id, sawLoading: false })
  }

  // The effect of a child runs before the one of the controller (the parent) that asks for the orders of a newly chosen driver: right after
  // choosing, `loading` is still false, with the orders of whoever was chosen before. So the opening waits to see the load start (sawLoading)
  // and then finish. If the person chooses another driver meanwhile, it is dropped.
  useEffect(() => {
    if (!pendingOpen) return
    if (selectedDriver?.id !== pendingOpen.id) {
      setPendingOpen(null)
      return
    }
    if (assignedOrders.loading) {
      if (!pendingOpen.sawLoading) setPendingOpen(previous => (previous ? { ...previous, sawLoading: true } : previous))
      return
    }
    if (pendingOpen.sawLoading) showSheet(groupOfOrders(boardAssignedOrders))
  }, [assignedOrders.loading, selectedDriver?.id, pendingOpen])

  // Safety: if the orders never finish, the sheet opens after a while with no group (in Pending, as before).
  useEffect(() => {
    if (!pendingOpen) return
    const timer = setTimeout(() => showSheet(undefined), ORDERS_OPEN_WAIT_MS)
    return () => clearTimeout(timer)
  }, [pendingOpen?.id])

  // redesign W1-4 (T1-4-4a): the text is typed locally and sent after the same wait as before (one `users` request per text);
  // a value set from outside (clear filters) shows unless the user is typing. Same behaviour as SearchBar with lazyLoad.
  const [searchText, setSearchText] = useState(searchValue || '')
  const searchTimer = useRef(null)
  const searchInput = useRef(null)
  useEffect(() => {
    if (!searchValue) {
      setSearchText('')
      return
    }
    if (typeof document !== 'undefined' && document.activeElement !== searchInput.current) setSearchText(searchValue)
  }, [searchValue])
  useEffect(() => () => clearTimeout(searchTimer.current), [])
  const typeSearch = (value) => {
    setSearchText(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => handleChangeSearch(value), SEARCH_DEBOUNCE_MS)
  }
  const clearSearch = () => {
    clearTimeout(searchTimer.current)
    setSearchText('')
    handleChangeSearch('')
  }

  // (row 26, drivers-dashboard P1, D-33): the driver groups chosen on the board. The choice lives here, with the search, so the
  // notice and «Clear filters» cover both; the board narrows its own list with it (the page request is unchanged).
  // (row 28, driver-store-status P-1): it starts from ?groups=<id[,id…]> (the «View drivers» exit of a store), read once on mount;
  // the param then leaves the address bar so a reload or «Clear filters» does not bring it back. `id` stays. Without it: empty, as before.
  const [groupIds, setGroupIds] = useState(() => parseGroupIds(urlSearch))
  useEffect(() => {
    if (query.get('groups') !== null) removeQueryToUrl(['groups'])
  }, [])
  const isFiltered = !!searchValue || groupIds.length > 0

  const handleClearFilters = () => {
    if (searchValue) clearSearch()
    if (groupIds.length > 0) setGroupIds([])
    // (review L2): «Clear filters» lives in the notice, which unmounts when the filters clear; the focus would fall to <body>.
    // The search stays on screen: the focus goes there.
    searchInput.current?.focus()
  }

  // redesign drivers-dashboard B4 (decision 5): this effect goes before the ?id= one. On mount both run; the ?id= one chooses a driver and must
  // be the last word (it used to go after because it chose nobody).
  useEffect(() => {
    setSelectedDriver(null)
  }, [driversIsOnline])

  // redesign drivers-dashboard B4 (decision 5, DD-06): an incoming ?id= chooses the driver and waits for its orders, like «n assigned orders».
  // The id attended last is kept: every event of the socket rebuilds `drivers`, and must not open the sheet again.
  const attendedId = useRef(null)
  useEffect(() => {
    if (loading) return
    const id = query.get('id')
    if (id === null) {
      attendedId.current = null
      setIsOpenDriverOrders(false)
      return
    }
    if (attendedId.current === id) return
    attendedId.current = id
    const driver = drivers.find(_driver => _driver.id === parseInt(id))
    if (!driver) {
      setOpenDriver(undefined)
      setIsOpenDriverOrders(true)
      return
    }
    openOrders(driver, undefined, false)
  }, [drivers, loading])

  return (
    <>
      <DriversContainer id='driverDashboard' data-filtered={isFiltered ? '' : undefined}>
        {/* redesign W1-4 (T1-4-4a): the head is P/PageHeader (h1, live status, Learn); the maps-key button is its action.
            Open menu (W1-D-2) is a P/IconButton in the header's `leading` slot with the sidebar collapsed.
            redesign tanda AB (O-3): the search is no longer a head action; it sits in the FilterBar below, as in /deliveries and /all-in-one. */}
        <DriversHeader>
          <PageHeader
            title={t('DRIVERS_DASHBOARD', 'Drivers dashboard')}
            // redesign tanda AB (O-3): the search no longer pushes the actions to their own line on a phone, so the title
            // takes the row of a narrow head itself (it was cut to «Dash bo…» beside the live status and Learn in it, fr, es…)
            wideTitle
            leading={isCollapse && (
              <IconButton
                icon={MenuIcon}
                label={t('OPEN_MENU', 'Open menu')}
                onClick={() => handleMenuCollapse(false)}
              />
            )}
            status={<WebsocketStatus />}
            learn={<LearnDropDown learnOptions={learnOptions} />}
            actions={(
              <>
                {!googleMapsApiKey && (
                  <GoogleMapsApiKeySettingButton />
                )}
              </>
            )}
          />
        </DriversHeader>
        {/* redesign tanda AB (O-3): the anatomy of /deliveries and /all-in-one: the search and, under it, «Filters applied» in one
            P/FilterBar under the head (`flush`: the page already gives the margin). The driver-group pill and the load filter stay where they
            were, in the head of the list (DriversDashboard), which owns the drivers they are built from. */}
        <FilterBar
          flush
          label={t('DRIVER_FILTERS', 'Driver filters')}
          search={(
            <SearchField
              value={searchText}
              onChange={typeSearch}
              onClear={clearSearch}
              inputRef={searchInput}
              label={t('SEARCH', 'Search')}
              placeholder={t('SEARCH_BY_NAME_OR_PHONE', 'Search by name or phone')} // redesign drivers-dashboard B4 (decision 3: the search covers the phone)
              clearLabel={t('CLEAR_SEARCH', 'Clear search')}
            />
          )}
          notice={isFiltered
            ? (
              <InlineNotice
                tone='warning'
                icon={TriangleAlert}
                action={<Button variant='ghost' onClick={() => handleClearFilters()}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>}
              >
                {t('WARNING_FILTER_APPLIED', 'Filters applied. You may miss new orders.')}
              </InlineNotice>
              )
            : undefined}
        />
        {/* redesign W0-12 (W0-A0-01): one-line slot under the head; it was the last child, below the fold. redesign cierre W0 (W0-QA4-04): spaced from the search on a phone */}
        <OrderNotificationSlot spaced />
        <DriversContent>
          {/* redesign drivers-dashboard B4 (decisions 4 to 7): the board gets the clock, the orders of the chosen driver with their statuses
              up to date, the driver whose sheet is opening, and the three actions (choose, open orders, close panel) */}
          <DriversDashboard
            {...props}
            selectedDriver={selectedDriver}
            groupIds={groupIds}
            onGroupIdsChange={setGroupIds}
            assignedOrders={boardAssignedOrders}
            now={now}
            ordersOpeningId={pendingOpen?.id ?? null}
            onSelectDriver={handleChangeDriver}
            onOpenOrders={openOrders}
            onClosePanel={handleClosePanel}
          />
        </DriversContent>

        {/* redesign W1-1 (T1-2): mounted while there is a driver, so the Sheet plays its exit and gives the focus back.
            redesign drivers-dashboard B4 (decision 5): `statusGroup` opens it in the tab of the group that holds the driver's orders */}
        {openDriver && (
          <ContactOrdersSheet
            isDriver
            open={isOpenDriverOrders}
            user={openDriver}
            statusGroup={sheetGroup}
            // (P4): opened from ?id= there is no opener; the focus goes back to the chosen row
            returnFocus={() => document.getElementById('driverDashboard')?.querySelector('.odd-row[data-selected] .odd-row-select')}
            onClose={() => handleBackRedirect()}
          />
        )}
      </DriversContainer>
    </>
  )
}

export const DriversManager = (props) => {
  const DriversControlProps = {
    ...props,
    asDashboard: true,
    UIComponent: DriversManagerUI
  }
  return (
    <>
      <DriversController {...DriversControlProps} />
    </>
  )
}
