import React, { useCallback, useMemo } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { bucketSeries, downloadCsv, toCsv } from '../../../../../utils/businessReports'
import { Download } from '../../Shared/Icon'
import { BarList, CardAction, ReportCard, formatDurationSigned } from '../AnalyticsKit'
import { Figure } from '../BusinessAnalytics/BusinessSummary'
import { formatCount } from '../BusinessAnalytics/BusinessTrends'
import { DriverChartCard } from './DriverChartCard'

// redesign drivers FC2 (D1, D6, D7; DR-03, DR-04, DR-05, DR-06, DR-10, DR-15; auditors 2, 5, 6, 12): the cards of the sections of
// /intelligence/drivers. «Orders and sales» (two line charts), «Drivers» (top drivers, availability and busy time) and «Delivery
// times» (times by day). The controller computes the series (`ordersSeries`, `availablePairs`, `spendSeries`, `topDrivers`...); each card
// here only writes the labels of the axis with the project's formats and the CSV of `main`, and hands them to the card (`DriverChartCard`).

const DASH = '—'
const MAX_SERIES = 6 // the slots of the palette of the chart (decision 36): a seventh is never a new color
const MONTH = /^\d{4}-\d{2}$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const TIME_NO_SECONDS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
const MIDNIGHT = /\s00:00:00$/

const asList = (value) => (Array.isArray(value) ? value : [])

/** «Jul 2026» in the language of the user, from the bucket 'YYYY-MM' (the one of `BusinessTrends`, which does not export it). */
const monthLabel = (bucket, languageCode) => {
  const [year, month] = String(bucket).split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, 1)
  try {
    return new Intl.DateTimeFormat(languageCode || undefined, { month: 'short', year: 'numeric' }).format(date)
  } catch (error) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date)
  }
}

/** The header of the first column of the table of a chart, by the kind of its axis. Every call is a literal (the i18n scanner reads those). */
const xHeaderOf = (kind, t) => {
  if (kind === 'hour') return t('HOUR', 'Hour')
  if (kind === 'month') return t('MONTH', 'Month')
  return t('DATE', 'Date')
}

const isMidnight = (at) => DATE_ONLY.test(at) || MIDNIGHT.test(at)
// a time without seconds or a bare day is completed, so it reads with the default input format of `parseDate`
const fullTime = (at) => {
  if (DATE_ONLY.test(at)) return `${at} 00:00:00`
  if (TIME_NO_SECONDS.test(at)) return `${at}:00`
  return at
}

/**
 * The axis of a chart whose points are the `at` texts of the API (decision 13: never ISO). `YYYY-MM` is a month; if every other `at`
 * is midnight (or a bare day) the axis is by day; if not, by hour. An hourly axis of several days keeps the date, or two points
 * would read the same.
 * @returns {{ labels: string[], kind: 'hour' | 'date' | 'month' }}
 */
const atAxis = (ats, { parseDate, code }) => {
  const texts = ats.map(at => String(at ?? ''))
  const dated = texts.filter(at => !MONTH.test(at))
  const allMidnight = dated.every(isMidnight)
  const severalDays = new Set(dated.map(at => at.slice(0, 10))).size > 1
  const labels = texts.map((at) => {
    if (MONTH.test(at)) return monthLabel(at, code)
    if (allMidnight) return parseDate(at.slice(0, 10), { dateOnly: true, omitYear: true, inputFormat: 'YYYY-MM-DD', utc: false })
    if (severalDays) return parseDate(fullTime(at), { utc: false })
    return parseDate(fullTime(at), { utc: false, timeOnly: true })
  })
  let kind = 'hour'
  if (texts.length > 0 && dated.length === 0) kind = 'month'
  else if (allMidnight || severalDays) kind = 'date'
  return { labels, kind }
}

/**
 * A line chart of orders or sales: every series of the response on the axis of the period its own response carries (`bucketSeries`:
 * continuous days with 0 in the gaps, hours by their start, months as they come). Without a period the points are drawn as they come, in
 * time order, and a series without a point at a time leaves a gap. The CSV is the first series as `main` wrote it (`rows`).
 */
