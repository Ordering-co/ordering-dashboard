/* eslint-disable import/first */
// `useUtils` formats are the ones of a project («D MMM» for a short date, «HH:mm» for a time, «$1.00» for a price).
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ charts: [], map: null, configs: {}, user: {}, downloads: [], clicks: [] }))

vi.mock('react-chartjs-2', () => ({
  Line: props => { runtime.charts.push({ kind: 'line', props }); return <canvas data-testid='line-chart' aria-label={props['aria-label']} /> },
  Bar: props => { runtime.charts.push({ kind: 'bar', props }); return <canvas data-testid='bar-chart' aria-label={props['aria-label']} /> }
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  const moment = (await import('moment')).default
  return {
    GoogleMapsMap: props => { runtime.map = props; return react.createElement('div', { 'data-testid': 'google-map', 'data-heat': String(props.isHeat) }) },
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
    useConfig: () => [{ configs: runtime.configs }],
    useSession: () => [{ user: runtime.user }],
    useUtils: () => [{
      parsePrice: value => `$${Number(value).toFixed(2)}`,
      parseNumber: (value, options) => Number(value).toFixed(options?.decimal ?? 2),
      // the project's format: «D MMM» for a short date, «D MMM YYYY» for a date, «HH:mm» for a time
      parseDate: (date, options = {}) => {
        const instant = moment(date, options.inputFormat || 'YYYY-MM-DD HH:mm:ss')
        if (options.timeOnly) return instant.format('HH:mm')
        if (options.dateOnly) return instant.format(options.omitYear ? 'D MMM' : 'D MMM YYYY')
        return instant.format('D MMM YYYY HH:mm')
      }
    }]
  }
})

// what the page would save: the name and the text of each download
vi.mock('../../../../../../utils/advancedReportsCsv', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadText: (name, text) => { runtime.downloads.push({ name, text }) }
}))

import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'
import { getAdvancedReport } from '../../../../../../utils/advancedReports'
import { pivotToCsv } from '../../../../../../utils/advancedReportsCsv'
import { clipPeriod, parsePeriodLabel } from '../../../../../../utils/reportPeriods'
import { ReportBody } from '../ReportBody'
import { barDecimals } from '../reportBodyData'
import { usePeriodText } from '../usePeriodText'

const dir = path.join(__dirname, '..')

const h = (value, colspan = 1) => ({ value, colspan })
const c = (value, unit, refers, colspan = 1) => ({ value, colspan, value_unit: unit, value_refers: refers })
const table = (header, body, footer = []) => ({ header: { rows: header }, body: { rows: body }, footer: { rows: footer } })

// report 3 (business_spend_times): two groups of six columns
const week3 = (orders, sales, a, b, d, total) => [c(orders, 'number', 'quantity'), c(sales, 'currency', 'money'), c(a, 'seconds', 'time'), c(b, 'seconds', 'time'), c(d, 'seconds', 'time'), c(total, 'seconds', 'time')]
const heads3 = () => [h('Orders'), h('Sales'), h('API_REPORT_HEADER_SPEND_4_TO_3'), h('API_REPORT_HEADER_SPEND_3_TO_9'), h('API_REPORT_HEADER_SPEND_9_TO_11'), h('Time between business acceptance and delivery completion')]
const REPORT_3 = table(
  [[h('Business', 2), h('Week 2026-39', 6), h('Week 2026-40', 6)], [h('ID'), h('Name'), ...heads3(), ...heads3()]],
  [
    [c(202, 'number', 'id'), c('Example Store A', 'text', 'business'), ...week3(1, 14.05, null, null, 1, 157581), ...week3(1, 76.5, 113, 7, 300, 432)],
    [c(209, 'number', 'id'), c('Example Store B', 'text', 'business'), ...week3(0, 0, null, null, null, null), ...week3(16, 587.58, -4439, 5, 115, 1002)]
  ]
)

// report 8: one table per request, each with its own rows
const heads8 = () => [h('Orders'), h('Sales'), h('API_REPORT_HEADER_REJECTED'), h('API_REPORT_HEADER_REJECTED_PERCENTAGE')]
const week8 = (orders, sales) => [c(orders, 'number', 'quantity'), c(sales, 'currency', 'money'), c(0, 'number', 'quantity'), c(0, 'number', 'percentage')]
const REPORT_8_BUSINESS = table(
  [[h('Businesses', 2), h('Week 2026-39', 4), h('Week 2026-40', 4)], [h('ID'), h('Name'), ...heads8(), ...heads8()]],
  [[c(202, 'number', 'id'), c('Example Store A', 'text', 'business'), ...week8(1, 14.05), ...week8(2, 106)]]
)
const REPORT_8_FRANCHISE = table(
  [[h('Franchises', 2), h('Week 2026-39', 4), h('Week 2026-40', 4)], [h('ID'), h('Name'), ...heads8(), ...heads8()]],
  [[c(1, 'number', 'id'), c('Example Franchise', 'text', 'franchise'), ...week8(1, 14.05), ...week8(2, 106)]]
)

// report 1: km with two decimals; the weeks are the series of the chart
const REPORT_1 = table(
  [[h('Business', 2), h('Week 2026-39'), h('Week 2026-40')], [h('ID'), h('Name'), h('Average Distance'), h('Average Distance')]],
  [
    [c(202, 'number', 'id'), c('Example Store A', 'text', 'business'), c(0, 'number', 'average'), c(2.5, 'number', 'average')],
    [c(209, 'number', 'id'), c('Example Store B', 'text', 'business'), c(null, 'number', 'average'), c(0, 'number', 'average')]
  ],
  [[h('Total', 2), c(0, 'number', 'average'), c(1.25, 'number', 'average')]]
)
// the same report with seven weeks: more series than the chart has colors
const WEEKS_7 = ['Week 2026-30', 'Week 2026-31', 'Week 2026-32', 'Week 2026-33', 'Week 2026-34', 'Week 2026-35', 'Week 2026-36']
const REPORT_1_SEVEN_WEEKS = table(
  [[h('Business', 2), ...WEEKS_7.map(label => h(label))], [h('ID'), h('Name'), ...WEEKS_7.map(() => h('Average Distance'))]],
  [[c(202, 'number', 'id'), c('Example Store A', 'text', 'business'), ...WEEKS_7.map((_, i) => c(i, 'number', 'average'))]]
)

// report 2: the cells call distance what is a count; the chart draws the percentage columns
const REPORT_2 = table(
  [[h('Distance'), h('Week 2026-39', 2), h('Week 2026-40', 2)], [h('Distance'), h('Orders'), h('Percentage'), h('Orders'), h('Percentage')]],
  [
    [h('Between 0 to 1'), c(1, 'km', 'distance'), c(100, 'number', 'percentage'), c(5, 'km', 'distance'), c(100, 'number', 'percentage')],
    [h('Between 1 to 1.5'), c(0, 'km', 'distance'), c(0, 'number', 'percentage'), c(0, 'km', 'distance'), c(0, 'number', 'percentage')]
  ]
)

