/* eslint-disable import/first */
// redesign drivers FC2 (D1-D12; auditor 1, 2, 5, 6, 12; DR-01, DR-03, DR-05, DR-06, DR-07, DR-10, DR-11, DR-15, DR-19): the page /intelligence/drivers.
// The controller of the page (`DriverAnalytics` of `~components`, batch B) is a stand-in that hands the UI fixed props, as the real one does; the
// controllers of the filters are stand-ins too, and so is the page's own driver pill (`DriverTreePill`, batch C1, with its own test). What is
// under test is the new UI: the order of the page, the seven figures, the six cards with their CSV files, and the map.
import React from 'react'
import moment from 'moment'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'
import { pairsByAt, spendSeries as spendSeriesOf } from '../../../../../../utils/driverReports'

const runtime = vi.hoisted(() => ({
  props: {},
  charts: [],
  map: null,
  collapsed: false,
  collapse: vi.fn(),
  learn: null,
  driverPill: null,
  countries: {},
  appIdList: { loading: false, ids: [], error: null },
  // the state the stand-in of `DriverOrderRoute` (the controller of «Driver route by order») hands its UI
  route: { loading: false, error: null, order: null, routePoints: [], stops: [], businessLocation: null, customerLocation: null, deliveryDistance: null },
  search: null
}))

vi.mock('react-chartjs-2', () => ({
  Line: props => { runtime.charts.push({ ...props, kind: 'line' }); return <canvas data-testid='line-chart' aria-label={props['aria-label']} /> },
  Bar: props => { runtime.charts.push({ ...props, kind: 'bar' }); return <canvas data-testid='bar-chart' aria-label={props['aria-label']} /> }
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  return {
    // the controller of the page: it hands the UI the props of the test
    DriverAnalytics: ({ UIComponent, ...rest }) => react.createElement(UIComponent, { ...rest, ...runtime.props }),
    AnalyticsStatusSubFilter: ({ UIComponent, ...rest }) => react.createElement(UIComponent, { ...rest, appIdList: runtime.appIdList }),
    CountryList: ({ UIComponent, ...rest }) => react.createElement(UIComponent, { ...rest, ...runtime.countries }),
    // the controller of «Driver route by order» (the section is tested on its own in DriverOrderRoute.test.jsx)
    DriverOrderRoute: ({ UIComponent, ...rest }) => react.createElement(UIComponent, { ...rest, routeState: runtime.route, handleSearchOrder: runtime.search }),
    // the controllers of the pills that live in a popover: it is closed here, so they paint nothing (the kit has its own tests)
    ReportsBrandFilter: () => null,
    ReportsDriverGroupFilter: () => null,
    ReportsDriverFilter: () => null,
    ReportsAppIdFilter: () => null,
    AnalyticsBusinessFilter: () => null,
    GoogleMapsMap: props => { runtime.map = props; return react.createElement('div', { 'data-testid': 'google-map', 'data-heat': String(props.isHeat) }) },
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
    useConfig: () => [{ configs: runtime.configs }],
    useUtils: () => [{
      parsePrice: value => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      parseNumber: (value, options) => Number(value).toFixed(options?.decimal ?? 2),
      // the project's format: «D MMM» for a short date, «HH:mm» for a time
      parseDate: (date, options = {}) => {
        const instant = (options.utc ?? true) ? moment.utc(date, options.inputFormat || ['YYYY-MM-DD HH:mm:ss']).local() : moment(date, options.inputFormat || ['YYYY-MM-DD HH:mm:ss'])
        if (options.timeOnly) return instant.format('HH:mm')
        return instant.format(options.omitYear ? 'D MMM' : 'D MMM YYYY')
      }
    }]
  }
})
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: runtime.collapsed }, { handleMenuCollapse: runtime.collapse }]
}))
vi.mock('../../../Shared/LearnDropDown', () => ({
  LearnDropDown: ({ learnOptions }) => {
    runtime.learn = learnOptions
    return <button type='button'>Learn</button>
  }
}))
vi.mock('../../../../../../utils/businessReports', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadCsv: vi.fn()
}))
// the page's own driver pill (batch C1) has its own test: here it is a stand-in that records what the bar gives it
vi.mock('../DriverTreePill', () => ({
  DriverTreePill: props => {
    runtime.driverPill = props
    return <button type='button' data-testid='driver-tree-pill'>{props.label}</button>
  }
}))

import { downloadCsv } from '../../../../../../utils/businessReports'
import { DriverAnalytics } from '../index'

const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const ready = (data, extra = {}) => ({ loading: false, error: null, data, ...extra })
const loadingBlock = (extra = {}) => ({ loading: true, error: null, data: [], ...extra })
const failed = (extra = {}) => ({ loading: false, error: 'boom', data: [], ...extra })

const DAY_PERIOD = { from: '2026-10-01', to: '2026-10-03', days: 3, includesToday: false, granularity: 'day' }
const HOUR_PERIOD = { from: '2026-10-09', to: '2026-10-09', granularity: 'hour' }
const MONTH_PERIOD = { from: '2026-07-15', to: '2026-09-20', granularity: 'month' }

