import React from 'react'
import PropTypes from 'prop-types'
import { useHistory } from 'react-router-dom'
import { useLanguage } from '../../../../../index'
import { Menu, Skeleton, Status } from '../../Shared/Product'
import { Ellipsis } from '../../Shared/Icon'
import { StoreList, StoreCard, StoreName, StoreExits, StoreFigures, ConnectedValue, ConnectedCell, AttentionValue, FigureSkeleton, UngroupedNote } from './styles'

// redesign driver-store-status (decision 3): under 768 the table gives way to one card per store, with the four
// figures and their names (nothing is left outside the view). The card itself has no link and no tab stop (as on main); (row 28,
// driver-store-status P-1, D-22) adds the store's two exits at its foot (StoreExits).
// It draws the rows it is given; StoresTable decides when to use it. Precedent: InvoiceCardList (BusinessPaymentReports).

const SKELETON_CARDS = 5

// redesign driver-store-status (M-DSS1): a figure that could not be loaded paints «—», never 0. `bare` is for a
// phrase that already says it (a reference under a figure): the dash alone, hidden from a screen reader.
export const Dash = ({ bare = false }) => {
  const [, t] = useLanguage()
  return bare
    ? <span aria-hidden='true'>—</span>
    : (
      <span>
        <span aria-hidden='true'>—</span>
        <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
      </span>
      )
}

// (row 31, driver-store-status P-9): the Online drivers figure, plus «All busy» as text (P/Status, pending family) when every
// connected driver of the store is busy. It reads in the accessible name of the cell and never shows with the drivers failed.
// (rows 28-29, live check): the 0 of a store in no delivery group is not painted as an alert (the «Not in any delivery group» tag says why).
export const ConnectedFigure = ({ row }) => {
  const [, t] = useLanguage()
  const noneOnline = row.connectedDrivers === 0 && !row.ungrouped
  return (
    <ConnectedCell>
      <ConnectedValue data-zero={noneOnline ? '' : undefined}>
        <bdi className='odc-figure'>{row.connectedDrivers}</bdi>
      </ConnectedValue>
      {/* (T10): the red tint and the red 0 never carry the meaning alone; a text status (danger family) says it */}
      {noneOnline && <Status family='cancel' label={t('NO_DRIVERS_ONLINE', 'No drivers online')} wrap />}
      {row.allBusy && <Status family='pending' label={t('ALL_DRIVERS_BUSY', 'All busy')} wrap />}
    </ConnectedCell>
  )
}

// (row 29, driver-store-status P-4): a store that is in no delivery group says so in text (P/Status, the neutral «progress»
// family), under its name in the table and after it in the card (UngroupedNote keeps it on its own line).
export const UngroupedTag = ({ card = false }) => {
  const [, t] = useLanguage()
  return (
    <UngroupedNote $card={card}>
      <Status family='progress' label={t('NOT_IN_DELIVERY_GROUP', 'Not in any delivery group')} wrap />
    </UngroupedNote>
  )
}

// (row 28, driver-store-status P-1, D-22): the two exits of a store, shared by the table's Actions cell and the phone card.
// «View drivers» opens the drivers board with the Driver group filter set to the store's delivery groups (none, no link: an ungrouped
// store has no drivers); «View unassigned orders» opens the deliveries In progress tab with Unassigned on and the store filter. Both routes
// allow the same levels as this page. They are anchors (P/Button link look): a plain click pushes the route inside the app, a modified or
// middle click stays the browser's (new tab), as in Home's «Needs attention». The group is named for the store, as the links repeat.
const isPlainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

// (review L1): the groups in the link are the store's that have an enabled driver (`driverGroupIds`), and with none there is no
// «View drivers» (a group no loaded driver belongs to would show its raw id in the drivers board pill). (review M4): the orders link opens the
// tab that holds the store's unassigned orders (`unassignedTab`: Pending when all of them are pending).
const exitsOf = (row, t) => [
  ...(row.driverGroupIds?.length
    ? [{ key: 'drivers', label: t('VIEW_DRIVERS', 'View drivers'), path: `/drivers-dashboard?groups=${row.driverGroupIds.map(encodeURIComponent).join(',')}` }]
    : []),
  { key: 'orders', label: t('VIEW_UNASSIGNED_ORDERS', 'View unassigned orders'), path: `/deliveries?status=${row.unassignedTab || 'inProgress'}&unassigned=1&business=${encodeURIComponent(row.businessId)}` }
]

const actionsLabelOf = (row, t) => t('STORE_ACTIONS_FOR', 'Actions for _store_').split('_store_').join(row.name ?? '')

