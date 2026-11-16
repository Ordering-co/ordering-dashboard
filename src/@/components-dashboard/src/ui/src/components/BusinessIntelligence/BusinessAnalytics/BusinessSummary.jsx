import React, { useId, useRef } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { comparisonPlan, zonedNow } from '../../../../../utils/businessReports'
import { Button, InlineNotice, Metric, MetricGrid, Skeleton } from '../../Shared/Product'
import { formatDuration } from '../AnalyticsKit'
import './business-analytics.css'

// redesign bi FD (D1, D2, D3, D10; auditor 1, 8, 9, 12): the six figures of the period, each with the reference it is compared with.
// The references are text in a neutral color, with the signed change and the previous figure in figure nodes (decision 11). They come
// from the controller (`comparison`, `totals`); this file only writes them.

const DASH = '—'
const MINUS = '−' // U+2212: a drop reads as a minus in any font, not as a hyphen
const CAPTION_LINE = 'calc(var(--od-x-type-caption-size) * var(--od-x-leading-ui))'

// A figure is a node of its own, isolated for right-to-left (decision 11)
export const Figure = ({ children, ...props }) => <span className='odc-figure' {...props}><bdi>{children}</bdi></span>

/** «Previous _days_ days: _value_» -> the pieces of the text with each placeholder replaced by its node. */
export const fillTemplate = (template, values) => String(template).split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{values[name]}</React.Fragment> : part
})

// The blocks that feed a figure, by the prop that carries them and the key `reloadBlock` takes
const FIGURE_BLOCKS = [
  ['ordersList', 'orders'],
  ['salesList', 'sales'],
  ['registerUsersList', 'registerUsers'],
  ['ordersAcceptSpendList', 'ordersAcceptSpend'],
  ['arrivedPickUpSpendList', 'arrivedPickUpSpend']
]
// (AK-282): the statuses feed the orders figure only when it leaves the cancelled orders out
const STATUS_BLOCK = ['orderStatusList', 'orderStatus']

const isFailed = (block) => Boolean(block) && !block.loading && Boolean(block.error)

/**
 * The six figures: orders, sales, average ticket, registered users, time to accept and wait at pickup.
 * A figure of a block that loads is a skeleton of its own box; of a block that failed, a dash with one warning under the grid.
 */