const ORDER_ROWS = [{ time: '2026-10-01 00:00:00', orders: 2 }, { time: '2026-10-03 00:00:00', orders: 5 }]
const SALES_ROWS = [{ time: '2026-10-01 10:00:00', sales: 10.5 }, { time: '2026-10-02 10:00:00', sales: 20 }]
const SALES_SECOND = [{ time: '2026-10-03 09:00:00', sales: 4 }]
const STATUS_ROWS = [{ status: 7, orders: 30 }, { status: 0, orders: 100 }]
const LOCATIONS = [{ lat: '4.6', lng: '-74.1' }, { lat: 'x', lng: '1' }, { lat: 5, lng: -70 }]
// what the API sends, in ITS order (not sorted): the controller joins them with `pairsByAt`
const AVAILABLE_DATA = { available: [{ at: '2026-10-02', time: 7200 }, { at: '2026-10-01', time: 3600 }], not_available: [{ at: '2026-10-01', time: 1800 }] }
const BUSY_DATA = { busy: [{ at: '2026-10-09 14:00:00', time: 5400 }, { at: '2026-10-09 09:00:00', time: 1800 }], not_busy: [{ at: '2026-10-09 09:00:00', time: 600 }, { at: '2026-10-09 14:00:00', time: 900 }] }
const SPEND_DATA = [
  { time: '2026-10-02 00:00:00', accept_spend: 90, pickup_spend: -363, delivery_spend: 600, complete_spend: null },
  { time: '2026-10-01 00:00:00', accept_spend: 60, pickup_spend: 120, delivery_spend: null, complete_spend: 300 }
]
const TOP_DATA = [
  { id: 1, name: 'Ana Pérez', orders_count: 40, orders_percentage: 45.5 },
  { id: 2, name: 'Luis', orders_count: 30, orders_percentage: 33.333 },
  { id: 3, name: 'Luis', orders_count: 20, orders_percentage: 21.2 }
]
const TOP_DRIVERS = [
  { id: 1, name: 'Ana Pérez', count: 40, percent: 45.5, duplicate: false },
  { id: 2, name: 'Luis', count: 30, percent: 33.333, duplicate: true },
  { id: 3, name: 'Luis', count: 20, percent: 21.2, duplicate: true }
]

const baseProps = () => ({
  filterList: { lapse: 'last_7_days', drivers_ids: null, businessIds: null, app_id: 'all', driver_groups_ids: null, franchises_id: null, timeZone: BROWSER_ZONE },
  handleChangeFilterList: vi.fn(),
  countryCode: '',
  handleChangeCode: vi.fn(),
  period: DAY_PERIOD,
  reloadBlock: vi.fn(),
  totals: { orders: 7, sales: 2846.94, acceptSeconds: 345, arrivedSeconds: 2705, pickupSeconds: 120, deliverySeconds: 4620, completeSeconds: null },
  ordersList: ready({}),
  salesList: ready({}),
  orderStatusList: ready(STATUS_ROWS),
  topDriversList: ready(TOP_DATA),
  spendTimesList: ready(SPEND_DATA),
  availableTimesList: ready(AVAILABLE_DATA),
  busyTimesList: ready(BUSY_DATA),
  customerSatisfactionList: ready({ general: '4.50', quality: '5.00', delivery: 0, service: '3.20', package: '' }),
  acceptSpendList: ready(345),
  completeSpendList: ready(-1),
  arrivedPickUpSpendList: ready(2705),
  pickUpSpendList: ready(120),
  deliverySpendList: ready(4620),
  orderLocationList: ready(LOCATIONS, { locations: LOCATIONS }),
  ordersRows: ORDER_ROWS,
  salesRows: SALES_ROWS,
  ordersSeries: [{ label: 'Orders', rows: ORDER_ROWS }],
  salesSeries: [{ label: 'Sales', rows: SALES_ROWS }, { label: 'Sales B', rows: SALES_SECOND }],
  ordersPeriod: { from: '2026-10-01', to: '2026-10-03', granularity: 'day' },
  salesPeriod: { from: '2026-10-01', to: '2026-10-03', granularity: 'day' },
  spendSeries: spendSeriesOf(SPEND_DATA),
  availablePairs: pairsByAt(AVAILABLE_DATA, 'available', 'not_available'),
  busyPairs: pairsByAt(BUSY_DATA, 'busy', 'not_busy'),
  topDrivers: TOP_DRIVERS
})

const setProps = (patch = {}) => { runtime.props = { ...baseProps(), ...patch } }
const renderPage = () => render(<DriverAnalytics />)

const normal = (node) => node.textContent.replace(/\s+/g, ' ').trim()
const metric = (key) => document.querySelector(`[data-metric="${key}"]`)
const valueOf = (key) => normal(metric(key).querySelector('.odc-metric-value'))
const refsOf = (key) => [...metric(key).querySelectorAll('.odc-metric-ref')].map(normal)
const card = (name) => screen.getByRole('region', { name })
const chartOf = (name) => runtime.charts.filter(chart => chart['aria-label'] === name).pop()
const tick = (chart, value) => chart.options.scales.y.ticks.callback(value)
const tableLabels = (name) => [...card(name).querySelectorAll('figure table tbody th[scope="row"]')].map(normal)

// redesign drivers R1 (F5): the card of the times is «Times» again (the title of main), no longer «Times by day»
const CHART_CARDS = ['Orders', 'Sales', 'Availability', 'Busy time', 'Times']

