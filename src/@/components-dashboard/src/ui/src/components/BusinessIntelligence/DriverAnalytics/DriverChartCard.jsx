import React, { useMemo, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { downloadCsv, toCsv } from '../../../../../utils/businessReports'
import { Dialog, Skeleton } from '../../Shared/Product'
// by file, so the chart library (Chart.js) is not pulled into every page that imports the Product barrel
import { Chart } from '../../Shared/Product/Chart'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Download, Maximize2 } from '../../Shared/Icon'
import { CardAction, ReportCard } from '../AnalyticsKit'
import '../BusinessAnalytics/business-analytics.css'

// redesign drivers FC2 (D6; DR-07, DR-14, DR-15): the one card of the five charts of /intelligence/drivers (orders, sales, availability,
// busy time and times by day). It paints what the sections give it: the labels of the axis (already written with the project's formats,
// never ISO, decision 13), the series, the rows of the CSV of `main`, and the state of the block. «Expand» and «Download CSV» are really
// `disabled` while it loads, after an error or without rows (DR-07). The model is `TrendCard` of Business, which draws one series from
// one kind of rows; the drivers' charts need several series on an axis the section already computed.

/**
 * One chart card.
 *
 * - `block`: `{ loading, error, data }` of the controller. `empty`: the chart has no rows to draw.
 * - `type`: `line` or `bar`. `labels`: one text per point of the axis. `series`: `[{ id, label, data }]`, up to six (the palette of the chart).
 * - `formatValue(value)` writes the Y axis, the tooltip and the table. `xHeader` is the header of the first column of the table.
 * - `fileName` and `header` are the ones of `main`'s CSV; `rows` are its rows, as arrays of values (`toCsv` quotes what needs it).
 * - `durationTicks` (redesign , row 72 Q-08): the values are seconds, so the Y axis steps by a human duration (see `Chart`).
 * - redesign every chart takes `toggleSeries`, so a click on a legend entry hides that series and the axis rescales (the native
 *   legend of `main` did; Times needs it because «Completed» reaches days and flattens the rest).
 */
export const DriverChartCard = ({ title, block, empty, type = 'line', labels, series, formatValue, xHeader, fileName, header, rows, onRetry, durationTicks = false }) => {
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  const [expanded, setExpanded] = useState(false)

  const loading = Boolean(block?.loading)
  const error = block?.error
  const table = useMemo(() => ({ caption: title, xHeader }), [title, xHeader])

  // redesign drivers FC2 (DR-07): nothing to enlarge or download while it loads, after an error or without rows
  const unavailable = loading || Boolean(error) || empty

  const handleDownload = () => {
    downloadCsv(`${fileName}_${Date.now()}.csv`, toCsv(header, rows))
  }

  const actions = (
    <>
      <CardAction icon={Maximize2} label={`${t('EXPAND', 'Expand')}: ${title}`} onClick={() => setExpanded(true)} disabled={unavailable} />
      <CardAction icon={Download} label={`${t('DOWNLOAD_CSV', 'Download CSV')}: ${title}`} onClick={handleDownload} disabled={unavailable} />
    </>
  )

  const chart = (size) => (
    <Chart type={type} label={title} labels={labels} series={series} formatValue={formatValue} table={table} size={size} durationTicks={durationTicks} toggleSeries />
  )

  return (
    <>
      <ReportCard
        title={title}
        actions={actions}
        loading={loading}
        error={error}
        onRetry={onRetry}
        empty={empty}
        skeleton={<Skeleton size='100%' block={isPhone ? 'var(--od-x-chart-height-compact)' : 'var(--od-x-chart-height)'} />}
      >
        {chart(isPhone ? 'compact' : 'default')}
      </ReportCard>
      {/* redesign drivers R1 (F2): the class gives the dialog the size of the modal of `main` (driver-analytics.css), so «Expand» enlarges */}
      <Dialog open={expanded} onOpenChange={setExpanded} title={title} size='lg' className='odc-bi-chart-dialog' closeLabel={t('CLOSE', 'Close')}>
        {expanded && chart('default')}
      </Dialog>
    </>
  )
}
