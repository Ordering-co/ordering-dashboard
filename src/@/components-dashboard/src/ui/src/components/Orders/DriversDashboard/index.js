import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { useBoardStacked } from '../../../hooks/useBoardStacked'
import { DriversLocation } from '../DriversLocation'
// (row 26, drivers-dashboard P1, D-33): ChecklistPopover, pillValue and withoutLeadingLabel, for the Driver group pill
import { ChecklistPopover, EmptyState, Pagination, SegmentedControl, Skeleton, pillValue, withoutLeadingLabel } from '../../Shared/Product'
import { Users } from '../../Shared/Icon'
import { DriverLoadFilter } from './DriverLoadFilter'
import { DriverPanel } from './DriverPanel'
import { DriverRow } from './DriverRow'
import { applyLoad, countLoad, filterByGroups, groupOptions, splitDrivers } from './driverState'
import { DriversBoard } from './styles'

// redesign drivers-dashboard B4 (decisions 1, 2, 3, 6, 7, 8): the board of /drivers-dashboard, the same model as the dispatch board of
// /deliveries. The list column (tabs and load filter, rows, pager) and the map column (the map and, at its foot, the panel of the chosen
// driver); below 1024px one column with a List | Map switch. The classes are the ones of drivers-board.css (B3).

const PAGE_SIZES = [10, 25, 50]
const SKELETON_ROWS = 10
// a stable empty choice, so the memos below do not run again on every render of a board that has no group chosen
const NO_GROUPS = []

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (`figure` from Pagination) and keep their direction in RTL.
const fillRange = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

