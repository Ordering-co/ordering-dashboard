import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import ReactToPrint from 'react-to-print'
import { useTheme } from 'styled-components'
import { useLanguage, useSession, useApi, useConfig, useUtils } from '../../../../../index'
import { formatAmount } from '../../../../../utils/businessPayments'
import { readableApiMessage } from '../BusinessPaymentReports/readableApiMessage'
import { CircleAlert, Download } from '../../Shared/Icon'
import { Button, EmptyState, Skeleton } from '../../Shared/Product'
import { useInvoicePdfLogo } from '../invoicePdfLogo'
import '../BusinessPaymentReports/panels.css'

import {
  DetailContainer,
  DownloadButtonWrapper,
  PrintableContent,
  DetailHeader,
  PeriodBar,
  PeriodCol,
  PeriodLabel,
  PeriodValue,
  SummaryRow,
  SummaryCell,
  SummaryLabel,
  SummaryValue,
  SectionTitle,
  DayTitle,
  DataTable,
  TotalRow,
  FeeSection,
  FeeGroup,
  FeeRow,
  FeeName,
  FeeAmount,
  CountLabel,
  TotalsBlock,
  TotalsRow,
  TotalsLabel,
  TotalsValue,
  TransferRow,
  InvoiceFooter,
  OrderDetailsTableScroll
} from './styles'

// redesign business-payments FD (D11): the wall clock of an instant in a zone, as the text `YYYY-MM-DD HH:mm:ss` that
// parseDate reads (decision 13). Orders are grouped and timed in the zone of the invoice, not in the browser's, so the
// date and the hour are taken from Intl in that zone instead of `toLocale*String`.
const zonedWallClock = (iso, timeZone) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date)
  } catch {
    // An unknown zone name of the API: read the invoice in UTC, as when it has none
    return timeZone && timeZone !== 'UTC' ? zonedWallClock(iso, 'UTC') : ''
  }
  const get = type => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

// The day of the wall clock (`YYYY-MM-DD`) is the key of a group; the groups keep the order of their first order.
const groupOrdersByDay = (orders, timezone) => {
  if (!orders || orders.length === 0) return []
  const groups = {}
  orders.forEach(order => {
    const wall = zonedWallClock(order.created_at, timezone)
    const key = wall.slice(0, 10)
    if (!groups[key]) {
      groups[key] = { key, wall, orders: [] }
    }
    groups[key].orders.push(order)
  })
  return Object.values(groups).sort((a, b) =>
    new Date(a.orders[0].created_at) - new Date(b.orders[0].created_at)
  )
}

// redesign business-payments FD (D8, D9): the box of the document while it loads, so nothing jumps when it arrives
const DocumentSkeleton = ({ label }) => (
  <div className='bpp-skeleton' role='status' aria-busy='true'>
    <span className='odc-sr-only'>{label}</span>
    <div className='bpp-skeleton-head'>
      <Skeleton size='40%' block='var(--od-x-control-height)' />
      <Skeleton size='60%' />
    </div>
    <div className='bpp-skeleton-row'>
      <Skeleton block='var(--od-x-control-height)' />
      <Skeleton block='var(--od-x-control-height)' />
      <Skeleton block='var(--od-x-control-height)' />
    </div>
    <div className='bpp-skeleton-lines'>
      <Skeleton size='30%' />
      <Skeleton />
      <Skeleton />
      <Skeleton />
      <Skeleton size='50%' />
    </div>
  </div>
)

const deliveryTypeMap = {
  1: 'DELIVERY',
  2: 'PICKUP',
  3: 'EAT_IN',
  4: 'CURBSIDE',
  5: 'DRIVE_THRU'
}

