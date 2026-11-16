import React, { useCallback, useMemo, useRef } from 'react'

import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { reportPngName } from '../../../../../utils/advancedReports'
import { downloadText, pivotToCsv, seriesToCsv } from '../../../../../utils/advancedReportsCsv'
import { clipPeriod, parsePeriodLabel } from '../../../../../utils/reportPeriods'
import { getApiMessageDefault, translateApiMessage } from '../../../../../utils/translateApiMessage'
import { BarList } from '../AnalyticsKit/BarList'
import { PivotTable } from '../AnalyticsKit/PivotTable'
import { CardAction, ReportCard } from '../AnalyticsKit/ReportCard'
import { SatisfactionScores } from '../AnalyticsKit/SatisfactionScores'
import { cellText, distanceUnitOf, formatDurationSigned, headerText, kmToUnit } from '../AnalyticsKit/pivotFormat'
import { Button, EmptyState, Skeleton } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { CircleAlert, Download, Image as ImageIcon } from '../../Shared/Icon'
import { ReportHeatMap } from './ReportHeatMap'
import { SeriesChart, TotalMetric } from './ReportCharts'
import { ReportTimeline } from './ReportTimeline'
import {
  MAX_SERIES,
  barDecimals,
  barModel,
  buildAxis,
  downloadCanvasImage,
  hasTableRows,
  lineModel,
  rankingRows,
  satisfactionKey,
  satisfactionModel,
  seriesTable,
  timelineModel,
  toNumber,
  trimDecimals
} from './reportBodyData'
import { usePeriodText } from './usePeriodText'
import './report-body.css'

// redesign reports FC2 (D6, D7, D8, D11, D12, D13; RP-04, RP-05, RP-13, RP-14, RP-15, RP-16, RP-19; auditor 1, 2, 5, 11, 13): the body of an open report.
// `ReportBody` picks the body by `report.body` and paints each block of data in a `ReportCard` (level 2): a title of its own, the actions of that block
// (its CSV, the image of its chart), and the four states of D13 — a skeleton with the final box, the old data under «Updating…», the error of that block
// with «Try again», and the empty text. The data come from `useAdvancedReport` (`result`), the filters that were sent from the page (`filters`).

// One literal t() call per title, so the i18n scanner sees every key. A title is the block's own (it says what the block holds, not the report's name).
const BLOCKS = {
  1: [t => t('ENTERPRISE_REPORT_1_BLOCK', 'Average distance')],
  2: [t => t('ENTERPRISE_REPORT_2_BLOCK', 'Orders by distance range')],
  3: [t => t('ENTERPRISE_REPORT_3_BLOCK', 'Service times')],
  4: [t => t('ENTERPRISE_REPORT_4_BLOCK', 'Orders by time range')],
  5: [t => t('ENTERPRISE_REPORT_5_BLOCK', 'Service times')],
  6: [t => t('ENTERPRISE_REPORT_6_BLOCK', 'Orders and sales')],
  7: [t => t('ENTERPRISE_REPORT_7_BLOCK', 'Shifts of the day')],
  8: [t => t('ENTERPRISE_REPORT_8_BLOCK_STORE', 'By store'), t => t('ENTERPRISE_REPORT_8_BLOCK_BRAND', 'By brand')],
  9: [t => t('ENTERPRISE_REPORT_9_BLOCK', 'Order locations')],
  10: [t => t('ENTERPRISE_REPORT_10_BLOCK', 'Distance covered')],
  11: [t => t('ENTERPRISE_REPORT_11_BLOCK', 'Service times')],
  12: [t => t('ENTERPRISE_REPORT_12_BLOCK', 'Orders per driver')],
  13: [t => t('ENTERPRISE_REPORT_13_BLOCK', 'Orders per period')],
  14: [t => t('ENTERPRISE_REPORT_14_BLOCK', 'Sales per period')],
  15: [t => t('ENTERPRISE_REPORT_15_BLOCK', 'New users by channel')],
  16: [t => t('ENTERPRISE_REPORT_16_BLOCK', 'Customer scores')],
  17: [t => t('ENTERPRISE_REPORT_17_BLOCK', 'Orders and sales')],
  18: [t => t('ENTERPRISE_REPORT_18_BLOCK_SITE', 'By site'), t => t('ENTERPRISE_REPORT_18_BLOCK_ORDER_TYPE', 'By order type')],
  19: [t => t('ENTERPRISE_REPORT_19_BLOCK', 'Orders and sales')],
  20: [t => t('ENTERPRISE_REPORT_20_BLOCK_PRODUCTS', 'Top products'), t => t('ENTERPRISE_REPORT_20_BLOCK_CATEGORIES', 'Top categories')],
  21: [t => t('ENTERPRISE_REPORT_21_BLOCK', 'Orders by status')]
}