beforeEach(() => {
  vi.clearAllMocks()
  runtime.charts = []
  runtime.map = null
  runtime.collapsed = false
  runtime.learn = null
  runtime.driverPill = null
  runtime.configs = { google_maps_api_key: { value: 'key' }, location_default_latitude: { value: '4.7' }, location_default_longitude: { value: '-74.0' } }
  runtime.appIdList = { loading: false, ids: ['web', 'ios'], error: null }
  runtime.countries = {
    countriesState: { loading: false, error: null, countries: [] },
    searchValue: null,
    onSearch: vi.fn(),
    handleClickFilterButton: vi.fn(),
    code: '',
    setCode: vi.fn(),
    actionState: { loading: false, error: null }
  }
  runtime.route = { loading: false, error: null, order: null, routePoints: [], stops: [], businessLocation: null, customerLocation: null, deliveryDistance: null }
  runtime.search = vi.fn()
  setProps()
})
afterEach(() => {
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

describe('the page: header, controls and order', () => {
  it('has one h1 «Delivery reports» and Learn with the delivery_reports article (DR-11)', () => {
    renderPage()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Delivery reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(runtime.learn.map(option => option.value)).toEqual(['delivery_reports'])
  })

  it('has «Open menu» only with the sidebar collapsed, and it opens the menu (D12)', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    document.body.innerHTML = ''
    runtime.collapsed = true
    renderPage()
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(runtime.collapse).toHaveBeenCalledWith(false)
  })

  it('has no styled-component of the old page: the root is the odc-bi-page of the drivers, with its direction', () => {
    const { container } = renderPage()
    const root = container.querySelector('.odc-bi-page')
    expect(root).not.toBeNull()
    expect(root).toHaveAttribute('data-slot', 'bi-drivers-page')
    expect(root).toHaveClass('odc-root')
    expect(root).toHaveAttribute('dir', 'ltr')
  })

  it('paints, from top to bottom: header, period, filters, channels, the seven figures, the five sections and the map last (D1)', () => {
    renderPage()
    const nodes = [
      screen.getByRole('heading', { level: 1 }),
      screen.getByRole('group', { name: 'Period' }),
      screen.getByRole('group', { name: 'Filters' }),
      screen.getByRole('group', { name: 'Channel' }),
      metric('orders'),
      screen.getByRole('heading', { level: 2, name: 'Orders and sales' }),
      screen.getByRole('heading', { level: 2, name: 'Drivers' }),
      screen.getByRole('heading', { level: 2, name: 'Delivery times' }),
      screen.getByRole('heading', { level: 2, name: 'Service' }),
      screen.getByRole('heading', { level: 2, name: 'Order locations' }),
      screen.getByRole('region', { name: 'Orders map' })
    ]
    nodes.slice(1).forEach((node, index) => {
      expect(nodes[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING, `node ${index + 1} follows node ${index}`).toBeTruthy()
    })
  })

  // (port of ): the lookup by order number does not depend on the period or the filters, so it goes last
  it('«Driver route by order» is the last section, after «Order locations»: one card whose title is the h2, said once', () => {
    const { container } = renderPage()
    const sections = container.querySelectorAll('.odc-bi-section')
    expect([...sections].map(section => normal(section.querySelector('h2')))).toEqual(
      ['Orders and sales', 'Drivers', 'Delivery times', 'Service', 'Order locations', 'Driver route by order']
    )
    const last = sections[sections.length - 1]
    expect(within(last).getAllByRole('heading', { name: 'Driver route by order' })).toHaveLength(1)
    expect(within(last).getByRole('region', { name: 'Driver route by order' })).toBeInTheDocument()
    expect(within(last).getByRole('textbox', { name: 'Order number' })).toBeInTheDocument()
  })

  it('puts the cards in their sections: orders and sales, then drivers (top, availability, busy), times and service', () => {
    renderPage()
    const sections = ['Orders and sales', 'Drivers', 'Delivery times', 'Service', 'Order locations']
      .map(name => screen.getByRole('heading', { level: 2, name }).closest('section'))
    const cardsOf = section => [...section.querySelectorAll('.odc-bi-card-title')].map(normal)
    expect(cardsOf(sections[0])).toEqual(['Orders', 'Sales'])
    expect(cardsOf(sections[1])).toEqual(['Top drivers', 'Availability', 'Busy time'])
    expect(cardsOf(sections[2])).toEqual(['Times'])
    expect(cardsOf(sections[3])).toEqual(['Orders by status', 'Customer satisfaction'])
  })

  it('the filter pills come in the order of main and the page\'s own driver pill takes the place of the kit\'s (D5)', () => {
    renderPage()
    const labels = within(screen.getByRole('group', { name: 'Filters' }))
      .getAllByRole('button')
      .map(node => node.textContent.match(/^(Driver group|Driver|Stores|Brand|Country|Timezone)/)?.[1])
    expect(labels).toEqual(['Country', 'Brand', 'Driver group', 'Driver', 'Timezone'])
    expect(screen.getByTestId('driver-tree-pill')).toBeInTheDocument()
  })

  it('gives the driver pill the drivers of the filters (drivers_ids) and the callbacks of the bar', () => {
    setProps({ filterList: { ...baseProps().filterList, drivers_ids: [3, 4] } })
    renderPage()
    expect(runtime.driverPill.label).toBe('Driver')
    expect(runtime.driverPill.selected).toEqual([3, 4])
    expect(typeof runtime.driverPill.onSetIds).toBe('function')
    expect(typeof runtime.driverPill.onClear).toBe('function')
    expect(typeof runtime.driverPill.onLearn).toBe('function')
  })

  it('the period buttons and the channels write into the filters of the controller', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Yesterday' }))
    expect(runtime.props.handleChangeFilterList).toHaveBeenCalledWith({ ...runtime.props.filterList, lapse: 'yesterday' })
    await userEvent.click(screen.getByRole('button', { name: 'ios' }))
    expect(runtime.props.handleChangeFilterList).toHaveBeenCalledWith({ ...runtime.props.filterList, app_id: 'ios' })
  })
})

describe('the seven figures (D3)', () => {
  it('paint orders, sales (with currency, no country), and the five times, each in a figure node, with their labels', () => {
    renderPage()
    expect(valueOf('orders')).toBe('7')
    expect(valueOf('sales')).toBe('$2,846.94')
    expect(valueOf('accept')).toBe('5 min 45 s')
    expect(valueOf('arrived')).toBe('45 min 5 s')
    expect(valueOf('pickup')).toBe('2 min')
    expect(valueOf('delivery')).toBe('1 h 17 min')
    // a time that arrived as null once loaded reads «—», never 0
    expect(valueOf('complete')).toBe('—')
    ;['orders', 'sales', 'accept', 'arrived', 'pickup', 'delivery', 'complete'].forEach(key => {
      expect(metric(key).querySelector('.odc-metric-value .odc-figure bdi'), key).not.toBeNull()
    })
    expect(['orders', 'sales', 'accept', 'arrived', 'pickup', 'delivery', 'complete'].map(key => normal(metric(key).querySelector('.odc-metric-label')))).toEqual([
      'Orders', 'Sales', 'Driver time to accept', 'Wait at pickup', 'Time to pick up', 'Time to deliver', 'Time to complete'
    ])
    expect(document.querySelectorAll('.odc-metric')).toHaveLength(7)
  })

  it('the five times say they are averages of the period; orders and sales have no reference (D2: no comparison)', () => {
    renderPage()
    ;['accept', 'arrived', 'pickup', 'delivery', 'complete'].forEach(key => expect(refsOf(key), key).toEqual(['Average in this period']))
    expect(refsOf('orders')).toEqual([])
    expect(refsOf('sales')).toEqual([])
  })

  it('keeps the last figures, dimmed, while a new period loads, and shows skeletons only on the first load (R1 F3)', () => {
    setProps({ ordersList: loadingBlock(), totals: { ...baseProps().totals, orders: null } })
    const first = renderPage()
    expect(metric('orders').querySelector('.odc-metric-value .odc-figure')).toBeNull()
    expect(metric('orders').querySelector('.odc-metric-value .odc-skeleton')).not.toBeNull()
    expect(metric('sales')).toHaveTextContent('$2,846.94')
    first.unmount()
    setProps()
    const view = renderPage()
    expect(valueOf('orders')).toBe('7')
    setProps({
      ordersList: loadingBlock(),
      acceptSpendList: loadingBlock(),
      totals: { ...baseProps().totals, orders: null, acceptSeconds: null }
    })
    view.rerender(<DriverAnalytics />)
    expect(valueOf('orders')).toBe('7')
    expect(valueOf('accept')).toBe('5 min 45 s')
    expect(metric('orders').hasAttribute('data-stale')).toBe(true)
    expect(metric('accept').hasAttribute('data-stale')).toBe(true)
    expect(metric('sales').hasAttribute('data-stale')).toBe(false)
    setProps()
    view.rerender(<DriverAnalytics />)
    expect(metric('orders').hasAttribute('data-stale')).toBe(false)
  })

  it('a failed block makes its figure a dash and one warning with «Try again» reloads only the blocks that failed', async () => {
    setProps({
      salesList: failed(),
      acceptSpendList: failed(),
      deliverySpendList: failed(),
      totals: { ...baseProps().totals, sales: null, acceptSeconds: null, deliverySeconds: null }
    })
    renderPage()
    expect(valueOf('sales')).toBe('—')
    expect(valueOf('accept')).toBe('—')
    expect(valueOf('delivery')).toBe('—')
    expect(valueOf('orders')).toBe('7')
    expect(screen.getAllByText('Some figures could not be loaded.')).toHaveLength(1)
    const notice = screen.getByText('Some figures could not be loaded.').closest('[role="status"]')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    await userEvent.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(runtime.props.reloadBlock.mock.calls.map(call => call[0]).sort()).toEqual(['acceptSpend', 'deliverySpend', 'sales'])
    // the button leaves with the notice: the focus goes to the hidden title of the region
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Summary' }))
  })

  it('has no warning when every figure loads', () => {
    renderPage()
    expect(screen.queryByText('Some figures could not be loaded.')).toBeNull()
  })
})

describe('Orders and sales (D6, auditor 2, 4)', () => {
  it('draws a line chart per card on the axis of the period of its own response, labelled by day and never ISO', () => {
    renderPage()
    const orders = chartOf('Orders')
    expect(orders.kind).toBe('line')
    expect(orders.data.labels).toEqual(['1 Oct', '2 Oct', '3 Oct'])
    expect(orders.data.datasets).toHaveLength(1)
    expect(orders.data.datasets[0].data).toEqual([2, 0, 5])
  })

  it('Sales draws every series of the API with a legend, in the colors of the palette by order', () => {
    renderPage()
    const sales = chartOf('Sales')
    expect(sales.data.datasets).toHaveLength(2)
    expect(sales.data.datasets.map(dataset => dataset.label)).toEqual(['Sales', 'Sales B'])
    expect(sales.data.datasets[0].data).toEqual([10.5, 20, 0])
    expect(sales.data.datasets[1].data).toEqual([0, 0, 4])
    expect(within(card('Sales')).getAllByRole('listitem').map(normal)).toEqual(['Sales', 'Sales B'])
  })

  it('the values: orders as whole numbers, sales as currency', () => {
    renderPage()
    expect(tick(chartOf('Orders'), 3)).toBe('3')
    expect(tick(chartOf('Orders'), 0.5)).toBe('')
    expect(tick(chartOf('Sales'), 5)).toBe('$5.00')
  })

  it('draws the rows as they come, in time order, when the response carries no period (another zone)', () => {
    setProps({
      ordersPeriod: null,
      ordersRows: [{ time: '2026-10-09 13:00:00', orders: 1 }, { time: '2026-10-08 14:00:00', orders: 3 }],
      ordersSeries: [{ label: 'Orders', rows: [{ time: '2026-10-09 13:00:00', orders: 1 }, { time: '2026-10-08 14:00:00', orders: 3 }] }]
    })
    renderPage()
    const chart = chartOf('Orders')
    expect(chart.data.datasets[0].data).toEqual([3, 1])
    expect(chart.data.labels).toHaveLength(2)
    chart.data.labels.forEach(label => expect(label).not.toMatch(/\d{4}-\d{2}-\d{2}/))
  })

  it('labels the hours by their start in the project time format, and the months localized', () => {
    const hourRows = [{ time: '2026-10-09 14:00:00', orders: 3 }]
    setProps({ ordersPeriod: HOUR_PERIOD, ordersRows: hourRows, ordersSeries: [{ label: 'Orders', rows: hourRows }] })
    renderPage()
    const hourly = chartOf('Orders')
    expect(hourly.data.labels).toHaveLength(24)
    expect(hourly.data.labels[0]).toBe('00:00')
    expect(hourly.data.labels[13]).toBe('13:00')
    expect(hourly.data.datasets[0].data[13]).toBe(3)
    document.body.innerHTML = ''
    runtime.charts = []
    const monthRows = [{ time: '2026-08-01 00:00:00', orders: 9 }]
    setProps({ ordersPeriod: MONTH_PERIOD, ordersRows: monthRows, ordersSeries: [{ label: 'Orders', rows: monthRows }] })
    renderPage()
    expect(chartOf('Orders').data.labels).toEqual(['Jul 2026', 'Aug 2026', 'Sep 2026'])
    expect(chartOf('Orders').data.datasets[0].data).toEqual([0, 9, 0])
  })

  it('the CSV of orders and sales is the first series, with the time without seconds, and the header and names of main (DR-15)', async () => {
    renderPage()
    await userEvent.click(within(card('Orders')).getByRole('button', { name: 'Download CSV: Orders' }))
    expect(downloadCsv).toHaveBeenLastCalledWith(expect.stringMatching(/^orders_\d+\.csv$/), 'Time, Orders\n2026-10-01 00:00,2,\n2026-10-03 00:00,5,\n')
    await userEvent.click(within(card('Sales')).getByRole('button', { name: 'Download CSV: Sales' }))
    // the second series ('Sales B') is not in the file or in the total: main sums and exports the first
    expect(downloadCsv).toHaveBeenLastCalledWith(expect.stringMatching(/^sales_\d+\.csv$/), 'Time, Sales\n2026-10-01 10:00,10.5,\n2026-10-02 10:00,20,\n')
  })
})

describe('Drivers (D6, D7, auditor 5, 6, 12)', () => {
  it('Top drivers is a ranking in the order of the API with the count and the share with one decimal, and «#id» only when a name repeats (DR-10)', () => {
    renderPage()
    const region = card('Top drivers')
    const table = within(region).getByRole('table', { name: 'Top drivers' })
    expect([...table.querySelectorAll('.odc-bi-bar-label')].map(normal)).toEqual(['Ana Pérez', 'Luis · #2', 'Luis · #3'])
    expect([...table.querySelectorAll('.odc-bi-bar-hint')].map(normal)).toEqual(['45.5%', '33.3%', '21.2%'])
    expect([...table.querySelectorAll('.odc-bi-bar-value')].map(normal)).toEqual(['40', '30', '20'])
    expect(table.querySelector('.odc-bi-bar-hint .odc-figure bdi')).not.toBeNull()
    expect(within(region).queryByRole('button', { name: /Expand/ })).toBeNull()
  })

  it('Top drivers downloads top_orders with «Name, Orders» and without «#id» (auditor 12)', async () => {
    renderPage()
    await userEvent.click(within(card('Top drivers')).getByRole('button', { name: 'Download CSV: Top drivers' }))
    expect(downloadCsv).toHaveBeenCalledWith(expect.stringMatching(/^top_orders_\d+\.csv$/), 'Name, Orders\nAna Pérez,40,\nLuis,30,\nLuis,20,\n')
  })

  it('Availability is a bar chart with two series, the days in order and a gap where a side is missing (auditor 5)', () => {
    renderPage()
    const chart = chartOf('Availability')
    expect(chart.kind).toBe('bar')
    expect(chart.data.labels).toEqual(['1 Oct', '2 Oct'])
    expect(chart.data.datasets.map(dataset => dataset.label)).toEqual(['Available', 'Not available'])
    expect(chart.data.datasets[0].data).toEqual([3600, 7200])
    expect(chart.data.datasets[1].data).toEqual([1800, null])
    expect(tableLabels('Availability')).toEqual(['1 Oct', '2 Oct'])
  })

  it('does not reorder what the controller already ordered: the pairs reach the chart as they come', () => {
    setProps({ availablePairs: [{ at: '2026-10-01', first: 10, second: 20 }, { at: '2026-10-02', first: 30, second: 40 }, { at: '2026-10-10', first: 50, second: null }] })
    renderPage()
    expect(chartOf('Availability').data.labels).toEqual(['1 Oct', '2 Oct', '10 Oct'])
    expect(chartOf('Availability').data.datasets[0].data).toEqual([10, 30, 50])
    expect(chartOf('Availability').data.datasets[1].data).toEqual([20, 40, null])
  })

  // redesign (row 72 Q-08): the duration charts snap their Y step to a human duration, the count charts are as they were
  it('snaps the Y step of the three duration charts to a human duration and leaves Orders and Sales alone', () => {
    renderPage()
    const step = name => chartOf(name).options.scales.y.ticks.stepSize
    expect(step('Availability')).toBe(1800) // 7200 s over at most 6 intervals: 30 min, not a decimal second
    expect(step('Busy time')).toBeDefined()
    expect(step('Times')).toBe(300) // -363 … 600 s: 5 min
    expect(step('Orders')).toBeUndefined()
    expect(step('Sales')).toBeUndefined()
  })

  it('writes the durations with unit, days and sign, and a missing one as a dash (auditor 6, DR-06)', () => {
    renderPage()
    const chart = chartOf('Availability')
    expect(tick(chart, 3600)).toBe('1 h')
    expect(tick(chart, 157581)).toBe('1 d 19 h')
    expect(tick(chart, -4439)).toBe('−1 h 13 min')
    const table = card('Availability').querySelector('figure table')
    expect([...table.querySelectorAll('tbody tr')].map(row => [...row.querySelectorAll('td')].map(normal))).toEqual([['1 h', '30 min'], ['2 h', '']])
  })

  // redesign drivers R1 (P-a): the other side that is missing is written as 0 (as main did), not as an empty cell
  it('Availability downloads the list of the API in its order, in hours, with 0 where the other side is missing', async () => {
    renderPage()
    await userEvent.click(within(card('Availability')).getByRole('button', { name: 'Download CSV: Availability' }))
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^available_times_\d+\.csv$/),
      'Time, Available(h), Not Available(h)\n2026-10-02,2.00,0,\n2026-10-01,1.00,0.50,\n'
    )
  })

  // redesign drivers R1 (P-a): the same for Busy time, whose missing side «Not busy» was an empty cell
  it('Busy time downloads 0 where the other side is missing (the file keeps its comma)', async () => {
    setProps({ busyTimesList: ready({ busy: [{ at: '2026-10-09 14:00:00', time: 5400 }, { at: '2026-10-09 09:00:00', time: 1800 }], not_busy: [{ at: '2026-10-09 09:00:00', time: 600 }] }) })
    renderPage()
    await userEvent.click(within(card('Busy time')).getByRole('button', { name: 'Download CSV: Busy time' }))
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^busy_times_\d+\.csv$/),
      'Time, Busy(h), Not busy(h)\n2026-10-09 14:00:00,1.50,0,\n2026-10-09 09:00:00,0.50,0.17,\n'
    )
  })

  it('Busy time labels the hours by their start, in order, and downloads busy_times with its own header', async () => {
    renderPage()
    const chart = chartOf('Busy time')
    expect(chart.kind).toBe('bar')
    expect(chart.data.labels).toEqual(['09:00', '14:00'])
    expect(chart.data.datasets.map(dataset => dataset.label)).toEqual(['Busy', 'Not busy'])
    expect(chart.data.datasets[0].data).toEqual([1800, 5400])
    expect(chart.data.datasets[1].data).toEqual([600, 900])
    await userEvent.click(within(card('Busy time')).getByRole('button', { name: 'Download CSV: Busy time' }))
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^busy_times_\d+\.csv$/),
      'Time, Busy(h), Not busy(h)\n2026-10-09 14:00:00,1.50,0.25,\n2026-10-09 09:00:00,0.50,0.17,\n'
    )
  })
})

