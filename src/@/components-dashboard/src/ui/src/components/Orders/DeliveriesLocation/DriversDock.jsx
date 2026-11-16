import React, { useEffect, useId, useRef } from 'react'
import { useConfig, useLanguage } from '../../../../../index'
import { useUtils } from '../../../../../contexts/UtilsContext'
import { Phone } from '../../Shared/Icon'
import { Avatar, Button, InlineNotice, Skeleton } from '../../Shared/Product'
import './drivers-dock.css'

// redesign deliveries F2-B2 (decisions 1 and 3; DV-01, DV-06, DV-13): the drivers strip at the foot of the map column.
// It is always in the column (never over the map), so it still helps with «Map unavailable». Three states:
//   overview    nothing chosen: «Drivers», «n available · m busy» and every enabled driver;
//   candidates  an order without a driver: who can take it, with «Assign» when the board says the user may assign;
//   assigned    an order with a driver (or a company, or an external driver): that row, with no «Assign».

const SKELETON_ROWS = 3

const fullName = (person) => [person?.name, person?.lastname].filter(Boolean).join(' ')

// Same reading as the order panel's selector: busy wins, then available, the rest is offline.
const stateOf = (driver) => (driver?.busy ? 'busy' : driver?.available ? 'available' : 'offline')
const STATE_RANK = { available: 0, busy: 1, offline: 2 }
const assignedCount = (driver) => Number(driver?.assigned_orders_count) || 0

// Available first, then busy, then the rest; inside each, the fewest assigned orders first.
const sortDrivers = (list) => [...list].sort((a, b) => (
  STATE_RANK[stateOf(a)] - STATE_RANK[stateOf(b)] || assignedCount(a) - assignedCount(b)
))

// «text with _token_» → the text with each figure (digits, order numbers) isolated in a mono node.
const withFigures = (template, values) => (
  <>
    {String(template).split(/(_[a-z]+_)/).map((part, index) => (
      Object.prototype.hasOwnProperty.call(values, part)
        ? <bdi key={index} className='odc-figure'>{values[part]}</bdi>
        : part
    ))}
  </>
)

// What the board knows of a driver fills what the candidate (or the order) did not bring.
const mergeKnown = (known, own) => {
  const merged = { ...(known || {}) }
  for (const [key, value] of Object.entries(own || {})) {
    if (value !== undefined && value !== null) merged[key] = value
  }
  return merged
}

const isUnassigned = (order) => !order.driver_id && !order.driver_company_id && !order.external_driver && !order.driver