// the charts: 13 and 14 have one series, 15 has a list and an object with numeric keys
const labelsOf = labels => ({ title: 'Report header date/time', value_type: 'datetime', labels })
const SERIES = (id, label, points, labels) => ({ type: 'chart', dataset: { x: labelsOf(labels), y: { title: id }, dataset: { label, data: points } } })
const REPORT_13 = SERIES('Orders', 'Orders', [{ x: 'Week 2026-39', y: 4 }, { x: 'Week 2026-41', y: 16 }], ['Week 2026-39', 'Week 2026-41'])
const REPORT_14 = SERIES('Sales', 'Sales', [{ x: 'Week 2026-39', y: 113.05 }, { x: 'Week 2026-40', y: 587.58 }], ['Week 2026-39', 'Week 2026-40'])
const REPORT_15 = {
  type: 'char',
  sub_type: 'bar',
  dataset: {
    x: labelsOf(['Week 2026-39', 'Week 2026-40']),
    y: { title: 'Report header users' },
    dataset: [
      { label: 'unknow', data: [{ x: 'Week 2026-39', y: 1 }] },
      { label: 'App Marketplace', data: { 1: { x: 'Week 2026-40', y: 3 } } },
      { label: 'orderingplus v26.1', data: { 2: { x: 'Week 2026-40', y: 16 } } }
    ]
  }
}
const REPORT_15_EIGHT_CHANNELS = {
  type: 'char',
  dataset: {
    x: labelsOf(['Week 2026-39']),
    dataset: Array.from({ length: 8 }, (_, i) => ({ label: `Channel ${i + 1}`, data: [{ x: 'Week 2026-39', y: i + 1 }] }))
  }
}

// the rankings
const info = seconds => [{ label: 'Time between business acceptance and delivery completion', value_unit: 'seconds', value_refers: 'time', value: seconds }]
const REPORT_12 = { type: 'chart', dataset: { dataset: { label: 'Quantity', data: [{ x: 3, y: 'Example Driver A', info: info('364.0000000000000000') }, { x: 1, y: 'Example Driver B', info: info('4439') }] } } }
const REPORT_20_PRODUCTS = { type: 'chart', dataset: { dataset: { label: 'Report header quantity', data: [{ x: 7, y: 'Example Product A' }, { x: 4, y: 'Example Product B' }] } } }
const REPORT_20_CATEGORIES = { type: 'chart-bar', dataset: { dataset: { label: 'Report header quantity', data: [{ x: 7, y: 'Example Category A' }, { x: 4, y: 'Example Category B' }] } } }
const REPORT_16 = {
  type: 'char',
  dataset: {
    dataset: [{
      label: 'Report header qualification',
      data: [{ x: 'Quality', y: '5.00' }, { x: 'Delivery', y: '4.00' }, { x: 'Service', y: '3.50' }, { x: 'Package', y: '5.00' }, { x: 'API_GENERAL', y: '4.50' }]
    }]
  }
}

// report 7 and 9
const day = (from, to, value) => ({ from, to, value })
const REPORT_7 = {
  type: 'timeline',
  from: '2026-10-10 00:00:00',
  to: '2026-10-10 23:59:00',
  data: [{
    metadata: { name: 'Example Driver A' },
    lines: [
      { label_key: 'REPORT_HEADER_AVAILABLE', ranges: [day('2026-10-10 09:00:00', '2026-10-10 12:30:00', true), day('2026-10-10 12:30:00', '2026-10-10 13:00:00', false)] },
      { label_key: 'REPORT_HEADER_BUSY', ranges: [day('2026-10-10 10:00:00', '2026-10-10 11:00:00', true)] }
    ]
  }]
}
// the same shift written as instants: the table must show the hours of the chosen time zone (Chicago, UTC-5 in October)
const REPORT_7_INSTANTS = {
  type: 'timeline',
  from: '2026-10-10 00:00:00',
  to: '2026-10-10 23:59:00',
  data: [{
    metadata: { name: 'Example Driver C' },
    lines: [{ label_key: 'REPORT_HEADER_AVAILABLE', ranges: [day('2026-10-10T14:00:00Z', '2026-10-10T17:30:00Z', true)] }]
  }]
}
const REPORT_9 = { locations: [{ lat: 0.25, lng: -0.25 }, { lat: 0.5, lng: 0.75 }], zones: [] }

const FILTERS = { from: '2026-10-03', to: '2026-10-10', timeZone: 'America/Chicago' }

const result = (overrides = {}) => ({ data: null, data1: null, loading: false, updating: false, error: null, error1: null, retry: vi.fn(), ...overrides })
const renderBody = (id, overrides = {}, filters = FILTERS) => {
  const outcome = result(overrides)
  const view = render(<ReportBody report={getAdvancedReport(id)} result={outcome} filters={filters} />)
  return { ...view, outcome }
}

const normal = node => node.textContent.replace(/\s+/g, ' ').trim()
const card = name => screen.getByRole('region', { name })
const charts = kind => runtime.charts.filter(chart => chart.kind === kind).map(chart => chart.props)
const lastChart = kind => charts(kind).pop()
const clickCsv = async name => { await userEvent.click(screen.getByRole('button', { name })) }
const rowsOf = node => within(node).getAllByRole('row').map(row => [...row.children].map(normal))

