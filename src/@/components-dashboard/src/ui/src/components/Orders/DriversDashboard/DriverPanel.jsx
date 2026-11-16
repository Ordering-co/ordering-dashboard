import React, { useContext, useId } from 'react'
import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { ArrowRight, Phone, X } from '../../Shared/Icon'
import { Avatar, Button, IconButton, InlineNotice, Skeleton, Status } from '../../Shared/Product'
import { getOrderStatusPrefix } from '../../../utils'
import { getOrderStatusFamily } from '../../../utils/orderStatusFamily'
import { driverGroups, driverState, fullName } from './driverState'
import { DriverSignal, DriverState, figure } from './DriverRow'
import './drivers-board.css'

// redesign drivers-dashboard B3 (decisions 4 and 5): the chosen driver's panel at the foot of the map column. Head (who, state, signal,
// call, close), facts, the active orders the page already loads, and «All orders», which opens the sheet in the tab of the group that
// holds them. It never takes the focus: it stays on the row that was pressed (the h2 has tabIndex -1 for a page that wants it).

// redesign drivers-dashboard B3 (decision 5): the «In progress» group of OrdersManage (C/components/OrdersManage/index.js)
export const IN_PROGRESS_STATUSES = [7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26]

const SKELETON_ROWS = 2

const groupOf = (orders) => (
  orders.some((order) => IN_PROGRESS_STATUSES.includes(Number(order.status))) ? 'inProgress' : 'pending'
)

export const DriverPanel = ({ driver, assignedOrders, onClose, onOpenOrders, ordersBusy = false, now }) => {
  const [languageState, t] = useLanguage()
  const [utils] = useUtils()
  const parseDate = utils?.parseDate
  const [configState] = useConfig()
  const configFile = useContext(ConfigFileContext)?.[0]
  const titleId = useId()

  if (!driver) return null

  const name = fullName(driver)
  const dictionary = languageState?.dictionary || {}
  const prefixForVariable = (configFile?.app_internal_name || '').toUpperCase()
  const showExternalId = configState?.configs?.change_order_id?.value === '1'
  const groups = driverGroups(driver).map((group) => group.name).join(', ')
  const lastLocation = driver.last_location_at && typeof parseDate === 'function' ? parseDate(driver.last_location_at) : null
  const hasFacts = !!(driver.cellphone || groups || lastLocation)

  const orders = Array.isArray(assignedOrders?.orders) ? assignedOrders.orders : []
  const loading = !!assignedOrders?.loading
  const error = assignedOrders?.error
  // redesign drivers-dashboard B3 (audit): a reload of the same driver keeps the list it has; the skeleton is only for a load with nothing drawn yet
  const showSkeleton = loading && orders.length === 0
  const showError = !loading && !!error
  const loaded = !showSkeleton && !showError
  const canOpenOrders = Number(driver.assigned_orders_count) > 0 || orders.length > 0
  // redesign drivers-dashboard R1-01: with nothing loaded yet there is no group to give: the page waits for the orders and works it out

  const statusLabel = (order) => (
    (parseInt(order?.delivery_type, 10) === 9 && parseInt(order?.status, 10) === 13)
      ? (dictionary.RESERVATION ?? t('RESERVATION', 'Reservation'))
      : getOrderStatusPrefix(order.status, dictionary, prefixForVariable)
  )

  const renderOrders = () => {
    if (showSkeleton) {
      return (
        <div className='odd-orders-skeleton' aria-busy='true'>
          <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className='odd-order' data-skeleton-row=''>
              <Skeleton size='30%' />
              <Skeleton size='50%' />
            </div>
          ))}
        </div>
      )
    }
    if (showError) {
      return (
        <InlineNotice tone='warning'>
          {t('ORDERS_LOAD_ERROR', "We couldn't load this driver's orders.")}
        </InlineNotice>
      )
    }
    if (orders.length === 0) return <p className='odd-empty'>{t('NO_ACTIVE_ORDERS', 'No active orders')}</p>
    return (
      <ul className='odd-order-list'>
        {orders.map((order) => {
          const number = (showExternalId && order.external_id) ? order.external_id : order.id
          return (
            <li key={order.id} className='odd-order'>
              <span className='odd-order-number'>#{figure(number)}</span>
              <Status family={getOrderStatusFamily(order.status)} label={statusLabel(order)} />
              <span className='odd-order-who'>
                <span>{order.business?.name}</span>
                {order.customer?.name && (
                  <>
                    <ArrowRight className='odc-icon odc-icon-flip' aria-hidden='true' />
                    <span>{order.customer.name}</span>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section className='odd-panel' aria-labelledby={titleId} data-state={driverState(driver)}>
      <header className='odd-panel-head'>
        <Avatar name={name} src={driver.photo} size='lg' />
        <div className='odd-panel-who'>
          <h2 id={titleId} className='odd-panel-title' tabIndex={-1}>{name}</h2>
          <div className='odd-panel-meta'>
            <DriverState driver={driver} />
            <DriverSignal driver={driver} now={now} />
          </div>
        </div>
        <div className='odd-panel-actions'>
          {driver.cellphone && (
            <a
              className='odc-btn'
              data-variant='secondary'
              data-size='md'
              href={`tel:${driver.cellphone}`}
              aria-label={`${t('CALL', 'Call')} ${name}`}
            >
              <Phone className='odc-icon' />
              {t('CALL', 'Call')}
            </a>
          )}
          <IconButton icon={X} label={`${t('CLOSE', 'Close')} ${name}`} onClick={() => onClose?.()} />
        </div>
      </header>
      {hasFacts && (
        <dl className='odd-facts'>
          {driver.cellphone && (
            <>
              <dt>{t('PHONE', 'Phone')}</dt>
              <dd><bdi className='odc-figure'>{driver.cellphone}</bdi></dd>
            </>
          )}
          {groups && (
            <>
              <dt>{t('DRIVER_GROUP', 'Driver group')}</dt>
              <dd>{groups}</dd>
            </>
          )}
          {lastLocation && (
            <>
              <dt>{t('LAST_LOCATION', 'Last location')}</dt>
              <dd><bdi className='odc-figure'>{lastLocation}</bdi></dd>
            </>
          )}
        </dl>
      )}
      <div className='odd-orders'>
        <div className='odd-orders-head'>
          <h3 className='odd-orders-title'>
            {t('ACTIVE_ORDERS', 'Active orders')}
            {loaded && <> ({figure(orders.length)})</>}
          </h3>
          {canOpenOrders && (
            <Button variant='link' size='sm' busy={!!ordersBusy} onClick={() => onOpenOrders?.(driver, showSkeleton ? undefined : groupOf(orders))}>
              {t('ALL_ORDERS', 'All orders')}
            </Button>
          )}
        </div>
        {renderOrders()}
      </div>
    </section>
  )
}