describe('Delivery times (D6, DR-03, DR-19)', () => {
  // redesign drivers R1 (F5): it is a bar chart now (a line does not draw an isolated point), titled «Times» as in main
  it('Times is a bar chart of four series in order of the day, a day without data stays a gap and a negative keeps its sign', () => {
    renderPage()
    const chart = chartOf('Times')
    expect(chart.kind).toBe('bar')
    expect(chart.data.labels).toEqual(['1 Oct', '2 Oct'])
    expect(chart.data.datasets.map(dataset => dataset.label)).toEqual(['Accept', 'Pickup', 'Delivery', 'Completed'])
    expect(chart.data.datasets[0].data).toEqual([60, 90])
    expect(chart.data.datasets[1].data).toEqual([120, -363])
    expect(chart.data.datasets[2].data).toEqual([null, 600])
    expect(chart.data.datasets[3].data).toEqual([300, null])
    expect(tick(chart, 600)).toBe('10 min')
    expect(tick(chart, -363)).toBe('−6 min 3 s')
  })

  it('downloads times with the raw rows of the API in seconds, as main wrote them', async () => {
    renderPage()
    await userEvent.click(within(card('Times')).getByRole('button', { name: 'Download CSV: Times' }))
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^times_\d+\.csv$/),
      'Time, Accept, PickUP, Delivery, Completed\n2026-10-02 00:00:00,90,-363,600,,\n2026-10-01 00:00:00,60,120,,300,\n'
    )
  })
})

