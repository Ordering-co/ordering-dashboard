import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage, DriverStoreStatus as DriverStoreStatusController } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Button, EmptyState, IconButton, InlineNotice, PageHeader, Pagination, WebsocketStatus } from '../../Shared/Product' // redesign W1-8 (T1-8-4)
import { Menu as MenuIcon, RotateCw } from '../../Shared/Icon'
import { buildStoreRows, buildGlobalKpis, buildOrderTotals } from './aggregate'
import { KpiCards } from './KpiCards'
import { Filters } from './Filters'
import { StoresTable } from './StoresTable'
import { MissingGroupsState } from './MissingGroupsState'
import { Container, NoticeArea } from './styles'
import { timeZoneNote } from '../../../../../utils/timeZone'

const PAGE_SIZES = [10, 25, 50]

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11, `figure` from Pagination) and keep their direction in RTL.
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const DriverStoreStatusUI = (props) => {
  const {
    drivers,
    driversLoading,
    groups,
    groupsLoading,
    businesses,
    businessesLoading,
    storesWithoutGroups,
    orderCounts,
    activeByBusiness,
    activeInProgressByBusiness, // (review M4)
    finishedTodayByBusiness,
    ordersLoading,
    structureError,
    driversError,
    groupsError,
    businessesError,
    ordersError,
    onReload,
    timeZone
  } = props
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const searchRef = useRef(null) // redesign W1 tramo C r1 (C1c, W1-QC1-14): «Clear search» in the empty state hands the focus back to the search field

  // (row 29, driver-store-status P-4): the businesses read is part of the structure, so Reload is busy while it loads and row 30
  // retakes the order when it settles. A store is «in no group» only if the groups are known: with the groups read failed the
  // businesses are left out (the error shows, as today) rather than calling every store ungrouped.
  const structureLoading = driversLoading || groupsLoading || businessesLoading
  const storeBusinesses = groupsError ? undefined : businesses
  const anyLoading = Boolean(structureLoading || ordersLoading)

  // (row 30, driver-store-status P-8): the rows take the attention order (decision 2) when a load settles (the first
  // load and every Reload) and when the search text changes; between those moments the figures change in place and the rows keep
  // their place. It is adjusted during render (not in an effect) so no frame paints the old order after the new data.
  const attentionRows = useMemo(
    () => buildStoreRows({ groups, businesses: storeBusinesses, drivers, activeByBusiness, activeInProgressByBusiness, finishedTodayByBusiness }),
    [groups, storeBusinesses, drivers, activeByBusiness, activeInProgressByBusiness, finishedTodayByBusiness]
  )
  const [frozen, setFrozen] = useState(() => ({ loading: anyLoading, search, order: attentionRows.map(row => row.businessId) }))
  if (frozen.loading !== anyLoading || frozen.search !== search) {
    const retake = (frozen.loading && !anyLoading) || frozen.search !== search
    setFrozen({ loading: anyLoading, search, order: retake ? attentionRows.map(row => row.businessId) : frozen.order })
  }
  const rows = useMemo(
    () => buildStoreRows({ groups, businesses: storeBusinesses, drivers, activeByBusiness, activeInProgressByBusiness, finishedTodayByBusiness, order: frozen.order }),
    [groups, storeBusinesses, drivers, activeByBusiness, activeInProgressByBusiness, finishedTodayByBusiness, frozen.order]
  )
  const kpis = useMemo(() => buildGlobalKpis({ groups, businesses: storeBusinesses, drivers }), [groups, storeBusinesses, drivers])
  const totals = useMemo(() => buildOrderTotals(rows), [rows]) // redesign driver-store-status (decision 1): every store, not the ones the search leaves
  // (rows 28-29, live check): «without online drivers» counts the stores of a delivery group only (as before row 29); the stores in
  // none are counted apart, for their own line in the KPI card
  const storesWithoutOnline = useMemo(() => rows.filter(row => !row.ungrouped && row.connectedDrivers === 0).length, [rows])
  const storesInNoGroup = useMemo(() => rows.filter(row => row.ungrouped).length, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(row => (row.name || '').toLowerCase().includes(query))
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRows, currentPage, pageSize]
  )

  const handleSearch = (value) => {
    setSearch(value || '')
    setPage(1)
  }

  const handleClearSearch = () => {
    handleSearch('')
    searchRef.current?.focus()
  }

  const handleChangePageSize = (size) => {
    setPageSize(size)
    setPage(1)
  }

  // redesign driver-store-status (M-DSS1): with no store loaded an error replaces the table; with stores painted it is a notice above it.
  // redesign driver-store-status (review r1, Q-01/Q-02): each figure follows its own source. The stores come from the groups,
  // the driver figures from the drivers, the order sum from both the stores and the orders.
  const storesFailed = Boolean(groupsError) && rows.length === 0
  const driversFailed = Boolean(driversError)
  const partialError = !storesFailed && Boolean(structureError || driversError || groupsError || businessesError || ordersError)

  // redesign driver-store-status (review r1, Q-03): a retry that works removes «Try again»; the focus goes to «Reload», not to <body>.
  // A retry that fails again keeps it on «Try again» (the same button, or the one that replaced it). Directed review: only a focus
  // left on <body> moves; a person who went elsewhere while it loaded keeps their place.
  const reloadRef = useRef(null)
  const retryRef = useRef(null)
  const retrying = useRef(false)
  const showsRetry = storesFailed || partialError
  useEffect(() => {
    if (!retrying.current || anyLoading) return
    retrying.current = false
    const active = document.activeElement
    if (active && active !== document.body) return
    if (showsRetry) retryRef.current?.focus()
    else reloadRef.current?.focus()
  }, [anyLoading, showsRetry])
  const handleRetry = () => {
    retrying.current = true
    onReload()
  }
  const tryAgain = ( // busy, not disabled, as «Reload»: a disabled button drops the focus to <body> while it loads
    <Button ref={retryRef} onClick={handleRetry} busy={anyLoading}>{t('TRY_AGAIN', 'Try again')}</Button>
  )

  return (
    <Container className='odc-root'>
      {/* redesign W1-8 (T1-8-4): Reload is the header's one action. the opener is PageHeader's `leading`. */}
      <PageHeader
        title={t('DRIVER_STORE_STATUS', 'Driver store status')}
        description={timeZone && timeZoneNote(timeZone, t)} // the zone «Today» and «Active unassigned» are counted in
        status={<WebsocketStatus />} // (row 32, driver-store-status P-7): the realtime connection status, as Orders and /drivers-dashboard show it; no renderNotice yet (this page's notice area is unchanged)
        leading={isCollapse && (
          <IconButton
            icon={MenuIcon}
            label={t('OPEN_MENU', 'Open menu')}
            onClick={() => handleMenuCollapse(false)}
          />
        )}
        actions={(
          <Button // redesign W1 tramo C r1 (C1c, W1-QC1-06): busy, not disabled: a disabled button drops the focus to <body> while it loads
            ref={reloadRef}
            icon={RotateCw}
            onClick={onReload}
            busy={Boolean(structureLoading || ordersLoading)}
          >
            {t('RELOAD', 'Reload')}
          </Button>
        )}
      />
      <KpiCards
        kpis={kpis}
        orderCounts={orderCounts}
        totals={totals}
        storesWithoutOnline={storesWithoutOnline}
        storesInNoGroup={storesInNoGroup}
        loading={structureLoading}
        groupsLoading={Boolean(groupsLoading)}
        ordersLoading={ordersLoading}
        storesFailed={storesFailed}
        driversFailed={driversFailed}
        ordersError={Boolean(ordersError)}
      />
      <Filters search={search} onSearch={handleSearch} inputRef={searchRef} />
      {partialError && (
        <NoticeArea>
          <InlineNotice tone='warning' action={tryAgain}>
            {t('DRIVER_STORE_STATUS_PARTIAL_ERROR', "Some figures couldn't be updated.")}
          </InlineNotice>
        </NoticeArea>
      )}
      {/* (main #487): active stores and no driver group with any of them: say a driver group is needed, above the list */}
      {storesWithoutGroups && !storesFailed && (
        <NoticeArea>
          <MissingGroupsState hasGroups={!!groups?.length} />
        </NoticeArea>
      )}
      {storesFailed
        ? <EmptyState tone='error' title={t('DRIVER_STORE_STATUS_LOAD_ERROR', "We couldn't load the stores.")} action={tryAgain} />
        : <StoresTable rows={pageRows} loading={structureLoading} ordersLoading={ordersLoading} ordersError={Boolean(ordersError)} driversError={driversFailed} search={search.trim()} onClearSearch={handleClearSearch} />}
      {/* redesign owner-decisions Q-04: the size selector lives in the foot, so above the smallest size it stays to go back to it */}
      {!storesFailed && !structureLoading && (totalPages > 1 || pageSize > PAGE_SIZES[0]) && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={filteredRows.length}
          pageSizeOptions={PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={handleChangePageSize}
          showPageInput
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
          pageLabel={t('PAGE', 'Page')} /* redesign W1 tramo C r1 (C1c, W1-PC1-02): main painted page numbers; the field jumps to a page, as /orders */
          pageOfLabel={(total, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total }, figure)}
          rangeLabel={(from, to, total, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
          pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
        />
      )}
    </Container>
  )
}

export const DriverStoreStatus = (props) => {
  return (
    <DriverStoreStatusController {...props} UIComponent={DriverStoreStatusUI} />
  )
}
