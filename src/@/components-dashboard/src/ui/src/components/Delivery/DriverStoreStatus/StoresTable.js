import React from 'react'
import PropTypes from 'prop-types'
import { useLanguage } from '../../../../../index'
import { Button, DataTable, EmptyState, Skeleton } from '../../Shared/Product' // redesign W1-8 (T1-8-4): P/ table, empty state and loading
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { StoreCards, Dash, ConnectedFigure, UngroupedTag, StoreActionsMenu } from './StoreCards'
import { TableArea, AttentionValue, FigureSkeleton } from './styles'

const SKELETON_ROWS = 10

// redesign W1-8 (T1-8-4): the row itself opens nothing (as on main; row 28 puts the exits in the Actions cell, not on the row);
// a store without online drivers is tinted by a data attribute
// (rows 28-29, live check): a store in no delivery group is not tinted: the «Not in any delivery group» tag says why it has no drivers
const tintOf = row => row.connectedDrivers === 0 && !row.ungrouped ? { 'data-no-online': '' } : undefined
const getRowId = row => row.businessId

// redesign W1 tramo C r1 (C1c, W1-QC1-14): «No stores match “_query_”»; what the person typed travels in its own <bdi> (any script, any direction)
const fillQuery = (template, query) => template.split('_query_').flatMap((part, index) => index === 0 ? [part] : [<bdi key={index}>{query}</bdi>, part])

export const StoresTable = (props) => {
  const { rows, loading, ordersLoading, ordersError, driversError, search, onClearSearch } = props
  const [, t] = useLanguage()
  const isPhone = useIsPhone() // redesign driver-store-status (decision 3): under 768 the table is a list of cards

  // redesign driver-store-status (M-DSS1): with an orders error the two order columns paint «—», never 0
  const orderCell = value => ordersLoading
    ? <FigureSkeleton><Skeleton size='100%' align='end' /></FigureSkeleton>
    : ordersError ? <Dash /> : value

  // redesign driver-store-status (review r1, Q-01): with the drivers failed, the two driver columns paint «—» and no row is
  // tinted: a store is not «without online drivers» because the drivers could not be read
  const driverCell = value => driversError ? <Dash /> : value
  const getRowAttributes = driversError ? undefined : tintOf

  // The four figures are metrics (decision 11, .odc-figure) and align to the end (proposal W1-8: Product aligns figures to the end).
  const columns = [
    // redesign W1 tramo C r1 (C1c, W1-QC1-15): the store name is the row header again (main painted <th scope='row'>)
    // (row 29, driver-store-status P-4): a store in no delivery group carries the text tag under its name (it reads in the row header)
    { id: 'store', header: t('STORE', 'Store'), cell: row => row.ungrouped ? <>{row.name}<UngroupedTag /></> : row.name, wrap: true, rowHeader: true },
    {
      id: 'totalDrivers',
      header: t('TOTAL_DRIVERS', 'Total drivers'),
      align: 'end',
      cell: row => driverCell(<bdi className='odc-figure'>{row.totalDrivers}</bdi>)
    },
    {
      id: 'connectedDrivers',
      header: t('ONLINE_DRIVERS', 'Online drivers'),
      align: 'end',
      cell: row => driverCell(<ConnectedFigure row={row} />) // (row 31, P-9): figure + «All busy» mark
    },
    {
      id: 'activeOrders',
      header: t('ACTIVE_UNASSIGNED', 'Active unassigned'),
      align: 'end',
      // redesign driver-store-status (decision 2): a figure above 0 is semibold (the table is ordered by what needs attention)
      cell: row => orderCell(
        <AttentionValue data-attention={row.activeOrders > 0 ? '' : undefined}>
          <bdi className='odc-figure'>{row.activeOrders}</bdi>
        </AttentionValue>
      )
    },
    {
      id: 'finishedToday',
      header: t('FINISHED_TODAY', 'Finished today'),
      align: 'end',
      cell: row => orderCell(<bdi className='odc-figure'>{row.finishedToday}</bdi>)
    },
    // (row 28, driver-store-status P-1, D-22): the store's two exits; they open other pages, so they show with a drivers or orders
    // error too (and not on the skeleton rows, which never call the cell). (rows 28-29, live check): behind one menu button per row
    { id: 'actions', header: t('ACTIONS', 'Actions'), cell: row => <StoreActionsMenu row={row} /> }
  ]

  const empty = search && onClearSearch
    ? ( // redesign W1 tramo C r1 (C1c, W1-QC1-14): a search with no result is not «no stores»; it offers «Clear search»
      <EmptyState
        title={fillQuery(t('COMMAND_PALETTE_BUSINESS_EMPTY', 'No stores match “_query_”'), search)}
        action={<Button onClick={onClearSearch}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
      />
      )
    : <EmptyState title={t('NO_STORES_TO_SHOW', 'No stores to show')} />

  if (isPhone) {
    return <StoreCards rows={rows} loading={Boolean(loading)} ordersLoading={Boolean(ordersLoading)} ordersError={Boolean(ordersError)} driversError={Boolean(driversError)} empty={empty} />
  }

  return (
    <TableArea>
      <DataTable
        label={t('DRIVER_STORE_STATUS', 'Driver store status')}
        columns={columns}
        rows={rows || []}
        getRowId={getRowId}
        getRowAttributes={getRowAttributes}
        loading={Boolean(loading)}
        loadingLabel={t('LOADING', 'Loading')}
        skeletonRows={SKELETON_ROWS}
        // redesign W1 tramo C r1 (C1c, W1-QC1-11): a named scroll region with the edge fade; the row opens nothing (W1-PC1-03), so rows stay plain; the exits are links in the Actions cell (row 28)
        scrollLabel={t('STORES_TABLE_SCROLL_REGION', 'Stores table, scrolls sideways')}
        empty={empty}
      />
    </TableArea>
  )
}

StoresTable.propTypes = {
  rows: PropTypes.array,
  loading: PropTypes.bool,
  ordersLoading: PropTypes.bool,
  ordersError: PropTypes.bool,
  driversError: PropTypes.bool,
  search: PropTypes.string,
  onClearSearch: PropTypes.func
}