const blockTitle = (id, index, t) => BLOCKS[id]?.[index]?.(t) ?? ''

// the reports whose CSV writes a `$` after the currency cells, as main does (D11: 8 and 18)
const CURRENCY_SUFFIX_REPORTS = new Set([8, 18])

// A count is a whole number: a tick between two integers says nothing
const formatCount = value => (Number.isInteger(Number(value)) ? String(value) : '')

const blockOf = (result, index) => ({
  data: index === 0 ? result.data : result.data1,
  error: index === 0 ? result.error : result.error1
})

// ── states ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const RowsSkeleton = ({ rows = 6 }) => (
  <div className='odc-rp-skeleton-rows'>
    {Array.from({ length: rows }, (_, index) => <Skeleton key={index} size='100%' block='var(--od-x-row-comfortable)' />)}
  </div>
)

const ChartSkeleton = () => {
  const isPhone = useIsPhone()
  return <Skeleton size='100%' block={isPhone ? 'var(--od-x-chart-height-compact)' : 'var(--od-x-chart-height)'} />
}

const ChartAndRowsSkeleton = () => (
  <div className='odc-rp-block'>
    <ChartSkeleton />
    <RowsSkeleton />
  </div>
)

const MapSkeleton = () => <Skeleton size='100%' block='var(--od-x-map-height)' />

// The text of the error of the API (`['ERROR_REPORT_VERY_LONG_PERIOD']`, a string) in the language of the user; a failed request without text says nothing more.
const errorMessage = (error, t) => {
  const message = Array.isArray(error) ? error.find(item => typeof item === 'string') : error
  return typeof message === 'string' ? translateApiMessage(t, message, undefined, getApiMessageDefault(message)) : undefined
}

const BlockError = ({ title, error, onRetry }) => {
  const [, t] = useLanguage()
  const handleRetry = (event) => {
    const section = event.currentTarget.closest('section')
    if (typeof onRetry === 'function') onRetry()
    // the button leaves with the error: the focus goes to the title of the block (the card does the same with its own error)
    section?.querySelector('[tabindex="-1"]')?.focus()
  }
  return (
    <EmptyState
      tone='error'
      icon={CircleAlert}
      title={t('BUSINESS_REPORTS_BLOCK_ERROR', '_title_ could not be loaded.').replace('_title_', () => title)}
      description={errorMessage(error, t)}
      action={<Button onClick={handleRetry}>{t('TRY_AGAIN', 'Try again')}</Button>}
    />
  )
}

/**
 * A block of a report (D13). `ReportCard` gives the skeleton, the empty text and the title; this adds what it does not have: the error of the block with the
 * message of the API and «Try again», and «Updating…» — the old data stay in place, dimmed and `aria-busy`, with a polite mark among the actions (a region
 * that exists before it has text is the one a screen reader announces; empty, it takes no room).
 */
const ReportBlock = ({ title, loading, updating, error, onRetry, empty, emptyText, skeleton, actions, children }) => {
  const [, t] = useLanguage()
  return (
    <ReportCard
      title={title}
      headingLevel={2}
      loading={loading}
      empty={!error && empty}
      emptyText={emptyText}
      skeleton={skeleton}
      actions={(
        <>
          <span className='odc-rp-updating' aria-live='polite'>{updating ? t('ENTERPRISE_REPORTS_UPDATING', 'Updating…') : null}</span>
          {actions}
        </>
      )}
    >
      <div className='odc-rp-block' aria-busy={updating ? 'true' : undefined} data-stale={updating ? '' : undefined}>
        {error ? <BlockError title={title} error={error} onRetry={onRetry} /> : children}
      </div>
    </ReportCard>
  )
}

