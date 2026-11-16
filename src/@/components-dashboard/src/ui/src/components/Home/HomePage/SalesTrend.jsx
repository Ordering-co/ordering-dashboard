import React, { useCallback, useId, useMemo } from 'react'

import { useEvent, useLanguage, useUtils } from '../../../../../index'
import { Button, EmptyState, Skeleton } from '../../Shared/Product'
// redesign home C1 (D8): by file, so the chart library (Chart.js) is not pulled into every page that imports the Product barrel
import { Chart } from '../../Shared/Product/Chart'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { CircleAlert } from '../../Shared/Icon'
import './blocks.css'
import './home.css'

const DASH = '—'
const MINUS = '−' // U+2212: the sign of a drop reads as a minus in any font, not as a hyphen

// A plain click goes through the event bus; a modified or middle click stays the browser's
const isPlainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

// redesign home R1 (Q-08): the day, as 'YYYY-MM-DD', that is `back` days before another. Built from its parts in local time, so no time zone moves it
const PREVIOUS_SHIFT = 30
const shiftDay = (day, back) => {
  const [year, month, date] = String(day).split('-').map(Number)
  const value = new Date(year, (month || 1) - 1, (date || 1) - back)
  if (Number.isNaN(value.getTime())) return null
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

const Figure = ({ children, className = '', ...props }) => <span className={`odc-figure ${className}`.trim()} {...props}><bdi>{children}</bdi></span>

/**
 * Sales of the last 30 closed days against the 30 before (redesign home C1, D2, D8, HM-01, HM-15, HM-18, auditor 8, 13):
 * the total with its signed change as text, the month figure of `main`, the chart and «See more reports» for every level.
 */
export const SalesTrend = ({ trend, onRetry, headingRef }) => {
  const [, t] = useLanguage()
  const [{ parsePrice, parseNumber, parseDate }] = useUtils()
  const [events] = useEvent()
  const isPhone = useIsPhone()
  const headingId = useId()

  const { loading = false, error = null } = trend || {}
  const title = t('HOME_SALES_LAST_30_DAYS', 'Sales, last 30 days')
  const salesLabel = t('SALES', 'Sales')
  const previousLabel = t('HOME_PREVIOUS_30_DAYS', 'Previous 30 days')
  const dateHeader = t('DATE', 'Date')

  const formatValue = useCallback((value) => parsePrice(value), [parsePrice])

  // HM-18: a short date by the project format. The days are local days ('YYYY-MM-DD'), so they are read as local, not as UTC
  const labels = useMemo(
    () => (trend?.days || []).map(day => parseDate(day, { dateOnly: true, omitYear: true, inputFormat: 'YYYY-MM-DD', utc: false })),
    [trend?.days, parseDate]
  )
  // redesign home R1 (Q-08, review P2): the previous series names its own days, the 30 current days shifted 30 days back, formatted the same way
  const previousLabels = useMemo(
    () => (trend?.days || []).map(day => {
      const shifted = shiftDay(day, PREVIOUS_SHIFT)
      return shifted ? parseDate(shifted, { dateOnly: true, omitYear: true, inputFormat: 'YYYY-MM-DD', utc: false }) : ''
    }),
    [trend?.days, parseDate]
  )
  const series = useMemo(() => [
    { id: 'sales', label: salesLabel, data: trend?.current || [] },
    { id: 'previous', label: previousLabel, data: trend?.previous || [], labels: previousLabels, comparison: true }
  ], [trend?.current, trend?.previous, salesLabel, previousLabel, previousLabels])
  const table = useMemo(() => ({ caption: title, xHeader: dateHeader }), [title, dateHeader])

  const handleReports = (event) => {
    if (event.defaultPrevented || !isPlainClick(event)) return
    event.preventDefault()
    events.emit('go_to_page', { page: 'business_analytics' })
  }

  const change = trend?.change
  const changeText = change == null
    ? null
    : `${change > 0 ? '+' : change < 0 ? MINUS : ''}${parseNumber(Math.abs(change), { decimal: 1 })}%`

  let body
  if (loading) {
    // redesign home R1 (Q-01): the box of the loaded block, on its own classes: the figures row (two figures, three captions),
    // the chart box at its height and the legend row. The captions and the legend are lines of their own height; the figures have
    // no content to give them a width in the wrapping row, so each skeleton brings one (a token, not a measure of the text)
    const ghostWidth = 'var(--od-x-sk-meta)'
    const captionLine = 'calc(var(--od-x-type-caption-size) * var(--od-x-leading-ui))'
    body = (
      <>
        <div className='odc-trend-figures' aria-hidden='true'>
          <div className='odc-trend-figure'>
            <p className='odc-trend-value'><Skeleton size={ghostWidth} block='calc(var(--od-x-type-display-size) * var(--od-x-leading-title))' /></p>
            <p className='odc-trend-caption'><Skeleton size={ghostWidth} block={captionLine} /></p>
            <p className='odc-trend-caption'><Skeleton size={ghostWidth} block={captionLine} /></p>
          </div>
          <div className='odc-trend-figure'>
            <p className='odc-trend-value'><Skeleton size={ghostWidth} block='calc(var(--od-x-type-display-size) * var(--od-x-leading-title))' /></p>
            <p className='odc-trend-caption'><Skeleton size={ghostWidth} block={captionLine} /></p>
          </div>
        </div>
        <figure className='odc-chart' data-size={isPhone ? 'compact' : 'default'} aria-hidden='true'>
          <div className='odc-chart-plot'>
            <Skeleton size='100%' block='100%' />
          </div>
          <ul className='odc-chart-legend'>
            {[0, 1].map(index => (
              <li key={index} className='odc-chart-legend-item'>
                <Skeleton size={ghostWidth} block={captionLine} />
              </li>
            ))}
          </ul>
        </figure>
      </>
    )
  } else if (error) {
    body = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('HOME_TREND_ERROR', 'Sales could not be loaded.')}
        action={<Button onClick={onRetry}>{t('TRY_AGAIN', 'Try again')}</Button>}
      />
    )
  } else {
    body = (
      <>
        <div className='odc-trend-figures'>
          <div className='odc-trend-figure'>
            <p className='odc-trend-value'><Figure>{parsePrice(trend?.total)}</Figure></p>
            <p className='odc-trend-caption'>{t('HOME_LAST_30_DAYS_TO_YESTERDAY', '30 days to yesterday')}</p>
            {changeText && (
              <p className='odc-trend-caption'>
                <Figure className='odc-trend-change'>{changeText}</Figure> {t('HOME_VS_PREVIOUS_30_DAYS', 'vs previous 30 days')}
              </p>
            )}
          </div>
          <div className='odc-trend-figure'>
            <p className='odc-trend-value'>
              {trend?.monthTotal == null ? <Figure>{DASH}</Figure> : <Figure>{parsePrice(trend.monthTotal)}</Figure>}
            </p>
            <p className='odc-trend-caption'>{t('THIS_MONTH_SALES', 'This month sales')}</p>
          </div>
        </div>
        <Chart
          type='line'
          label={title}
          labels={labels}
          series={series}
          formatValue={formatValue}
          table={table}
          size={isPhone ? 'compact' : 'default'}
        />
      </>
    )
  }

  return (
    <section className='odc-home-block odc-trend' data-slot='home-trend' aria-labelledby={headingId} aria-busy={loading ? 'true' : undefined}>
      <div className='odc-trend-head'>
        <h2 className='odc-home-block-title' id={headingId} ref={headingRef} tabIndex={-1}>{title}</h2>
        {/* redesign home C1 (auditor 13): «See more reports» stays for every level, as in `main` */}
        <a
          className='odc-btn'
          href='/intelligence/business'
          data-variant='link'
          data-size='md'
          onClick={handleReports}
        >
          {t('SEE_MORE_REPORTS', 'See more reports')}
        </a>
      </div>
      {body}
    </section>
  )
}