beforeEach(() => {
  runtime.charts = []
  runtime.map = null
  runtime.configs = { google_maps_api_key: { value: 'key' } }
  runtime.user = {}
  runtime.downloads = []
  runtime.clicks = []
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,AAA')
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click () { runtime.clicks.push({ href: this.href, download: this.download }) })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── tables (pivot, pivot2) ────────────────────────────────────────────────────────────────────────────────────────
describe('a report table (pivot)', () => {
  it('paints the table in a block of level 2 with the weeks cut to the period and a download of the block', async () => {
    renderBody(3, { data: REPORT_3 })
    expect(screen.getByRole('heading', { level: 2, name: 'Service times' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Service times' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Service times, scrolls sideways' })).toHaveAttribute('tabindex', '0')
    // D7: the weeks of the API in the dates of the project, the first cut to the period
    expect(screen.getByText('Week 39 · 3 Oct')).toBeInTheDocument()
    expect(screen.getByText('Week 40 · 4 Oct – 10 Oct')).toBeInTheDocument()
    expect(screen.queryByText('Week 2026-39')).toBeNull()

    await clickCsv('Download CSV: Service times')
    expect(runtime.downloads).toHaveLength(1)
    // D11: the name of main (service_times_) and the CSV of this block, with the values as they come
    expect(runtime.downloads[0].name).toMatch(/^service_times_\d+\.csv$/)
    expect(runtime.downloads[0].text).toBe(pivotToCsv(REPORT_3))
    expect(runtime.downloads[0].text).toContain('Week 2026-39')
    expect(runtime.downloads[0].text).toContain('157581')
  })

  // redesign the same week outside the period in the header of a table: its own dates, not the raw label
  it('writes a week the API numbers outside the period with its own dates in a table header', () => {
    const outside = table([[h('Business', 2), h('Week 2026-37', 1)], [h('ID'), h('Name'), h('Orders')]], [[c(202, 'number', 'id'), c('Example Store A', 'text', 'business'), c(1, 'number', 'quantity')]])
    renderBody(3, { data: outside }, { ...FILTERS, from: '2026-09-20', to: '2026-10-20' })
    expect(screen.getByText('Week 37 · 13 Sep – 19 Sep')).toBeInTheDocument()
    expect(screen.queryByText('Week 2026-37')).toBeNull()
  })

  it('has the right file name in the reports where main got it wrong (11, 17, 21)', async () => {
    const one = table([[h('Name'), h('Orders')]], [[c('Cash', 'text', 'name'), c(3, 'number', 'quantity')]])
    const names = { 11: 'driver_spent_times_', 17: 'paymethod_sales_', 21: 'sla_orders_' }
    for (const [id, prefix] of Object.entries(names)) {
      runtime.downloads = []
      const { unmount } = renderBody(Number(id), { data: one })
      await userEvent.click(screen.getByRole('button', { name: /^Download CSV/ }))
      expect(runtime.downloads[0].name.startsWith(prefix), id).toBe(true)
      unmount()
    }
  })

  it('disables the download without rows, with the empty text of D13', () => {
    renderBody(3, { data: table([[h('Name')]], []) })
    expect(screen.getByText('No data for this period and filters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download CSV: Service times' })).toBeDisabled()
  })

  it('has two blocks in report 8 and each downloads its own table, with the $ of main (RP-04, D11)', async () => {
    renderBody(8, { data: REPORT_8_BUSINESS, data1: REPORT_8_FRANCHISE })
    expect(screen.getAllByRole('heading', { level: 2 }).map(normal)).toEqual(['By store', 'By brand'])
    expect(within(card('By store')).getByText('Example Store A')).toBeInTheDocument()
    expect(within(card('By brand')).getByText('Example Franchise')).toBeInTheDocument()

    await clickCsv('Download CSV: By brand')
    expect(runtime.downloads[0].name).toMatch(/^franchise_orders_count_sales_\d+\.csv$/)
    expect(runtime.downloads[0].text).toBe(pivotToCsv(REPORT_8_FRANCHISE, { currencySuffix: '$' }))
    expect(runtime.downloads[0].text).toContain('Example Franchise')
    expect(runtime.downloads[0].text).not.toContain('Example Store A')
    expect(runtime.downloads[0].text).toContain('106$')

    await clickCsv('Download CSV: By store')
    expect(runtime.downloads[1].name).toMatch(/^business_orders_count_sales_\d+\.csv$/)
    expect(runtime.downloads[1].text).toContain('Example Store A')
    expect(runtime.downloads[1].text).not.toContain('Example Franchise')
  })

  it('has two blocks in report 18 and the second one downloads the order types (RP-04)', async () => {
    const sites = table([[h('Report header sites', 2), h('Week 2026-39', 3)], [h('ID'), h('Name'), h('Orders'), h('Sales'), h('API_REPORT_HEADER_AVERAGE_TICKET')]], [[c(134, 'number', 'id'), c('Example Site', 'text', 'site'), c(3, 'number', 'quantity'), c(99, 'currency', 'money'), c(33, 'currency', 'money')]])
    const types = table([[h('Report header order types', 2), h('Week 2026-39', 3)], [h('ID'), h('Name'), h('Orders'), h('Sales'), h('API_REPORT_HEADER_AVERAGE_TICKET')]], [[c(1, 'number', 'id'), c('Delivery', 'text', 'order_type'), c(4, 'number', 'quantity'), c(113.05, 'currency', 'money'), c(28.26, 'currency', 'money')]])
    renderBody(18, { data: sites, data1: types })
    expect(screen.getAllByRole('heading', { level: 2 }).map(normal)).toEqual(['By site', 'By order type'])
    // the markers of the API pass to names of the project (D8)
    expect(within(card('By site')).getByRole('columnheader', { name: 'Site' })).toBeInTheDocument()
    expect(within(card('By order type')).getByRole('columnheader', { name: 'Order type' })).toBeInTheDocument()

    await clickCsv('Download CSV: By order type')
    expect(runtime.downloads[0].name).toMatch(/^order_type_sales_average_\d+\.csv$/)
    expect(runtime.downloads[0].text).toContain('Delivery')
    expect(runtime.downloads[0].text).not.toContain('Example Site')
    expect(runtime.downloads[0].text).toContain('113.05$')
  })
})