// ── tables: 3 to 6, 8, 10, 11, 17 to 19, 21, and with bars 1 and 2 ──────────────────────────────────────────────────────
const PivotBlock = ({ report, index, result, filters }) => {
  const [, t] = useLanguage()
  const [utils] = useUtils() || []
  const [configState] = useConfig() || []
  // redesign (row 4, P4, D-30): the distances (report 1, the ranges of 2, report 10) are written in the unit of the project
  const distanceUnit = distanceUnitOf(configState?.configs)
  const periods = usePeriodText()
  const imageRef = useRef(null)
  const { data, error } = blockOf(result, index)
  const title = blockTitle(report.id, index, t)
  const rows = hasTableRows(data)
  const withBars = report.chart === 'bars'

  // a group of periods of the API in the dates of the project, cut to the range of the report (D7); what is not a period comes as it is
  const periodText = useCallback((period, label) => {
    // redesign a period that does not touch the range (the API numbers weeks differently, pending backend: ) keeps its own
    // dates instead of the raw label «Week 2026-37»
    const clipped = clipPeriod(period, filters?.from, filters?.to) || period
    return periods.periodText(clipped) || label
  }, [periods, filters?.from, filters?.to])

  // D11: the CSV of this block's own table (RP-04), the `$` of main in 8 and 18
  const csv = useMemo(() => (rows ? pivotToCsv(data, CURRENCY_SUFFIX_REPORTS.has(report.id) ? { currencySuffix: '$' } : undefined) : null), [rows, data, report.id])
  const handleDownloadCsv = () => downloadText(`${report.csv?.files?.[index] ?? ''}${Date.now()}.csv`, csv)

  // the bars of reports 1 and 2: one series per period, the stores or the ranges as labels (D12)
  const bars = useMemo(() => (withBars && rows ? barModel(report, data) : null), [withBars, rows, report, data])
  const barSeries = (bars?.series || []).map((item, position) => ({
    id: item.id,
    label: headerText(item.group, { t, periodText }) || String(position + 1),
    // report 1 plots the average distance (km in the API): in miles for a miles project; report 2 plots percentages
    data: report.id === 1 ? item.values.map(value => kmToUnit(value, distanceUnit)) : item.values
  }))
  const barLabels = (bars?.labels || []).map(value => cellText(value, t, utils?.parseNumber, distanceUnit))
  // more series than colors: the table alone with a notice, unless they add up (then the chart groups the small ones in «Other»)
  const tooMany = barSeries.length > MAX_SERIES && !bars?.additive
  const decimals = barDecimals(barSeries)
  const formatBar = (value) => {
    const number = Number(value)
    const text = Number.isInteger(number) ? String(number) : trimDecimals(utils.parseNumber(number, { decimal: decimals }))
    // report 1 is km as main says on its axis (mi for a miles project); report 2 plots percentages (its axis said nothing, 2.D2)
    if (report.id === 2) return `${text}%`
    return distanceUnit === 'MI' ? `${text} ${t('MI', 'mi')}` : t('ENTERPRISE_REPORT_KM', '_n_ km').replace('_n_', () => text)
  }
  const xHeader = report.id === 2 ? t('ENTERPRISE_REPORT_2_CHART_X', 'Distance range') : t('ENTERPRISE_REPORT_1_CHART_X', 'Store')

  const emptyText = t('ENTERPRISE_REPORTS_EMPTY', 'No data for this period and filters')
  const actions = (
    <>
      {withBars && (
        <CardAction
          icon={ImageIcon}
          label={`${t('ENTERPRISE_REPORTS_DOWNLOAD_IMAGE', 'Download image')}: ${title}`}
          onClick={() => downloadCanvasImage(imageRef.current, `${reportPngName(report, t)}.png`)}
          disabled={result.loading || result.updating || !bars || barSeries.length === 0 || tooMany}
        />
      )}
      <CardAction
        icon={Download}
        label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`}
        onClick={handleDownloadCsv}
        disabled={result.loading || result.updating || !csv}
      />
    </>
  )

  return (
    <ReportBlock
      title={title}
      loading={result.loading}
      updating={result.updating}
      error={error}
      onRetry={result.retry}
      empty={!rows}
      emptyText={emptyText}
      skeleton={withBars ? <ChartAndRowsSkeleton /> : <RowsSkeleton />}
      actions={actions}
    >
      {bars && barSeries.length > 0 && (
        <div ref={imageRef}>
          {/* the table of the chart is the same data as the visible one: a name of its own, so two tables are never called the same */}
          <SeriesChart
            type='bar'
            title={t('ENTERPRISE_REPORTS_CHART_NAME', 'Chart: _title_').replace('_title_', () => title)}
            xHeader={xHeader}
            labels={barLabels}
            series={barSeries}
            formatValue={formatBar}
            additive={bars.additive}
          />
        </div>
      )}
      <PivotTable
        content={data}
        report={report}
        label={title}
        distanceUnit={distanceUnit}
        periodText={periodText}
        scrollLabel={t('ENTERPRISE_REPORTS_SCROLL_LABEL', '_title_, scrolls sideways').replace('_title_', () => title)}
        emptyText={emptyText}
      />
    </ReportBlock>
  )
}

// ── line charts: 13, 14, 15 ─────────────────────────────────────────────────────────────────────────────────────────────
const LineBlock = ({ report, result, filters }) => {
  const [, t] = useLanguage()
  const [utils] = useUtils() || []
  const periods = usePeriodText()
  const { data, error } = blockOf(result, 0)
  const title = blockTitle(report.id, 0, t)

  const model = useMemo(() => lineModel(report.id, data), [report.id, data])
  // D7: the groups of the range that the API leaves out are 0 on the chart; the labels are the dates of the project, cut to the range
  const axis = useMemo(() => buildAxis(model.labels, filters?.from, filters?.to), [model.labels, filters?.from, filters?.to])
  const clippedOf = (label) => {
    const period = parsePeriodLabel(label)
    // redesign a period outside the range keeps its own dates, never the raw label (see PivotBlock)
    return period && (clipPeriod(period, filters?.from, filters?.to) || period)
  }
  const labelText = (label) => {
    const clipped = clippedOf(label)
    return (clipped && periods.periodText(clipped)) || label
  }
  const labels = axis.labels.map(labelText)
  // the compact form of each label for a narrow axis (a week on two lines, the full label otherwise); only a weekly line has one,
  // a daily or hourly line passes nothing and its axis is as it was
  const compact = axis.labels.map(label => periods.periodAxisText(clippedOf(label)))
  const axisLabels = compact.some(Boolean) ? compact.map((entry, index) => entry || labels[index]) : undefined

  // the name of the series of 13 and 14 is the one of the project (main printed the API's own label); each channel of 15 is a series (RP-14)
  const singleName = report.id === 14 ? t('SALES', 'Sales') : t('ORDERS', 'Orders')
  const series = model.series.map(item => ({
    id: item.id,
    label: report.id === 15 ? (item.unknown ? t('ENTERPRISE_REPORT_UNKNOWN_CHANNEL', 'Unknown') : String(item.label ?? '')) : singleName,
    data: axis.labels.map(label => item.values[label] ?? 0)
  }))

  const formatValue = useCallback(
    report.id === 14 ? value => utils.parsePrice(value) : formatCount,
    [report.id, utils?.parsePrice]
  )

  // the table of the same data, for when the chart has no room for the series (D12)
  const xHeader = t('ENTERPRISE_REPORT_PERIOD', 'Period')
  const fallback = series.length > MAX_SERIES
    ? (
      <PivotTable
        content={seriesTable({ xHeader, labels, series })}
        report={report}
        label={title}
        scrollLabel={t('ENTERPRISE_REPORTS_SCROLL_LABEL', '_title_, scrolls sideways').replace('_title_', () => title)}
      />
      )
    : null

  // D11: the rows as main wrote them (the labels of the API, the values as they came); 15 writes every series, one column per channel after «Time»
  const csv = useMemo(() => {
    if (model.empty) return null
    if (report.id === 15) {
      const names = model.series.map(item => (item.unknown ? t('ENTERPRISE_REPORT_UNKNOWN_CHANNEL', 'Unknown') : String(item.label ?? '')))
      return seriesToCsv([t('TIME', 'Time'), ...names], model.labels.map(label => [label, ...model.series.map(item => item.values[label] ?? 0)]))
    }
    return seriesToCsv(
      [t('TIME', 'Time'), report.id === 14 ? t('SALES', 'Sales') : t('ORDERS', 'Orders')],
      model.series[0].points.map(point => [point.x, point.y])
    )
  }, [model, report.id, t])
  const handleDownloadCsv = () => downloadText(`${report.csv?.files?.[0] ?? ''}${Date.now()}.csv`, csv)

  let total = null
  if (report.id === 13) total = <TotalMetric label={t('ENTERPRISE_REPORT_13_TOTAL', 'Total orders')} value={String(model.total)} />
  if (report.id === 14) total = <TotalMetric label={t('ENTERPRISE_REPORT_14_TOTAL', 'Total sales')} value={utils.parsePrice(Number(model.total.toFixed(2)))} />

  return (
    <ReportBlock
      title={title}
      loading={result.loading}
      updating={result.updating}
      error={error}
      onRetry={result.retry}
      empty={model.empty}
      emptyText={t('ENTERPRISE_REPORTS_EMPTY', 'No data for this period and filters')}
      skeleton={<ChartSkeleton />}
      actions={(
        <CardAction
          icon={Download}
          label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`}
          onClick={handleDownloadCsv}
          disabled={result.loading || result.updating || !csv}
        />
      )}
    >
      {total}
      <SeriesChart type='line' title={title} xHeader={xHeader} labels={labels} axisLabels={axisLabels} series={series} formatValue={formatValue} fallback={fallback} additive={model.additive} />
    </ReportBlock>
  )
}

