import React, { useCallback, useMemo, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { bucketSeries, downloadCsv, toCsv } from '../../../../../utils/businessReports'
import { Dialog, Skeleton } from '../../Shared/Product'
// by file, so the chart library (Chart.js) is not pulled into every page that imports the Product barrel
import { Chart } from '../../Shared/Product/Chart'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Download, Maximize2 } from '../../Shared/Icon'
import { CardAction, ReportCard } from '../AnalyticsKit'
import './business-analytics.css'
// redesign the rule that enlarges the «Expand» dialog (class `odc-bi-chart-dialog`) lives in the Drivers sheet, which this route
// does not load on its own. Importing it keeps one copy of the values (the rule is generic: it only reaches that class); the sheet also holds
// Drivers-only classes (`odc-bi-drivers-*`) that nothing here uses
import '../DriverAnalytics/driver-analytics.css'

// redesign bi FD (D7, D8, D10; BI-01, BI-08, BI-09, BI-16, BI-22): the line charts of the page (orders, sales, registered users).
// The series is the one of the axis of the period (`bucketSeries`: continuous days with 0 in the gaps, hours by their start, months
// as they come); the CSV, in contrast, is the rows of the API as they are, as `main` wrote them (inventory 2.1).

// A count is a whole number: a tick between two integers says nothing (the chart asks for one at 0.5 when the maximum is 1)
const formatCount = (value) => (Number.isInteger(Number(value)) ? String(value) : '')

/** «Jul 2026» in the language of the user, from the bucket 'YYYY-MM'. */
const monthLabel = (bucket, languageCode) => {
  const [year, month] = String(bucket).split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, 1)
  try {
    return new Intl.DateTimeFormat(languageCode || undefined, { month: 'short', year: 'numeric' }).format(date)
  } catch (error) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date)
  }
}

/**
 * One chart card of the page: a title, «Expand» and «Download CSV», and the chart (or the skeleton, the error with «Try again»
 * or the empty text, which the card decides). `block` is `{ loading, error, data }` of the controller.
 *
 * - `valueKey`: the field of the rows that is drawn (`orders`, `sales`, `users`); `fileName` and `header` are the ones of `main`'s CSV.
 * - `formatValue(value)` writes the Y axis, the tooltip and the table.
 */
