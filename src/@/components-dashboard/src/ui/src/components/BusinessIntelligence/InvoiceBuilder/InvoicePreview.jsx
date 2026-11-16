import React, { useContext, useId, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { getOrderStatusPrefix } from '../../../utils/orderStatus'
import { Button, DataTable, EmptyState, InlineNotice, Pagination, SearchField, Skeleton } from '../../Shared/Product'
import { Download, FileText } from '../../Shared/Icon'
import { fillTemplate, figure } from '../AnalyticsKit/reportPillParts'
import './invoice-builder.css'
// redesign invoice R2 (M2, P2): the foot of the list, the notes and the dimmed list are styled in this file (the only stylesheet R2 may touch)
import './invoice-form.css'

// redesign invoice FC2 (D3, D4, D6, D9, D13; IV-01, IV-05; auditor 2, 9, 12): the preview of the invoice. It is NOT the HTML of the PDF (D3): the
// PDF (`InvoiceBusinessPdf`, `InvoiceDriverPdf`) stays hidden and is the source of the file. This card reads the SAME `invoice` that the PDF reads
// and writes the same rows, in the same order and under the same conditions, with `parsePrice` in figure nodes (decision 11). If a row of a PDF
// changes, the test that mounts both fails (InvoicePreview.test.jsx).

export const PREVIEW_PAGE_SIZE = 10

// A figure is a node of its own, isolated for right-to-left (decision 11); `data-amount` marks an amount of money
const Figure = ({ children, ...props }) => <bdi className='odc-figure' {...props}>{children}</bdi>

const METRIC_VALUE = 'calc(var(--od-x-type-display-size) * var(--od-x-leading-title))'

// redesign invoice R2 (M3): the width (px) of the scroller of the orders list under which a column gives way, Status first and then Date, so on a phone
// (a column of about 350) the number, the subtotal and the total stay in view and nothing hides behind a sideways scroll. Estimated from the widths of the
// five columns (about 580 together); not yet measured in a browser.
const HIDE_STATUS_BELOW = 560
const HIDE_DATE_BELOW = 480

/**
 * The notes of the invoice as the person typed them. `invoice.notes` is the escaped HTML the PDF prints (`escapeNotes` of invoiceMath: `& < > " '` escaped, the
 * line breaks as `<br>`); here they are shown as text, so it is read back (the breaks come out of CSS `white-space: pre-line`), never set as markup (R2 M2).
 */
const notesText = (html) => String(html ?? '')
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')

/** True when some item of a list of the controller (`payMethods`, `orderTypes`) is unchecked: that list is filtering (R2 P3). */
const hasUnchecked = (list) => Array.isArray(list?.items) && list.items.some(item => !item.checked)

/**
 * The rows of the table «Totals» of the PDF of the kind, as [{ key, label, amount }] (the body) and the three of its foot.
 * The conditions are those of `InvoiceBusinessPdf` and `InvoiceDriverPdf`: what the PDF prints is what this card paints.
 */
const totalsRows = ({ kind, invoice, t }) => {
  const percentage = (value) => <>(<Figure>{value}%</Figure>)</>
  const misc = (
    <>{t('MISC', 'Misc')} {invoice.misc_description && <small>({invoice.misc_description})</small>}</>
  )
  const body = []

  if (kind === 'driver') {
    // as in its PDF, these two are for reference and do not enter the subtotal (D20)
    const forReference = <small>({t('INVOICE_MANAGER_FOR_REFERENCE', 'for reference, not added')})</small>
    body.push({ key: 'orders-subtotal', label: <>{t('ORDERS', 'Orders')} ({t('SUBTOTAL', 'Subtotal')}) {forReference}</>, amount: invoice.orders_subtotal })
    body.push({ key: 'discounts', label: <>{t('DISCOUNT', 'Discount')} {forReference}</>, amount: invoice.discounts })
    body.push({ key: 'percentage-fee', label: <>{t('PERCENTAGE_FEE', 'Percentage Fee')} {percentage(invoice.percentage_fee)}</>, amount: invoice.percentage_fee_total })
    body.push({ key: 'fixed-fee', label: t('FIXED_FEE', 'Fixed Fee'), amount: invoice.fixed_fee_total })
    body.push({ key: 'delivery-price', label: <>{t('DELIVERY_PRICE', 'Delivery price')} {t('PERCENTAGE', 'Percentage')}</>, amount: invoice.percentage_delivery_price_total })
    body.push({ key: 'driver-tip', label: <>{t('DRIVER_TIP', 'Driver tip')} {t('PERCENTAGE', 'Percentage')}</>, amount: invoice.percentage_driver_tip_total })
    body.push({ key: 'misc', label: misc, amount: invoice.misc_amount })
  } else {
    const payout = invoice.type === 'payout'
    if (payout) body.push({ key: 'orders-subtotal', label: <>{t('ORDERS', 'Orders')} ({t('SUBTOTAL', 'Subtotal')})</>, amount: invoice.orders_subtotal })
    if (invoice.inlcude_discounts) body.push({ key: 'discounts', label: t('DISCOUNTS_BY_PLATFORM', 'Discounts by platform'), amount: invoice.discounts })
    if (payout && invoice.tax_products !== 0) body.push({ key: 'products-tax', label: <>{t('PRODUCTS', 'Products')} {t('TAX', 'Tax')}</>, amount: invoice.tax_products })
    body.push({ key: 'percentage-fee', label: <>{t('PERCENTAGE_FEE', 'Percentage Fee')} {percentage(invoice.percentage_fee)}</>, amount: invoice.percentage_fee_total })
    body.push({ key: 'fixed-fee', label: t('FIXED_FEE', 'Fixed Fee'), amount: invoice.fixed_fee_total })
    if (invoice.misc_amount !== 0) body.push({ key: 'misc', label: misc, amount: invoice.misc_amount })
  }

  const foot = [
    { key: 'subtotal', label: t('SUBTOTAL', 'Subtotal'), amount: invoice.subtotal },
    { key: 'tax', label: <>{t('TAX', 'Tax')} {percentage(invoice.tax)}</>, amount: invoice.tax_total },
    { key: 'total', label: t('TOTAL', 'Total'), amount: invoice.total }
  ]
  return { body, foot }
}

/**
 * The orders of the invoice: a table of 10 per page with a search by order number. The PDF lists all of them (the line under the table).
 */
const InvoiceOrders = ({ invoice, getSubtotal, getTotal, updating, filtered }) => {
  const [{ dictionary }, t] = useLanguage()
  const [{ parsePrice, parseDate }] = useUtils()
  const [configFile] = useContext(ConfigFileContext) ?? []
  const prefixForVariable = configFile?.app_internal_name?.toUpperCase()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const orders = invoice.orders ?? []
  const text = query.trim()
  const matches = text ? orders.filter(order => String(order.id).includes(text)) : orders
  // the page never goes past the last one the matches allow (the invoice can shrink while the person is on page 3)
  const lastPage = Math.max(1, Math.ceil(matches.length / PREVIEW_PAGE_SIZE))
  const current = Math.min(page, lastPage)
  const shown = matches.slice((current - 1) * PREVIEW_PAGE_SIZE, current * PREVIEW_PAGE_SIZE)

  const columns = [
    { id: 'number', header: t('EXPORT_ORDER_NUMBER', 'Order number'), cell: order => <Figure>{order.id}</Figure> },
    // redesign invoice R2 (M3): Date and Status give way on a narrow list (hideBelow), Status first; the number and the amounts never do
    { id: 'date', header: t('EXPORT_DATE', 'Date'), hideBelow: HIDE_DATE_BELOW, cell: order => <Figure>{parseDate(order.delivery_datetime, { utc: false })}</Figure> },
    { id: 'status', header: t('CONTROL_PANEL_ORDERS_STATUS_HEADER', 'Status'), wrap: true, hideBelow: HIDE_STATUS_BELOW, cell: order => getOrderStatusPrefix(order.status, dictionary, prefixForVariable) },
    { id: 'subtotal', header: t('SUBTOTAL', 'Subtotal'), align: 'end', cell: order => <Figure>{parsePrice(getSubtotal(order))}</Figure> },
    { id: 'total', header: t('TOTAL', 'Total'), align: 'end', cell: order => <Figure>{parsePrice(getTotal(order))}</Figure> }
  ]

  return (
    // redesign invoice R2 (P2): dimmed with the figures while they are recalculated
    <section className='odc-iv-orders' aria-label={t('INVOICE_MANAGER_ORDERS_LIST', 'Orders in the invoice')} data-stale={updating ? '' : undefined} aria-busy={updating || undefined}>
      {orders.length > 0 && (
        <SearchField
          className='odc-iv-search'
          value={query}
          onChange={next => { setQuery(next); setPage(1) }}
          label={t('INVOICE_MANAGER_SEARCH_ORDERS', 'Search by order number')}
          clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          placeholder={t('INVOICE_MANAGER_SEARCH_ORDERS', 'Search by order number')}
        />
      )}
      <DataTable
        label={t('INVOICE_MANAGER_ORDERS_LIST', 'Orders in the invoice')}
        columns={columns}
        rows={shown}
        getRowId={order => order.id}
        // redesign invoice R2 (P3): with a filter on, the zero comes from the filters and not from the period
        empty={orders.length === 0
          ? (filtered ? t('INVOICE_MANAGER_NO_ORDERS_FILTERS', 'No orders match these filters') : t('INVOICE_MANAGER_NO_ORDERS', 'No orders in this period'))
          : t('NO_RESULTS_FOUND', 'No results found')}
      />
      {/* redesign invoice R2 (M2, D3): the foot of the orders table of the PDF. Subtotal is the base of the commission; both are of ALL the orders,
          so they do not change with the search or the page shown */}
      <dl className='odc-iv-orders-foot' data-orders-foot=''>
        <div data-foot='subtotal'>
          <dt>{t('SUBTOTAL', 'Subtotal')}</dt>
          <dd><Figure data-amount=''>{parsePrice(invoice.orders_subtotal)}</Figure></dd>
        </div>
        <div data-foot='total'>
          <dt>{t('TOTAL', 'Total')}</dt>
          <dd><Figure data-amount=''>{parsePrice(invoice.orders_total)}</Figure></dd>
        </div>
      </dl>
      {matches.length > PREVIEW_PAGE_SIZE && (
        <Pagination
          page={current}
          pageSize={PREVIEW_PAGE_SIZE}
          total={matches.length}
          onPageChange={setPage}
          label={t('PAGINATION', 'Pagination')}
          previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
          nextLabel={t('NEXT_PAGE', 'Next page')}
          rangeLabel={(from, to, total, figureOf) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figureOf)}
          pageStatusLabel={(pageNumber, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(pageNumber)).replace('_total_', String(total))}
        />
      )}
      {orders.length > 0 && (
        <p className='odc-iv-lists-all'>
          {orders.length === 1
            ? t('INVOICE_MANAGER_PDF_LISTS_ALL_ONE', 'The PDF lists the only order')
            : fillTemplate(t('INVOICE_MANAGER_PDF_LISTS_ALL_OTHER', 'The PDF lists all _count_ orders'), { count: orders.length }, figure)}
        </p>
      )}
    </section>
  )
}