// ── rankings: 12 and 20 ─────────────────────────────────────────────────────────────────────────────────────────────────
const RankingBlock = ({ report, index, result }) => {
  const [, t] = useLanguage()
  const { data, error } = blockOf(result, index)
  const title = blockTitle(report.id, index, t)
  const rows = useMemo(() => rankingRows(data), [data])

  let names = { name: t('DRIVER', 'Driver'), value: t('ORDERS', 'Orders'), csv: t('DRIVER', 'Driver') }
  if (report.id === 20) {
    names = index === 0
      ? { name: t('PRODUCT', 'Product'), value: t('QUANTITY', 'Quantity'), csv: t('PRODUCTS', 'Products') }
      : { name: t('CATEGORY', 'Category'), value: t('QUANTITY', 'Quantity'), csv: t('CATEGORIES', 'Categories') }
  }

  // auditor 13: the tooltip of main said the average delivery time of the driver; here it is the hint under the name
  const hintOf = (row) => {
    const seconds = toNumber(row?.info?.[0]?.value)
    if (report.id !== 12 || seconds === null) return undefined
    const [before, after] = t('ENTERPRISE_REPORT_12_AVERAGE_TIME', 'Average delivery time: _time_').split('_time_')
    return <>{before}<span className='odc-figure'><bdi>{formatDurationSigned(t, seconds)}</bdi></span>{after ?? ''}</>
  }
  const items = rows.map((row, position) => ({ id: position, name: row.y, value: row.x, hint: hintOf(row) }))

  const csv = rows.length > 0 ? seriesToCsv([names.csv, t('ORDERS', 'Orders')], rows.map(row => [row.y, row.x])) : null
  const handleDownloadCsv = () => downloadText(`${report.csv?.files?.[index] ?? ''}${Date.now()}.csv`, csv)

  return (
    <ReportBlock
      title={title}
      loading={result.loading}
      updating={result.updating}
      error={error}
      onRetry={result.retry}
      empty={rows.length === 0}
      emptyText={t('ENTERPRISE_REPORTS_EMPTY', 'No data for this period and filters')}
      skeleton={<RowsSkeleton />}
      actions={(
        <CardAction
          icon={Download}
          label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`}
          onClick={handleDownloadCsv}
          disabled={result.loading || result.updating || !csv}
        />
      )}
    >
      <BarList label={title} items={items} nameHeader={names.name} valueHeader={names.value} />
    </ReportBlock>
  )
}

// ── satisfaction: 16 ─────────────────────────────────────────────────────────────────────────────────────────────────────
// the names of the five categories the API sends (one literal t() each); `API_GENERAL` is the general note
const SCORE_NAMES = {
  general: t => t('GENERAL', 'General'),
  quality: t => t('QUALITY', 'Quality'),
  delivery: t => t('DELIVERY', 'Delivery'),
  service: t => t('SERVICE', 'Service'),
  package: t => t('PACKAGE', 'Package')
}

const SatisfactionBlock = ({ report, result }) => {
  const [, t] = useLanguage()
  const { data, error } = blockOf(result, 0)
  const title = blockTitle(report.id, 0, t)
  const model = useMemo(() => satisfactionModel(data), [data])

  // RP-04: this CSV does download now (main's guard looked at a path that never exists). The category is written with its name, not the key of the API.
  const csv = model.rows.length > 0
    ? seriesToCsv(
      [t('CATEGORY', 'Category'), t('MARK', 'Mark')],
      model.rows.map(row => [satisfactionKey(row.x) ? SCORE_NAMES[satisfactionKey(row.x)](t) : row.x, row.y])
    )
    : null
  const handleDownloadCsv = () => downloadText(`${report.csv?.files?.[0] ?? ''}${Date.now()}.csv`, csv)

  return (
    <ReportBlock
      title={title}
      loading={result.loading}
      updating={result.updating}
      error={error}
      onRetry={result.retry}
      empty={!model.hasScores}
      emptyText={t('ENTERPRISE_REPORTS_EMPTY', 'No data for this period and filters')}
      skeleton={<RowsSkeleton rows={5} />}
      actions={(
        <CardAction
          icon={Download}
          label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`}
          onClick={handleDownloadCsv}
          disabled={result.loading || result.updating || !csv}
        />
      )}
    >
      <SatisfactionScores scores={model.scores} />
    </ReportBlock>
  )
}

