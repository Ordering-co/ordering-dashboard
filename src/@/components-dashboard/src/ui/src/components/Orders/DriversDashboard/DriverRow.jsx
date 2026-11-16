import React, { useId } from 'react'
import { useLanguage, useUtils } from '../../../../../index'
import { TriangleAlert } from '../../Shared/Icon'
import { Avatar, Button } from '../../Shared/Product'
import { formatRelativeTime } from '../../../../../utils/relativeTime'
import { driverState, fullName, signalOf } from './driverState'
import './drivers-board.css'

// redesign drivers-dashboard B3 (decisions 2 and 6): one driver of the list in two lines, no card. Line 1: photo, name and the state WITH
// text (Available / Busy / Offline). Line 2: the age of the last location. The assigned orders (a button that opens them) close the
// row, outside the button that selects the driver (tanda AG, ).
// This file also holds the pieces the driver panel repeats (state, signal) and the template helper the filter summary uses.

const NODE_TOKEN = /(_[A-Za-z]+_)/

/** «text with _token_» → the text with each token replaced by its node (a figure, a time). */
export const fillTemplate = (template, nodes) => (
  <>
    {String(template).split(NODE_TOKEN).map((part, index) => (
      Object.prototype.hasOwnProperty.call(nodes, part)
        ? <React.Fragment key={index}>{nodes[part]}</React.Fragment>
        : part
    ))}
  </>
)

// A figure (count, number) isolated and in the mono face of the system.
export const figure = (value) => <bdi className='odc-figure'>{value}</bdi>

// redesign drivers-dashboard B3 (decision 2): the state is a dot AND a word, never the color alone. A disconnected driver that still carries
// orders says Offline first and then «· Busy».
export const DriverState = ({ driver }) => {
  const [, t] = useLanguage()
  const state = driverState(driver)
  const label = {
    available: t('AVAILABLE', 'Available'),
    busy: t('BUSY', 'Busy'),
    offline: t('OFFLINE', 'Offline')
  }[state]
  const offlineBusy = state === 'offline' && !!driver?.busy
  return (
    <span className='odd-state' data-state={state}>
      <span className='odd-dot' aria-hidden='true' />
      <span>{label}{offlineBusy && ` · ${t('BUSY', 'Busy')}`}</span>
    </span>
  )
}

// redesign drivers-dashboard B3 (decision 6): «Location 3 minutes ago»; a connected driver with no location for too long says it with an icon
// and words («No recent location · 20 minutes ago»). The project's own date is the title.
export const DriverSignal = ({ driver, now }) => {
  const [languageState, t] = useLanguage()
  const [utils] = useUtils()
  const locale = languageState?.language?.code || 'en'
  const signal = signalOf(driver, now)

  if (signal.kind === 'none') {
    return <span className='odd-signal' data-signal='none'>{t('NO_LOCATION_YET', 'No location yet')}</span>
  }

  const ago = <bdi>{formatRelativeTime(driver.last_location_at, { now, locale })}</bdi>
  const title = typeof utils?.parseDate === 'function' ? utils.parseDate(driver.last_location_at) : undefined

  if (signal.kind === 'stale') {
    return (
      <span className='odd-signal' data-signal='stale' title={title}>
        <TriangleAlert className='odc-icon' aria-hidden='true' />
        <span>{t('NO_RECENT_LOCATION', 'No recent location')} · {ago}</span>
      </span>
    )
  }

  return (
    <span className='odd-signal' data-signal='fresh' title={title}>
      {fillTemplate(t('LOCATION_AGO', 'Location _time_'), { _time_: ago })}
    </span>
  )
}

const DriverRowPropsAreEqual = (prevProps, nextProps) => (
  JSON.stringify(prevProps.driver) === JSON.stringify(nextProps.driver) &&
  prevProps.selected === nextProps.selected &&
  prevProps.ordersBusy === nextProps.ordersBusy &&
  prevProps.now === nextProps.now
)

export const DriverRow = React.memo(({ driver, selected = false, ordersBusy = false, onSelect, onOpenOrders, now }) => {
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const name = fullName(driver)
  const describedId = useId()
  const count = Number(driver?.assigned_orders_count) || 0
  const ordersText = fillTemplate(
    count === 1
      ? t('ASSIGNED_ORDERS_COUNT_ONE', '_count_ assigned order')
      : t('ASSIGNED_ORDERS_COUNT_OTHER', '_count_ assigned orders'),
    { _count_: figure(count) }
  )

  // tanda AG (A3-1): two sibling actions in a row that is not itself interactive. The select button holds the driver
  // (only phrasing content: spans); the orders button follows it, outside its box, so their 44px areas do not cross on a phone. The
  // orders text is one span, so the link is underlined once (as two flex items, the figure and the words were underlined apart).
  // The aria-label names who (it replaces the content), so the state and the signal reach a screen reader as the description.
  return (
    <li className='odd-row' data-state={driverState(driver)} data-selected={selected ? '' : undefined}>
      <button
        type='button'
        className='odd-row-select'
        aria-pressed={selected}
        aria-label={`${t('SELECT_DRIVER', 'Select driver')} ${name}`}
        aria-describedby={`${describedId}-state ${describedId}-signal`}
        onClick={() => onSelect?.(driver)}
      >
        <Avatar name={name} src={driver?.photo ? optimizeImage(driver.photo, 'h_50,c_limit') : undefined} size='lg' />
        <span className='odd-row-body'>
          <span className='odd-row-line'>
            <span className='odd-row-name' title={name}>{name}</span>
            <span id={`${describedId}-state`} className='odd-row-state'><DriverState driver={driver} /></span>
          </span>
          <span id={`${describedId}-signal`} className='odd-row-meta'>
            <DriverSignal driver={driver} now={now} />
          </span>
        </span>
      </button>
      {count > 0
        ? (
          <Button variant='link' size='sm' className='odd-row-orders' busy={ordersBusy} onClick={() => onOpenOrders?.(driver)}>
            <span className='odd-row-orders-text'>{ordersText}</span>
          </Button>
          )
        : <span className='odd-row-orders'><span className='odd-row-orders-text'>{ordersText}</span></span>}
    </li>
  )
}, DriverRowPropsAreEqual)

DriverRow.displayName = 'DriverRow'
