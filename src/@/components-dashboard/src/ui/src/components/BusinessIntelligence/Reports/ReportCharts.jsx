import React, { useMemo } from 'react'

import { useLanguage } from '../../../../../index'
import { InlineNotice, Metric } from '../../Shared/Product'
// by file, so the chart library (Chart.js) is not pulled into every page that imports the Product barrel
import { Chart } from '../../Shared/Product/Chart'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Info } from '../../Shared/Icon'
import { MAX_SERIES, groupSmallSeries } from './reportBodyData'
import './report-body.css'

// redesign reports FC2 (D7, D12, P8; RP-14): the charts of the reports on `P/Chart`. One component draws a line or a bar chart from the series the
// body hands over; with more series than colors (D12) it draws no chart (a notice says so and the table of the same data takes its place), unless the
// series add up: then it draws the largest and «Other» (P8, D-32).

/**
 * The figure of the period of reports 13 and 14 (what main added up under the chart): a `P/Metric` with its figure in an isolated
 * `.odc-figure` (decision 11). It is a `div`: it does not sit in a list of figures.
 */
export const TotalMetric = ({ label, value }) => (
  <Metric
    as='div'
    className='odc-rp-total'
    label={label}
    value={<span className='odc-figure'><bdi>{value}</bdi></span>}
  />
)

/**
 * A chart of `type` ('line' or 'bar') with the series `[{ id, label, data }]` over `labels` (text already written by the caller: periods in
 * the dates of the project, names). `title` names the chart; `xHeader` heads the first column of its table; `formatValue` writes the axis, the tooltip and
 * the table. The table of `P/Chart` is part of the chart (hidden, always in the DOM).
 *
 * With more than `MAX_SERIES` series `P/Chart` would throw (D12). When the series do not add up (`additive` false: averages, percentages, durations)
 * the chart is not drawn, a notice says «The chart shows up to 6 series. See the table.» and `fallback` (the table, when the page does not paint it
 * already) goes under it. When they do add up (`additive`: orders, sales, users) the chart draws the largest ones and «Other», which sums the rest at
 * each label (redesign , row 6, P8, D-32); a note says so and `fallback` still lists every series under the chart.
 * `axisLabels` (optional, ) is the compact form of `labels` for a narrow X axis, passed as is to `P/Chart`.
 */
export const SeriesChart = ({ type, title, xHeader, labels, series, formatValue, fallback, additive = false, axisLabels }) => {
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  const otherLabel = t('OTHER', 'Other')
  const tooMany = series.length > MAX_SERIES
  const grouped = tooMany && additive
  const drawn = useMemo(() => (grouped ? groupSmallSeries(series, otherLabel) : series), [grouped, series, otherLabel])
  // the table of the grouped chart is not the full one under it: a name of its own, so two tables are never called the same
  const caption = grouped && fallback ? t('ENTERPRISE_REPORTS_CHART_NAME', 'Chart: _title_').replace('_title_', () => title) : title
  const table = useMemo(() => ({ caption, xHeader }), [caption, xHeader])

  if (tooMany && !additive) {
    return (
      <>
        <InlineNotice tone='info' icon={Info} className='odc-rp-chart-limit'>
          {t('ENTERPRISE_REPORTS_CHART_LIMIT', 'The chart shows up to 6 series. See the table.')}
        </InlineNotice>
        {fallback}
      </>
    )
  }

  const chart = (
    <Chart
      type={type}
      label={title}
      labels={labels}
      axisLabels={axisLabels}
      series={drawn}
      formatValue={formatValue}
      table={table}
      size={isPhone ? 'compact' : 'default'}
      // redesign a click on a legend entry hides that series, as the native legend of `main` did
      toggleSeries
    />
  )
  if (!grouped) return chart

  return (
    <>
      <InlineNotice tone='info' icon={Info} className='odc-rp-chart-limit'>
        {t('ENTERPRISE_REPORTS_CHART_GROUPED', 'The smaller series are grouped in “_other_”. The table lists all of them.').replace('_other_', () => otherLabel)}
      </InlineNotice>
      {chart}
      {fallback}
    </>
  )
}
