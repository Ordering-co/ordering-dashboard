import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConfig, useLanguage, DriversList as DriversController } from '../../../../../../index'
import { ContactOrdersSheet } from '../../ContactOrdersSheet' // redesign W1-1 (T1-2)
import { GoogleMapsApiKeySettingButton } from '../../GoogleMapsApiKeySettingButton'
// redesign all-in-one B1 (decision 2, AIO-05): the filter, the row and the pure functions of /drivers-dashboard, as they are; the list uses P/
import { DriverLoadFilter } from '../../DriversDashboard/DriverLoadFilter'
import { DriverRow } from '../../DriversDashboard/DriverRow'
import { applyLoad, countLoad } from '../../DriversDashboard/driverState'
import { EmptyState, Pagination, Skeleton } from '../../../Shared/Product'
import './all-in-one-drivers.css' // redesign all-in-one B1 (decision 7): the block's layout

// redesign all-in-one B1 (decision 2): the same page sizes, rows of skeleton and clock as O/DriversDashboard
const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 10
const CLOCK_TICK_MS = 60000

// redesign all-in-one B1 (decision 2): «Showing _from_–_to_ of _total_»; the numbers become .odc-figure nodes (`figure` comes from Pagination).
// O/DriversDashboard keeps its own copy private, so this is the same few lines.
const fillRange = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const DriversManagerUI = (props) => {
  const {
    driversIsOnline,
    driversList,
    driversLoading, // redesign all-in-one B1 (AIO-04): the parent's own load of the drivers (OrdersManage), which the controller does not see
    handleChangeDriverIsOnline,
    onlineDrivers,
    offlineDrivers,
    setMapsData,
    selectedDriver,
    setSelectedDriver,
    assignedOrders,
    handleUpdateAssignedOrders,
    handleEmtpyOrderSelected,
    orderForMap,
    className
  } = props

  const [, t] = useLanguage()
  const [configState] = useConfig()
  const googleMapsApiKey = configState?.configs?.google_maps_api_key?.value

  const [isOpenDriverOrders, setIsOpenDriverOrders] = useState(false)
  const [openDriver, setOpenDriver] = useState(null)

  // redesign all-in-one B1 (decision 2, audit A2): the tab counts and lists what the CONTROLLER filtered (the header's «Driver» and
  // «Driver group» are already applied in onlineDrivers / offlineDrivers); the load filter goes on top of that and the controller keeps
  // both busy flags on (handleChangeDriversSubFilter is never called).
  const [load, setLoad] = useState('all')
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10 })
  useEffect(() => { setLoad('all') }, [driversIsOnline])

  const tabList = driversIsOnline ? onlineDrivers : offlineDrivers
  const counts = useMemo(() => countLoad(tabList), [tabList])
  const visible = useMemo(() => applyLoad(tabList, load), [tabList, load])
  // redesign all-in-one B1 (decision 2): the map takes the load too, as the chips of before did
  const onlineOnMap = useMemo(() => applyLoad(onlineDrivers, load), [onlineDrivers, load])
  const offlineOnMap = useMemo(() => applyLoad(offlineDrivers, load), [offlineDrivers, load])

  // The page count and the page shown come from the list on every render: a list that shrinks never shows an empty page.
  const totalPages = Math.max(1, Math.ceil(visible.length / pagination.pageSize))
  const currentPage = Math.min(pagination.currentPage, totalPages)
  const pageDrivers = visible.slice((currentPage - 1) * pagination.pageSize, currentPage * pagination.pageSize)
  useEffect(() => {
    if (pagination.currentPage !== currentPage) setPagination(state => ({ ...state, currentPage }))
  }, [pagination.currentPage, currentPage])

  // redesign all-in-one B1 (decision 2, signal of decision 6 of /drivers-dashboard): the age of each location is read against this clock
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const handleBackRedirect = () => {
    setIsOpenDriverOrders(false)
  }

  // redesign bugs-d row 4: the order this click empties must not make the effect on orderForMap wipe the driver being chosen
  const keepDriverOnOrderCleared = useRef(false)

  const handleChangeDriver = (driver) => {
    if (handleEmtpyOrderSelected && orderForMap != null) keepDriverOnOrderCleared.current = true
    handleEmtpyOrderSelected && handleEmtpyOrderSelected()
    if (selectedDriver?.id === driver.id) {
      setSelectedDriver(null)
    } else {
      setSelectedDriver(driver)
    }
  }

  const handleOpenDriverOrders = (driver) => {
    // redesign all-in-one R1-01: as in main (O/DriversList onOpenDriverOrdersDetail), opening a driver's orders also chooses that driver
    // for the map, unless it already is the chosen one (choosing again would let go of it)
    if (selectedDriver?.id !== driver?.id) handleChangeDriver(driver)
    setOpenDriver(driver)
    setIsOpenDriverOrders(true)
  }

  // redesign all-in-one B1 (decision 2): DriverRow is memoized on the driver, the selection and the clock, not on its handlers; what
  // it keeps would answer with the state of the render that drew it. The rows call these, which read the latest.
  const handlersRef = useRef({})
  handlersRef.current = { handleChangeDriver, handleOpenDriverOrders }
  const selectRow = useCallback((driver) => handlersRef.current.handleChangeDriver(driver), [])
  const openRowOrders = useCallback((driver) => handlersRef.current.handleOpenDriverOrders(driver), [])

  useEffect(() => {
    setSelectedDriver(null)
  }, [driversIsOnline])

  useEffect(() => {
    setMapsData({
      driversIsOnline,
      onlineDrivers: onlineOnMap, // redesign all-in-one B1 (decision 2): with the load filter applied
      offlineDrivers: offlineOnMap,
      selectedDriver
    })
  }, [driversIsOnline, selectedDriver, onlineOnMap, offlineOnMap])

  useEffect(() => {
    if (keepDriverOnOrderCleared.current) {
      keepDriverOnOrderCleared.current = false
      return
    }
    if (orderForMap === null) {
      setSelectedDriver(null)
    }
  }, [orderForMap])

  useEffect(() => {
    handleUpdateAssignedOrders && handleUpdateAssignedOrders(assignedOrders)
  }, [assignedOrders])

  // redesign all-in-one B1 (AIO-04): the parent's load counts too; with the drivers coming from the parent the controller says it is not loading
  const loading = !!driversLoading || !!driversList?.loading

  const renderRows = () => {
    if (loading) {
      return (
        <ul className='odd-rows aio-drivers-rows' aria-busy='true'>
          <li className='odc-sr-only'>{t('LOADING', 'Loading')}</li>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className='odd-row' data-skeleton='' aria-hidden='true'>
              <Skeleton shape='round' size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' />
              <div className='odd-row-body'>
                <Skeleton size='40%' />
                <Skeleton size='25%' />
              </div>
            </li>
          ))}
        </ul>
      )
    }
    if (visible.length === 0) {
      return (
        <div className='odd-rows aio-drivers-rows'>
          <EmptyState className='odd-empty' title={t('NO_DRIVERS', 'No drivers')} />
        </div>
      )
    }
    return (
      <ul className='odd-rows aio-drivers-rows'>
        {pageDrivers.map(driver => (
          <DriverRow
            key={driver.id}
            driver={driver}
            selected={selectedDriver?.id === driver.id}
            onSelect={selectRow}
            onOpenOrders={openRowOrders}
            now={now}
          />
        ))}
      </ul>
    )
  }

  return (
    <>
      <div className={['aio-drivers', className].filter(Boolean).join(' ')}>
        {/* redesign all-in-one B1 (decision 7): the maps-key button stays on top of the block, only without a key */}
        {!googleMapsApiKey && (
          <div className='aio-drivers-key'>
            <GoogleMapsApiKeySettingButton />
          </div>
        )}
        <div className='odd-list-head'>
          <DriverLoadFilter
            tab={driversIsOnline ? 'online' : 'offline'}
            onTabChange={(value) => handleChangeDriverIsOnline(value === 'online')}
            onlineCount={onlineDrivers.length}
            offlineCount={offlineDrivers.length}
            load={load}
            onLoadChange={setLoad}
            counts={counts}
          />
        </div>
        {renderRows()}
        {!loading && visible.length > 0 && (
          <div className='odd-list-foot'>
            <Pagination
              page={currentPage}
              pageSize={pagination.pageSize}
              total={visible.length}
              pageSizeOptions={PAGE_SIZES}
              showPageInput
              onPageChange={(page) => setPagination(state => ({ ...state, currentPage: page }))}
              // `page` is the page that keeps the first row of the page shown in view (Pagination computes it)
              onPageSizeChange={(pageSize, page) => setPagination({ currentPage: page, pageSize })}
              label={t('PAGINATION', 'Pagination')}
              previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
              nextLabel={t('NEXT_PAGE', 'Next page')}
              pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
              pageLabel={t('PAGE', 'Page')}
              rangeLabel={(from, to, total, figure) => fillRange(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
              pageOfLabel={(totalPages, figure) => fillRange(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages }, figure)}
              pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
            />
          </div>
        )}
      </div>

      {/* redesign W1-1 (T1-2): mounted while there is a driver, so the Sheet plays its exit and gives the focus back */}
      {openDriver && (
        <ContactOrdersSheet
          isDriver
          open={isOpenDriverOrders}
          user={openDriver}
          onClose={() => handleBackRedirect()}
        />
      )}
    </>
  )
}

export const DriversManager = (props) => {
  const DriversControlProps = {
    ...props,
    asDashboard: true,
    // redesign all-in-one B1 (AIO-04): last_location_at feeds the signal of the row (it is read only when the controller asks for the drivers)
    propsToFetch: ['id', 'name', 'lastname', 'location', 'enabled', 'available', 'busy', 'driver_groups.name', 'driver_groups.id', 'assigned_orders_count', 'photo', 'last_location_at'],
    // redesign all-in-one B1 (AIO-04): the drivers of OrdersManage; the controller then does not ask for them (C/components/DriversList)
    driversList: props.driversList,
    UIComponent: DriversManagerUI
  }
  return (
    <>
      <DriversController {...DriversControlProps} />
    </>
  )
}