// ── the schedule of the drivers: 7 ───────────────────────────────────────────────────────────────────────────────────────
const TimelineBlock = ({ report, result, filters }) => {
  const [, t] = useLanguage()
  const imageRef = useRef(null)
  const { data, error } = blockOf(result, 0)
  const title = blockTitle(report.id, 0, t)
  const model = useMemo(() => timelineModel(data, filters?.timeZone || 'UTC'), [data, filters?.timeZone])
  const empty = model.size === 0

  return (
    <ReportBlock
      title={title}
      loading={result.loading}
      updating={result.updating}
      error={error}
      onRetry={result.retry}
      empty={empty}
      emptyText={t('ENTERPRISE_REPORT_7_EMPTY', 'No shifts on this day')}
      skeleton={<ChartSkeleton />}
      actions={(
        <CardAction
          icon={ImageIcon}
          label={`${t('ENTERPRISE_REPORTS_DOWNLOAD_IMAGE', 'Download image')}: ${title}`}
          onClick={() => downloadCanvasImage(imageRef.current, `${reportPngName(report, t)}.png`)}
          disabled={result.loading || result.updating || empty}
        />
      )}
    >
      <div ref={imageRef}>
        <ReportTimeline model={model} filters={filters} />
      </div>
    </ReportBlock>
  )
}