/**
 * The preview: the head (the name, the kind and the period, the three figures and Download PDF), the notices, the rows of the totals and the list
 * of orders. `download` is `{ onClick, disabled, busy }` (null: the page puts the button in the dock of the phone). Props are the controller's.
 */
export const InvoicePreview = ({ kind, form, party, orders, payMethods, orderTypes, invoice, updating, getSubtotal, getTotal, download }) => {
  const [, t] = useLanguage()
  const [{ parsePrice, parseDate }] = useUtils()
  const titleId = useId()
  const totalsId = useId()
  const notesId = useId()

  const selected = party?.selected
  const status = orders?.status
  const blocked = orders?.blocked

  if (!selected) {
    return (
      <div className='odc-iv-preview' data-slot='invoice-preview'>
        <EmptyState
          icon={FileText}
          title={kind === 'driver'
            ? t('INVOICE_MANAGER_EMPTY_DRIVER', 'Choose a driver to see their invoice')
            : t('INVOICE_MANAGER_EMPTY_BUSINESS', 'Choose a business to see its invoice')}
        />
      </div>
    )
  }

  // redesign invoice R2 (P4): a failed /paymethods blocks the setup for good; it is told here (with «Try again») instead of an endless skeleton
  const payFailed = blocked === 'setup' && Boolean(payMethods?.error)
  const firstLoad = !payFailed && (blocked === 'setup' || (!invoice && status !== 'error' && blocked !== 'no_order_types'))
  const showFigures = Boolean(invoice) && !firstLoad && !payFailed
  const failed = status === 'error'
  // redesign invoice R2 (P3): a method or an order type left out (or none of the types) is a filter: an empty list may come from it
  const filtered = hasUnchecked(payMethods) || hasUnchecked(orderTypes) || blocked === 'no_order_types'
  // redesign invoice R2 (P2): the name, like the kind and the period, is the one of the invoice on screen; the chosen one only while there is none
  const shownName = (kind === 'driver' ? invoice?.driver?.name : invoice?.business?.name) ?? selected.name

  // redesign invoice FC2 (D10, auditor 8): the days of the period are dates of the day of the project, not instants
  const day = (value) => parseDate(value, { utc: false, dateOnly: true, inputFormat: 'YYYY-MM-DD' })
  const from = invoice ? invoice.from : form?.from
  const to = invoice ? invoice.to : form?.to
  let period = t('INVOICE_MANAGER_ALL_DATES', 'All dates')
  if (from && to) period = `${day(from)} – ${day(to)}`
  else if (from) period = `${t('FROM', 'From')} ${day(from)}`
  else if (to) period = `${t('TO', 'To')} ${day(to)}`

  const payout = kind !== 'driver' && (invoice?.type ?? form?.type) === 'payout'
  const kindText = kind === 'driver'
    ? t('DRIVER_INVOICE', 'Driver invoice')
    : `${t('BUSINESS_INVOICE', 'Business invoice')} · ${payout ? t('INVOICE_MANAGER_KIND_PAYOUT', 'Payout') : t('INVOICE_MANAGER_KIND_CHARGE', 'Charge')}`

  const skeletonValue = <Skeleton size='60%' block={METRIC_VALUE} />
  const rows = showFigures ? totalsRows({ kind, invoice, t }) : null

  const row = ({ key, label, amount }) => (
    <tr key={key} data-row={key}>
      <th scope='row' data-label=''>{label}</th>
      <td><Figure data-amount=''>{parsePrice(amount)}</Figure></td>
    </tr>
  )

  return (
    <div className='odc-iv-preview' data-slot='invoice-preview' data-kind={kind}>
      <div className='odc-iv-preview-head'>
        <div className='odc-iv-preview-titles'>
          <h2 className='odc-iv-preview-title' id={titleId}>{shownName}</h2>
          <p className='odc-iv-preview-meta'>{kindText}</p>
          <p className='odc-iv-preview-meta'>{period}</p>
        </div>
        {(showFigures || firstLoad) && (
          // redesign invoice (integration, live 1440): the three figures in a list of their own; P/Metric's display size broke
          // «$ 12,885.81» across lines in this card, and a page may not restyle the inside of P/
          <dl className='odc-iv-figures' data-figures='' aria-busy={updating || undefined}>
            <div className='odc-iv-figure' data-metric='orders' data-stale={updating ? '' : undefined}>
              <dt className='odc-iv-figure-label'>{t('ORDERS', 'Orders')}</dt>
              <dd className='odc-iv-figure-value'>{showFigures ? <Figure>{invoice.orders.length}</Figure> : skeletonValue}</dd>
            </div>
            <div className='odc-iv-figure' data-metric='orders-total' data-stale={updating ? '' : undefined}>
              <dt className='odc-iv-figure-label'>{t('INVOICE_MANAGER_ORDERS_TOTAL', 'Orders total')}</dt>
              <dd className='odc-iv-figure-value'>{showFigures ? <Figure>{parsePrice(invoice.orders_total)}</Figure> : skeletonValue}</dd>
            </div>
            <div className='odc-iv-figure' data-metric='total-due' data-stale={updating ? '' : undefined}>
              <dt className='odc-iv-figure-label'>{t('INVOICE_MANAGER_TOTAL_DUE', 'Total due')}</dt>
              <dd className='odc-iv-figure-value'>
                {!showFigures && skeletonValue}
                {/* redesign invoice FC2 (D13): the total is announced when a load ends; the region is always there so the first answer is read too */}
                <span className='odc-iv-live' aria-live='polite' aria-atomic='true'>
                  {showFigures && <Figure>{parsePrice(invoice.total)}</Figure>}
                </span>
              </dd>
            </div>
          </dl>
        )}
        {(download || updating) && (
          <div className='odc-iv-head-actions'>
            {download && (
              <Button
                variant='primary'
                icon={Download}
                disabled={download.disabled}
                busy={download.busy}
                onClick={download.onClick}
                aria-describedby={titleId}
              >
                {t('INVOICE_MANAGER_DOWNLOAD_PDF', 'Download PDF')}
              </Button>
            )}
            {updating && <p className='odc-iv-updating' role='status'>{t('INVOICE_MANAGER_UPDATING', 'Updating…')}</p>}
          </div>
        )}
      </div>

      {(failed || payFailed || orders?.truncated || blocked === 'no_order_types') && (
        <div className='odc-iv-notices'>
          {payFailed && (
            <InlineNotice
              tone='danger'
              action={<Button size='sm' onClick={() => payMethods.retry?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
            >
              {t('INVOICE_MANAGER_PAYMETHODS_ERROR', 'The payment methods could not be loaded.')}
            </InlineNotice>
          )}
          {failed && (
            <InlineNotice
              tone='danger'
              action={<Button size='sm' onClick={() => orders.retry?.()}>{t('TRY_AGAIN', 'Try again')}</Button>}
            >
              {t('INVOICE_MANAGER_ORDERS_ERROR', 'The orders could not be read.')}
            </InlineNotice>
          )}
          {orders?.truncated && (
            <InlineNotice tone='warning'>
              {fillTemplate(
                t('INVOICE_MANAGER_TRUNCATED', 'Only _received_ of _total_ orders were read; the totals may be incomplete.'),
                { received: orders.truncated.received, total: orders.truncated.total },
                figure
              )}
            </InlineNotice>
          )}
          {blocked === 'no_order_types' && (
            <InlineNotice tone='warning'>{t('INVOICE_MANAGER_NO_ORDER_TYPES', 'No order types selected')}</InlineNotice>
          )}
        </div>
      )}

      {firstLoad && (
        <div className='odc-iv-skeleton' role='status' aria-busy='true'>
          <span className='odc-sr-only'>{t('INVOICE_MANAGER_LOADING', 'Loading the invoice')}</span>
          <Skeleton size='40%' />
          <Skeleton size='100%' />
          <Skeleton size='100%' />
          <Skeleton size='100%' />
          <Skeleton size='70%' />
        </div>
      )}

      {showFigures && (
        <>
          <section className='odc-iv-totals-wrap' data-figures='' data-stale={updating ? '' : undefined} aria-labelledby={totalsId} aria-busy={updating || undefined}>
            <h3 className='odc-iv-section-title' id={totalsId}>{t('INVOICE_MANAGER_TOTALS', 'Totals')}</h3>
            <table className='odc-iv-totals' data-totals='' aria-labelledby={totalsId}>
              <tbody>{rows.body.map(row)}</tbody>
              <tfoot>{rows.foot.map(row)}</tfoot>
            </table>
            {payout && (
              <p className='odc-iv-payout-note'>
                {t('INVOICE_MANAGER_PAYOUT_NOTE', 'In a payout, fees are subtracted from what the business is paid')}
              </p>
            )}
          </section>
          {/* redesign invoice R2 (P2): another business or driver is another list, so the search and the page start again */}
          <InvoiceOrders key={selected.id} invoice={invoice} getSubtotal={getSubtotal} getTotal={getTotal} updating={updating} filtered={filtered} />
          {/* redesign invoice R2 (M2, D3): the notes at the end, as text (the PDF prints them as HTML; here they are read back from the escaped form) */}
          {invoice.notes && (
            <section className='odc-iv-notes' data-notes='' aria-labelledby={notesId}>
              <h3 className='odc-iv-section-title' id={notesId}>{t('NOTES', 'Notes')}</h3>
              <p className='odc-iv-notes-text'>{notesText(invoice.notes)}</p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