// (rows 28-29, live check): in the table the same exits sit behind one P/Menu per row (icon trigger named «Actions for <store>»),
// so the Actions column is one button wide and the Store column keeps its room at 1024. A menu item has no href, so it pushes the same
// path the phone card's link points to.
export const StoreActionsMenu = ({ row }) => {
  const [, t] = useLanguage()
  const history = useHistory()
  return (
    <Menu
      label={actionsLabelOf(row, t)}
      icon={Ellipsis}
      items={exitsOf(row, t).map(exit => ({ key: exit.key, label: exit.label, onSelect: () => history.push(exit.path) }))}
    />
  )
}

export const StoreExitLinks = ({ row, card = false }) => {
  const [, t] = useLanguage()
  const history = useHistory()
  const label = actionsLabelOf(row, t)
  const open = path => (event) => {
    if (event.defaultPrevented || !isPlainClick(event)) return
    event.preventDefault()
    history.push(path)
  }
  return (
    <StoreExits role='group' aria-label={label} $card={card}>
      {exitsOf(row, t).map(exit => (
        <a key={exit.key} className='odc-btn' data-variant='link' data-size='md' href={exit.path} onClick={open(exit.path)}>
          {exit.label}
        </a>
      ))}
    </StoreExits>
  )
}

const SkeletonCard = ({ labels }) => (
  <StoreCard aria-hidden='true'>
    <Skeleton size='50%' />
    <StoreFigures>
      {labels.map(label => (
        <div key={label}>
          <dt>{label}</dt>
          <dd><Skeleton size='40%' /></dd>
        </div>
      ))}
    </StoreFigures>
  </StoreCard>
)

export const StoreCards = (props) => {
  const { rows, loading, ordersLoading, ordersError, driversError, empty } = props
  const [, t] = useLanguage()
  const label = t('DRIVER_STORE_STATUS', 'Driver store status')

  // redesign driver-store-status (review r1, Q-01): with the drivers failed, their two figures paint «—» and no card is tinted
  const driverValue = value => driversError ? <Dash /> : value
  const orderValue = value => ordersLoading
    ? <FigureSkeleton><Skeleton size='100%' /></FigureSkeleton>
    : ordersError ? <Dash /> : value

  if (loading) {
    const names = [
      t('ONLINE_DRIVERS', 'Online drivers'),
      t('TOTAL_DRIVERS', 'Total drivers'),
      t('ACTIVE_UNASSIGNED', 'Active unassigned'),
      t('FINISHED_TODAY', 'Finished today')
    ]
    return (
      <>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <StoreList aria-label={label} aria-busy='true'>
          {Array.from({ length: SKELETON_CARDS }, (_, index) => <SkeletonCard key={index} labels={names} />)}
        </StoreList>
      </>
    )
  }

  if (!rows?.length) return empty

  return (
    <StoreList aria-label={label}>
      {rows.map(row => (
        // (rows 28-29, live check): a card of a store in no delivery group is not tinted, as its table row
        <StoreCard key={row.businessId} data-no-online={!driversError && row.connectedDrivers === 0 && !row.ungrouped ? '' : undefined}>
          <StoreName dir='auto'>{row.name}</StoreName>
          {row.ungrouped && <UngroupedTag card />}
          <StoreFigures>
            <div>
              <dt>{t('ONLINE_DRIVERS', 'Online drivers')}</dt>
              <dd>
                {driverValue(<ConnectedFigure row={row} />)}
              </dd>
            </div>
            <div>
              <dt>{t('TOTAL_DRIVERS', 'Total drivers')}</dt>
              <dd>{driverValue(<bdi className='odc-figure'>{row.totalDrivers}</bdi>)}</dd>
            </div>
            <div>
              <dt>{t('ACTIVE_UNASSIGNED', 'Active unassigned')}</dt>
              <dd>
                {orderValue(
                  <AttentionValue data-attention={row.activeOrders > 0 ? '' : undefined}>
                    <bdi className='odc-figure'>{row.activeOrders}</bdi>
                  </AttentionValue>
                )}
              </dd>
            </div>
            <div>
              <dt>{t('FINISHED_TODAY', 'Finished today')}</dt>
              <dd>{orderValue(<bdi className='odc-figure'>{row.finishedToday}</bdi>)}</dd>
            </div>
          </StoreFigures>
          <StoreExitLinks row={row} card />
        </StoreCard>
      ))}
    </StoreList>
  )
}

StoreCards.propTypes = {
  rows: PropTypes.array,
  loading: PropTypes.bool,
  ordersLoading: PropTypes.bool,
  ordersError: PropTypes.bool,
  driversError: PropTypes.bool,
  empty: PropTypes.node
}