// ── reports 1 and 2: table + bars ──────────────────────────────────────────────────────────────────────────────────
describe('reports 1 and 2: the table and the bars', () => {
  it('draws one series per week with the stores as labels, km on the axis, and the table below (report 1)', () => {
    renderBody(1, { data: REPORT_1 })
    const bars = lastChart('bar')
    expect(bars.data.labels).toEqual(['Example Store A', 'Example Store B'])
    expect(bars.data.datasets.map(set => set.label)).toEqual(['Week 39 · 3 Oct', 'Week 40 · 4 Oct – 10 Oct'])
    expect(bars.data.datasets.map(set => set.data)).toEqual([[0, null], [2.5, 0]])
    // «km» on the axis, as main
    expect(bars.options.scales.y.ticks.callback(2)).toBe('2 km')
    expect(bars.options.scales.y.ticks.callback(2.5)).toBe('2.50 km')
    // two tables with the same data, and each with a name of its own
    expect(screen.getByRole('table', { name: 'Average distance' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Chart: Average distance' })).toBeInTheDocument()
    // D8: km with two decimals in the table, as main
    expect(within(card('Average distance')).getByText('2.50')).toBeInTheDocument()
  })

  // Tiny synthetic averages need more axis precision than the table.
  it('writes the marks of the axis with the decimals the size of the averages needs, in km (report 1)', () => {
    const tiny = table(
      [[h('Business', 2), h('Week 2026-40')], [h('ID'), h('Name'), h('Average Distance')]],
      [
        [c(202, 'number', 'id'), c('Example Store A', 'text', 'business'), c(0, 'number', 'average')],
        [c(242, 'number', 'id'), c('Example Store C', 'text', 'business'), c(0.00047, 'number', 'average')]
      ]
    )
    renderBody(1, { data: tiny })
    const tick = lastChart('bar').options.scales.y.ticks.callback
    // the marks Chart.js picks for that peak (a step of 0.00005): each one says its own value
    const marks = [0.00005, 0.0001, 0.00015, 0.0002, 0.0004, 0.00045, 0.0005].map(value => tick(value))
    expect(marks).toEqual(['0.00005 km', '0.0001 km', '0.00015 km', '0.0002 km', '0.0004 km', '0.00045 km', '0.0005 km'])
    expect(tick(0)).toBe('0 km')
    // the tooltip and the table of the chart use the same text: the average is not «0.00 km»
    expect(tick(0.00047)).toBe('0.00047 km')
    // D8: the visible table keeps km with two decimals, as main: the row of the 0.00047 average says «0.00»
    const row = within(screen.getByRole('table', { name: 'Average distance' })).getByRole('row', { name: /Example Store C/ })
    expect(within(row).getByText('0.00')).toBeInTheDocument()
    expect(within(row).queryByText(/0\.0004/)).toBeNull()
  })

  // review r1 (low): the peak is read without spreading every value into Math.max, which throws past ~125k arguments
  it('finds the decimals of a report with very many bars without throwing', () => {
    const data = Array.from({ length: 200000 }, (_, index) => (index === 7 ? 0.00047 : 0))
    expect(barDecimals([{ data }])).toBe(5)
    expect(barDecimals([{ data: [] }, { data: [null, Number.NaN, 2.5] }])).toBe(2)
    expect(barDecimals([{ data: [-0.004] }])).toBe(4)
  })

  it('keeps two decimals on the axis when the averages are whole kilometres or more (report 1)', () => {
    renderBody(1, { data: REPORT_1 })
    const tick = lastChart('bar').options.scales.y.ticks.callback
    expect(tick(0.25)).toBe('0.25 km')
    expect(tick(1.5)).toBe('1.50 km')
  })

  it('draws the percentage columns of report 2, with the ranges written as «0–1 km» and % on the axis', () => {
    renderBody(2, { data: REPORT_2 })
    const bars = lastChart('bar')
    expect(bars.data.labels).toEqual(['0–1 km', '1–1.5 km'])
    expect(bars.data.datasets.map(set => set.data)).toEqual([[100, 0], [100, 0]])
    expect(bars.options.scales.y.ticks.callback(50)).toBe('50%')
    // D8: the cells that the API calls distance are counts here
    expect(within(card('Orders by distance range')).getAllByText('5').length).toBeGreaterThan(0)
  })

  it('shows the table alone with a notice when there are more than 6 series (D12, P8)', () => {
    renderBody(1, { data: REPORT_1_SEVEN_WEEKS }, { ...FILTERS, from: '2026-07-26', to: '2026-09-12' })
    expect(screen.getByText('The chart shows up to 6 series. See the table.')).toBeInTheDocument()
    expect(charts('bar')).toHaveLength(0)
    expect(screen.getByRole('table', { name: 'Average distance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download image: Average distance' })).toBeDisabled()
  })

  it('downloads the image of the canvas of the block with the name of main (1, 2)', async () => {
    renderBody(1, { data: REPORT_1 })
    await userEvent.click(screen.getByRole('button', { name: 'Download image: Average distance' }))
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/png')
    expect(runtime.clicks).toEqual([{ href: 'data:image/png;base64,AAA', download: 'Distance per brand.png' }])
  })

  it('downloads the image of report 2 with its own name', async () => {
    renderBody(2, { data: REPORT_2 })
    await userEvent.click(screen.getByRole('button', { name: 'Download image: Orders by distance range' }))
    expect(runtime.clicks[0].download).toBe('Orders delivery.png')
  })
})

// redesign (row 4, intelligence-reports P4, D-30): the distances are written in the unit of the project (the rule of `parseDistance`)
describe('distances in the unit of the project (1, 2 and 10)', () => {
  const MILES = { distance_unit: { value: 'mi' } }
  const REPORT_10 = table(
    [[h('Driver', 2), h('Week 2026-40')], [h('ID'), h('Name'), h('Distance')]],
    [[c(7, 'number', 'id'), c('Example Driver A', 'text', 'driver'), c(12500, 'meter', 'distance')]]
  )

  it('draws report 1 in miles: the bars, the marks of the axis, the tooltip and the table', () => {
    runtime.configs = MILES
    renderBody(1, { data: REPORT_1 })
    const bars = lastChart('bar')
    expect(bars.data.datasets[1].data[0]).toBeCloseTo(2.5 * 0.621371, 6)
    const tick = bars.options.scales.y.ticks.callback
    expect(tick(1)).toBe('1 mi')
    expect(tick(1.5)).toBe('1.50 mi')
    const visible = screen.getByRole('table', { name: 'Average distance' })
    expect(within(visible).getByText('1.55 mi')).toBeInTheDocument()
    expect(within(visible).queryByText('2.50')).toBeNull()
  })

  it('keeps report 1 in km when the project asks for km, or says nothing', () => {
    runtime.configs = { distance_unit_km: { value: '1' } }
    renderBody(1, { data: REPORT_1 })
    expect(lastChart('bar').data.datasets[1].data[0]).toBe(2.5)
    expect(lastChart('bar').options.scales.y.ticks.callback(2.5)).toBe('2.50 km')
    expect(within(screen.getByRole('table', { name: 'Average distance' })).getByText('2.50')).toBeInTheDocument()
  })

  it('converts and labels the ranges of report 2 in miles, and the percentages stay as they are', () => {
    runtime.configs = MILES
    renderBody(2, { data: REPORT_2 })
    const bars = lastChart('bar')
    expect(bars.data.labels).toEqual(['0–0.62 mi', '0.62–0.93 mi'])
    expect(bars.data.datasets.map(set => set.data)).toEqual([[100, 0], [100, 0]])
    expect(bars.options.scales.y.ticks.callback(50)).toBe('50%')
    const visible = screen.getByRole('table', { name: 'Orders by distance range' })
    expect(within(visible).getByText('0.62–0.93 mi')).toBeInTheDocument()
    // the counts of orders are not distances
    expect(within(visible).getAllByText('5').length).toBeGreaterThan(0)
  })

  it('writes the metres of report 10 as miles in the table, and its CSV keeps the values of the API (D11)', async () => {
    runtime.configs = MILES
    renderBody(10, { data: REPORT_10 })
    expect(within(card('Distance covered')).getByText('7.77 mi')).toBeInTheDocument()
    await clickCsv('Download CSV: Distance covered')
    expect(runtime.downloads[0].text).toContain('12500')
  })

  it('writes the metres of report 10 as km in a km project', () => {
    renderBody(10, { data: REPORT_10 })
    expect(within(card('Distance covered')).getByText('12.50')).toBeInTheDocument()
  })
})

// ── charts of lines (13, 14, 15) ───────────────────────────────────────────────────────────────────────────────────
describe('the line charts', () => {
  it('fills the weeks that the API leaves out with 0 and shows the total of the period (13)', () => {
    renderBody(13, { data: REPORT_13 }, { ...FILTERS, to: '2026-10-24' })
    const line = lastChart('line')
    expect(line.data.labels).toEqual(['Week 39 · 3 Oct', 'Week 40 · 4 Oct – 10 Oct', 'Week 41 · 11 Oct – 17 Oct', 'Week 42 · 18 Oct – 24 Oct'])
    expect(line.data.datasets[0].data).toEqual([4, 0, 16, 0])
    // the total is the sum of the points of the API, in an isolated figure (decision 11)
    const metric = screen.getByText('Total orders').closest('.odc-metric')
    expect(normal(metric.querySelector('.odc-metric-value'))).toBe('20')
    expect(metric.querySelector('.odc-figure bdi')).not.toBeNull()
    // the hidden table of the chart carries the same rows
    const hidden = screen.getByRole('table', { name: 'Orders per period' })
    expect(rowsOf(hidden).map(row => row[0])).toEqual(['Period', 'Week 39 · 3 Oct', 'Week 40 · 4 Oct – 10 Oct', 'Week 41 · 11 Oct – 17 Oct', 'Week 42 · 18 Oct – 24 Oct'])
  })

  // redesign the API sent `Week 2026-37` for a range that starts on Sunday 2026-09-20; with Sunday weeks that is 13-09..19-09, outside the range.
  // It has data, so it takes its place in time with its own dates; it is never painted raw and never left after the last week.
  it('puts a week the API numbers outside the period in its place, with its own dates and never raw (13)', () => {
    const data = SERIES('Orders', 'Orders', [{ x: 'Week 2026-37', y: 5 }, { x: 'Week 2026-39', y: 4 }], ['Week 2026-37', 'Week 2026-39'])
    renderBody(13, { data }, { ...FILTERS, from: '2026-09-20', to: '2026-10-20' })
    const line = lastChart('line')
    expect(line.data.labels).toEqual([
      'Week 37 · 13 Sep – 19 Sep',
      'Week 38 · 20 Sep – 26 Sep',
      'Week 39 · 27 Sep – 3 Oct',
      'Week 40 · 4 Oct – 10 Oct',
      'Week 41 · 11 Oct – 17 Oct',
      'Week 42 · 18 Oct – 20 Oct'
    ])
    expect(line.data.datasets[0].data).toEqual([5, 0, 4, 0, 0, 0])
    const hidden = screen.getByRole('table', { name: 'Orders per period' })
    expect(rowsOf(hidden).map(row => row[0]).join('|')).not.toMatch(/Week 20/)
  })

  // at 390 px the weekly labels of the X axis were cut with «…» in the middle of their range; the chart gets the compact form
  // (the week and its dates on two lines) to use when the whole label does not fit. Tooltip and table keep the whole label.
  it('hands the chart a compact form of every weekly label, in step with the labels (13)', () => {
    renderBody(13, { data: REPORT_13 }, { ...FILTERS, to: '2026-10-24' })
    const line = lastChart('line')
    expect(line.data.labels).toHaveLength(4)
    const axis = line.options.scales.x
    // narrow: the compact form, a week above its dates
    const compact = [0, 1, 2, 3].map(index => axis.ticks.callback.call({ width: 300 }, index, index))
    expect(compact).toEqual([['Week 39', '3 Oct'], null, ['Week 41', '11 Oct – 17 Oct'], null])
    expect(JSON.stringify(compact)).not.toContain('…')
    // wide: the whole label, as it was
    expect([0, 1, 2, 3].map(index => axis.ticks.callback.call({ width: 1400 }, index, index))).toEqual(line.data.labels)
  })

  it('keeps the weeks of the dates outside the period in the compact form too (13)', () => {
    const data = SERIES('Orders', 'Orders', [{ x: 'Week 2026-37', y: 5 }, { x: 'Week 2026-39', y: 4 }], ['Week 2026-37', 'Week 2026-39'])
    renderBody(13, { data }, { ...FILTERS, from: '2026-09-20', to: '2026-10-20' })
    const axis = lastChart('line').options.scales.x
    expect([0, 1].map(index => axis.ticks.callback.call({ width: 150 }, index, index))).toEqual([['Week 37', '13 Sep – 19 Sep'], null])
  })

  it('passes no compact form for a daily line: its labels are short (13)', () => {
    const data = SERIES('Orders', 'Orders', [{ x: 'Day 2026-10-03', y: 2 }, { x: 'Day 2026-10-05', y: 3 }], ['Day 2026-10-03', 'Day 2026-10-05'])
    renderBody(13, { data })
    const line = lastChart('line')
    expect(line.data.labels[0]).toBe('3 Oct')
    // every tick is a plain string, whatever the width
    line.data.labels.forEach((label, index) => expect(line.options.scales.x.ticks.callback.call({ width: 80 }, index, index) ?? label).toEqual(expect.any(String)))
  })

  it('downloads the rows of the API, with the header and the name of main (13)', async () => {
    renderBody(13, { data: REPORT_13 }, { ...FILTERS, to: '2026-10-24' })
    await clickCsv('Download CSV: Orders per period')
    expect(runtime.downloads[0].name).toMatch(/^orders_\d+\.csv$/)
    expect(runtime.downloads[0].text).toBe('Time, Orders\nWeek 2026-39,4,\nWeek 2026-41,16,\n')
  })

  it('writes the total of the sales with the price of the project, without forcing the separator (14)', () => {
    renderBody(14, { data: REPORT_14 })
    const metric = screen.getByText('Total sales').closest('.odc-metric')
    expect(normal(metric.querySelector('.odc-metric-value'))).toBe('$700.63')
    expect(lastChart('line').data.datasets[0].data).toEqual([113.05, 587.58])
  })

  it('draws one series per channel from both shapes, calls «unknow» Unknown, and invents no zero point (15)', () => {
    renderBody(15, { data: REPORT_15 })
    const line = lastChart('line')
    // RP-14: two points, the two weeks of the API; main added a leading 0
    expect(line.data.labels).toEqual(['Week 39 · 3 Oct', 'Week 40 · 4 Oct – 10 Oct'])
    expect(line.data.datasets.map(set => [set.label, set.data])).toEqual([
      ['Unknown', [1, 0]],
      ['App Marketplace', [0, 3]],
      ['orderingplus v26.1', [0, 16]]
    ])
  })

  it('downloads every series of report 15, one column per channel after «Time» (RP-04)', async () => {
    renderBody(15, { data: REPORT_15 })
    await clickCsv('Download CSV: New users by channel')
    expect(runtime.downloads[0].name).toMatch(/^registers_users_\d+\.csv$/)
    expect(runtime.downloads[0].text).toBe('Time, Unknown, App Marketplace, orderingplus v26.1\nWeek 2026-39,1,0,0,\nWeek 2026-40,0,3,16,\n')
  })

  // redesign (row 6, P8, D-32): the channels are counts of users, they add up: the five largest and «Other», and the table of all of them stays
  it('draws the five largest channels and «Other» when there are more than 6, and keeps the table of every channel (15)', () => {
    renderBody(15, { data: REPORT_15_EIGHT_CHANNELS })
    expect(screen.queryByText('The chart shows up to 6 series. See the table.')).toBeNull()
    expect(screen.getByText('The smaller series are grouped in “Other”. The table lists all of them.')).toBeInTheDocument()
    const line = lastChart('line')
    expect(line.data.datasets.map(set => set.label)).toEqual(['Channel 8', 'Channel 7', 'Channel 6', 'Channel 5', 'Channel 4', 'Other'])
    // channels 1, 2 and 3 add up in «Other» (the second week of the range has none)
    expect(line.data.datasets.map(set => set.data)).toEqual([[8, 0], [7, 0], [6, 0], [5, 0], [4, 0], [6, 0]])
    // the visible table lists the eight, and the table of the chart has a name of its own
    const visible = screen.getByRole('table', { name: 'New users by channel' })
    expect(rowsOf(visible)[0]).toEqual(['Period', 'Channel 1', 'Channel 2', 'Channel 3', 'Channel 4', 'Channel 5', 'Channel 6', 'Channel 7', 'Channel 8'])
    expect(screen.getByRole('table', { name: 'Chart: New users by channel' })).toBeInTheDocument()
  })

  it('downloads every channel in the CSV even when the chart groups the small ones (15)', async () => {
    renderBody(15, { data: REPORT_15_EIGHT_CHANNELS })
    await clickCsv('Download CSV: New users by channel')
    expect(runtime.downloads[0].text.split('\n')[0]).toBe('Time, Channel 1, Channel 2, Channel 3, Channel 4, Channel 5, Channel 6, Channel 7, Channel 8')
  })

  it('draws the 6 channels as they are, with no «Other» and no note (15)', () => {
    const six = { ...REPORT_15_EIGHT_CHANNELS, dataset: { ...REPORT_15_EIGHT_CHANNELS.dataset, dataset: REPORT_15_EIGHT_CHANNELS.dataset.dataset.slice(0, 6) } }
    renderBody(15, { data: six })
    expect(lastChart('line').data.datasets.map(set => set.label)).toEqual(['Channel 1', 'Channel 2', 'Channel 3', 'Channel 4', 'Channel 5', 'Channel 6'])
    expect(screen.queryByText(/grouped in/)).toBeNull()
    expect(screen.queryByText('The chart shows up to 6 series. See the table.')).toBeNull()
  })
})

// ── rankings, satisfaction ─────────────────────────────────────────────────────────────────────────────────────────
describe('rankings and satisfaction', () => {
  it('ranks the drivers with the average delivery time of the tooltip of main as a hint (12, auditor 13)', async () => {
    renderBody(12, { data: REPORT_12 })
    const list = screen.getByRole('table', { name: 'Orders per driver' })
    expect(rowsOf(list).slice(1).map(row => row.join('|'))).toEqual([
      'Example Driver AAverage delivery time: 6 min 4 s|3',
      'Example Driver BAverage delivery time: 1 h 13 min|1'
    ])
    await clickCsv('Download CSV: Orders per driver')
    expect(runtime.downloads[0].name).toMatch(/^top_orders_\d+\.csv$/)
    expect(runtime.downloads[0].text).toBe('Driver, Orders\nExample Driver A,3,\nExample Driver B,1,\n')
  })

  it('has a ranking and a CSV for each of the two blocks of report 20, with the categories in the second (RP-04)', async () => {
    renderBody(20, { data: REPORT_20_PRODUCTS, data1: REPORT_20_CATEGORIES })
    expect(screen.getAllByRole('heading', { level: 2 }).map(normal)).toEqual(['Top products', 'Top categories'])
    expect(within(card('Top products')).getByText('Example Product A')).toBeInTheDocument()
    expect(within(card('Top categories')).getByText('Example Category A')).toBeInTheDocument()

    await clickCsv('Download CSV: Top categories')
    expect(runtime.downloads[0].name).toMatch(/^top_category_\d+\.csv$/)
    expect(runtime.downloads[0].text).toBe('Categories, Orders\nExample Category A,7,\nExample Category B,4,\n')

    await clickCsv('Download CSV: Top products')
    expect(runtime.downloads[1].name).toMatch(/^top_selling_\d+\.csv$/)
    expect(runtime.downloads[1].text).toBe('Products, Orders\nExample Product A,7,\nExample Product B,4,\n')
  })

  it('shows the scores of the API mapped to the notes and downloads them (16, RP-04)', async () => {
    renderBody(16, { data: REPORT_16 })
    const notes = screen.getAllByRole('img').map(node => node.getAttribute('aria-label'))
    // General, Quality, Delivery, Service, Package (the order of the kit)
    expect(notes).toEqual(['4.5 out of 5', '5.0 out of 5', '4.0 out of 5', '3.5 out of 5', '5.0 out of 5'])

    await clickCsv('Download CSV: Customer scores')
    expect(runtime.downloads[0].name).toMatch(/^customer_satisfaction_\d+\.csv$/)
    // the category of the API (API_GENERAL) is written with its name
    expect(runtime.downloads[0].text).toBe('Category, Mark\nQuality,5.00,\nDelivery,4.00,\nService,3.50,\nPackage,5.00,\nGeneral,4.50,\n')
  })
})

// ── report 7: the timeline ────────────────────────────────────────────────────────────────────────────────────────
describe('report 7: the schedule of the drivers', () => {
  const timeline = () => charts('bar').find(props => props.options?.indexAxis === 'y')

  it('says there are no shifts when the day has none, and has nothing to download', () => {
    renderBody(7, { data: { type: 'timeline', from: '2026-10-10 00:00:00', to: '2026-10-10 23:59:00', data: [] } }, { ...FILTERS, from: '2026-10-10', to: '2026-10-10' })
    expect(screen.getByText('No shifts on this day')).toBeInTheDocument()
    expect(timeline()).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Download image: Shifts of the day' })).toBeDisabled()
  })

  it('draws the four datasets of main as floating bars from the start of the day, with the palette slots', () => {
    renderBody(7, { data: REPORT_7 }, { ...FILTERS, from: '2026-10-10', to: '2026-10-10' })
    const props = timeline()
    expect(props.data.datasets.map(set => [set.label, set.stack])).toEqual([
      ['Available', 'Stack 0'], ['Not Available', 'Stack 0'], ['Busy', 'Stack 1'], ['Not busy', 'Stack 1'] // redesign reports R1 (P-a): the catalog text of NOT_AVAILABLE
    ])
    expect(props.data.datasets[0].data).toEqual([{ y: 'Example Driver A', x: [32400, 45000] }])
    expect(props.data.datasets[1].data).toEqual([{ y: 'Example Driver A', x: [45000, 46800] }])
    expect(props.data.datasets[2].data).toEqual([{ y: 'Example Driver A', x: [36000, 39600] }])
    expect(props.data.datasets[3].data).toEqual([])
    // the axis and the tooltip are hours, not seconds
    expect(props.options.scales.x.ticks.callback(32400)).toBe('09:00')
    expect(props.options.plugins.tooltip.callbacks.label({ raw: { x: [32400, 45000] } })).toBe('10 Oct 2026 09:00 ~ 10 Oct 2026 12:30')
  })

  it('has a table with the same shifts, hidden for the eye, and names the time zone', () => {
    renderBody(7, { data: REPORT_7 }, { ...FILTERS, from: '2026-10-10', to: '2026-10-10' })
    const shifts = screen.getByRole('table', { name: 'Driver schedule, America/Chicago time' })
    expect(shifts.closest('.odc-sr-only')).not.toBeNull()
    expect(rowsOf(shifts)).toEqual([
      ['Driver', 'Status', 'From', 'To'],
      ['Example Driver A', 'Available', '10 Oct 2026 09:00', '10 Oct 2026 12:30'],
      ['Example Driver A', 'Not Available', '10 Oct 2026 12:30', '10 Oct 2026 13:00'],
      ['Example Driver A', 'Busy', '10 Oct 2026 10:00', '10 Oct 2026 11:00']
    ])
  })

  it('writes an instant in the hours of the chosen time zone, not the ones of the browser (inventory A 7.D4)', () => {
    renderBody(7, { data: REPORT_7_INSTANTS }, { ...FILTERS, from: '2026-10-10', to: '2026-10-10', timeZone: 'America/Chicago' })
    expect(timeline().data.datasets[0].data).toEqual([{ y: 'Example Driver C', x: [32400, 45000] }])
    const shifts = screen.getByRole('table', { name: 'Driver schedule, America/Chicago time' })
    expect(rowsOf(shifts)[1]).toEqual(['Example Driver C', 'Available', '10 Oct 2026 09:00', '10 Oct 2026 12:30'])
  })

  // R3: main's native legend hid a series on click; the HTML legend does the same, as P/Chart with toggleSeries
  it('hides and shows a series from its legend entry', async () => {
    const lastTimeline = () => charts('bar').filter(props => props.options?.indexAxis === 'y').at(-1)
    renderBody(7, { data: REPORT_7 }, { ...FILTERS, from: '2026-10-10', to: '2026-10-10' })
    const legend = document.querySelector('.odc-rp-timeline .odc-chart-legend')
    const busy = within(legend).getByRole('button', { name: 'Busy' })
    expect(within(legend).getAllByRole('button')).toHaveLength(4)
    expect(busy).toHaveAttribute('aria-pressed', 'true')
    expect(lastTimeline().data.datasets.map(set => set.hidden)).toEqual([false, false, false, false])

    await userEvent.click(busy)
    expect(busy).toHaveAttribute('aria-pressed', 'false')
    expect(lastTimeline().data.datasets.map(set => set.hidden)).toEqual([false, false, true, false])

    await userEvent.click(busy)
    expect(busy).toHaveAttribute('aria-pressed', 'true')
    expect(lastTimeline().data.datasets.map(set => set.hidden)).toEqual([false, false, false, false])
  })

  it('downloads the image of the chart as driver_schedule.png', async () => {
    renderBody(7, { data: REPORT_7 }, { ...FILTERS, from: '2026-10-10', to: '2026-10-10' })
    await userEvent.click(screen.getByRole('button', { name: 'Download image: Shifts of the day' }))
    expect(runtime.clicks).toEqual([{ href: 'data:image/png;base64,AAA', download: 'driver_schedule.png' }])
  })
})

// ── report 9: the map ─────────────────────────────────────────────────────────────────────────────────────────────
describe('report 9: the heat map', () => {
  it('says «Map unavailable» in the frame when the project has no key (RP-15)', () => {
    runtime.configs = {}
    renderBody(9, { data: REPORT_9 })
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('google-map')).toBeNull()
  })

  it('draws the map as main does: the centre, the zoom, the layers', () => {
    renderBody(9, { data: REPORT_9 })
    expect(screen.getByTestId('google-map')).toBeInTheDocument()
    expect(runtime.map.apiKey).toBe('key')
    expect(runtime.map.location).toEqual({ lat: 40.77473399999999, lng: -73.9653844 })
    expect(runtime.map.locations).toEqual(REPORT_9.locations)
    expect(runtime.map.mapControls.defaultZoom).toBe(15)
    expect(runtime.map.isHeatMap).toBe(true)
    expect(runtime.map.isHeat).toBe(false)
  })

  it('centres on the location of the user when there is one', () => {
    runtime.user = { location: { lat: 4.7, lng: -74 } }
    renderBody(9, { data: REPORT_9 })
    expect(runtime.map.location).toEqual({ lat: 4.7, lng: -74 })
  })

  it('switches Heatmap and Grouped, and goes back to Grouped when the data change', async () => {
    const { rerender, outcome } = renderBody(9, { data: REPORT_9 })
    const group = () => screen.getByRole('group', { name: 'Map view' })
    expect(within(group()).getByRole('button', { name: 'Grouped' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(group()).getByRole('button', { name: 'Heatmap' }))
    expect(screen.getByTestId('google-map')).toHaveAttribute('data-heat', 'true')
    rerender(<ReportBody report={getAdvancedReport(9)} result={{ ...outcome, data: { ...REPORT_9, locations: [{ lat: 1, lng: 2 }] } }} filters={FILTERS} />)
    expect(screen.getByTestId('google-map')).toHaveAttribute('data-heat', 'false')
    expect(within(group()).getByRole('button', { name: 'Grouped' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('says there is nothing to show when there are no points', () => {
    renderBody(9, { data: { locations: [], zones: [] } })
    expect(screen.getByText('No orders to show on the map')).toBeInTheDocument()
    expect(screen.queryByTestId('google-map')).toBeNull()
  })
})

// ── states (D13) ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('the states of a block', () => {
  it.each([1, 3, 7, 9, 12, 13, 16, 20])('shows a skeleton with the box of the block while report %i loads', (id) => {
    const { container } = renderBody(id, { loading: true })
    const busy = container.querySelectorAll('section[aria-busy="true"]')
    expect(busy.length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByRole('table')).toBeNull()
    expect(runtime.charts).toHaveLength(0)
  })

  it.each([
    [3, table([[h('Name')]], []), 'No data for this period and filters'],
    [12, { type: 'chart', dataset: { dataset: { data: [] } } }, 'No data for this period and filters'],
    [13, SERIES('Orders', 'Orders', [], []), 'No data for this period and filters'],
    [15, { type: 'char', dataset: { x: labelsOf([]), dataset: [] } }, 'No data for this period and filters'],
    [16, { type: 'char', dataset: { dataset: [{ data: [] }] } }, 'No data for this period and filters']
  ])('says what is missing when report %i has no rows', (id, data, text) => {
    renderBody(id, { data })
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(runtime.charts).toHaveLength(0)
  })

  it('keeps the old data under «Updating…» while the new ones arrive, with the region busy and polite', () => {
    const { container } = renderBody(3, { data: REPORT_3, updating: true })
    expect(screen.getByRole('table', { name: 'Service times' })).toBeInTheDocument()
    const mark = screen.getByText('Updating…')
    expect(mark).toHaveAttribute('aria-live', 'polite')
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('.odc-skeleton')).toBeNull()
  })

  // redesign reports R1 (Q-04): the data on screen belong to the filters before; a download now would save them under the new chips
  it('disables every download of the report while it is updating', () => {
    renderBody(3, { data: REPORT_3, updating: true })
    const downloads = screen.getAllByRole('button', { name: /Download/ })
    expect(downloads.length).toBeGreaterThan(0)
    downloads.forEach(button => expect(button).toBeDisabled())
  })

  it('keeps the polite region in the page when nothing is updating, so the next «Updating…» is announced', () => {
    const { container } = renderBody(3, { data: REPORT_3 })
    expect(screen.queryByText('Updating…')).toBeNull()
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('shows the error of the block with the message of the API translated and «Try again» that retries', async () => {
    const { outcome } = renderBody(3, { error: ['ERROR_REPORT_VERY_LONG_PERIOD'] })
    expect(screen.getByText('Service times could not be loaded.')).toBeInTheDocument()
    expect(screen.getByText('Error report, very long period')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(outcome.retry).toHaveBeenCalledTimes(1)
  })

  it('shows the error of a failed request without text (a network failure) with «Try again» alone', async () => {
    const { outcome } = renderBody(13, { error: new Error('Failed to fetch') })
    expect(screen.getByText('Orders per period could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByText('Failed to fetch')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(outcome.retry).toHaveBeenCalledTimes(1)
  })

  it('fails only the second block when only the second request fails (8, 18, 20)', async () => {
    const { outcome } = renderBody(8, { data: REPORT_8_BUSINESS, error1: ['SERVER_ERROR'] })
    expect(within(card('By store')).getByText('Example Store A')).toBeInTheDocument()
    expect(within(card('By store')).getByRole('button', { name: 'Download CSV: By store' })).toBeEnabled()
    expect(within(card('By brand')).getByText('By brand could not be loaded.')).toBeInTheDocument()
    expect(within(card('By brand')).getByRole('button', { name: 'Download CSV: By brand' })).toBeDisabled()
    await userEvent.click(within(card('By brand')).getByRole('button', { name: 'Try again' }))
    expect(outcome.retry).toHaveBeenCalledTimes(1)
  })

  it('draws nothing for a report that does not exist', () => {
    const { container } = render(<ReportBody report={null} result={result()} filters={FILTERS} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// ── the text of the periods ───────────────────────────────────────────────────────────────────────────────────────
describe('usePeriodText', () => {
  const periodsOf = () => renderHook(() => usePeriodText()).result.current
  const clipped = (label, from = '2026-10-03', to = '2026-10-10') => clipPeriod(parsePeriodLabel(label), from, to)

  it('writes a week cut to the period with its dates', () => {
    const { periodText } = periodsOf()
    expect(periodText(clipped('Week 2026-39'))).toBe('Week 39 · 3 Oct')
    expect(periodText(clipped('Week 2026-40'))).toBe('Week 40 · 4 Oct – 10 Oct')
  })

  it('writes a month, a day, a year and an hour', () => {
    const { periodText } = periodsOf()
    expect(periodText(clipped('Month 2026-08', '2026-08-01', '2026-09-30'))).toBe('Aug 2026')
    expect(periodText(clipped('Day 2026-10-03'))).toBe('3 Oct')
    expect(periodText(clipped('Year 2025', '2025-01-01', '2025-12-31'))).toBe('2025')
    expect(periodText(clipped('Hour 2026-10-05 09:00', '2026-10-05', '2026-10-05'))).toBe('09:00')
  })

  // the compact form of the X axis of a weekly chart: the week and its dates, on two lines
  it('writes a week as two lines for the axis, and nothing for the other units', () => {
    const { periodAxisText } = periodsOf()
    expect(periodAxisText(clipped('Week 2026-39'))).toEqual(['Week 39', '3 Oct'])
    expect(periodAxisText(clipped('Week 2026-40'))).toEqual(['Week 40', '4 Oct – 10 Oct'])
    expect(periodAxisText(clipped('Day 2026-10-03'))).toBeNull()
    expect(periodAxisText(clipped('Month 2026-08', '2026-08-01', '2026-09-30'))).toBeNull()
    expect(periodAxisText(clipped('Year 2025', '2025-01-01', '2025-12-31'))).toBeNull()
    expect(periodAxisText(clipped('Hour 2026-10-05 09:00', '2026-10-05', '2026-10-05'))).toBeNull()
    expect(periodAxisText(null)).toBeNull()
  })

  it('has no text for what it does not know', () => {
    const { periodText } = periodsOf()
    expect(periodText(null)).toBeNull()
  })

  it('writes the range of the report and how the API groups it', () => {
    const { rangeText, groupingText } = periodsOf()
    expect(rangeText('2026-10-03', '2026-10-10')).toBe('3 Oct 2026 – 10 Oct 2026')
    expect(rangeText('2026-10-10', '2026-10-10')).toBe('10 Oct 2026')
    expect(groupingText('week')).toBe('by week')
    expect(groupingText('hour')).toBe('by hour')
    expect(groupingText('day')).toBe('by day')
    expect(groupingText('month')).toBe('by month')
    expect(groupingText('year')).toBe('by year')
    expect(groupingText('fortnight')).toBe('')
  })
})

// ── the literal guard (decision 5 of 00-common) ───────────────────────────────────────────────────────────────────
describe('the governed files', () => {
  it.each(['report-body.css', 'ReportBody.jsx', 'ReportCharts.jsx', 'ReportTimeline.jsx', 'ReportHeatMap.jsx', 'usePeriodText.js', 'reportBodyData.js'])(
    '%s has no literal colour, length, weight, duration or z-index',
    (file) => {
      expect(scanSource(readFileSync(path.join(dir, file), 'utf8'), file), file).toEqual([])
    }
  )
})