export const DriversDashboard = (props) => {
  const {
    driversList,
    driversIsOnline,
    searchValue,
    groupIds = NO_GROUPS,
    onGroupIdsChange,
    selectedDriver,
    handleChangeDriverIsOnline,
    assignedOrders,
    ordersOpeningId,
    now,
    onSelectDriver,
    onOpenOrders,
    onClosePanel
  } = props

  const [, t] = useLanguage()
  const isStacked = useBoardStacked()
  // redesign drivers-dashboard B4 (decision 7): List | Map below 1024px; from there up both columns are drawn and `view` is not used
  const [view, setView] = useState('list')
  // redesign drivers-dashboard B4 (decision 3): one value, «All» by default; it goes back to «All» when the tab changes (the chips of today stayed on)
  const [load, setLoad] = useState('all')
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 10 })

  useEffect(() => { setLoad('all') }, [driversIsOnline])

  // (row 26, drivers-dashboard P1, D-33): the group narrows the drivers BEFORE they are split, so the tabs, their counts, the
  // rows, the pager and the map all follow it, as they follow the search. The options come from every driver loaded (not the narrowed
  // list), so a chosen group never vanishes from the pill.
  const allDrivers = driversList?.drivers
  const groups = useMemo(() => groupOptions(allDrivers), [allDrivers])
  const grouped = useMemo(() => filterByGroups(allDrivers, groupIds), [allDrivers, groupIds])
  const groupLabel = t('DRIVER_GROUP', 'Driver group')
  const groupName = (id) => groups.find(group => group.id === id)?.name
  const groupItems = groups.map(group => ({ id: group.id, name: group.name, secondary: `${t('ID', 'ID')} ${group.id}`, keywords: [String(group.id)] }))
  const toggleGroup = (id) => onGroupIdsChange?.(groupIds.includes(id) ? groupIds.filter(item => item !== id) : [...groupIds, id])
  // a change of group (here or from «Clear filters») goes back to page 1
  const groupKey = groupIds.join(',')
  useEffect(() => { setPagination(state => (state.currentPage === 1 ? state : { ...state, currentPage: 1 })) }, [groupKey])

  // The tabs count every driver of their state (DD-05); the filter, the rows and the map take the load on top. The API's order (decision 8).
  const { online, offline } = useMemo(() => splitDrivers(grouped), [grouped])
  const tabList = driversIsOnline ? online : offline
  const counts = countLoad(tabList)
  const visible = applyLoad(tabList, load)
  const onlineOnMap = useMemo(() => applyLoad(online, load), [online, load])
  const offlineOnMap = useMemo(() => applyLoad(offline, load), [offline, load])
  // redesign drivers-dashboard B4 (DD-10): the panel already shows the load of the orders; the map does not repeat it with a spinner
  const mapOrders = useMemo(() => ({ ...assignedOrders, loading: false }), [assignedOrders])

  // The page count and the page shown come from the list on every render: a list that shrinks never shows an empty page.
  const totalPages = Math.max(1, Math.ceil(visible.length / pagination.pageSize))
  const currentPage = Math.min(pagination.currentPage, totalPages)
  const pageDrivers = visible.slice((currentPage - 1) * pagination.pageSize, currentPage * pagination.pageSize)
  // the stored page follows the one shown: a list that empties and fills again starts from the page it was clamped to, not from a stale one
  useEffect(() => {
    if (pagination.currentPage !== currentPage) setPagination(state => ({ ...state, currentPage }))
  }, [pagination.currentPage, currentPage])

  // DriverRow is memoized on the driver, the selection, the busy flag and the clock, not on its handlers: a handler it kept would answer with
  // the state of the render that drew it (the chosen driver, whether its orders are loading). The rows call these, which read the latest.
  const handlersRef = useRef({})
  handlersRef.current = { onSelectDriver, onOpenOrders }
  const selectRow = useCallback((driver) => handlersRef.current.onSelectDriver?.(driver), [])
  const openRowOrders = useCallback((driver) => handlersRef.current.onOpenOrders?.(driver), [])

  // redesign drivers-dashboard R1-02: the × of the panel took the focus with it (it fell to <body>); it goes back to the chosen row, or
  // to the current tab when that row is not on the list (filtered out, another page)
  const listRef = useRef(null)
  const handleClosePanel = () => {
    const row = listRef.current?.querySelector('.odd-row-select[aria-pressed="true"]')
    onClosePanel?.()
    const target = row || listRef.current?.querySelector('[role="tab"][aria-selected="true"]')
    if (target) setTimeout(() => { if (target.isConnected) target.focus() }, 0)
  }

  const handleChangePage = (page) => setPagination(state => ({ ...state, currentPage: page }))
  // `page` is the page that keeps the first row of the page shown in view (Pagination computes it)
  const handleChangePageSize = (pageSize, page) => setPagination({ currentPage: page, pageSize })

  const isListHidden = isStacked && view === 'map'
  // the map is mounted only in «Map» (it frames with its real size), but the column stays while the panel has to sit in it
  const showMapColumn = !isStacked || view === 'map' || !!selectedDriver
  const showMap = !isStacked || view === 'map'
  const loading = !!driversList?.loading

  const renderRows = () => {
    if (loading) {
      return (
        <ul className='odd-rows' id='driversList' aria-busy='true'>
          <li className='odc-sr-only'>{t('LOADING', 'Loading')}</li>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className='odd-row' data-skeleton='' aria-hidden='true'>
              <Skeleton shape='round' size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' />
              <div className='odd-row-body'>
                <Skeleton size='40%' />
                <Skeleton size='25%' />
                {/* tanda AG: the third line of a row, the assigned orders */}
                <Skeleton size='30%' />
              </div>
            </li>
          ))}
        </ul>
      )
    }
    if (visible.length === 0) {
      return (
        <div className='odd-rows' id='driversList'>
          <EmptyState
            className='odd-empty'
            title={(searchValue || groupIds.length > 0) ? t('NO_DRIVERS_FOUND', 'No drivers found') : t('NO_DRIVERS', 'No drivers')}
          />
        </div>
      )
    }
    return (
      <ul className='odd-rows' id='driversList'>
        {pageDrivers.map(driver => (
          <DriverRow
            key={driver.id}
            driver={driver}
            selected={selectedDriver?.id === driver.id}
            onSelect={selectRow}
            onOpenOrders={openRowOrders}
            ordersBusy={ordersOpeningId === driver.id}
            now={now}
          />
        ))}
      </ul>
    )
  }

  return (
    <DriversBoard className='odd-board' data-view={isStacked ? view : undefined}>
      {isStacked && (
        <div className='odd-view'>
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
      <div className='odd-list' hidden={isListHidden} ref={listRef}>
        <div className='odd-list-head'>
          <DriverLoadFilter
            tab={driversIsOnline ? 'online' : 'offline'}
            onTabChange={(value) => handleChangeDriverIsOnline(value === 'online')}
            onlineCount={online.length}
            offlineCount={offline.length}
            load={load}
            onLoadChange={setLoad}
            counts={counts}
          />
          {/* hidden while no driver has a group (a choice already made stays, so it can be cleared) */}
          {(groups.length > 0 || groupIds.length > 0) && (
            <div className='odd-group-filter'>
              <ChecklistPopover
                icon={Users}
                label={groupLabel}
                // the name of a group may already start with «Driver group»: not written twice (as the Orders filter bar does)
                value={withoutLeadingLabel(groupLabel, pillValue(groupIds, groupName))}
                items={groupItems}
                selected={groupIds}
                onToggle={toggleGroup}
                onClear={() => onGroupIdsChange?.([])}
                searchLabel={t('SEARCH', 'Search')}
                clearSearchLabel={t('CLEAR_SEARCH', 'Clear search')}
                loadingLabel={`${t('LOADING', 'Loading')}...`}
                noResultsLabel={t('NO_RESULTS_FOUND', 'No results found')}
                clearLabel={t('CLEAR', 'Clear')}
              />
            </div>
          )}
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
              onPageChange={handleChangePage}
              onPageSizeChange={handleChangePageSize}
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
      {showMapColumn && (
        <div className='odd-map'>
          {showMap && (
            <DriversLocation
              driversIsOnline={driversIsOnline}
              selectedDriver={selectedDriver}
              onlineDrivers={onlineOnMap}
              offlineDrivers={offlineOnMap}
              driversList={driversList}
              assignedOrders={mapOrders}
            />
          )}
          <DriverPanel
            driver={selectedDriver}
            assignedOrders={assignedOrders}
            onClose={handleClosePanel}
            onOpenOrders={onOpenOrders}
            now={now}
            ordersBusy={!!selectedDriver && ordersOpeningId === selectedDriver.id}
          />
        </div>
      )}
    </DriversBoard>
  )
}