export const TrendCard = ({ title, block, valueKey, period, formatValue, fileName, header, onRetry, note }) => {
  const [languageState, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const isPhone = useIsPhone()
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo(() => (Array.isArray(block?.data) ? block.data : []), [block?.data])
  const loading = Boolean(block?.loading)
  const error = block?.error
  const code = languageState?.language?.code
  const granularity = period?.granularity ?? 'day'
  // redesign bi R1 targeted (N1): without a period (a zone other than the browser's) the rows are drawn as they come, in time order
  const raw = !period
  const sortedRows = useMemo(() => [...rows].sort((a, b) => String(a?.time).localeCompare(String(b?.time))), [rows])
  const allMidnight = sortedRows.every(row => /\s00:00:00$/.test(String(row?.time ?? '')))

  const points = useMemo(() => (raw
    ? sortedRows.map(row => ({ bucket: String(row?.time ?? ''), value: Number(row?.[valueKey]) || 0 }))
    : bucketSeries(rows, valueKey, period)), [raw, sortedRows, rows, valueKey, period])
  // redesign bi FD (decision 13): the labels come from the project's formats, never ISO
  const labels = useMemo(() => points.map(({ bucket }) => {
    if (raw) return allMidnight ? parseDate(bucket, { dateOnly: true, utc: false }) : parseDate(bucket, { utc: false })
    if (granularity === 'hour') return parseDate(`${bucket}:00:00`, { timeOnly: true, utc: false })
    if (granularity === 'month') return monthLabel(bucket, code)
    return parseDate(bucket, { dateOnly: true, omitYear: true, inputFormat: 'YYYY-MM-DD', utc: false })
  }), [points, raw, allMidnight, granularity, code, parseDate])
  const series = useMemo(() => [{ id: valueKey, label: title, data: points.map(({ value }) => value) }], [points, valueKey, title])

  let xHeader = t('DATE', 'Date')
  if (raw) xHeader = t('DATE', 'Date')
  else if (granularity === 'hour') xHeader = t('HOUR', 'Hour')
  else if (granularity === 'month') xHeader = t('MONTH', 'Month')
  const table = useMemo(() => ({ caption: title, xHeader }), [title, xHeader])

  // redesign bi FD (BI-09): nothing to enlarge or download while it loads, after an error or without rows
  const unavailable = loading || Boolean(error) || rows.length === 0

  const handleDownload = () => {
    downloadCsv(`${fileName}_${Date.now()}.csv`, toCsv(header, rows.map(row => [row.time, row[valueKey]])))
  }

  const actions = (
    <>
      <CardAction icon={Maximize2} label={`${t('EXPAND', 'Expand')}: ${title}`} onClick={() => setExpanded(true)} disabled={unavailable} />
      <CardAction icon={Download} label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`} onClick={handleDownload} disabled={unavailable} />
    </>
  )

  const chart = (size) => (
    <Chart type='line' label={title} labels={labels} series={series} formatValue={formatValue} table={table} size={size} toggleSeries />
  )

  return (
    <>
      <ReportCard
        title={title}
        actions={actions}
        loading={loading}
        error={error}
        onRetry={onRetry}
        empty={rows.length === 0}
        skeleton={<Skeleton size='100%' block={isPhone ? 'var(--od-x-chart-height-compact)' : 'var(--od-x-chart-height)'} />}
      >
        {chart(isPhone ? 'compact' : 'default')}
        {/* (review AK-R2): what the series counts, when it is not what the figure above it counts */}
        {note && <p className='odc-bi-chart-note'>{note}</p>}
      </ReportCard>
      {/* redesign the class gives the dialog the size of the modal of `main` (driver-analytics.css, as in Drivers), so «Expand» enlarges: the
          `lg` dialog (670 at 1440) was as tall as the card it came from */}
      <Dialog open={expanded} onOpenChange={setExpanded} title={title} size='lg' className='odc-bi-chart-dialog' closeLabel={t('CLOSE', 'Close')}>
        {expanded && chart('default')}
      </Dialog>
    </>
  )
}

/** Orders and sales, side by side from 1024 px. */
// redesign bi R1 targeted (N1): the axis of the charts is the period of the API's labels (`chartPeriod`), see the controller
export const BusinessTrends = ({ chartPeriod, ordersList, salesList, reloadBlock }) => {
  const period = chartPeriod
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const formatPrice = useCallback((value) => parsePrice(value), [parsePrice])

  return (
    <div className='odc-bi-grid'>
      <TrendCard
        title={t('ORDERS', 'Orders')}
        block={ordersList}
        // the chart draws what the API answered: without the cancelled orders only when it says so
        note={ordersList?.excludesCancelled === true
          ? t('BUSINESS_REPORTS_EXCLUDES_CANCELLED', 'Excludes cancelled orders')
          : t('BUSINESS_REPORTS_TICKET_HELP', 'Includes cancelled orders')}
        valueKey='orders'
        period={period}
        formatValue={formatCount}
        fileName='orders'
        header={[t('TIME', 'Time'), t('ORDERS', 'Orders')]}
        onRetry={() => reloadBlock?.('orders')}
      />
      <TrendCard
        title={t('SALES', 'Sales')}
        block={salesList}
        note={salesList?.excludesCancelled === true ? t('BUSINESS_REPORTS_EXCLUDES_CANCELLED', 'Excludes cancelled orders') : undefined}
        valueKey='sales'
        period={period}
        formatValue={formatPrice}
        fileName='sales'
        header={[t('TIME', 'Time'), t('SALES', 'Sales')]}
        onRetry={() => reloadBlock?.('sales')}
      />
    </div>
  )
}

export { formatCount }