const getDeliveryTypeLabel = (type, t) => {
  const key = deliveryTypeMap[type] || (typeof type === 'string' && type.toUpperCase().replace(/ /g, '_'))
  if (!key) return 'N/A'
  return t(key, key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '))
}

const mergeInvoiceOrderDetails = (data) => {
  if (!data) return []
  const lists = [
    data.order_details,
    data.cash_order_details,
    data.card_order_details,
    data.prepaid_order_details,
    data.non_prepaid_order_details
  ].filter(Array.isArray)
  if (lists.length === 0) return []

  const byId = new Map()
  for (const list of lists) {
    for (const order of list) {
      const rawId = order?.order_id ?? order?.id
      if (rawId == null) continue
      if (!byId.has(rawId)) {
        byId.set(rawId, order)
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )
}

const lower = (value) =>
  value == null ? '' : String(value).toLowerCase()

const getOrderPaymentKindLabel = (order, t) => {
  if (!order) {
    return t('N/A', 'N/A')
  }

  const gatewayRaw = order.paymethod_gateway ?? order.payment_gateway ?? order.gateway
  if (gatewayRaw != null && String(gatewayRaw).trim() !== '') {
    const g = lower(gatewayRaw)
    if (g === 'cash' || g === 'card_delivery') {
      return t('CASH', 'Cash')
    }
    return t('CARD', 'Card')
  }

  if (order.is_cash_payment === true || order.is_cash === true || order.is_cash === 1) {
    return t('CASH', 'Cash')
  }
  if (order.is_prepaid_payment === true || order.is_prepaid === true || order.is_prepaid === 1) {
    return t('CARD', 'Card')
  }

  const category = `${order.payment_category ?? order.payment_kind ?? ''}`.toUpperCase()
  if (category === 'CASH') return t('CASH', 'Cash')
  if (category === 'CARD') return t('CARD', 'Card')

  let paymethodStr = ''
  if (typeof order.paymethod === 'string') {
    paymethodStr = order.paymethod
  } else if (typeof order.paymethod === 'object' && order.paymethod) {
    paymethodStr = [order.paymethod.gateway, order.paymethod.name].filter(Boolean).join(' ')
  }
  const token = [
    order.payment_type,
    order.pay_method,
    paymethodStr,
    order.paymethod_gateway,
    order.payment_gateway,
    order.gateway
  ].map(lower).join(' ')

  if (!token.trim()) {
    return t('N/A', 'N/A')
  }

  const tokens = token.split(/[\s,]+/).filter(Boolean)
  const isCashKeyword = tokens.some(p =>
    p === 'cash' ||
    (p.includes('cash') && !/(cashback|creditcash)/.test(p)) ||
    p === 'cod' ||
    p.startsWith('cash_')
  )
  const isCardKeyword =
    /^card|^stripe|^paypal|^braintree|^square|^izipay|^oxxo|^mercad/i.test(tokens.join('_')) ||
    tokens.some(p => p.includes('stripe') || p.includes('creditcard') || p.endsWith('_card'))

  if (isCashKeyword && !isCardKeyword) {
    return t('CASH', 'Cash')
  }
  return t('CARD', 'Card')
}

const ORDER_DETAIL_FEE_COLOR = '#c0392b'

/** Unique fee names in first-seen order (matches server-side unique fee column order). */
const collectUniqueOrderFeeNames = (orders) => {
  const names = []
  const seen = new Set()
  if (!Array.isArray(orders)) {
    return names
  }
  for (const order of orders) {
    const feesList = order?.fees
    if (!Array.isArray(feesList)) {
      continue
    }
    for (const fee of feesList) {
      const name = fee?.name
      if (name == null || name === '') {
        continue
      }
      if (seen.has(name)) {
        continue
      }
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

const getOrderFeeTotalByName = (order, feeName) => {
  const feesList = order?.fees
  if (!Array.isArray(feesList)) {
    return 0
  }
  const fee = feesList.find(f => f?.name === feeName)
  if (!fee || fee.fee_total == null) {
    return 0
  }
  const amt = parseFloat(fee.fee_total)
  return Number.isFinite(amt) ? amt : 0
}

// redesign the seven columns of the order summary do not fit a narrow panel (390 px) and overflowed the padding of the panel at
// 1024. The table scrolls inside its own container instead of the whole document. Only when it really overflows is the container a named
// region with a tab stop, so the keyboard can scroll to the last column; when it fits there is nothing extra to tab to.
const ScrollableTable = ({ label, children }) => {
  const ref = useRef(null)
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const measure = () => setScrolls(node.scrollWidth > node.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    const table = node.querySelector('table')
    if (table) observer.observe(table)
    return () => observer.disconnect()
  }, [])
  return (
    <OrderDetailsTableScroll
      ref={ref}
      role={scrolls ? 'region' : undefined}
      aria-label={scrolls ? label : undefined}
      tabIndex={scrolls ? 0 : undefined}
    >
      {children}
    </OrderDetailsTableScroll>
  )
}

export const BusinessPaymentInvoiceDetail = (props) => {
  const { invoiceId } = props

  const [, t] = useLanguage()
  const [{ token }] = useSession()
  const [ordering] = useApi()
  const [{ configs }] = useConfig()
  const [{ parsePrice, parseDate }] = useUtils()
  const theme = useTheme()
  const printRef = useRef()

  const [state, setState] = useState({ loading: true, data: null, error: null })

  const fetchDetail = useCallback(async () => {
    setState({ loading: true, data: null, error: null })
    try {
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(
        `${ordering.root}/business_payment_invoices/${invoiceId}/detail`,
        requestOptions
      )
      const content = await response.json()
      if (!content.error) {
        setState({ loading: false, data: content.result, error: null })
      } else {
        setState({ loading: false, data: null, error: content.result })
      }
    } catch (err) {
      setState({ loading: false, data: null, error: [err.message] })
    }
  }, [invoiceId, token, ordering])

  useEffect(() => {
    if (invoiceId) {
      fetchDetail()
    }
  }, [invoiceId])

  const formatCurrency = (amount) => {
    // redesign business-payments integration (BP-M6): the sign before the currency («-$ 37.58»), never «$ -,37.58»
    return formatAmount(parsePrice, amount)
  }

  // redesign business-payments FD (D11, decision 13): the dates of the API are text (`YYYY-MM-DD HH:mm:ss`) painted as they
  // come in the project's format; `utc: false` keeps parseDate from moving them to the zone of the browser.
  const formatDateLocal = (dateStr) => {
    if (!dateStr) return ''
    return parseDate(dateStr, { dateOnly: true, utc: false })
  }

  // «Tuesday, 24 Feb 2026»: the wall-clock day of the invoice zone (already computed by the group), weekday first
  const formatDayTitle = (wall) => {
    if (!wall) return ''
    return `${parseDate(wall, { outputFormat: 'dddd', utc: false })}, ${parseDate(wall, { dateOnly: true, utc: false })}`
  }

  const formatOrderTime = (dateStr, timezone) => {
    if (!dateStr) return ''
    const wall = zonedWallClock(dateStr, timezone)
    return wall ? parseDate(wall, { timeOnly: true, utc: false }) : ''
  }

  const { invoice, order_summary: orderSummary, fee_details: feeDetails, totals } = state.data || {}

  const logo = useInvoicePdfLogo(configs, theme?.images?.logos?.logoPdf)
  const mergedOrderDetails = useMemo(() => mergeInvoiceOrderDetails(state.data), [state.data])
  const ordersByDay = useMemo(
    () => groupOrdersByDay(mergedOrderDetails, invoice?.timezone),
    [mergedOrderDetails, invoice?.timezone]
  )
  const allFeeNames = useMemo(
    () => collectUniqueOrderFeeNames(mergedOrderDetails),
    [mergedOrderDetails]
  )

  if (state.loading) {
    return <DocumentSkeleton label={t('LOADING', 'Loading')} />
  }

  // redesign business-payments FD (D9): the error keeps the place of the document, with a way to ask again. The API's messages go through
  // readableApiMessage: a message in words, or a key the dictionary knows, is shown; a key it does not know (API_ERROR_NOT_FOUND)
  // or the browser's «Failed to fetch» is a sentence a person can read, never the raw text.
  if (state.error) {
    const generic = t('BUSINESS_PAYMENTS_ERROR_GENERIC', 'Something went wrong.')
    const notFound = t('BUSINESS_PAYMENTS_INVOICE_NOT_FOUND', "This invoice doesn't exist.")
    const messages = [...new Set(
      (Array.isArray(state.error) ? state.error : [state.error])
        .filter(message => typeof message === 'string' && message.trim())
        .map(message => readableApiMessage(t, message, generic, notFound))
        .filter(Boolean)
    )]
    return (
      <div className='bpp-error'>
        <EmptyState
          tone='error'
          icon={CircleAlert}
          title={t('BUSINESS_PAYMENTS_INVOICE_LOAD_ERROR', "We couldn't load this invoice.")}
          description={messages.length > 0 ? messages.join(' ') : undefined}
          action={<Button onClick={fetchDetail}>{t('TRY_AGAIN', 'Try again')}</Button>}
        />
      </div>
    )
  }

  return (
    <DetailContainer>
      {/* Download PDF button (redesign business-payments FD, D8: the Product secondary button, in the same place) */}
      <DownloadButtonWrapper>
        <ReactToPrint
          trigger={() => (
            <Button variant='secondary' icon={Download} disabled={logo.status === 'loading'}>
              {t('DOWNLOAD_PDF', 'Download PDF')}
            </Button>
          )}
          content={() => printRef.current}
          removeAfterPrint
          pageStyle={`
            @page { size: A4; margin: 15mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          `}
        />
      </DownloadButtonWrapper>

      <PrintableContent ref={printRef}>
        {/* Header */}
        <DetailHeader>
          {logo.src && (
            <>
              <img src={logo.src} alt={invoice?.business?.name || ''} />
              <br />
            </>
          )}
          <h1>{t('PAYMENT_REPORT', 'Payment Report')}</h1>
          <p>
            {invoice?.business?.name || ''} &mdash; {t('REPORT', 'Report')} #{invoice?.id} &mdash; {(invoice?.paymethod || 'N/A').toUpperCase()}
          </p>
        </DetailHeader>

        {/* Period Bar */}
        <PeriodBar>
          <PeriodCol>
            <PeriodLabel>{t('PERIOD_START', 'Period Start')}</PeriodLabel>
            <PeriodValue>{formatDateLocal(invoice?.period_start)}</PeriodValue>
          </PeriodCol>
          <PeriodCol>
            <PeriodLabel>{t('PERIOD_END', 'Period End')}</PeriodLabel>
            <PeriodValue>{formatDateLocal(invoice?.period_end)}</PeriodValue>
          </PeriodCol>
        </PeriodBar>

        {/* Quick Summary */}
        {totals && (
          <SummaryRow>
            <SummaryCell variant='left'>
              <SummaryLabel>{t('PREPAID_TOTAL', 'Prepaid Total')}</SummaryLabel>
              <SummaryValue>{formatCurrency(totals.prepaid_total ?? totals.prepaid_orders_total)}</SummaryValue>
            </SummaryCell>
            <SummaryCell variant='mid'>
              <SummaryLabel>{t('TOTAL_CHARGES', 'Total charges')}</SummaryLabel>
              <SummaryValue color='red'>{formatCurrency(totals.total_charges)}</SummaryValue>
            </SummaryCell>
            <SummaryCell variant='right'>
              <SummaryLabel green>{t('TRANSFER_AMOUNT', 'Transfer Amount')}</SummaryLabel>
              <SummaryValue color='green'>{formatCurrency(totals.deposit_amount)}</SummaryValue>
            </SummaryCell>
          </SummaryRow>
        )}

        {/* Order Summary Table */}
        {orderSummary && (
          <>
            <SectionTitle>{t('ORDER_SUMMARY', 'Order summary')}</SectionTitle>
            <ScrollableTable label={t('ORDER_SUMMARY', 'Order summary')}>
            <DataTable>
              <thead>
                <tr>
                  <th />
                  <th className='center'>{t('ORDERS', 'Orders')}</th>
                  <th className='right'>{t('SUBTOTAL', 'Subtotal')}</th>
                  <th className='right'>{t('TAX', 'Tax')}</th>
                  <th className='right'>{t('DELIVERY', 'Delivery')}</th>
                  <th className='right'>{t('TIP', 'Tip')}</th>
                  <th className='right'>{t('TOTAL', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('CARD', 'Card')}</td>
                  <td className='center'>{orderSummary.card_orders?.count || 0}</td>
                  <td className='right'>{formatCurrency(orderSummary.card_orders?.subtotal)}</td>
                  <td className='right'>{formatCurrency(orderSummary.card_orders?.tax)}</td>
                  <td className='right'>{formatCurrency(orderSummary.card_orders?.delivery_price)}</td>
                  <td className='right'>{formatCurrency(orderSummary.card_orders?.tip)}</td>
                  <td className='right'>{formatCurrency(orderSummary.card_orders?.total)}</td>
                </tr>
                <tr>
                  <td>{t('CASH', 'Cash')}</td>
                  <td className='center'>{orderSummary.cash_orders?.count || 0}</td>
                  <td className='right'>{formatCurrency(orderSummary.cash_orders?.subtotal)}</td>
                  <td className='right'>{formatCurrency(orderSummary.cash_orders?.tax)}</td>
                  <td className='right'>{formatCurrency(orderSummary.cash_orders?.delivery_price)}</td>
                  <td className='right'>{formatCurrency(orderSummary.cash_orders?.tip)}</td>
                  <td className='right'>{formatCurrency(orderSummary.cash_orders?.total)}</td>
                </tr>
                <TotalRow>
                  <td>{t('TOTAL', 'Total')}</td>
                  <td className='center'>{orderSummary.total?.count || 0}</td>
                  <td className='right'>{formatCurrency(orderSummary.total?.subtotal)}</td>
                  <td className='right'>{formatCurrency(orderSummary.total?.tax)}</td>
                  <td className='right'>{formatCurrency(orderSummary.total?.delivery_price)}</td>
                  <td className='right'>{formatCurrency(orderSummary.total?.tip)}</td>
                  <td className='right'>{formatCurrency(orderSummary.total?.total)}</td>
                </TotalRow>
              </tbody>
            </DataTable>
            </ScrollableTable>
          </>
        )}

        {/* Transfer Statement — always show all fee section titles */}
        {state.data && (
          <>
            <SectionTitle>{t('TRANSFER_STATEMENT', 'Transfer Statement')}</SectionTitle>

            <FeeSection>
              <FeeGroup>{t('ORDER_FEES', 'Order fees')}</FeeGroup>
              {(feeDetails?.order_fees ?? []).length > 0
                ? (feeDetails.order_fees).map((fee, i) => (
                  <FeeRow key={`of-${i}`}>
                    <FeeName>{fee.name} <CountLabel>({fee.count} {t('ORDERS', 'orders')})</CountLabel></FeeName>
                    <FeeAmount color='red'>-{formatCurrency(fee.total_amount)}</FeeAmount>
                  </FeeRow>
                  ))
                : (
                  <FeeRow>
                    <FeeName>&mdash;</FeeName>
                    <FeeAmount>{formatCurrency(0)}</FeeAmount>
                  </FeeRow>
                  )}
            </FeeSection>

            <FeeSection>
              <FeeGroup>{t('RECURRING_FEES', 'Recurring Fees')}</FeeGroup>
              {(feeDetails?.recurring ?? []).length > 0
                ? (feeDetails.recurring).map((fee, i) => (
                  <FeeRow key={`rc-${i}`}>
                    <FeeName>{fee.name}</FeeName>
                    <FeeAmount color='red'>-{formatCurrency(fee.total_amount)}</FeeAmount>
                  </FeeRow>
                  ))
                : (
                  <FeeRow>
                    <FeeName>&mdash;</FeeName>
                    <FeeAmount>{formatCurrency(0)}</FeeAmount>
                  </FeeRow>
                  )}
            </FeeSection>

            <FeeSection>
              <FeeGroup>{t('MANUAL_CHARGES', 'Manual Charges')}</FeeGroup>
              {(feeDetails?.manual_charges ?? []).length > 0
                ? (feeDetails.manual_charges).map((fee, i) => (
                  <FeeRow key={`mc-${i}`}>
                    <FeeName>{fee.name}</FeeName>
                    <FeeAmount color='red'>-{formatCurrency(fee.total_amount)}</FeeAmount>
                  </FeeRow>
                  ))
                : (
                  <FeeRow>
                    <FeeName>&mdash;</FeeName>
                    <FeeAmount>{formatCurrency(0)}</FeeAmount>
                  </FeeRow>
                  )}
            </FeeSection>

            <FeeSection>
              <FeeGroup>{t('MANUAL_CREDITS', 'Manual Credits')}</FeeGroup>
              {(feeDetails?.manual_credits ?? []).length > 0
                ? (feeDetails.manual_credits).map((fee, i) => (
                  <FeeRow key={`cr-${i}`}>
                    <FeeName>{fee.name}</FeeName>
                    <FeeAmount color='green'>+{formatCurrency(Math.abs(fee.total_amount))}</FeeAmount>
                  </FeeRow>
                  ))
                : (
                  <FeeRow>
                    <FeeName>&mdash;</FeeName>
                    <FeeAmount>{formatCurrency(0)}</FeeAmount>
                  </FeeRow>
                  )}
            </FeeSection>

            <TotalsBlock>
              <TotalsRow>
                <TotalsLabel bold>{t('TOTAL_CHARGES', 'Total charges')}</TotalsLabel>
                <TotalsValue color='red' bold>-{formatCurrency(totals?.total_charges)}</TotalsValue>
              </TotalsRow>
            </TotalsBlock>
          </>
        )}

        {/* Order Details by Day */}
        {ordersByDay.length > 0 && (
          <>
            <SectionTitle>{t('ORDER_DETAILS', 'Order details')}</SectionTitle>
            {ordersByDay.map((dayGroup, di) => (
              <div key={di}>
                <DayTitle>{formatDayTitle(dayGroup.wall)}</DayTitle>
                <OrderDetailsTableScroll>
                  <DataTable>
                    <thead>
                      <tr>
                        <th>{t('TIME', 'Time')}</th>
                        <th>{t('TYPE', 'Type')}</th>
                        <th>{t('PAY', 'Pay')}</th>
                        <th className='center'>{t('ID', 'ID')}</th>
                        <th className='right'>{t('TIP', 'Tip')}</th>
                        <th className='right'>{t('TOTAL', 'Total')}</th>
                        {allFeeNames.map((feeName) => (
                          <th key={feeName} className='right'>{feeName}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dayGroup.orders.map((order, oi) => (
                        <tr key={order.order_id || oi}>
                          <td>{formatOrderTime(order.created_at, invoice?.timezone)}</td>
                          <td>{getDeliveryTypeLabel(order.delivery_type, t)}</td>
                          <td>{getOrderPaymentKindLabel(order, t)}</td>
                          <td className='center'>#{order.order_id}</td>
                          <td className='right'>{formatCurrency(order.tip ?? 0)}</td>
                          <td className='right'>{formatCurrency(order.order_total)}</td>
                          {allFeeNames.map((feeName) => (
                            <td
                              key={feeName}
                              className='right'
                              style={{ color: ORDER_DETAIL_FEE_COLOR }}
                            >
                              {formatCurrency(getOrderFeeTotalByName(order, feeName))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </OrderDetailsTableScroll>
              </div>
            ))}
          </>
        )}

        {/* Transfer Amount (bottom) */}
        {totals && (
          <TransferRow>
            <span>{t('TRANSFER_AMOUNT', 'Transfer Amount')}</span>
            <span>{formatCurrency(totals.deposit_amount)}</span>
          </TransferRow>
        )}

        {/* Footer */}
        <InvoiceFooter>
          {t('AUTOMATED_PAYMENT_REPORT_MSG', 'This is an automated payment report.')}<br />
          {t('REPORT_CONTACT_MSG', 'If you have questions about this report, please contact your account administrator.')}
        </InvoiceFooter>
      </PrintableContent>
    </DetailContainer>
  )
}
