import React from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { AsyncSwitch, Checkbox, DataTable, RecordCardList, Skeleton } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import './business-fees.css'

// redesign stores 5.13 (; E2): the two lists of the business fees of a store as Product tables (cards under 768px, as the
// customer fees of 5.12). They draw what the controller gives and fetch nothing.
// - FeesTable: ID, Name (a native button, with the description under it), Type («Per order», «Weekly · Monday», «Monthly · Day 1»),
//   Amount (per order «$x + y%»; recurrent: the fixed amount alone) and Status, a switch that saves at once (P/AsyncSwitch: it goes
//   back and says why when the save fails). A click on a row, or Enter on it, opens the fee; the name is a native button for the same
//   (Space too); the checkbox and the switch are theirs and never open it.
// - FeeEventsTable: Name (with «Order #N» under it when the event comes from an order), Type, Amount and Date. Only the manual events
//   (a charge or a credit) have a checkbox: an order fee cannot be deleted, so it has none instead of a checkbox that only says no.
//   The rows open nothing, so on a phone they are cards without a link.

const SKELETON_ROWS = 5
const SKELETON_CARDS = 5

const nameLabel = (template, name) => template.replace('_name_', () => name ?? '')

/** «Per order», or «Weekly · Monday» / «Monthly · Day 1» for a recurrent fee. */
export const feeTypeText = (fee, t) => {
  if (!fee?.recurring_period) return t('PER_ORDER', 'Per order')
  const weekly = fee.recurring_period === 'weekly'
  const period = weekly ? t('WEEKLY', 'Weekly') : t('MONTHLY', 'Monthly')
  if (fee.recurring_day == null) return period
  const weekdays = [
    t('SUNDAY', 'Sunday'),
    t('MONDAY', 'Monday'),
    t('TUESDAY', 'Tuesday'),
    t('WEDNESDAY', 'Wednesday'),
    t('THURSDAY', 'Thursday'),
    t('FRIDAY', 'Friday'),
    t('SATURDAY', 'Saturday')
  ]
  const day = weekly ? weekdays[fee.recurring_day] : t('DAY_N', 'Day {{day}}').replace('{{day}}', () => String(fee.recurring_day))
  return day ? `${period} · ${day}` : period
}