export const DriversDock = ({
  order,
  drivers,
  driversLoading,
  candidates,
  candidatesStatus,
  onRetryCandidates,
  canAssign,
  assigner,
  focusToken
}) => {
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [utils] = useUtils()
  const parseDate = utils?.parseDate
  const titleId = useId()
  const rootRef = useRef(null)
  const titleRef = useRef(null)
  const lastToken = useRef(focusToken)
  const wantsFocus = useRef(false)
  const rescueFocus = useRef(false)

  const board = new Map((drivers || []).map(driver => [String(driver.id), driver]))
  const mode = !order ? 'overview' : isUnassigned(order) ? 'candidates' : 'assigned'
  const loading = mode === 'overview' ? !!driversLoading : (mode === 'candidates' && candidatesStatus === 'loading')
  const mayAssign = mode === 'candidates' && typeof canAssign === 'function' && !!canAssign(order)
  const orderNumber = order ? ((configs?.change_order_id?.value === '1' && order.external_id) ? order.external_id : order.id) : null

  // The page asks for the candidates (a card's «Assign»): the focus goes to the first «Assign», or to the title when there is none.
  // It waits for the candidates of a newly chosen order instead of landing on a strip that is still loading.
  useEffect(() => {
    if (focusToken !== lastToken.current) {
      lastToken.current = focusToken
      wantsFocus.current = true
    }
  })
  useEffect(() => {
    if (!wantsFocus.current || loading) return
    wantsFocus.current = false
    const target = rootRef.current?.querySelector('[data-assign]') || titleRef.current
    target?.focus()
  })

  // redesign deliveries R1 (finding 4): the control that was pressed goes away when the request ends (the order gets its driver and the
  // candidates make room for its row; the failure notice gives way to the request; the comment dialog closes) and the focus fell to <body>.
  // An assignment in flight, or a «Retry», asks for the focus to be put back once the strip has settled; it is put back only if it is on
  // <body> by then (a user who went elsewhere keeps their place). Target: the first «Assign» while the strip still offers candidates,
  // otherwise the title (which is also where an assigned order's row is announced from).
  const assigning = !!assigner?.busy
  useEffect(() => {
    if (assigning) rescueFocus.current = true
  }, [assigning])
  useEffect(() => {
    if (!rescueFocus.current || loading || assigning || assigner?.comment?.open) return
    rescueFocus.current = false
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const target = mode === 'candidates' ? rootRef.current?.querySelector('[data-assign]') : null
    ;(target || titleRef.current)?.focus()
  })

  const enabled = (drivers || []).filter(driver => driver?.enabled)
  const available = enabled.filter(driver => stateOf(driver) === 'available').length
  const busy = enabled.filter(driver => stateOf(driver) === 'busy').length

  const stateLabel = (state) => ({
    available: t('AVAILABLE', 'Available'),
    busy: t('BUSY', 'Busy'),
    offline: t('OFFLINE', 'Offline')
  })[state]

  const renderOrders = (driver) => {
    const count = driver?.assigned_orders_count
    if (count === undefined || count === null || count === '') return null
    const template = Number(count) === 1
      ? t('ASSIGNED_ORDERS_COUNT_ONE', '_count_ assigned order')
      : t('ASSIGNED_ORDERS_COUNT_OTHER', '_count_ assigned orders')
    return <span className='odc-dock-orders'>{withFigures(template, { _count_: count })}</span>
  }

  const renderSignal = (driver) => {
    if (!driver?.last_location_at || typeof parseDate !== 'function') return null
    return (
      // redesign tanda AB (O-2): the label is visible beside the date («Last location · 16-12-2025 05:58 PM», as /all-in-one writes
      // «No recent location · 10 months ago»); it was a title plus a hidden copy. One text, so a reader says it once.
      <span className='odc-dock-signal'>
        {t('LAST_LOCATION', 'Last location')} · <bdi className='odc-figure'>{parseDate(driver.last_location_at)}</bdi>
      </span>
    )
  }

  const renderRow = (person, { key, showState = true, action } = {}) => {
    const name = fullName(person)
    const state = showState ? stateOf(person) : undefined
    return (
      <li key={key} className='odc-dock-row' data-state={state}>
        <Avatar name={name} src={person.photo} />
        <div className='odc-dock-who'>
          <span className='odc-dock-name' title={name}>{name}</span>
          <span className='odc-dock-meta'>
            {state && (
              <span className='odc-dock-state'>
                <span className='odc-dock-dot' aria-hidden='true' />
                <span>{stateLabel(state)}</span>
              </span>
            )}
            {renderOrders(person)}
            {renderSignal(person)}
          </span>
        </div>
        {person.cellphone && (
          <a
            className='odc-btn odc-dock-call'
            data-variant='ghost'
            data-size='md'
            data-icon-only=''
            href={`tel:${person.cellphone}`}
            aria-label={`${t('CALL', 'Call')} ${name}`}
            title={`${t('CALL', 'Call')} ${name}`}
          >
            <Phone className='odc-icon' />
          </a>
        )}
        {action}
      </li>
    )
  }

  const renderAssign = (driver, index) => {
    if (!mayAssign) return null
    const name = fullName(driver)
    const label = t('ASSIGN_DRIVER_NAME_TO_ORDER', 'Assign _driver_ to order _number_')
      .replace('_driver_', () => name)
      .replace('_number_', () => String(orderNumber))
    return (
      <Button
        data-assign=''
        variant={index === 0 ? 'primary' : 'secondary'}
        busy={assigner.isBusy(order, driver)}
        aria-label={label}
        onClick={() => assigner.assign(order, driver)}
      >
        {t('ASSIGN', 'Assign')}
      </Button>
    )
  }

  const renderSkeleton = () => (
    <div className='odc-dock-skeleton'>
      <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className='odc-dock-row' data-skeleton-row=''>
          <Skeleton shape='round' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
          <div className='odc-dock-who'>
            <Skeleton size='40%' />
            <Skeleton size='25%' />
          </div>
        </div>
      ))}
    </div>
  )

  const renderBody = () => {
    if (loading) return renderSkeleton()
    if (mode === 'overview') {
      return <ul className='odc-dock-list'>{sortDrivers(enabled).map(driver => renderRow(driver, { key: driver.id }))}</ul>
    }
    if (mode === 'assigned') {
      const internalId = order.driver_id ?? order.driver?.id
      const known = internalId !== undefined && internalId !== null ? board.get(String(internalId)) : null
      const person = order.driver ? mergeKnown(known, order.driver) : (known || order.external_driver)
      if (person) {
        return (
          <ul className='odc-dock-list'>
            {renderRow(person, { key: person.id ?? 'driver', showState: !!(order.driver || known) })}
          </ul>
        )
      }
      const company = order.driver_company
      if (company?.name) {
        return (
          <ul className='odc-dock-list'>
            <li className='odc-dock-row'>
              <Avatar kind='business' name={company.name} src={company.logo} />
              <div className='odc-dock-who'><span className='odc-dock-name' title={company.name}>{company.name}</span></div>
            </li>
          </ul>
        )
      }
      return null
    }
    // candidates
    if (candidatesStatus === 'error') {
      return (
        <InlineNotice
          tone='warning'
          action={<Button size='sm' onClick={() => { rescueFocus.current = true; onRetryCandidates() }}>{t('RETRY', 'Retry')}</Button>}
        >
          {t('CANDIDATES_LOAD_ERROR', "We couldn't load the candidates.")}
        </InlineNotice>
      )
    }
    if (!candidates?.length) {
      return <p className='odc-dock-empty'>{t('NO_DRIVER_CAN_TAKE_ORDER', 'No driver can take this order right now')}</p>
    }
    return (
      <ul className='odc-dock-list'>
        {candidates.map((candidate, index) => {
          const driver = mergeKnown(board.get(String(candidate.id)), candidate)
          return renderRow(driver, { key: candidate.id, action: renderAssign(driver, index) })
        })}
      </ul>
    )
  }

  return (
    <section
      ref={rootRef}
      className='odc-root odc-dock'
      data-mode={mode}
      aria-labelledby={titleId}
      aria-busy={loading ? 'true' : undefined}
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className='odc-dock-title' aria-live='polite'>
        {mode === 'candidates'
          ? <span>{withFigures(t('CANDIDATES_FOR_ORDER', 'Candidates for #_number_'), { _number_: orderNumber })}</span> /* redesign deliveries F2 integration: one flex item, so the title gap does not split «#» from its number */
          : (
            <>
              <span>{t('DRIVERS', 'Drivers')}</span>
              {mode === 'overview' && !driversLoading && (
                <span className='odc-dock-summary'>
                  {withFigures(t('DRIVERS_AVAILABLE_BUSY', '_available_ available · _busy_ busy'), { _available_: available, _busy_: busy })}
                </span>
              )}
            </>
            )}
      </h2>
      {assigner.error && String(assigner.error.order?.id) === String(order?.id) && (
        <InlineNotice
          tone='danger'
          role='alert'
          action={<Button size='sm' onClick={() => { rescueFocus.current = true; assigner.retry() }}>{t('RETRY', 'Retry')}</Button>}
        >
          {assigner.error.message}
        </InlineNotice>
      )}
      {renderBody()}
    </section>
  )
}
