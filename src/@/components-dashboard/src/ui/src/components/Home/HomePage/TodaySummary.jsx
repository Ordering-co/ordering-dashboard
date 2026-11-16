import React, { useId } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Button, EmptyState } from '../../Shared/Product'
import { Metric, MetricGrid } from '../../Shared/Product/Metric' // redesign bi FA0 (promoción, auditor 10)
import { CircleAlert } from '../../Shared/Icon'
import './home.css'

const DASH = '—'

// A figure is a node of its own, isolated for right-to-left (decision 11)
const Figure = ({ children, ...props }) => <span className='odc-figure' {...props}><bdi>{children}</bdi></span>

/** The weekday of a local day 'YYYY-MM-DD' in the language of the user. Built from its parts so no time zone moves it. */
const weekdayName = (day, languageCode) => {
  const [year, month, date] = String(day).split('-').map(Number)
  const value = new Date(year, (month || 1) - 1, date || 1)
  if (Number.isNaN(value.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(languageCode || undefined, { weekday: 'long' }).format(value)
  } catch (error) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(value)
  }
}

/**
 * Today's four figures (redesign home C1, D2, D5, HM-05): sales, orders, average ticket and cancelled, each with the same weekday
 * of last week as reference. Sales and orders say «by now» (the hours up to this one) and, dimmer, the full day; the ticket and the
 * cancelled orders only have the full day. No percentage while the day is half over (D2).
 */
export const TodaySummary = ({ today, onRetry, headingRef }) => {
  const [languageState, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const headingId = useId()

  const { loading = false, error = null, lastWeek } = today || {}
  const weekday = weekdayName(lastWeek?.day, languageState?.language?.code)
  const noOrders = t('HOME_NO_ORDERS_YET', 'No orders yet')
  const byNowText = t('HOME_LAST_WEEK_BY_NOW', ':weekday: last week, by now').replace(':weekday:', weekday)
  const fullText = t('HOME_LAST_WEEK_FULL', ':weekday: last week, full day').replace(':weekday:', weekday)
  const fullDayText = t('HOME_LAST_WEEK_FULL_DAY', 'Full day')
  // (AK-282): «by now» has no breakdown by status, so the orders and the ticket keep the cancelled orders in the figure
  // and in its references, and say it, with the same words as Business Intelligence; «Cancelled today» shows them apart
  // each figure says the base the API answered it in (`today.excludesCancelled.sales` / `.orders`): sales only when they
  // leave the cancelled orders out (as before, they said nothing), orders always, the ticket when both terms share a base
  const includesHelp = { text: t('BUSINESS_REPORTS_TICKET_HELP', 'Includes cancelled orders'), secondary: true }
  const excludesHelp = { text: t('BUSINESS_REPORTS_EXCLUDES_CANCELLED', 'Excludes cancelled orders'), secondary: true }
  const salesExcluded = today?.excludesCancelled?.sales === true
  const ordersExcluded = today?.excludesCancelled?.orders === true
  const mixedTicket = salesExcluded !== ordersExcluded
  const ticketHelp = salesExcluded ? excludesHelp : includesHelp

  const price = (value) => parsePrice(value)
  // A reference in another base than its figure is null: a dash, never a 0
  const orDash = (value, format = (shown) => shown) => (value == null ? DASH : format(value))
  // The average ticket is null on a day without orders: a dash that is named, never a $ 0.00 that reads as a ticket of zero.
  // With sales and orders in different bases it is a plain dash: there are orders, they just cannot be divided
  const ticket = (value) => {
    if (value != null) return <Figure>{price(value)}</Figure>
    return mixedTicket ? <Figure>{DASH}</Figure> : <Figure role='img' aria-label={noOrders}>{DASH}</Figure>
  }

  const cards = [
    {
      key: 'sales',
      // redesign own keys; TODAY_SALES / TODAY_ORDERS come from the API catalog in Title Case («Today Sales») and sat next to
      // «Average ticket today» and «Cancelled today». Same pattern as those two: sentence case, the word «today» last.
      label: t('HOME_SALES_TODAY', 'Sales today'),
      value: <Figure>{price(today?.sales)}</Figure>,
      refs: [
        { text: byNowText, value: <Figure>{orDash(lastWeek?.byNow?.sales, price)}</Figure> },
        { text: fullDayText, value: <Figure>{orDash(lastWeek?.fullDay?.sales, price)}</Figure>, secondary: true },
        ...(salesExcluded ? [excludesHelp] : [])
      ]
    },
    {
      key: 'orders',
      label: t('HOME_ORDERS_TODAY', 'Orders today'),
      value: <Figure>{today?.orders}</Figure>,
      refs: [
        { text: byNowText, value: <Figure>{orDash(lastWeek?.byNow?.orders)}</Figure> },
        { text: fullDayText, value: <Figure>{orDash(lastWeek?.fullDay?.orders)}</Figure>, secondary: true },
        ordersExcluded ? excludesHelp : includesHelp
      ]
    },
    {
      key: 'ticket',
      label: t('HOME_AVERAGE_TICKET_TODAY', 'Average ticket today'),
      value: ticket(today?.averageTicket),
      refs: [{ text: fullText, value: ticket(lastWeek?.fullDay?.averageTicket) }, ...(mixedTicket ? [] : [ticketHelp])]
    },
    {
      key: 'cancelled',
      label: t('HOME_CANCELLED_TODAY', 'Cancelled today'),
      value: <Figure>{today?.cancelled}</Figure>,
      refs: [{ text: fullText, value: <Figure>{lastWeek?.fullDay?.cancelled}</Figure> }]
    }
  ]

  let body
  if (error) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('HOME_TODAY_ERROR', "Today's figures could not be loaded.")}
        action={<Button onClick={onRetry}>{t('TRY_AGAIN', 'Try again')}</Button>}
      />
    )
  } else {
    body = (
      // redesign bi FA0 (promoción, auditor 10): the card and its grid are P/Metric now; same DOM, same texts, same skeletons (R1, Q-01)
      <MetricGrid columns={4}>
        {cards.map(card => (
          <Metric key={card.key} data-card={card.key} label={card.label} value={card.value} refs={card.refs} loading={loading} />
        ))}
      </MetricGrid>
    )
  }

  return (
    <section className='odc-today' data-slot='home-today' aria-labelledby={headingId} aria-busy={loading ? 'true' : undefined}>
      {/* redesign home R1 (Q-04): focusable by script, so «Try again» can hand the focus here when the figures load */}
      <h2 className='odc-sr-only' id={headingId} ref={headingRef} tabIndex={-1}>{t('HOME_TODAY', 'Today')}</h2>
      {body}
    </section>
  )
}
