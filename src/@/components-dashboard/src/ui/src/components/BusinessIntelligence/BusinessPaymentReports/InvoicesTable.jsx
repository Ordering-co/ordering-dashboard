import React, { useRef } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { invoiceStatusFamily, formatAmount } from '../../../../../utils/businessPayments'
import { Button, DataTable, EmptyState, Status, useSplitView } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Receipt, TriangleAlert } from '../../Shared/Icon'
import { InvoiceCardList } from './InvoiceCardList'
import { readableApiMessage } from './readableApiMessage'
import { useFocusAfter } from './useFocusAfter'
import './store-reports.css'

// redesign business-payments FC1 (D3, D4, D7, D9, D11): the invoices of the store as a Product `DataTable` (a card per invoice
// under 768 px). It draws what the controller gives (`invoices`, `business`, `detail`) and fetches nothing. Newest first is the
// controller's order (BP-06); Enter or a click on a row opens its panel (BP-03). The dates of the API are painted as they come
// (`parseDate` with the day only and no zone conversion, never `new Date(text)`: D11), the amounts with `parsePrice` as `main`
// (`BPR:610-612`), in figures (decision 11). «Orders total» is the field `order_total` under its own name (D4: «Prepaid total» was
// not true of it, BP-01).

const SKELETON_ROWS = 8

// What each column asks for, in px, padding included. Method and Status (new here) give their place when the list is narrower
// than all the columns that outrank them plus their own (the first of the list first): the panel beside the list in the split
// view, or a small window. The five columns of `main` (ID, Period, Orders total, Total charges, Transfer amount) never step aside
// (review r1 H1: at 1024 «Orders total» went first, and `main` always showed it).
const COLUMN_WIDTH = { id: 90, period: 230, method: 110, status: 130, ordersTotal: 120, charges: 120, transfer: 130 }
const WIDTH_PRIORITY = ['method', 'status']

const sameId = (a, b) => a != null && b != null && String(a) === String(b)

// the first text of an API error, which comes as a string, a list of them or `{ message }` (BPR keeps the `result` of the API)
const firstMessage = (error) => {
  const first = (Array.isArray(error) ? error : [error]).map(item => (typeof item === 'string' ? item : item?.message)).find(Boolean)
  return first
}

// The label of each status is a literal `t()` call, so the key scanner sees it; any other status keeps the text the API sent
const statusText = (t, status) => {
  switch (String(status).trim().toLowerCase()) {
    case 'pending': return t('PENDING', 'Pending')
    case 'paid': return t('PAID', 'Paid')
    case 'completed': return t('COMPLETED', 'Completed')
    case 'cancelled':
    case 'canceled': return t('CANCELLED', 'Cancelled')
    case 'void': return t('BUSINESS_PAYMENTS_STATUS_VOID', 'Void')
    default: return String(status).trim()
  }
}