describe('the six cards: axis labels, Expand, states', () => {
  it('no label of any axis or table is ISO (decision 13)', () => {
    renderPage()
    CHART_CARDS.forEach(name => {
      const labels = chartOf(name).data.labels
      expect(labels.length, name).toBeGreaterThan(0)
      labels.forEach(label => expect(label, name).not.toMatch(/\d{4}-\d{2}-\d{2}/))
      const rows = tableLabels(name)
      expect(rows.length, name).toBeGreaterThan(0)
      rows.forEach(label => expect(label, name).not.toMatch(/\d{4}-\d{2}-\d{2}/))
    })
  })

  it('a series with times of several days and hours is labelled with the date and the time, never the time alone', () => {
    setProps({ spendSeries: [{ at: '2026-10-01 09:00:00', accept: 1, pickup: 2, delivery: 3, complete: 4 }, { at: '2026-10-02 09:00:00', accept: 1, pickup: 2, delivery: 3, complete: 4 }] })
    renderPage()
    expect(chartOf('Times').data.labels).toEqual(['1 Oct 2026', '2 Oct 2026'])
  })

  it('a bucket per month is labelled with the month of the user\'s language', () => {
    setProps({ availablePairs: [{ at: '2026-08', first: 3600, second: null }, { at: '2026-09', first: 60, second: 60 }] })
    renderPage()
    expect(chartOf('Availability').data.labels).toEqual(['Aug 2026', 'Sep 2026'])
  })

  it('«Expand» opens a large dialog with the same chart; on a phone the card is compact and the dialog is not', async () => {
    window.matchMedia = query => ({ matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {} })
    renderPage()
    expect(card('Availability').querySelector('figure[data-size="compact"]')).not.toBeNull()
    await userEvent.click(within(card('Availability')).getByRole('button', { name: 'Expand: Availability' }))
    const dialog = await screen.findByRole('dialog', { name: 'Availability' })
    expect(dialog.querySelector('figure[data-size="default"]')).not.toBeNull()
    expect(within(dialog).getByTestId('bar-chart')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Availability' })).toBeNull(), { timeout: 4000 })
  })

  it('every chart card has «Expand» and «Download CSV» named after it', () => {
    renderPage()
    CHART_CARDS.forEach(name => {
      expect(within(card(name)).getByRole('button', { name: `Expand: ${name}` }), name).toBeEnabled()
      expect(within(card(name)).getByRole('button', { name: `Download CSV: ${name}` }), name).toBeEnabled()
    })
  })

  it('«Expand» and «Download CSV» are really disabled without rows (DR-07), with «No data»', () => {
    setProps({
      ordersList: ready({}),
      ordersRows: [],
      ordersSeries: [],
      salesRows: [],
      salesSeries: [],
      topDrivers: [],
      topDriversList: ready([]),
      availablePairs: [],
      availableTimesList: ready({ available: [], not_available: [] }),
      busyPairs: [],
      busyTimesList: ready({}),
      spendSeries: [],
      spendTimesList: ready([])
    })
    renderPage()
    CHART_CARDS.forEach(name => {
      expect(within(card(name)).getByRole('button', { name: `Expand: ${name}` }), name).toBeDisabled()
      expect(within(card(name)).getByRole('button', { name: `Download CSV: ${name}` }), name).toBeDisabled()
      expect(within(card(name)).getByText('No data'), name).toBeInTheDocument()
    })
    expect(within(card('Top drivers')).getByRole('button', { name: 'Download CSV: Top drivers' })).toBeDisabled()
    expect(within(card('Top drivers')).getByText('No data')).toBeInTheDocument()
  })

  // redesign with «Today» the API answers rows whose four times are all null; the card drew an empty grid with «Expand» and
  // «Download CSV» enabled. A series with no value at all is «No data», as when there are no rows
  it('rows whose every time is null are «No data», with «Expand» and «Download CSV» disabled', () => {
    const nulls = [
      { time: '2026-10-20 00:00:00', accept_spend: null, pickup_spend: null, delivery_spend: null, complete_spend: null },
      { time: '2026-10-20 01:00:00', accept_spend: null, pickup_spend: null, delivery_spend: null, complete_spend: null }
    ]
    setProps({ spendTimesList: ready(nulls), spendSeries: spendSeriesOf(nulls) })
    renderPage()
    expect(within(card('Times')).getByText('No data')).toBeInTheDocument()
    expect(within(card('Times')).getByRole('button', { name: 'Expand: Times' })).toBeDisabled()
    expect(within(card('Times')).getByRole('button', { name: 'Download CSV: Times' })).toBeDisabled()
  })

  it('a single value among the nulls keeps the chart and its buttons', () => {
    const one = [
      { time: '2026-10-20 00:00:00', accept_spend: null, pickup_spend: null, delivery_spend: null, complete_spend: null },
      { time: '2026-10-20 01:00:00', accept_spend: 0, pickup_spend: null, delivery_spend: null, complete_spend: null }
    ]
    setProps({ spendTimesList: ready(one), spendSeries: spendSeriesOf(one) })
    renderPage()
    expect(within(card('Times')).queryByText('No data')).toBeNull()
    expect(within(card('Times')).getByRole('button', { name: 'Expand: Times' })).toBeEnabled()
  })

  it('while a block loads its card is a skeleton and its buttons are disabled', () => {
    setProps({ spendTimesList: loadingBlock(), spendSeries: [], topDriversList: loadingBlock(), topDrivers: [] })
    renderPage()
    expect(card('Times')).toHaveAttribute('aria-busy', 'true')
    expect(card('Times').querySelector('.odc-skeleton')).not.toBeNull()
    expect(within(card('Times')).getByRole('button', { name: 'Expand: Times' })).toBeDisabled()
    expect(within(card('Times')).getByRole('button', { name: 'Download CSV: Times' })).toBeDisabled()
    expect(within(card('Top drivers')).getByRole('button', { name: 'Download CSV: Top drivers' })).toBeDisabled()
  })

  it.each([
    ['Orders', 'ordersList', 'orders'],
    ['Sales', 'salesList', 'sales'],
    ['Top drivers', 'topDriversList', 'topDrivers'],
    ['Availability', 'availableTimesList', 'availableTimes'],
    ['Busy time', 'busyTimesList', 'busyTimes'],
    ['Times', 'spendTimesList', 'spendTimes'],
    ['Orders by status', 'orderStatusList', 'orderStatus'],
    ['Customer satisfaction', 'customerSatisfactionList', 'customerSatisfaction']
  ])('a failed «%s» paints its error with «Try again», reloads only that block and disables its buttons', async (name, prop, key) => {
    setProps({ [prop]: failed() })
    renderPage()
    expect(within(card(name)).getByText(`${name} could not be loaded.`)).toBeInTheDocument()
    expect(within(card(name)).getByRole('button', { name: `Download CSV: ${name}` })).toBeDisabled()
    await userEvent.click(within(card(name)).getByRole('button', { name: 'Try again' }))
    expect(runtime.props.reloadBlock).toHaveBeenCalledTimes(1)
    expect(runtime.props.reloadBlock).toHaveBeenCalledWith(key)
  })
})

describe('Service and Order locations (D7, D8)', () => {
  it('Service is the one of Business: orders by status (translated, highest first) and customer satisfaction', () => {
    renderPage()
    const rows = [...card('Orders by status').querySelectorAll('tbody tr')].map(row => [normal(row.querySelector('th')), normal(row.querySelector('td'))])
    expect(rows).toEqual([['Pending Order', '100'], ['Accepted by business', '30']])
    expect(normal(card('Orders by status').querySelector('.odc-bi-total'))).toBe('130 orders')
    expect(within(card('Customer satisfaction')).getAllByRole('listitem').map(normal)).toEqual(['General4.5', 'Quality5.0', 'Service3.2'])
  })

  it('draws the map in the Product frame with the valid locations and the Grouped · Heatmap switch', async () => {
    renderPage()
    expect(screen.getByRole('region', { name: 'Orders map' })).toHaveAttribute('data-state', 'ready')
    expect(runtime.map.locations).toEqual([LOCATIONS[0], LOCATIONS[2]])
    const group = screen.getByRole('group', { name: 'Map view' })
    await userEvent.click(within(group).getByRole('button', { name: 'Heatmap' }))
    expect(screen.getByTestId('google-map')).toHaveAttribute('data-heat', 'true')
  })
})

describe('driver-analytics.css', () => {
  const file = path.join(__dirname, '..', 'driver-analytics.css')
  const read = () => readFileSync(file, 'utf8')
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('has no literal color, size, weight, duration or z-index', () => {
    expect(scanSource(read(), file)).toEqual([])
  })

  it('has no physical direction property (RTL)', () => {
    expect(strip(read()).match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
  })

  // redesign drivers FC2 (live check a1): a P/Metric part may be styled, but only as a descendant of a class of this page
  it('only uses the odc-bi prefix for its own classes', () => {
    const css = strip(read())
    // redesign drivers R1 (F2): `.odc-dialog` and `.odc-chart` of P/ appear too, but only in a selector that carries `.odc-bi-chart-dialog`
    const own = (css.match(/\.[a-z][\w-]*/g) ?? []).filter(name => !name.startsWith('.odc-bi-') && !['.odc-metric-value', '.odc-dialog', '.odc-chart'].includes(name))
    expect(own).toEqual([])
    const selectors = css.match(/[^{}]+(?=\{)/g) ?? []
    selectors.filter(selector => selector.includes('.odc-metric-value')).forEach(selector => {
      expect(selector.trim()).toMatch(/^\.odc-bi-[\w-]+ \.odc-metric-value$/)
    })
    selectors.filter(selector => /\.odc-(?:dialog|chart)\b/.test(selector)).forEach(selector => {
      expect(selector, 'a P/ class only next to the dialog class of the page').toContain('.odc-bi-chart-dialog')
    })
  })

  it('has its breakpoints on the numbers of the dashboard', () => {
    const widths = [...strip(read()).matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g)].map(match => Number(match[1]))
    widths.forEach(width => expect([767, 768, 1024, 1280]).toContain(width))
  })
})

// ---- redesign drivers R1 (F2, F3, F5) -----------------------------------------------------------------------------------------------------
describe('R1 F2: «Expand» enlarges the chart (the modal of main: 70% of the width, 60vh of chart)', () => {
  const css = () => readFileSync(path.join(__dirname, '..', 'driver-analytics.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  it.each(CHART_CARDS)('the dialog of «%s» carries the class odc-bi-chart-dialog', async (name) => {
    renderPage()
    await userEvent.click(within(card(name)).getByRole('button', { name: `Expand: ${name}` }))
    const dialog = await screen.findByRole('dialog', { name })
    expect(dialog).toHaveClass('odc-dialog', 'odc-bi-chart-dialog')
  })

  it('the CSS gives that dialog 70vw (up to the viewport minus its gaps) from 768px and its chart 60vh', () => {
    const rules = css()
    const media = rules.match(/@media \(min-width:\s*768px\)\s*\{([\s\S]*?\n\})/)?.[1] ?? ''
    expect(media).toMatch(/\.odc-dialog\.odc-bi-chart-dialog(?:\[data-size\])?\s*\{[^}]*inline-size:\s*70vw;[^}]*max-inline-size:\s*calc\(100vw - 2 \* var\(--od-x-viewport-gap\)\);[^}]*\}/)
    expect(media).toMatch(/\.odc-bi-chart-dialog \.odc-chart\s*\{[^}]*--odc-chart-height:\s*60vh;[^}]*\}/)
  })
})