const TrendChartCard = ({ title, block, seriesList, period, valueKey, formatValue, fileName, header, rows, onRetry }) => {
  const [languageState, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const code = languageState?.language?.code
  const raw = !period
  const granularity = period?.granularity ?? 'day'

  const { labels, data } = useMemo(() => {
    const lists = asList(seriesList).slice(0, MAX_SERIES)
    if (!raw) {
      const buckets = lists.map(list => bucketSeries(list.rows, valueKey, period))
      return {
        labels: asList(buckets[0]).map(({ bucket }) => {
          if (granularity === 'hour') return parseDate(`${bucket}:00:00`, { timeOnly: true, utc: false })
          if (granularity === 'month') return monthLabel(bucket, code)
          return parseDate(bucket, { dateOnly: true, omitYear: true, inputFormat: 'YYYY-MM-DD', utc: false })
        }),
        data: buckets.map(points => points.map(({ value }) => value))
      }
    }
    // redesign drivers FC2 (auditor 4): without a period (a response with no readable range) the rows are drawn as they come, in time order
    const times = [...new Set(lists.flatMap(list => asList(list.rows).map(row => String(row?.time ?? ''))))].sort()
    const allMidnight = times.every(time => MIDNIGHT.test(time))
    return {
      labels: times.map(time => (allMidnight ? parseDate(time, { dateOnly: true, utc: false }) : parseDate(time, { utc: false }))),
      data: lists.map((list) => {
        const byTime = new Map(asList(list.rows).map(row => [String(row?.time ?? ''), Number(row?.[valueKey]) || 0]))
        return times.map(time => (byTime.has(time) ? byTime.get(time) : null))
      })
    }
  }, [seriesList, period, raw, granularity, valueKey, code, parseDate])

  // redesign drivers FC2 (auditor 2): one line per series of the API, named by its label (a single one is named by the card)
  const series = useMemo(() => {
    const lists = asList(seriesList).slice(0, MAX_SERIES)
    return lists.map((list, index) => ({
      id: `${valueKey}-${index}`,
      label: lists.length === 1 ? title : (list.label || `${title} ${index + 1}`),
      data: data[index] ?? []
    }))
  }, [seriesList, data, valueKey, title])

  const empty = asList(seriesList).every(list => asList(list.rows).length === 0)

  return (
    <DriverChartCard
      title={title}
      block={block}
      empty={empty}
      type='line'
      labels={labels}
      series={series}
      formatValue={formatValue}
      xHeader={xHeaderOf(raw || granularity === 'day' ? 'date' : granularity, t)}
      fileName={fileName}
      header={header}
      rows={rows}
      onRetry={onRetry}
    />
  )
}

/** A chart whose points are an `at` of the API and whose series are in seconds (availability, busy time, times by day). */
const SecondsChartCard = ({ title, block, type, ats, seriesList, fileName, header, rows, onRetry }) => {
  const [languageState, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const code = languageState?.language?.code
  const formatValue = useCallback((seconds) => formatDurationSigned(t, seconds) ?? DASH, [t])

  const axis = useMemo(() => atAxis(ats, { parseDate, code }), [ats, parseDate, code])
  // redesign rows whose every value is null (the API answers them with «Today») draw an empty grid, so they are «No data» like no rows
  const empty = ats.length === 0 || asList(seriesList).every(serie => asList(serie.data).every(value => value === null || value === undefined))

  return (
    <DriverChartCard
      title={title}
      block={block}
      empty={empty}
      type={type}
      labels={axis.labels}
      series={seriesList}
      formatValue={formatValue}
      durationTicks // redesign (row 72 Q-08): seconds, so the Y axis steps by 15 s, 5 min, 2 h … and not by Chart.js decimals
      xHeader={xHeaderOf(axis.kind, t)}
      fileName={fileName}
      header={header}
      rows={rows}
      onRetry={onRetry}
    />
  )
}

/** The rows of the CSV of availability and busy time as `main` wrote them: the list of the API in its order, in hours, the other side of the same `at` or 0. */
const hoursRows = (data, firstKey, secondKey, parseNumber) => {
  const hours = (seconds) => parseNumber(seconds / 3600, { separator: '.' })
  const others = asList(data?.[secondKey])
  return asList(data?.[firstKey]).map((row) => {
    const other = others.find(item => item?.at === row?.at)
    // redesign drivers R1 (P-a): the side that is missing is `0`, as in `main` (it was an empty cell); the row keeps its comma, which `main` lost
    return [row?.at, hours(row?.time), other ? hours(other.time) : 0]
  })
}

/** Orders and sales, side by side from 1024 px. */
export const DriverOrdersAndSales = ({ ordersList, salesList, ordersSeries, salesSeries, ordersRows, salesRows, ordersPeriod, salesPeriod, reloadBlock }) => {
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const formatPrice = useCallback((value) => parsePrice(value), [parsePrice])
  // redesign drivers FC2 (DR-15): the rows of the CSV are those of the first series, with the time of the API without its seconds
  const csv = (rows, key) => asList(rows).map(row => [String(row?.time ?? '').slice(0, 16), row?.[key]])

  return (
    <div className='odc-bi-grid'>
      <TrendChartCard
        title={t('ORDERS', 'Orders')}
        block={ordersList}
        seriesList={ordersSeries}
        period={ordersPeriod}
        valueKey='orders'
        formatValue={formatCount}
        fileName='orders'
        header={[t('TIME', 'Time'), t('ORDERS', 'Orders')]}
        rows={csv(ordersRows, 'orders')}
        onRetry={() => reloadBlock?.('orders')}
      />
      <TrendChartCard
        title={t('SALES', 'Sales')}
        block={salesList}
        seriesList={salesSeries}
        period={salesPeriod}
        valueKey='sales'
        formatValue={formatPrice}
        fileName='sales'
        header={[t('TIME', 'Time'), t('SALES', 'Sales')]}
        rows={csv(salesRows, 'sales')}
        onRetry={() => reloadBlock?.('sales')}
      />
    </div>
  )
}

/** The ranking of the drivers with most orders: name, count and share, in the order of the API, with no color by threshold (DR-10). */
const TopDriversCard = ({ block, topDrivers, onRetry }) => {
  const [, t] = useLanguage()
  const [{ parseNumber }] = useUtils()
  const title = t('DRIVER_REPORTS_TOP_DRIVERS', 'Top drivers')
  const drivers = asList(topDrivers)

  const items = useMemo(() => drivers.map((driver, index) => ({
    id: `${index}-${driver.id ?? driver.name}`,
    // two drivers with the same name are told apart by their id on screen, never in the CSV (auditor 12)
    name: driver.duplicate && driver.id != null ? `${driver.name} · #${driver.id}` : driver.name,
    value: driver.count,
    hint: <Figure>{`${parseNumber(driver.percent, { decimal: 1 })}%`}</Figure>
  })), [drivers, parseNumber])

  const loading = Boolean(block?.loading)
  const unavailable = loading || Boolean(block?.error) || drivers.length === 0

  const handleDownload = () => {
    downloadCsv(`top_orders_${Date.now()}.csv`, toCsv([t('NAME', 'Name'), t('ORDERS', 'Orders')], drivers.map(driver => [driver.name, driver.count])))
  }

  return (
    <ReportCard
      title={title}
      actions={<CardAction icon={Download} label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`} onClick={handleDownload} disabled={unavailable} />}
      loading={loading}
      error={block?.error}
      onRetry={onRetry}
      empty={drivers.length === 0}
    >
      <BarList label={title} nameHeader={t('NAME', 'Name')} valueHeader={t('ORDERS', 'Orders')} items={items} />
    </ReportCard>
  )
}

const pairsOf = (pairs, firstId, firstLabel, secondId, secondLabel) => [
  { id: firstId, label: firstLabel, data: pairs.map(pair => pair.first) },
  { id: secondId, label: secondLabel, data: pairs.map(pair => pair.second) }
]

/** Top drivers, availability and busy time. */
export const DriverPeople = ({ topDriversList, topDrivers, availableTimesList, availablePairs, busyTimesList, busyPairs, reloadBlock }) => {
  const [, t] = useLanguage()
  const [{ parseNumber }] = useUtils()
  const available = asList(availablePairs)
  const busy = asList(busyPairs)
  const availableLabel = t('AVAILABLE', 'Available')
  // redesign the legend is sentence case beside «Busy / Not busy»; the shared NOT_AVAILABLE key says «Not Available» (Reports and
  // the old screens read it), so the legend has a key of its own. The CSV keeps the text of `main` (the file is data, not the legend)
  const notAvailableLabel = t('DRIVER_REPORTS_NOT_AVAILABLE', 'Not available')
  const notAvailableCsv = t('NOT_AVAILABLE', 'Not Available')
  const busyLabel = t('BUSY', 'Busy')
  const notBusyLabel = t('NOT_BUSY', 'Not busy')

  // redesign drivers FC2 (D6): the series follow the pairs, which the controller joined by their exact `at` and ordered
  const availableSeries = useMemo(() => pairsOf(available, 'available', availableLabel, 'not-available', notAvailableLabel), [available, availableLabel, notAvailableLabel])
  const busySeries = useMemo(() => pairsOf(busy, 'busy', busyLabel, 'not-busy', notBusyLabel), [busy, busyLabel, notBusyLabel])
  const availableAts = useMemo(() => available.map(pair => pair.at), [available])
  const busyAts = useMemo(() => busy.map(pair => pair.at), [busy])

  return (
    <div className='odc-bi-grid odc-bi-drivers-grid'>
      <TopDriversCard block={topDriversList} topDrivers={topDrivers} onRetry={() => reloadBlock?.('topDrivers')} />
      <SecondsChartCard
        title={t('DRIVER_REPORTS_AVAILABILITY', 'Availability')}
        block={availableTimesList}
        type='bar'
        ats={availableAts}
        seriesList={availableSeries}
        fileName='available_times'
        header={[t('TIME', 'Time'), `${availableLabel}(h)`, `${notAvailableCsv}(h)`]}
        rows={hoursRows(availableTimesList?.data, 'available', 'not_available', parseNumber)}
        onRetry={() => reloadBlock?.('availableTimes')}
      />
      <SecondsChartCard
        title={t('DRIVER_REPORTS_BUSY_TIME', 'Busy time')}
        block={busyTimesList}
        type='bar'
        ats={busyAts}
        seriesList={busySeries}
        fileName='busy_times'
        header={[t('TIME', 'Time'), `${busyLabel}(h)`, `${notBusyLabel}(h)`]}
        rows={hoursRows(busyTimesList?.data, 'busy', 'not_busy', parseNumber)}
        onRetry={() => reloadBlock?.('busyTimes')}
      />
    </div>
  )
}

/**
 * Times: accept, pickup, delivery and completed, in seconds, a day without data is a gap and never a 0 (DR-19).
 * redesign drivers R1 (F5): grouped bars titled «Times» (the title of `main`), not lines titled «Times by day»: a line does not draw an
 * isolated point (one hourly row with «Yesterday» left the chart blank), and the axis is by hour in a day. A gap stays a gap.
 */
export const DriverTimes = ({ spendTimesList, spendSeries, reloadBlock }) => {
  const [, t] = useLanguage()
  const days = asList(spendSeries)
  const acceptLabel = t('ACCEPT', 'Accept')
  const pickupLabel = t('PICKUP', 'Pickup')
  const deliveryLabel = t('DELIVERY', 'Delivery')
  const completedLabel = t('COMPLETED', 'Completed')

  const series = useMemo(() => [
    { id: 'accept', label: acceptLabel, data: days.map(day => day.accept) },
    { id: 'pickup', label: pickupLabel, data: days.map(day => day.pickup) },
    { id: 'delivery', label: deliveryLabel, data: days.map(day => day.delivery) },
    { id: 'complete', label: completedLabel, data: days.map(day => day.complete) }
  ], [days, acceptLabel, pickupLabel, deliveryLabel, completedLabel])
  const ats = useMemo(() => days.map(day => day.at), [days])

  return (
    <div className='odc-bi-grid'>
      <SecondsChartCard
        title={t('TIMES', 'Times')} // redesign drivers R1 (F5)
        block={spendTimesList}
        type='bar' // redesign drivers R1 (F5)
        ats={ats}
        seriesList={series}
        fileName='times'
        // the file keeps the text `main` wrote for «Pickup» («PickUP») and the raw rows of the API, in seconds
        header={[t('TIME', 'Time'), acceptLabel, t('PICKUP', 'PickUP'), deliveryLabel, completedLabel]}
        rows={asList(spendTimesList?.data).map(row => [row?.time, row?.accept_spend, row?.pickup_spend, row?.delivery_spend, row?.complete_spend])}
        onRetry={() => reloadBlock?.('spendTimes')}
      />
    </div>
  )
}