const InvoicesContent = ({ invoices, business, detail, panelOpen = false }) => {
  const [, t] = useLanguage()
  const [{ parseDate, parsePrice }] = useUtils()
  const isPhone = useIsPhone()
  const { mode } = useSplitView()

  const items = Array.isArray(invoices?.items) ? invoices.items : []
  const loading = Boolean(invoices?.loading) || (!business?.selected && Boolean(business?.restoring))
  const label = t('BUSINESS_PAYMENTS_INVOICES', 'Payment invoices')

  // ---- the cells (the table and the cards draw the same ones) ----
  const dash = () => (
    <span className='odc-bp-dash'>
      <span aria-hidden='true'>—</span>
      <span className='odc-sr-only'>{t('NO_DATA', 'No data')}</span>
    </span>
  )
  const dayText = (value) => (value ? parseDate(value, { dateOnly: true, utc: false }) : null)
  const periodText = (invoice) => [dayText(invoice.period_start), dayText(invoice.period_end)].filter(Boolean).join(' – ')
  const periodCell = (invoice) => {
    const text = periodText(invoice)
    return text ? <bdi>{text}</bdi> : dash()
  }
  const methodCell = (invoice) => (invoice.paymethod ? String(invoice.paymethod).toUpperCase() : dash())
  const statusCell = (invoice) => {
    const family = invoiceStatusFamily(invoice.status)
    return family ? <Status family={family} label={statusText(t, invoice.status)} /> : dash()
  }
  const money = (amount) => (
    <bdi dir='ltr' className='odc-figure'>{formatAmount(parsePrice, amount)}</bdi>
  )

  // ---- the states that are not rows ----
  if (!business?.selected && !business?.restoring) {
    return <EmptyState icon={Receipt} title={t('SELECT_BUSINESS_TO_VIEW_INVOICES', 'Select a business to view invoices')} />
  }
  if (invoices?.error && !loading) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('BUSINESS_PAYMENTS_INVOICES_FAILED', "We couldn't load the invoices.")}
        description={readableApiMessage(t, firstMessage(invoices.error), undefined)}
        action={<Button onClick={() => invoices.retry?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
      />
    )
  }
  const empty = <EmptyState icon={Receipt} title={t('NO_INVOICES_FOUND', 'No invoices found')} />

  // ---- phone: the same data as cards (D7) ----
  if (isPhone) {
    if (!loading && items.length === 0) return empty
    const cards = items.map(invoice => ({
      id: invoice.id,
      title: `#${invoice.id}`,
      label: t('BUSINESS_PAYMENTS_INVOICE_CARD_LABEL', 'Invoice #_id_, _period_').replace('_id_', invoice.id).replace('_period_', periodText(invoice)),
      period: periodText(invoice) || '—',
      method: methodCell(invoice),
      status: statusCell(invoice),
      ordersTotal: money(invoice.order_total),
      charges: money(invoice.total_charges),
      transfer: money(invoice.deposit_amount)
    }))
    return (
      <InvoiceCardList
        items={cards}
        loading={loading}
        activeId={detail?.invoiceId}
        onOpen={(id) => detail?.open(id)}
        labels={{
          list: label,
          ordersTotal: t('BUSINESS_PAYMENTS_ORDERS_TOTAL', 'Orders total'),
          charges: t('BUSINESS_PAYMENTS_TOTAL_CHARGES', 'Total charges'),
          transfer: t('BUSINESS_PAYMENTS_TRANSFER_AMOUNT', 'Transfer amount')
        }}
      />
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  const DEFINITIONS = {
    id: { header: t('INVOICE_ID', 'ID'), locked: true, rowHeader: true, skeleton: { lines: 1 }, cell: invoice => <bdi dir='ltr' className='odc-figure'>{`#${invoice.id}`}</bdi> },
    period: { header: t('PERIOD', 'Period'), locked: true, skeleton: { lines: 1 }, cell: periodCell },
    method: { header: t('BUSINESS_PAYMENTS_METHOD', 'Method'), skeleton: { lines: 1 }, cell: methodCell },
    status: { header: t('STATUS', 'Status'), skeleton: { lines: 1, lead: 'dot' }, cell: statusCell },
    ordersTotal: { header: t('BUSINESS_PAYMENTS_ORDERS_TOTAL', 'Orders total'), align: 'end', skeleton: { lines: 1 }, cell: invoice => money(invoice.order_total) },
    charges: { header: t('BUSINESS_PAYMENTS_TOTAL_CHARGES', 'Total charges'), align: 'end', skeleton: { lines: 1 }, cell: invoice => money(invoice.total_charges) },
    transfer: { header: t('BUSINESS_PAYMENTS_TRANSFER_AMOUNT', 'Transfer amount'), align: 'end', locked: true, className: 'odc-bp-transfer', skeleton: { lines: 1 }, cell: invoice => money(invoice.deposit_amount) }
  }
  const order = ['id', 'period', 'method', 'status', 'ordersTotal', 'charges', 'transfer']

  // the threshold of a priority column is the width of the table with it and everything that outranks it
  const hideBelow = {}
  let needed = order.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0)
  WIDTH_PRIORITY.forEach(id => {
    hideBelow[id] = needed
    needed -= COLUMN_WIDTH[id]
  })
  const columns = order.map(id => ({ id, ...DEFINITIONS[id], hideBelow: hideBelow[id] }))
  // D3: with the panel beside the list (split view, from 1280 px) Method, Status and Orders total give their place at once; in the overlay and full
  // modes the list is behind or hidden, so it keeps its columns and does not shift under the panel
  // review r1 H1: by width only Method and Status (new) step aside; «Orders total» gives its place only while the panel is beside the
  // list (in `main` the open panel covered the right of the table, the amounts included), so Transfer amount always stays in view
  const hiddenColumnIds = panelOpen && mode === 'split' ? [...WIDTH_PRIORITY, 'ordersTotal'] : []
  const active = items.find(invoice => sameId(invoice.id, detail?.invoiceId))

  return (
    <DataTable
      label={label}
      columns={columns}
      rows={items}
      getRowId={invoice => invoice.id}
      hiddenColumnIds={hiddenColumnIds}
      activeRowId={active?.id}
      onOpenRow={invoice => detail?.open(invoice.id)}
      loading={loading}
      loadingLabel={t('LOADING', 'Loading')}
      skeletonRows={SKELETON_ROWS}
      empty={empty}
    />
  )
}

// redesign «Try again» takes out the button that had the focus (the list loads, then the table or the error come back), so
// the focus fell to <body>. The frame of the invoices takes it when they are no longer loading, once, and only after that button: a list
// that loads by itself never takes the focus. Same contract as Home's `useFocusAfter`.
export const InvoicesTable = ({ invoices, business, detail, panelOpen = false }) => {
  const [, t] = useLanguage()
  const frameRef = useRef(null)
  const arm = useFocusAfter(frameRef, !invoices?.loading)
  const retrying = invoices && invoices.retry
    ? { ...invoices, retry: () => { arm(); invoices.retry() } }
    : invoices
  return (
    <div ref={frameRef} className='odc-bp-invoices' role='group' aria-label={t('BUSINESS_PAYMENTS_INVOICES', 'Payment invoices')} tabIndex={-1}>
      <InvoicesContent invoices={retrying} business={business} detail={detail} panelOpen={panelOpen} />
    </div>
  )
}