// ── the map: 9 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const MapBlock = ({ report, result }) => {
  const [, t] = useLanguage()
  const { data, error } = blockOf(result, 0)
  const title = blockTitle(report.id, 0, t)
  const empty = !Array.isArray(data?.locations) || data.locations.length === 0

  return (
    <ReportBlock
      title={title}
      loading={result.loading}
      updating={result.updating}
      error={error}
      onRetry={result.retry}
      empty={empty}
      emptyText={t('ENTERPRISE_REPORT_9_EMPTY', 'No orders to show on the map')}
      skeleton={<MapSkeleton />}
    >
      <ReportHeatMap data={data} />
    </ReportBlock>
  )
}

/**
 * The body of the open report. `report` is the registry's entry (`getAdvancedReport`), `result` what `useAdvancedReport` returns
 * (`{ data, data1, loading, updating, error, error1, retry }`) and `filters` the ones that were sent (`from`, `to` in `YYYY-MM-DD`, `timeZone`).
 * The page mounts it with `key={report.id}`: the hook keeps the data of the previous load while the next arrives, so a body of another report
 * must never be handed them.
 */
export const ReportBody = ({ report, result, filters }) => {
  if (!report || !result) return null
  const props = { report, result, filters }
  let blocks = null
  switch (report.body) {
    case 'pivot':
      blocks = <PivotBlock {...props} index={0} />
      break
    case 'pivot2':
      blocks = (
        <>
          <PivotBlock {...props} index={0} />
          <PivotBlock {...props} index={1} />
        </>
      )
      break
    case 'line':
      blocks = <LineBlock {...props} />
      break
    case 'ranking':
      blocks = <RankingBlock {...props} index={0} />
      break
    case 'ranking2':
      blocks = (
        <>
          <RankingBlock {...props} index={0} />
          <RankingBlock {...props} index={1} />
        </>
      )
      break
    case 'satisfaction':
      blocks = <SatisfactionBlock {...props} />
      break
    case 'timeline':
      blocks = <TimelineBlock {...props} />
      break
    case 'map':
      blocks = <MapBlock {...props} />
      break
    default:
      return null
  }
  return <div className='odc-rp-body' data-columns={report.body === 'ranking2' ? 'two' : undefined}>{blocks}</div>
}