export const BusinessSummary = ({
  filterList,
  totals,
  comparison,
  reloadBlock,
  reloadComparison,
  ordersList,
  salesList,
  orderStatusList,
  registerUsersList,
  ordersAcceptSpendList,
  arrivedPickUpSpendList
}) => {
  const [, t] = useLanguage()
  const [{ parsePrice, parseNumber }] = useUtils()
  const headingId = useId()
  const headingRef = useRef(null)
  // redesign bi R1 (F3): the last figures that were painted whole, by figure key. While a new period or filter loads they stay
  // (dimmed, aria-busy) instead of skeletons, so the summary keeps its height; the skeletons are only for the first load
  const lastShown = useRef({})

  const blocks = { ordersList, salesList, orderStatusList, registerUsersList, ordersAcceptSpendList, arrivedPickUpSpendList }
  // before the first answer the controller has no plan yet: the references are reserved by the plan the filter implies
  // redesign bi R1 (F1): the day it implies is the day of the zone of the filter
  const plan = comparison?.plan ?? comparisonPlan(filterList?.lapse, zonedNow(filterList?.timeZone))
  const previous = comparison?.previous ?? {}
  const change = comparison?.change ?? {}
  const comparing = Boolean(comparison?.loading)
  const noOrders = t('HOME_NO_ORDERS_YET', 'No orders yet')

  const price = (value) => parsePrice(value)
  const count = (value) => String(value)

  const signed = (percent) => `${percent > 0 ? '+' : percent < 0 ? MINUS : ''}${parseNumber(Math.abs(percent), { decimal: 1 })}%`

  /** The reference line of a figure, or null when it has none: how it compares with the period before (D2). */
  const comparisonReference = (key, format) => {
    if (!plan || comparison?.error) return null
    const { mode } = plan
    if (mode === 'byNow' && key === 'users') return null
    if (mode !== 'byNow' && !(plan.days >= 1)) return null
    if (comparing) return { text: <Skeleton size='80%' block={CAPTION_LINE} />, lead: true }

    const before = previous[key === 'ticket' ? 'averageTicket' : key]
    // a figure the period before did not have (a day without orders has no ticket) is a dash, named for the ticket
    let shown = DASH
    if (before != null) shown = format(before)
    else if (key === 'ticket') shown = <span role='img' aria-label={noOrders}>{DASH}</span>
    const value = <Figure>{shown}</Figure>
    if (mode === 'byNow') {
      return { text: fillTemplate(t('BUSINESS_REPORTS_YESTERDAY_BY_NOW', 'Yesterday by this time: _value_'), { value }), lead: true }
    }
    const percent = change[key === 'ticket' ? 'averageTicket' : key]
    const days = <Figure>{plan.days}</Figure>
    const one = plan.days === 1
    const changeNode = percent == null ? undefined : <Figure>{signed(percent)}</Figure>
    let template
    if (mode === 'previous') {
      if (percent == null) {
        template = one
          ? t('BUSINESS_REPORTS_PREVIOUS_DAYS_ONE', 'Previous day: _value_')
          : t('BUSINESS_REPORTS_PREVIOUS_DAYS_OTHER', 'Previous _days_ days: _value_')
      } else {
        template = one
          ? t('BUSINESS_REPORTS_VS_PREVIOUS_DAYS_ONE', '_change_ vs the previous day (_value_)')
          : t('BUSINESS_REPORTS_VS_PREVIOUS_DAYS_OTHER', '_change_ vs the previous _days_ days (_value_)')
      }
    } else if (percent == null) {
      template = one
        ? t('BUSINESS_REPORTS_CLOSED_PREVIOUS_ONE', 'The day before: _value_')
        : t('BUSINESS_REPORTS_CLOSED_PREVIOUS_OTHER', 'The _days_ days before: _value_')
    } else {
      template = one
        ? t('BUSINESS_REPORTS_CLOSED_VS_PREVIOUS_ONE', '_change_ yesterday vs the day before (_value_)')
        : t('BUSINESS_REPORTS_CLOSED_VS_PREVIOUS_OTHER', '_change_ over the last _days_ full days vs the _days_ before (_value_)')
    }
    return { text: fillTemplate(template, { change: changeNode, value, days }), lead: true }
  }

  const averageHelp = { text: t('BUSINESS_REPORTS_AVERAGE_IN_PERIOD', 'Average in this period'), secondary: true }
  const includesHelp = { text: t('BUSINESS_REPORTS_TICKET_HELP', 'Includes cancelled orders'), secondary: true }
  const excludesHelp = { text: t('BUSINESS_REPORTS_EXCLUDES_CANCELLED', 'Excludes cancelled orders'), secondary: true }
  // the blocks the API answered without the cancelled orders (`exclude_cancelled: true`)
  const ordersExcluded = ordersList?.excludesCancelled === true
  const salesExcluded = salesList?.excludesCancelled === true
  // orders and sales in different bases give no ticket (a plain dash) and no help: it has no base to tell
  const mixedTicket = ordersExcluded !== salesExcluded
  const ticketHelp = salesExcluded ? excludesHelp : includesHelp
  // (AK-282): the orders figure says which base it and its comparison share; without cancelled orders it also needs
  // the statuses of the period, so that block feeds it (and its failure is the figure's), unless the API already left them out
  const excludesCancelled = totals?.ordersBase === 'excludesCancelled'
  const statusFeedsOrders = excludesCancelled && !ordersExcluded
  const ordersHelp = excludesCancelled ? excludesHelp : includesHelp

  const figures = [
    {
      key: 'orders',
      label: t('ORDERS', 'Orders'),
      deps: statusFeedsOrders ? [ordersList, orderStatusList] : [ordersList],
      value: () => <Figure>{count(totals?.orders ?? 0)}</Figure>,
      refs: [comparisonReference('orders', count), ordersHelp]
    },
    {
      key: 'sales',
      label: t('SALES', 'Sales'),
      deps: [salesList],
      value: () => <Figure>{price(totals?.sales ?? 0)}</Figure>,
      refs: [comparisonReference('sales', price), ...(salesExcluded ? [excludesHelp] : [])]
    },
    {
      key: 'ticket',
      label: t('BUSINESS_REPORTS_AVERAGE_TICKET', 'Average ticket'),
      deps: [ordersList, salesList],
      // a day without orders has no ticket: a dash that is named, never a $0.00 that reads as a ticket of zero
      value: (failed) => (totals?.averageTicket == null
        ? <Figure>{failed || mixedTicket ? DASH : <span role='img' aria-label={noOrders}>{DASH}</span>}</Figure>
        : <Figure>{price(totals.averageTicket)}</Figure>),
      refs: [comparisonReference('ticket', price), ...(mixedTicket ? [] : [ticketHelp])]
    },
    {
      key: 'users',
      label: t('BUSINESS_REPORTS_REGISTERED_USERS', 'Registered users'),
      deps: [registerUsersList],
      value: () => <Figure>{count(totals?.users ?? 0)}</Figure>,
      refs: [comparisonReference('users', count)]
    },
    {
      key: 'accept',
      label: t('BUSINESS_REPORTS_TIME_TO_ACCEPT', 'Time to accept'),
      deps: [ordersAcceptSpendList],
      value: () => <Figure>{formatDuration(t, totals?.acceptSeconds)}</Figure>,
      refs: [averageHelp]
    },
    {
      key: 'pickup',
      label: t('BUSINESS_REPORTS_WAIT_AT_PICKUP', 'Wait at pickup'),
      deps: [arrivedPickUpSpendList],
      value: () => <Figure>{formatDuration(t, totals?.pickupSeconds)}</Figure>,
      refs: [averageHelp]
    }
  ]

  const failedBlocks = [...FIGURE_BLOCKS, ...(statusFeedsOrders ? [STATUS_BLOCK] : [])].filter(([prop]) => isFailed(blocks[prop]))
  const busy = figures.some(figure => figure.deps.some(block => block?.loading))

  // redesign bi FD (D10): the retry button leaves with the notice, so the focus goes to the title of the region first
  const retryFigures = () => {
    headingRef.current?.focus()
    failedBlocks.forEach(([, key]) => reloadBlock?.(key))
  }
  const retryComparison = () => {
    headingRef.current?.focus()
    reloadComparison?.()
  }

  return (
    <section className='odc-bi-summary' data-slot='bi-summary' aria-labelledby={headingId} aria-busy={busy ? 'true' : undefined}>
      <h2 className='odc-sr-only' id={headingId} ref={headingRef} tabIndex={-1}>{t('BUSINESS_REPORTS_SECTION_SUMMARY', 'Summary')}</h2>
      <MetricGrid columns={6}>
        {figures.map(figure => {
          const failed = figure.deps.some(isFailed)
          const loading = figure.deps.some(block => block?.loading)
          const value = failed ? <Figure>{DASH}</Figure> : figure.value(failed)
          // redesign bi R1 (F4): the first reference that is painted is the lead one, so the page can reserve its height
          const refs = figure.refs.filter(Boolean).map((ref, index) => (index === 0 ? { ...ref, lead: true } : ref))
          const settled = !loading && !comparing
          if (settled) lastShown.current[figure.key] = { value, refs }
          const kept = !settled ? lastShown.current[figure.key] : null
          return (
            <Metric
              key={figure.key}
              data-metric={figure.key}
              data-stale={kept ? '' : undefined}
              label={figure.label}
              value={kept ? kept.value : value}
              refs={kept ? kept.refs : refs}
              loading={loading && !kept}
            />
          )
        })}
      </MetricGrid>
      {failedBlocks.length > 0 && (
        <InlineNotice tone='warning' action={<Button onClick={retryFigures}>{t('TRY_AGAIN', 'Try again')}</Button>}>
          {t('BUSINESS_REPORTS_FIGURES_ERROR', 'Some figures could not be loaded.')}
        </InlineNotice>
      )}
      {comparison?.error && (
        <InlineNotice tone='info' action={<Button onClick={retryComparison}>{t('TRY_AGAIN', 'Try again')}</Button>}>
          {t('BUSINESS_REPORTS_COMPARISON_ERROR', 'Comparison with the previous period could not be loaded.')}
        </InlineNotice>
      )}
    </section>
  )
}