// The stamp of the API is UTC without a zone: it is read as UTC and drawn in the browser's zone (as `main` did)
const formatDate = (stamp) => {
  if (!stamp) return '-'
  const text = String(stamp)
  const date = new Date(text.endsWith('Z') ? text : `${text}Z`)
  if (Number.isNaN(date.getTime())) return text
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const useMoney = () => {
  const [{ parsePrice }] = useUtils()
  return (amount) => {
    const num = Number(amount)
    if (Number.isNaN(num)) return '-'
    return parsePrice(num)
  }
}

/**
 * @param {object}   props
 * @param {Array<object>} props.fees
 * @param {boolean}  props.loading             Skeleton rows (only with no rows to keep on screen).
 * @param {Array}    props.selectedIds         Ids of the selected fees (they outlive the page).
 * @param {Function} props.onToggle            `(id)`: one row.
 * @param {Function} props.onToggleAll         `()`: the rows of the page.
 * @param {*}        [props.activeId]          The fee open in the detail.
 * @param {Function} props.onOpen              `(fee)`.
 * @param {Function} props.onToggleEnabled     `(fee, next) => Promise<{ ok, error? }>`: the switch.
 * @param {React.ReactNode} [props.empty]      What the table says when there is nothing to show.
 */
export const FeesTable = ({
  fees,
  loading,
  selectedIds,
  onToggle,
  onToggleAll,
  activeId,
  onOpen,
  onToggleEnabled,
  empty
}) => {
  const [, t] = useLanguage()
  const formatCurrency = useMoney()
  const isPhone = useIsPhone()

  const pageIds = fees.map(fee => fee.id)
  const selectedOnPage = pageIds.filter(id => selectedIds.includes(id))
  const allChecked = !loading && pageIds.length > 0 && selectedOnPage.length === pageIds.length
  const selectLabel = (fee) => nameLabel(t('STORES_SELECT_ROW', 'Select _name_'), fee?.name)
  const openLabel = (fee) => `${fee?.name ?? ''}, ${t('VIEW_DETAILS', 'View details')}`
  const listLabel = t('FEES', 'Fees')
  const loadingLabel = t('BUSINESS_FEES_LOADING', 'Loading fees')

  // ---- the cells (the table and the cards draw the same ones) ----
  const nameCell = (fee) => (
    <span className='odc-bf-namecell'>
      <button type='button' className='odc-bf-name' aria-label={openLabel(fee)} onClick={() => onOpen(fee)}>
        <span className='odc-bf-name-text' dir='auto' title={fee.name}>{fee.name}</span>
      </button>
      {fee.description && <span className='odc-bf-sub' dir='auto' title={fee.description}>{fee.description}</span>}
    </span>
  )

  const amountCell = (fee) => (
    <span className='odc-bf-amount'>
      <span className='odc-figure'>
        {fee?.recurring_period
          ? (fee?.fixed != null ? formatCurrency(fee.fixed) : '-')
          : `${fee?.fixed != null ? formatCurrency(fee.fixed) : formatCurrency(0)} + ${fee?.percentage != null ? fee.percentage : 0}%`}
      </span>
    </span>
  )

  // The switch of a row: a click on it is its own, never the row's
  const statusCell = (fee) => (
    <span className='odc-bf-control' data-odc-no-open=''>
      <AsyncSwitch
        checked={Boolean(fee.enabled)}
        label={nameLabel(t('FEE_ENABLED_NAMED', 'Enabled: _name_'), fee.name)}
        failureText={t('FEE_TOGGLE_FAILED', "We couldn't change this fee.")}
        onToggle={(next) => onToggleEnabled(fee, next)}
      />
    </span>
  )

  // ---- phone: the same data as cards ----
  if (isPhone) {
    const toCard = (fee) => ({
      id: fee.id,
      href: '#', // the card is a link for the keyboard and the screen reader; a plain click opens the detail (no address of its own)
      label: openLabel(fee),
      title: <span className='odc-bf-name-text' dir='auto'>{fee.name}</span>,
      from: (
        <span className='odc-bf-sub'>
          {t('ID', 'ID')} <bdi dir='ltr' className='odc-figure'>{fee.id}</bdi>
          {fee.description ? ` · ${fee.description}` : ''}
        </span>
      ),
      indicator: <span dir='auto'>{feeTypeText(fee, t)}</span>,
      figure: amountCell(fee),
      active: activeId != null && String(activeId) === String(fee.id),
      actions: (
        <div className='odc-bf-card-actions' data-card-actions='' onClick={event => event.stopPropagation()}>
          <Checkbox label={selectLabel(fee)} checked={selectedIds.includes(fee.id)} onCheckedChange={() => onToggle(fee.id)} />
          {statusCell(fee)}
        </div>
      ),
      onOpen: () => onOpen(fee)
    })
    return (
      <RecordCardList
        label={listLabel}
        items={loading ? [] : fees.map(toCard)}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonCount={SKELETON_ROWS}
        empty={empty}
        selectAll={{
          label: t('SELECT_ALL', 'Select all'),
          checked: allChecked ? true : (selectedOnPage.length > 0 ? 'mixed' : false),
          onToggle: onToggleAll
        }}
      />
    )
  }

  const columns = [
    { id: 'id', header: t('ID', 'ID'), skeleton: { lines: 1 }, cell: fee => <bdi dir='ltr' className='odc-figure'>{fee.id}</bdi> },
    { id: 'name', header: t('NAME', 'Name'), rowHeader: true, wrap: true, skeleton: { lines: 2 }, cell: nameCell },
    { id: 'type', header: t('TYPE', 'Type'), wrap: true, skeleton: { lines: 1 }, cell: fee => <span dir='auto'>{feeTypeText(fee, t)}</span> },
    { id: 'amount', header: t('AMOUNT', 'Amount'), skeleton: { lines: 1 }, cell: amountCell },
    { id: 'status', header: t('STATUS', 'Status'), skeleton: { lines: 1 }, cell: statusCell }
  ]

  return (
    <DataTable
      label={listLabel}
      columns={columns}
      rows={fees}
      getRowId={fee => fee.id}
      selection={{
        selectedIds,
        onToggle: id => onToggle(id),
        onToggleAll,
        allLabel: t('SELECT_ALL', 'Select all'),
        rowLabel: selectLabel
      }}
      activeRowId={activeId != null ? fees.find(fee => String(fee.id) === String(activeId))?.id : undefined}
      onOpenRow={onOpen}
      getRowAttributes={fee => ({ 'data-section-split-key': fee.id })}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={SKELETON_ROWS}
      scrollLabel={t('BUSINESS_FEES_TABLE_SCROLL_REGION', 'Fees table, scrolls sideways')}
      empty={empty}
    />
  )
}

const isManual = (event) => event?.event_type !== 'order_fee'

/**
 * @param {object}   props
 * @param {Array<object>} props.events
 * @param {boolean}  props.loading
 * @param {Array}    props.selectedIds         Ids of the selected manual events.
 * @param {Function} props.onToggle            `(id)`.
 * @param {Function} props.onToggleAll         `()`: the manual events of the page.
 * @param {React.ReactNode} [props.empty]
 */
export const FeeEventsTable = ({ events, loading, selectedIds, onToggle, onToggleAll, empty }) => {
  const [, t] = useLanguage()
  const formatCurrency = useMoney()
  const isPhone = useIsPhone()

  const selectable = events.filter(isManual)
  const selectableIds = selectable.map(event => event.id)
  const selectedOnPage = selectableIds.filter(id => selectedIds.includes(id))
  const allChecked = !loading && selectableIds.length > 0 && selectedOnPage.length === selectableIds.length
  const headerChecked = allChecked ? true : (selectedOnPage.length > 0 ? 'mixed' : false)
  const selectLabel = (event) => nameLabel(t('STORES_SELECT_ROW', 'Select _name_'), event?.name)
  const listLabel = t('FEE_EVENTS', 'Fee events')
  const loadingLabel = t('FEE_EVENTS_LOADING', 'Loading fee events')

  const typeLabels = {
    order_fee: t('ORDER_FEE', 'Order fee'),
    manual_charge: t('MANUAL_CHARGE', 'Manual charge'),
    manual_credit: t('MANUAL_CREDIT', 'Manual credit'),
    recurring: t('RECURRING_FEE', 'Recurring fee')
  }
  // a type the dashboard does not know yet reads as words («late_payment» -> «Late payment»), never as the raw key
  const typeLabel = (type) => {
    if (typeLabels[type]) return typeLabels[type]
    const words = String(type ?? '').replace(/_/g, ' ').trim()
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
  }

  // ---- the cells ----
  const nameCell = (event) => (
    <span className='odc-bf-namecell'>
      <span className='odc-bf-name-text odc-bf-plain' dir='auto' title={event.name}>{event.name}</span>
      {event.order_id != null && event.order_id !== '' && (
        <span className='odc-bf-sub'>
          {t('ORDER_WITH_NUMBER', 'Order #_id_').replace('_id_', () => String(event.order_id))}
        </span>
      )}
    </span>
  )

  // the sign is in the text («-$ 4,00» for a credit); the tint of the type label only helps
  const typeCell = (event) => (
    <span className='odc-bf-type' data-type={event.event_type}>{typeLabel(event.event_type)}</span>
  )
  const amountCell = (event) => <span className='odc-figure'>{formatCurrency(event.total_amount)}</span>
  const dateCell = (event) => formatDate(event.created_at)

  // ---- phone: cards without a link (the rows open nothing) ----
  if (isPhone) {
    return (
      <div className='odc-root odc-bf-ev'>
        {!loading && selectableIds.length > 0 && (
          <div className='odc-bf-ev-select'>
            <Checkbox checked={headerChecked} onCheckedChange={() => onToggleAll()}>
              {t('SELECT_ALL', 'Select all')}
            </Checkbox>
          </div>
        )}
        {loading && <span className='odc-sr-only'>{loadingLabel}</span>}
        {!loading && events.length === 0 && empty}
        {(loading || events.length > 0) && (
          <ul className='odc-bf-ev-list' aria-label={listLabel} aria-busy={loading || undefined}>
            {loading
              ? Array.from({ length: SKELETON_CARDS }, (_, index) => (
                <li key={index} className='odc-bf-ev-card' aria-hidden='true'>
                  <Skeleton size={index % 2 ? '40%' : '55%'} />
                  <Skeleton size='30%' />
                </li>
              ))
              : events.map(event => (
                <li key={event.id} className='odc-bf-ev-card'>
                  <div className='odc-bf-ev-row'>
                    {nameCell(event)}
                    {amountCell(event)}
                  </div>
                  <div className='odc-bf-ev-row'>
                    {typeCell(event)}
                    <span className='odc-bf-ev-date'>{formatDate(event.created_at)}</span>
                  </div>
                  {isManual(event) && (
                    <Checkbox label={selectLabel(event)} checked={selectedIds.includes(event.id)} onCheckedChange={() => onToggle(event.id)} />
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>
    )
  }

  const columns = [
    { id: 'name', header: t('NAME', 'Name'), rowHeader: true, wrap: true, skeleton: { lines: 2 }, cell: nameCell },
    { id: 'type', header: t('TYPE', 'Type'), skeleton: { lines: 1 }, cell: typeCell },
    { id: 'amount', header: t('AMOUNT', 'Amount'), skeleton: { lines: 1 }, cell: amountCell },
    { id: 'date', header: t('DATE', 'Date'), skeleton: { lines: 1 }, cell: dateCell }
  ]

  return (
    <DataTable
      label={listLabel}
      columns={columns}
      rows={events}
      getRowId={event => event.id}
      selection={{
        selectedIds,
        isSelectable: isManual,
        onToggle: id => onToggle(id),
        onToggleAll,
        allLabel: t('SELECT_ALL', 'Select all'),
        rowLabel: selectLabel
      }}
      loading={loading}
      loadingLabel={loadingLabel}
      skeletonRows={SKELETON_ROWS}
      scrollLabel={t('FEE_EVENTS_TABLE_SCROLL_REGION', 'Fee events table, scrolls sideways')}
      empty={empty}
    />
  )
}