describe('R1 F3: a failed map says so, with «Try again»', () => {
  it('paints the card of the map with its error instead of an empty map, and «Try again» reloads only the location block', async () => {
    setProps({ orderLocationList: failed({ locations: [] }) })
    renderPage()
    const region = screen.getByRole('region', { name: 'Orders map' })
    expect(within(region).getByText('Orders map could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Map view' })).toBeNull()
    expect(screen.queryByTestId('google-map')).toBeNull()
    await userEvent.click(within(region).getByRole('button', { name: 'Try again' }))
    expect(runtime.props.reloadBlock).toHaveBeenCalledTimes(1)
    expect(runtime.props.reloadBlock).toHaveBeenCalledWith('orderLocation')
  })

  it('keeps the map (its skeleton) while it loads, even if the last try failed', () => {
    setProps({ orderLocationList: { loading: true, error: 'boom', data: [], locations: [] } })
    renderPage()
    expect(screen.getByRole('group', { name: 'Map view' })).toBeInTheDocument()
    expect(screen.queryByText('Orders map could not be loaded.')).toBeNull()
  })

  // redesign (Drivers part): the page reuses `BusinessHeatmap`, so «Try again» keeps the card mounted while it reloads and the
  // focus never falls on <body>
  it('the focus stays on the card while it reloads and lands on the map frame when it loads, never on <body>', async () => {
    setProps({ orderLocationList: failed({ locations: [] }) })
    const view = renderPage()
    await userEvent.click(within(screen.getByRole('region', { name: 'Orders map' })).getByRole('button', { name: 'Try again' }))
    expect(document.activeElement).not.toBe(document.body)
    setProps({ orderLocationList: { loading: true, error: 'boom', data: [], locations: [] } })
    act(() => view.rerender(<DriverAnalytics />))
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toHaveTextContent('Orders map')
    setProps()
    act(() => view.rerender(<DriverAnalytics />))
    expect(screen.getByTestId('google-map')).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Orders map' }))
  })

  it('without an error the map is the one of Business, as before', () => {
    renderPage()
    expect(screen.getByRole('group', { name: 'Map view' })).toBeInTheDocument()
    expect(screen.queryByText('Orders map could not be loaded.')).toBeNull()
  })
})

describe('R1 F5: the times are drawn as bars, titled «Times»', () => {
  it('is a bar chart (an isolated point is a bar, not an invisible dot) titled «Times»', () => {
    setProps({ spendSeries: [{ at: '2026-10-09 10:00:00', accept: -14160, pickup: -14100, delivery: null, complete: null }] })
    renderPage()
    const chart = chartOf('Times')
    expect(chart.kind).toBe('bar')
    expect(chart.data.datasets[0].data).toEqual([-14160])
    expect(within(screen.getByRole('heading', { level: 2, name: 'Delivery times' }).closest('section')).getByRole('region', { name: 'Times' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Times by day' })).toBeNull()
  })

  it('does not use the key of «Times by day» any more', () => {
    const source = readFileSync(path.join(__dirname, '..', 'DriverSections.jsx'), 'utf8')
    expect(source).not.toContain('DRIVER_REPORTS_TIMES_BY_DAY')
    expect(source).toContain("t('TIMES', 'Times')")
  })
})
