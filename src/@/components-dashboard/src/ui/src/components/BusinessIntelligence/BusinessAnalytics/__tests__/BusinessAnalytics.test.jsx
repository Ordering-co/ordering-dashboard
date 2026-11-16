/* eslint-disable import/first */
// redesign bi FD (D1-D10; auditor 1, 4, 6, 8, 9, 12; BI-07, BI-08, BI-09, BI-13, BI-16, BI-20): the page /intelligence/business.
// The controller of the page (`BusinessAnalytics` of `~components`) is a stand-in that hands the UI fixed props, as the real one does; the
// controllers of the filters are stand-ins too (they hand their UIComponent what the real ones hand it). What is under test is the new UI:
// the order of the page, the six figures with their references, the blocks, the CSV files and the map.
import React from 'react'
import moment from 'moment'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

const runtime = vi.hoisted(() => ({
  props: {},
  charts: [],
  map: null,
  collapsed: false,
  collapse: vi.fn(),
  learn: null,
  stores: {},
  brands: {},
  countries: {},
  appIdList: { loading: false, ids: [], error: null }
}))

vi.mock('react-chartjs-2', () => ({
  Line: props => { runtime.charts.push(props); return <canvas data-testid='line-chart' aria-label={props['aria-label']} /> },
  Bar: props => { runtime.charts.push(props); return <canvas data-testid='bar-chart' aria-label={props['aria-label']} /> }
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  const controller = key => function Controller (props) {
    const { UIComponent, ...rest } = props
    return react.createElement(UIComponent, { ...rest, ...runtime[key] })
  }
  return {
    // the controller of the page: it hands the UI the props of the test
    BusinessAnalytics: ({ UIComponent, ...rest }) => react.createElement(UIComponent, { ...rest, ...runtime.props }),
    AnalyticsStatusSubFilter: ({ UIComponent, ...rest }) => react.createElement(UIComponent, { ...rest, appIdList: runtime.appIdList }),
    AnalyticsBusinessFilter: controller('stores'),
    ReportsBrandFilter: controller('brands'),
    CountryList: controller('countries'),
    GoogleMapsMap: props => { runtime.map = props; return react.createElement('div', { 'data-testid': 'google-map', 'data-heat': String(props.isHeat) }) },
    useLanguage: () => [{ language: { code: 'en' } }, (_key, text) => text],
    useConfig: () => [{ configs: runtime.configs }],
    useUtils: () => [{
      parsePrice: value => `$${Number(value).toFixed(2)}`,
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

import { downloadCsv } from '../../../../../../utils/businessReports'
import { BusinessAnalytics } from '../index'

const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const ready = (data, extra = {}) => ({ loading: false, error: null, data, ...extra })
const loadingBlock = (extra = {}) => ({ loading: true, error: null, data: [], ...extra })
const failed = (extra = {}) => ({ loading: false, error: 'boom', data: [], ...extra })

const DAY_PERIOD = { from: '2026-10-01', to: '2026-10-03', days: 3, includesToday: false, granularity: 'day' }
const HOUR_PERIOD = { from: '2026-10-09', to: '2026-10-09', days: 1, includesToday: true, granularity: 'hour' }
const MONTH_PERIOD = { from: '2026-07-15', to: '2026-09-20', days: 68, includesToday: false, granularity: 'month' }

const ORDER_ROWS = [{ time: '2026-10-01 00:00:00', orders: 2 }, { time: '2026-10-03 00:00:00', orders: 5 }]
const SALES_ROWS = [{ time: '2026-10-01 10:00:00', sales: 10.5 }, { time: '2026-10-02 10:00:00', sales: 20 }]
const USER_ROWS = [{ time: '2026-10-02 00:00:00', users: 4 }]
const STATUS_ROWS = [{ status: 7, orders: 30 }, { status: 0, orders: 100 }, { status: 11, orders: 30 }, { status: 99, orders: 0 }]
const LOCATIONS = [{ lat: '4.6', lng: '-74.1' }, { lat: 'x', lng: '1' }, { lat: 5, lng: -70 }]

const NO_CHANGE = { orders: null, sales: null, users: null, averageTicket: null }
const comparisonOf = (plan, previous, change = NO_CHANGE, extra = {}) => ({ loading: false, error: null, plan, previous, current: null, change, ...extra })

const baseProps = () => ({
  filterList: { lapse: 'last_7_days', businessIds: null, app_id: 'all', franchises_id: null, timeZone: BROWSER_ZONE },
  handleChangeFilterList: vi.fn(),
  countryCode: '',
  handleChangeCode: vi.fn(),
  period: DAY_PERIOD,
  chartPeriod: DAY_PERIOD, // redesign bi R1 targeted (N1): the chart axis has its own period
  totals: { orders: 7, sales: 30.5, users: 4, averageTicket: 30.5 / 7, acceptSeconds: 345, pickupSeconds: 2705 },
  comparison: comparisonOf(
    { mode: 'previous', previous: '2026-09-28,2026-09-30', days: 3 },
    { orders: 5, sales: 20, users: 2, averageTicket: 4 },
    { orders: 40, sales: 52.5, users: 100, averageTicket: -8.9 }
  ),
  reloadComparison: vi.fn(),
  reloadBlock: vi.fn(),
  ordersList: ready(ORDER_ROWS),
  salesList: ready(SALES_ROWS),
  topProductList: ready([{ name: 'Burger, large', sales: 40 }, { name: 'Fries', sales: 25 }]),
  topCategoryList: ready([{ name: 'Mains', sales: 70 }, { name: 'Sides', sales: 30 }]),
  orderStatusList: ready(STATUS_ROWS),
  registerUsersList: ready(USER_ROWS),
  customerSatisfactionList: ready({ general: '4.50', quality: '5.00', delivery: 0, service: '3.20', package: '' }),
  ordersAcceptSpendList: ready(345),
  arrivedPickUpSpendList: ready(2705),
  orderLocationList: ready(LOCATIONS, { locations: LOCATIONS })
})

const setProps = (patch = {}) => { runtime.props = { ...baseProps(), ...patch } }
const renderPage = () => render(<BusinessAnalytics />)

const normal = (node) => node.textContent.replace(/\s+/g, ' ').trim()
const metric = (key) => document.querySelector(`[data-metric="${key}"]`)
const valueOf = (key) => normal(metric(key).querySelector('.odc-metric-value'))
const refsOf = (key) => [...metric(key).querySelectorAll('.odc-metric-ref')].map(normal)
const card = (name) => screen.getByRole('region', { name })
const chartOf = (name) => runtime.charts.filter(chart => chart['aria-label'] === name).pop()
const listRows = (table) => within(table).getAllByRole('row').slice(1).map(row => [normal(row.querySelector('th')), normal(row.querySelector('td'))])
const tick = (chart, value) => chart.options.scales.y.ticks.callback(value)

beforeEach(() => {
  vi.clearAllMocks()
  runtime.charts = []
  runtime.map = null
  runtime.collapsed = false
  runtime.learn = null
  runtime.configs = { google_maps_api_key: { value: 'key' }, location_default_latitude: { value: '4.7' }, location_default_longitude: { value: '-74.0' } }
  runtime.appIdList = { loading: false, ids: ['web', 'ios'], error: null }
  runtime.stores = {
    businessList: { loading: false, error: null, businesses: [], pagination: { current_page: 1, page_size: 10, total_pages: 1, total: 0 } },
    businessIds: [],
    handleChangeBusinessId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn(),
    handleChangeBusinessPage: vi.fn(),
    handleChangeBusinessPageSize: vi.fn(),
    searchValue: null,
    onSearch: vi.fn()
  }
  runtime.brands = {
    brandList: { loading: false, error: null, brands: [], pagination: null },
    brandIds: null,
    handleChangeBrandId: vi.fn(),
    handleClickFilterButton: vi.fn(),
    isAllCheck: false,
    handleChangeAllCheck: vi.fn()
  }
  runtime.countries = {
    countriesState: { loading: false, error: null, countries: [] },
    searchValue: null,
    onSearch: vi.fn(),
    handleClickFilterButton: vi.fn(),
    code: '',
    setCode: vi.fn(),
    actionState: { loading: false, error: null }
  }
  setProps()
})
afterEach(() => {
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

describe('the page: header, controls and order', () => {
  it('has one h1 «Business reports» and Learn with the business_reports article', () => {
    renderPage()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Business reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(runtime.learn.map(option => option.value)).toEqual(['business_reports'])
  })

  it('has «Open menu» only with the sidebar collapsed, and it opens the menu', async () => {
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

  it('paints, from top to bottom: header, period, filters, channels, figures, the five sections and the map last', () => {
    renderPage()
    const nodes = [
      screen.getByRole('heading', { level: 1 }),
      screen.getByRole('group', { name: 'Period' }),
      screen.getByRole('group', { name: 'Filters' }),
      screen.getByRole('group', { name: 'Channel' }),
      metric('orders'),
      screen.getByRole('heading', { level: 2, name: 'Orders and sales' }),
      screen.getByRole('heading', { level: 2, name: 'What sells' }),
      screen.getByRole('heading', { level: 2, name: 'Service' }),
      screen.getByRole('heading', { level: 2, name: 'Customers' }),
      screen.getByRole('heading', { level: 2, name: 'Where orders come from' }),
      screen.getByRole('region', { name: 'Orders map' })
    ]
    nodes.slice(1).forEach((node, index) => {
      expect(nodes[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING, `node ${index + 1} follows node ${index}`).toBeTruthy()
    })
  })

  it('the period buttons and the channels write into the filters of the controller', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Yesterday' }))
    expect(runtime.props.handleChangeFilterList).toHaveBeenCalledWith({ ...runtime.props.filterList, lapse: 'yesterday' })
    await userEvent.click(screen.getByRole('button', { name: 'ios' }))
    expect(runtime.props.handleChangeFilterList).toHaveBeenCalledWith({ ...runtime.props.filterList, app_id: 'ios' })
  })

  it('has no styled-component of the old page: the container is the odc-bi-page', () => {
    const { container } = renderPage()
    expect(container.querySelector('.odc-bi-page')).not.toBeNull()
  })
})

// redesign (D-21, option B): Business keeps the country opening by itself on the first load. Its bar is never mounted again during
// a visit (no tabs, `UIComponent` is one constant), so there is nothing to reopen: a change of period or of filters must not open it again.
describe('the Country pill (D-21)', () => {
  const TWO = [{ id: 1, code: 'CO', name: 'Colombia' }, { id: 2, code: 'US', name: 'United States' }]

  it('opens by itself with several countries, as always', async () => {
    runtime.countries.countriesState = { loading: false, error: null, countries: TWO }
    renderPage()
    expect(await screen.findByRole('dialog', { name: 'Country' })).toBeInTheDocument()
  })

  it('once closed it stays closed through a change of period or filters (the bar is not mounted again)', async () => {
    runtime.countries.countriesState = { loading: false, error: null, countries: TWO }
    const view = renderPage()
    await screen.findByRole('dialog', { name: 'Country' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull(), { timeout: 4000 })
    setProps({ filterList: { ...runtime.props.filterList, lapse: 'yesterday', businessIds: [1] } })
    view.rerender(<BusinessAnalytics />)
    expect(screen.queryByRole('dialog', { name: 'Country' })).toBeNull()
    expect(screen.getByRole('button', { name: /^Country/ })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('the six figures', () => {
  // redesign bi R1 (F3, live check f3.js): a reload keeps the last figures, dimmed, instead of skeletons, so the page does not move
  it('keeps the last figures while a new period loads, and shows skeletons only on the first load', () => {
    setProps({ ordersList: loadingBlock(), totals: { ...baseProps().totals, orders: null } })
    const first = renderPage()
    expect(metric('orders').querySelector('.odc-metric-value .odc-figure')).toBeNull()
    first.unmount()
    setProps()
    const view = renderPage()
    expect(valueOf('orders')).toBe('7')
    setProps({
      ordersList: loadingBlock(),
      salesList: loadingBlock(),
      totals: { ...baseProps().totals, orders: null, sales: null, averageTicket: null },
      comparison: { ...baseProps().comparison, loading: true }
    })
    view.rerender(<BusinessAnalytics />)
    expect(valueOf('orders')).toBe('7')
    expect(valueOf('sales')).toBe('$30.50')
    expect(metric('orders').hasAttribute('data-stale')).toBe(true)
    expect(metric('users').hasAttribute('data-stale')).toBe(true)
    expect(refsOf('orders')[0]).toMatch(/40/)
    setProps()
    view.rerender(<BusinessAnalytics />)
    expect(metric('orders').hasAttribute('data-stale')).toBe(false)
  })

  it('paint orders, sales (with currency), ticket, registered users and the two durations, each in a figure node', () => {
    renderPage()
    expect(valueOf('orders')).toBe('7')
    expect(valueOf('sales')).toBe('$30.50')
    expect(valueOf('ticket')).toBe('$4.36')
    expect(valueOf('users')).toBe('4')
    expect(valueOf('accept')).toBe('5 min 45 s')
    expect(valueOf('pickup')).toBe('45 min 5 s')
    ;['orders', 'sales', 'ticket', 'users', 'accept', 'pickup'].forEach(key => {
      expect(metric(key).querySelector('.odc-metric-value .odc-figure bdi')).not.toBeNull()
    })
    expect(normal(metric('orders').querySelector('.odc-metric-label'))).toBe('Orders')
    expect(normal(metric('ticket').querySelector('.odc-metric-label'))).toBe('Average ticket')
    expect(normal(metric('users').querySelector('.odc-metric-label'))).toBe('Registered users')
    expect(normal(metric('accept').querySelector('.odc-metric-label'))).toBe('Time to accept')
    expect(normal(metric('pickup').querySelector('.odc-metric-label'))).toBe('Wait at pickup')
  })

  it('helps: the ticket says it includes cancelled orders; the two durations say they are averages', () => {
    renderPage()
    expect(refsOf('ticket')).toContain('Includes cancelled orders')
    expect(refsOf('accept')).toEqual(['Average in this period'])
    expect(refsOf('pickup')).toEqual(['Average in this period'])
  })

  // (tanda AK, AK-282): the orders figure says which base it shares with its comparison
  it('orders say they include cancelled orders when compared «by now», and exclude them over a whole period', () => {
    setProps({ totals: { ...baseProps().totals, ordersBase: 'includesCancelled' } })
    const { unmount } = renderPage()
    expect(refsOf('orders')).toContain('Includes cancelled orders')
    expect(refsOf('orders')).not.toContain('Excludes cancelled orders')
    unmount()
    setProps({ totals: { ...baseProps().totals, ordersBase: 'excludesCancelled' } })
    renderPage()
    expect(refsOf('orders')).toContain('Excludes cancelled orders')
    expect(refsOf('ticket')).toContain('Includes cancelled orders')
  })

  it('without cancelled orders the statuses feed the orders figure: their failure is a dash and «Try again» reloads them', async () => {
    setProps({
      orderStatusList: failed(),
      totals: { ...baseProps().totals, ordersBase: 'excludesCancelled', orders: null }
    })
    renderPage()
    expect(valueOf('orders')).toBe('—')
    const notice = screen.getByText('Some figures could not be loaded.').closest('[role="status"]')
    await userEvent.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(runtime.props.reloadBlock.mock.calls.map(call => call[0])).toEqual(['orderStatus'])
  })

  // blocks the API answered without the cancelled orders (`excludesCancelled`) say so on orders, sales and ticket, and the
  // statuses no longer feed the orders figure
  it('with orders and sales the API answered without cancelled orders, the three figures say they exclude them', () => {
    setProps({
      ordersList: ready(ORDER_ROWS, { excludesCancelled: true }),
      salesList: ready(SALES_ROWS, { excludesCancelled: true }),
      orderStatusList: failed(),
      totals: { ...baseProps().totals, ordersBase: 'excludesCancelled' }
    })
    renderPage()
    ;['orders', 'sales', 'ticket'].forEach(key => {
      expect(refsOf(key)).toContain('Excludes cancelled orders')
      expect(refsOf(key)).not.toContain('Includes cancelled orders')
    })
    expect(valueOf('orders')).toBe('7')
    expect(screen.queryByText('Some figures could not be loaded.')).toBeNull()
  })

  it('orders marked and sales not: each says its base, the ticket says none and its dash is not «No orders yet»', () => {
    setProps({
      ordersList: ready(ORDER_ROWS, { excludesCancelled: true }),
      totals: { ...baseProps().totals, ordersBase: 'excludesCancelled', averageTicket: null }
    })
    renderPage()
    expect(refsOf('orders')).toContain('Excludes cancelled orders')
    expect(refsOf('sales').some(text => /cancelled/.test(text))).toBe(false)
    expect(refsOf('ticket').some(text => /cancelled/.test(text))).toBe(false)
    expect(within(metric('ticket')).queryByRole('img', { name: 'No orders yet' })).toBeNull()
    expect(valueOf('ticket')).toBe('—')
  })

  it('without the mark of the API, sales say nothing about cancelled orders and the ticket includes them', () => {
    renderPage()
    expect(refsOf('sales').some(text => /cancelled/.test(text))).toBe(false)
    expect(refsOf('ticket')).toContain('Includes cancelled orders')
  })

  it('a day without orders paints a dash named «No orders yet» for the ticket, never $0.00', () => {
    setProps({ totals: { ...baseProps().totals, orders: 0, sales: 0, averageTicket: null } })
    renderPage()
    const dash = metric('ticket').querySelector('.odc-metric-value .odc-figure')
    expect(dash).toHaveTextContent('—')
    expect(within(metric('ticket')).getByRole('img', { name: 'No orders yet' })).toBeInTheDocument()
  })

  it('while a block loads, its figures are skeletons and the region is busy', () => {
    setProps({ ordersList: loadingBlock(), totals: { ...baseProps().totals, orders: null, averageTicket: null } })
    renderPage()
    expect(metric('orders').querySelector('.odc-metric-value .odc-skeleton')).not.toBeNull()
    expect(metric('ticket').querySelector('.odc-metric-value .odc-skeleton')).not.toBeNull()
    expect(metric('sales').querySelector('.odc-metric-value .odc-skeleton')).toBeNull()
    expect(metric('sales')).toHaveTextContent('$30.50')
  })

  it('a failed block makes its figures dashes and one warning with «Try again» reloads only the blocks that failed', async () => {
    setProps({
      salesList: failed(),
      registerUsersList: failed(),
      totals: { ...baseProps().totals, sales: null, users: null, averageTicket: null }
    })
    renderPage()
    expect(valueOf('sales')).toBe('—')
    expect(valueOf('ticket')).toBe('—')
    expect(valueOf('users')).toBe('—')
    expect(valueOf('orders')).toBe('7')
    const notice = screen.getByText('Some figures could not be loaded.').closest('[role="status"]')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    await userEvent.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(runtime.props.reloadBlock.mock.calls.map(call => call[0]).sort()).toEqual(['registerUsers', 'sales'])
  })

  it('has no warning when every figure loads', () => {
    renderPage()
    expect(screen.queryByText('Some figures could not be loaded.')).toBeNull()
  })
})

describe('the references (D2, auditor 1, 9, 12)', () => {
  const planPrevious = days => ({ mode: 'previous', previous: 'a,b', days })
  const planClosed = days => ({ mode: 'closed', current: 'a,b', previous: 'c,d', days })
  const previous = { orders: 5, sales: 20, users: 2, averageTicket: 4 }
  const change = { orders: 40, sales: 52.5, users: 100, averageTicket: -8.9 }

  it('Today («by now») says «Yesterday by this time», has no percentage, and users have no reference', () => {
    setProps({
      comparison: comparisonOf({ mode: 'byNow', previous: 'a,a', hour: 14 }, { orders: 3, sales: 12, users: null, averageTicket: 4 })
    })
    renderPage()
    expect(refsOf('orders')).toEqual(['Yesterday by this time: 3', 'Includes cancelled orders'])
    expect(refsOf('sales')).toEqual(['Yesterday by this time: $12.00'])
    expect(refsOf('ticket')[0]).toBe('Yesterday by this time: $4.00')
    expect(refsOf('users')).toEqual([])
    ;['orders', 'sales', 'ticket'].forEach(key => expect(refsOf(key)[0]).not.toMatch(/%/))
  })

  it('previous: a signed percentage with U+2212 for a drop, and the previous figure in a figure node', () => {
    setProps({ comparison: comparisonOf(planPrevious(3), previous, change) })
    renderPage()
    expect(refsOf('orders')[0]).toBe('+40.0% vs the previous 3 days (5)')
    expect(refsOf('sales')).toEqual(['+52.5% vs the previous 3 days ($20.00)'])
    expect(refsOf('ticket')[0]).toBe('−8.9% vs the previous 3 days ($4.00)')
    expect(refsOf('users')).toEqual(['+100.0% vs the previous 3 days (2)'])
    expect(metric('orders').querySelector('.odc-metric-ref .odc-figure bdi')).not.toBeNull()
  })

  it('previous with one day uses the singular', () => {
    setProps({ comparison: comparisonOf(planPrevious(1), previous, change) })
    renderPage()
    expect(refsOf('orders')[0]).toBe('+40.0% vs the previous day (5)')
  })

  it('previous without a percentage (the previous figure was 0 or the range is by month) says «Previous N days: value»', () => {
    setProps({ comparison: comparisonOf(planPrevious(3), previous) })
    renderPage()
    expect(refsOf('orders')[0]).toBe('Previous 3 days: 5')
    expect(refsOf('sales')).toEqual(['Previous 3 days: $20.00'])
    setProps({ comparison: comparisonOf(planPrevious(1), previous) })
    document.body.innerHTML = ''
    renderPage()
    expect(refsOf('orders')[0]).toBe('Previous day: 5')
  })

  it('closed days say what they cover, with and without percentage, singular and plural', () => {
    setProps({ comparison: comparisonOf(planClosed(7), previous, { ...change, orders: 10 }) })
    renderPage()
    expect(refsOf('orders')[0]).toBe('+10.0% over the last 7 full days vs the 7 before (5)')
    document.body.innerHTML = ''
    setProps({ comparison: comparisonOf(planClosed(1), previous, { ...change, orders: 10 }) })
    renderPage()
    expect(refsOf('orders')[0]).toBe('+10.0% yesterday vs the day before (5)')
    document.body.innerHTML = ''
    setProps({ comparison: comparisonOf(planClosed(7), previous) })
    renderPage()
    expect(refsOf('orders')[0]).toBe('The 7 days before: 5')
    document.body.innerHTML = ''
    setProps({ comparison: comparisonOf(planClosed(1), previous) })
    renderPage()
    expect(refsOf('orders')[0]).toBe('The day before: 5')
  })

  it('a drop of exactly 0 has no sign and the references are neutral text (no color class, no icon)', () => {
    setProps({ comparison: comparisonOf(planPrevious(3), previous, { ...change, orders: 0 }) })
    renderPage()
    expect(refsOf('orders')[0]).toBe('0.0% vs the previous 3 days (5)')
    expect(metric('orders').querySelector('.odc-metric-ref svg')).toBeNull()
  })

  it('while the comparison loads, the references are skeletons and the figures stay', () => {
    setProps({ comparison: comparisonOf(planPrevious(3), { orders: null, sales: null, users: null, averageTicket: null }, NO_CHANGE, { loading: true }) })
    renderPage()
    expect(metric('orders').querySelector('.odc-metric-ref .odc-skeleton')).not.toBeNull()
    expect(valueOf('orders')).toBe('7')
  })

  it('a failed comparison paints no reference, and a notice with «Try again» reloads the comparison', async () => {
    setProps({ comparison: comparisonOf(planPrevious(3), { orders: null, sales: null, users: null, averageTicket: null }, NO_CHANGE, { error: 'boom' }) })
    renderPage()
    expect(refsOf('orders')).toEqual(['Includes cancelled orders'])
    const notice = screen.getByText(/previous period could not be loaded/i).closest('[role="status"]')
    await userEvent.click(within(notice).getByRole('button', { name: 'Try again' }))
    expect(runtime.props.reloadComparison).toHaveBeenCalledTimes(1)
  })

  // redesign bi R1 (F4): the first reference of each figure, loaded, is the lead one (the page reserves its height)
  const leads = key => [...metric(key).querySelectorAll('.odc-metric-ref')].map(node => node.hasAttribute('data-lead'))

  it('the first loaded reference of each figure is marked lead, the help lines under it are not (R1 F4)', () => {
    setProps({ comparison: comparisonOf(planPrevious(3), previous, change) })
    renderPage()
    expect(leads('orders')).toEqual([true, false])
    expect(leads('ticket')).toEqual([true, false])
    expect(leads('accept')).toEqual([true])
    expect(leads('pickup')).toEqual([true])
  })

  it('without a comparison reference the help line becomes the lead one, as it is while loading (R1 F4)', () => {
    setProps({ comparison: comparisonOf(planPrevious(3), { orders: null, sales: null, users: null, averageTicket: null }, NO_CHANGE, { error: 'boom' }) })
    renderPage()
    expect(leads('orders')).toEqual([true])
    expect(leads('ticket')).toEqual([true])
  })

  it('before the first plan, the references are reserved by the day of the zone of the filter (R1 F1)', () => {
    // 2026-10-10T04:06:00Z is 13:06 of 10-10 in Tokyo and 18:06 of 10-09 in Honolulu: «2026-10-10» is today in the first and the future in the second
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T04:06:00Z'))
    try {
      const loadingPlanless = timeZone => ({
        filterList: { ...baseProps().filterList, lapse: '2026-10-10,2026-10-10', timeZone },
        comparison: comparisonOf(null, null, NO_CHANGE, { loading: true })
      })
      setProps(loadingPlanless('Asia/Tokyo'))
      renderPage()
      // by now: the registered users have no reference
      expect(metric('users').querySelectorAll('.odc-metric-ref')).toHaveLength(0)
      document.body.innerHTML = ''
      setProps(loadingPlanless('Pacific/Honolulu'))
      renderPage()
      expect(metric('users').querySelectorAll('.odc-metric-ref')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Orders and sales', () => {
  // review AK-R2: the chart draws every order by hour or day, cancelled too (no status per hour), under a figure that may
  // leave them out: the chart says so
  it('the Orders chart says it includes cancelled orders; the Sales chart says nothing', () => {
    setProps({ totals: { ...baseProps().totals, ordersBase: 'excludesCancelled' } })
    renderPage()
    const card = name => screen.getByRole('heading', { level: 3, name }).closest('.odc-bi-card')
    expect(within(card('Orders')).getByText('Includes cancelled orders')).toHaveClass('odc-bi-chart-note')
    expect(within(card('Sales')).queryByText(/cancelled/)).toBeNull()
  })

  // what the API answered without the cancelled orders, the chart says so
  it('the Orders and Sales charts say they exclude cancelled orders when the API left them out', () => {
    setProps({ ordersList: ready(ORDER_ROWS, { excludesCancelled: true }), salesList: ready(SALES_ROWS, { excludesCancelled: true }) })
    renderPage()
    const card = name => screen.getByRole('heading', { level: 3, name }).closest('.odc-bi-card')
    expect(within(card('Orders')).getByText('Excludes cancelled orders')).toHaveClass('odc-bi-chart-note')
    expect(within(card('Sales')).getByText('Excludes cancelled orders')).toHaveClass('odc-bi-chart-note')
  })

  it('draws a line chart per card with the series of the API on the axis of the period, labelled by day', () => {
    renderPage()
    const orders = chartOf('Orders')
    const sales = chartOf('Sales')
    expect(orders.data.labels).toEqual(['1 Oct', '2 Oct', '3 Oct'])
    expect(orders.data.datasets).toHaveLength(1)
    expect(orders.data.datasets[0].data).toEqual([2, 0, 5])
    expect(sales.data.datasets[0].data).toEqual([10.5, 20, 0])
    expect(screen.getAllByTestId('line-chart').length).toBeGreaterThanOrEqual(3)
  })

  it('the values: orders as whole numbers, sales as currency', () => {
    renderPage()
    expect(tick(chartOf('Orders'), 3)).toBe('3')
    expect(tick(chartOf('Sales'), 5)).toBe('$5.00')
  })

  // redesign bi R1 targeted (N1): with a zone other than the browser's the controller sends no chart period and the rows are drawn as they come
  it('draws the rows as they come, in time order and with their dates, when there is no chart period (another zone)', () => {
    setProps({ chartPeriod: null, ordersList: ready([{ time: '2026-10-09 13:00:00', orders: 1 }, { time: '2026-10-08 14:00:00', orders: 3 }]) })
    renderPage()
    const chart = chartOf('Orders')
    expect(chart.data.datasets[0].data).toEqual([3, 1])
    expect(chart.data.labels).toHaveLength(2)
    chart.data.labels.forEach(label => expect(label).not.toMatch(/\d{4}-\d{2}-\d{2}/))
  })

  it('labels the hours by their start in the project time format, and the months localized', () => {
    setProps({ period: HOUR_PERIOD, chartPeriod: HOUR_PERIOD, ordersList: ready([{ time: '2026-10-09 14:00:00', orders: 3 }]) })
    renderPage()
    const hourly = chartOf('Orders')
    expect(hourly.data.labels).toHaveLength(24)
    expect(hourly.data.labels[0]).toBe('00:00')
    expect(hourly.data.labels[13]).toBe('13:00')
    expect(hourly.data.datasets[0].data[13]).toBe(3)
    document.body.innerHTML = ''
    runtime.charts = []
    setProps({ period: MONTH_PERIOD, chartPeriod: MONTH_PERIOD, ordersList: ready([{ time: '2026-08-01 00:00:00', orders: 9 }]) })
    renderPage()
    expect(chartOf('Orders').data.labels).toEqual(['Jul 2026', 'Aug 2026', 'Sep 2026'])
    expect(chartOf('Orders').data.datasets[0].data).toEqual([0, 9, 0])
  })

  it('the table alternative has the header of the granularity', () => {
    renderPage()
    const tables = screen.getAllByRole('table', { hidden: true })
    expect(tables.some(table => within(table).queryByRole('columnheader', { name: 'Date', hidden: true }))).toBe(true)
  })

  it('«Expand» opens a large dialog with the same chart; on a phone the card is compact and the dialog is not', async () => {
    window.matchMedia = query => ({ matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {} })
    renderPage()
    expect(card('Orders').querySelector('figure[data-size="compact"]')).not.toBeNull()
    await userEvent.click(within(card('Orders')).getByRole('button', { name: 'Expand: Orders' }))
    const dialog = await screen.findByRole('dialog', { name: 'Orders' })
    expect(dialog.querySelector('figure[data-size="default"]')).not.toBeNull()
    expect(within(dialog).getByTestId('line-chart')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Orders' })).toBeNull(), { timeout: 4000 })
  })

  it('«Download CSV» writes the rows of the API as they come, with the names and header of main', async () => {
    renderPage()
    await userEvent.click(within(card('Orders')).getByRole('button', { name: 'Download CSV: Orders' }))
    expect(downloadCsv).toHaveBeenCalledWith(expect.stringMatching(/^orders_\d+\.csv$/), 'Time, Orders\n2026-10-01 00:00:00,2,\n2026-10-03 00:00:00,5,\n')
    await userEvent.click(within(card('Sales')).getByRole('button', { name: 'Download CSV: Sales' }))
    expect(downloadCsv).toHaveBeenLastCalledWith(expect.stringMatching(/^sales_\d+\.csv$/), 'Time, Sales\n2026-10-01 10:00:00,10.5,\n2026-10-02 10:00:00,20,\n')
  })

  it('the buttons are really disabled without data and while loading', () => {
    setProps({ ordersList: ready([]), salesList: loadingBlock() })
    renderPage()
    ;['Orders', 'Sales'].forEach(name => {
      expect(within(card(name)).getByRole('button', { name: `Expand: ${name}` })).toBeDisabled()
      expect(within(card(name)).getByRole('button', { name: `Download CSV: ${name}` })).toBeDisabled()
    })
    expect(within(card('Orders')).getByText('No data')).toBeInTheDocument()
  })

  it('a failed block paints its error with «Try again» and reloads only that block', async () => {
    setProps({ ordersList: failed() })
    renderPage()
    expect(within(card('Orders')).getByText('Orders could not be loaded.')).toBeInTheDocument()
    await userEvent.click(within(card('Orders')).getByRole('button', { name: 'Try again' }))
    expect(runtime.props.reloadBlock).toHaveBeenCalledWith('orders')
    expect(within(card('Orders')).getByRole('button', { name: 'Download CSV: Orders' })).toBeDisabled()
  })
})

describe('What sells', () => {
  it('lists products and categories in the order of the API with the value as it comes (no unit, no color by value)', () => {
    renderPage()
    const products = within(card('Top products')).getByRole('table', { name: 'Top products' })
    expect(listRows(products)).toEqual([['Burger, large', '40'], ['Fries', '25']])
    const categories = within(card('Top categories')).getByRole('table', { name: 'Top categories' })
    expect(listRows(categories)).toEqual([['Mains', '70'], ['Sides', '30']])
    expect(card('Top products').textContent).not.toMatch(/%/)
  })

  it('downloads top_products and top_categories with «Name, Sales(%)» and quotes a name with a comma', async () => {
    renderPage()
    await userEvent.click(within(card('Top products')).getByRole('button', { name: 'Download CSV: Top products' }))
    expect(downloadCsv).toHaveBeenLastCalledWith(expect.stringMatching(/^top_products_\d+\.csv$/), 'Name, Sales(%)\n"Burger, large",40,\nFries,25,\n')
    await userEvent.click(within(card('Top categories')).getByRole('button', { name: 'Download CSV: Top categories' }))
    expect(downloadCsv).toHaveBeenLastCalledWith(expect.stringMatching(/^top_categories_\d+\.csv$/), 'Name, Sales(%)\nMains,70,\nSides,30,\n')
  })

  it('has no «Expand» (a list has nothing to enlarge)', () => {
    renderPage()
    expect(within(card('Top products')).queryByRole('button', { name: /Expand/ })).toBeNull()
  })

  it('an empty block says «No data» and disables its CSV', () => {
    setProps({ topProductList: ready([]) })
    renderPage()
    expect(within(card('Top products')).getByText('No data')).toBeInTheDocument()
    expect(within(card('Top products')).getByRole('button', { name: 'Download CSV: Top products' })).toBeDisabled()
  })
})

describe('Service', () => {
  it('orders by status: translated names, highest first, total as the first line and no «All» bar', () => {
    renderPage()
    const region = card('Orders by status')
    expect(normal(region.querySelector('.odc-bi-total'))).toBe('160 orders')
    expect(region.querySelector('.odc-bi-total .odc-figure bdi')).not.toBeNull()
    const rows = listRows(within(region).getByRole('table'))
    expect(rows).toEqual([['Pending Order', '100'], ['Accepted by business', '30'], ['Delivery completed by driver', '30'], ['Status 99', '0']])
    expect(within(region).queryByText('All')).toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: 'Orders by status' })).toBeInTheDocument()
  })

  it('the total of one order is singular', () => {
    setProps({ orderStatusList: ready([{ status: 0, orders: 1 }]) })
    renderPage()
    expect(normal(card('Orders by status').querySelector('.odc-bi-total'))).toBe('1 order')
  })

  it('its CSV keeps the API order, the English names of main and «Status N» for an unknown status', async () => {
    renderPage()
    await userEvent.click(within(card('Orders by status')).getByRole('button', { name: 'Download CSV: Orders by status' }))
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^orders_status_\d+\.csv$/),
      'Status, Orders\nAccepted by business,30,\nPending Order,100,\nDelivery completed by driver,30,\nStatus 99,0,\n'
    )
  })

  it('customer satisfaction paints the notes that are present and not 0, with the CSV of main (raw keys)', async () => {
    renderPage()
    const region = card('Customer satisfaction')
    expect(within(region).getAllByRole('listitem').map(normal)).toEqual(['General4.5', 'Quality5.0', 'Service3.2'])
    await userEvent.click(within(region).getByRole('button', { name: 'Download CSV: Customer satisfaction' }))
    expect(downloadCsv).toHaveBeenCalledWith(
      expect.stringMatching(/^customer_satification_\d+\.csv$/),
      'Type, Rate\ngeneral,4.50,\nquality,5.00,\ndelivery,0,\nservice,3.20,\npackage,,\n'
    )
  })

  it('satisfaction with no notes says «No reviews in this period.» and disables the CSV', () => {
    setProps({ customerSatisfactionList: ready({ general: '0.00', quality: 0, delivery: '', service: null }) })
    renderPage()
    const region = card('Customer satisfaction')
    expect(within(region).getByText('No reviews in this period.')).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Download CSV: Customer satisfaction' })).toBeDisabled()
  })
})

describe('Customers', () => {
  it('registered users is a chart with Expand and its CSV', async () => {
    renderPage()
    const region = card('Registered users')
    expect(chartOf('Registered users').data.datasets[0].data).toEqual([0, 4, 0])
    await userEvent.click(within(region).getByRole('button', { name: 'Download CSV: Registered users' }))
    expect(downloadCsv).toHaveBeenCalledWith(expect.stringMatching(/^registers_users_\d+\.csv$/), 'Time, Users\n2026-10-02 00:00:00,4,\n')
    await userEvent.click(within(region).getByRole('button', { name: 'Expand: Registered users' }))
    expect(await screen.findByRole('dialog', { name: 'Registered users' })).toBeInTheDocument()
  })

  it('a failed users block retries with its own key', async () => {
    setProps({ registerUsersList: failed() })
    renderPage()
    await userEvent.click(within(card('Registered users')).getByRole('button', { name: 'Try again' }))
    expect(runtime.props.reloadBlock).toHaveBeenCalledWith('registerUsers')
  })
})

describe('Where orders come from', () => {
  it('draws the map in the Product frame with the props of main: default center, controls, heat map and the valid locations', () => {
    renderPage()
    const frame = screen.getByRole('region', { name: 'Orders map' })
    expect(frame).toHaveAttribute('data-state', 'ready')
    expect(runtime.map.apiKey).toBe('key')
    expect(runtime.map.location).toEqual({ lat: 4.7, lng: -74 })
    expect(runtime.map.isHeatMap).toBe(true)
    expect(runtime.map.isHeat).toBe(false)
    expect(runtime.map.locations).toEqual([LOCATIONS[0], LOCATIONS[2]])
    expect(runtime.map.mapControls).toMatchObject({ defaultZoom: 15, zoomControl: false, streetViewControl: false, fullscreenControl: false, mapTypeId: 'roadmap', mapTypeControl: false })
  })

  it('says «Map unavailable» in the same frame when there is no key', () => {
    runtime.configs = {}
    renderPage()
    expect(screen.getByRole('region', { name: 'Orders map' })).toHaveAttribute('data-state', 'unavailable')
    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
  })

  it('«Map view» switches Grouped and Heatmap, and goes back to Grouped when the locations change', async () => {
    const view = renderPage()
    const group = screen.getByRole('group', { name: 'Map view' })
    expect(within(group).getByRole('button', { name: 'Grouped' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(group).getByRole('button', { name: 'Heatmap' }))
    expect(screen.getByTestId('google-map')).toHaveAttribute('data-heat', 'true')
    setProps({ orderLocationList: ready(LOCATIONS, { locations: [LOCATIONS[0]] }) })
    act(() => view.rerender(<BusinessAnalytics />))
    expect(screen.getByTestId('google-map')).toHaveAttribute('data-heat', 'false')
    expect(within(screen.getByRole('group', { name: 'Map view' })).getByRole('button', { name: 'Grouped' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the switch is disabled without locations and while loading', () => {
    setProps({ orderLocationList: ready([], { locations: [] }) })
    const view = renderPage()
    const group = screen.getByRole('group', { name: 'Map view' })
    expect(within(group).getByRole('button', { name: 'Heatmap' })).toBeDisabled()
    setProps({ orderLocationList: loadingBlock({ locations: [] }) })
    act(() => view.rerender(<BusinessAnalytics />))
    expect(within(screen.getByRole('group', { name: 'Map view' })).getByRole('button', { name: 'Heatmap' })).toBeDisabled()
  })

  it('while the locations load, a skeleton holds the box of the frame instead of the map', () => {
    setProps({ orderLocationList: loadingBlock({ locations: [] }) })
    renderPage()
    expect(screen.queryByTestId('google-map')).toBeNull()
    expect(document.querySelector('.odc-bi-map-skeleton .odc-skeleton')).not.toBeNull()
  })
})

// redesign «Expand» must enlarge (the modal of main, 70% of the width). The dialog carries the class that the Drivers page uses for the
// same rule; the sheet that holds the rule (driver-analytics.css) is imported by the file that opens the dialog, so it is there on this route too
describe('«Expand» enlarges the chart', () => {
  it.each(['Orders', 'Sales', 'Registered users'])('the dialog of «%s» carries the class odc-bi-chart-dialog', async (name) => {
    renderPage()
    await userEvent.click(within(card(name)).getByRole('button', { name: `Expand: ${name}` }))
    const dialog = await screen.findByRole('dialog', { name })
    expect(dialog).toHaveClass('odc-dialog', 'odc-bi-chart-dialog')
  })

  it('imports the sheet that gives that class its size, since the Business route does not load the Drivers page', () => {
    const source = readFileSync(path.join(__dirname, '..', 'BusinessTrends.jsx'), 'utf8')
    expect(source).toContain("import '../DriverAnalytics/driver-analytics.css'")
    const rules = readFileSync(path.join(__dirname, '..', '..', 'DriverAnalytics', 'driver-analytics.css'), 'utf8')
    expect(rules).toMatch(/\.odc-dialog\.odc-bi-chart-dialog\[data-size\]\s*\{[^}]*inline-size:\s*70vw/)
  })
})

// redesign a failed map block said nothing (an empty map reads as «no orders»). It says so, with «Try again» for this block only
describe('a failed map says so, with «Try again»', () => {
  it('paints the error in the card of the map, without the switch or the map, and «Try again» reloads only the location block', async () => {
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

  it('keeps the map (its skeleton) while it loads, even if the last try failed, and does not hide a map that loaded', () => {
    setProps({ orderLocationList: { loading: true, error: 'boom', data: [], locations: [] } })
    const view = renderPage()
    expect(screen.getByRole('group', { name: 'Map view' })).toBeInTheDocument()
    expect(screen.queryByText('Orders map could not be loaded.')).toBeNull()
    setProps()
    act(() => view.rerender(<BusinessAnalytics />))
    expect(screen.getByRole('group', { name: 'Map view' })).toBeInTheDocument()
    expect(screen.queryByText('Orders map could not be loaded.')).toBeNull()
  })

  it('the focus stays on the card while it reloads and lands on the map frame when it loads, never on <body>', async () => {
    setProps({ orderLocationList: failed({ locations: [] }) })
    const view = renderPage()
    await userEvent.click(within(screen.getByRole('region', { name: 'Orders map' })).getByRole('button', { name: 'Try again' }))
    expect(document.activeElement).not.toBe(document.body)
    // the controller flags the block as loading (its old error is still there until the answer comes)
    setProps({ orderLocationList: { loading: true, error: 'boom', data: [], locations: [] } })
    act(() => view.rerender(<BusinessAnalytics />))
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toHaveTextContent('Orders map')
    // the answer: the map comes back
    setProps()
    act(() => view.rerender(<BusinessAnalytics />))
    expect(screen.getByTestId('google-map')).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Orders map' }))
  })

  // review (low): if the answer comes without the block ever flagging itself as loading, «asked» must not outlive it; the next change of
  // period would show the skeleton of the CARD (no Grouped/Heatmap control) instead of the map's own
  it('an answer that never passed through loading does not leave «Try again» pending for the next reload', async () => {
    setProps({ orderLocationList: failed({ locations: [] }) })
    const view = renderPage()
    await userEvent.click(within(screen.getByRole('region', { name: 'Orders map' })).getByRole('button', { name: 'Try again' }))
    // the map comes back with no loading in between
    setProps()
    act(() => view.rerender(<BusinessAnalytics />))
    expect(screen.getByTestId('google-map')).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    // the period changes: the map reloads with its own skeleton and the switch, not the card
    setProps({ orderLocationList: { loading: true, error: null, data: [], locations: [] } })
    act(() => view.rerender(<BusinessAnalytics />))
    expect(screen.getByRole('group', { name: 'Map view' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Orders map' })).toBeNull()
  })

  it('a second failure keeps the error and the focus in the card', async () => {
    setProps({ orderLocationList: failed({ locations: [] }) })
    const view = renderPage()
    await userEvent.click(within(screen.getByRole('region', { name: 'Orders map' })).getByRole('button', { name: 'Try again' }))
    setProps({ orderLocationList: { loading: true, error: 'boom', data: [], locations: [] } })
    act(() => view.rerender(<BusinessAnalytics />))
    setProps({ orderLocationList: failed({ locations: [] }) })
    act(() => view.rerender(<BusinessAnalytics />))
    expect(screen.getByText('Orders map could not be loaded.')).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toHaveTextContent('Orders map')
  })
})

describe('the entry point of the kit', () => {
  it('exports what the other BI pages reuse', async () => {
    // a variable, so a missing barrel fails this test and not the whole file
    const entryFile = '../../AnalyticsKit/index.js'
    const entry = await import(/* @vite-ignore */ entryFile)
    ;['ReportPeriod', 'ReportChannels', 'ReportFilterPills', 'ReportCard', 'CardAction', 'BarList', 'SatisfactionScores', 'orderStatusLabel', 'formatDuration'].forEach(name => {
      expect(typeof entry[name], name).toBe('function')
    })
  })
})

// redesign (row 71 Q-09): the period picker of both report pages marks «today» in the zone of the report
describe('the report period gets the zone of the report', () => {
  it.each([
    ['business reports', path.join(__dirname, '..', 'index.js')],
    ['delivery reports', path.join(__dirname, '..', '..', 'DriverAnalytics', 'index.js')]
  ])('%s passes filterList.timeZone to ReportPeriod', (name, file) => {
    const source = readFileSync(file, 'utf8')
    const tag = source.slice(source.indexOf('<ReportPeriod'), source.indexOf('/>', source.indexOf('<ReportPeriod')))
    expect(tag).toContain('timeZone={filterList?.timeZone}')
  })
})

describe('business-analytics.css', () => {
  const file = path.join(__dirname, '..', 'business-analytics.css')
  const read = () => readFileSync(file, 'utf8')
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('has no literal color, size, weight, duration or z-index', () => {
    expect(scanSource(read(), file)).toEqual([])
  })

  it('has no physical direction property (RTL)', () => {
    expect(strip(read()).match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
  })

  it('only uses the odc-bi prefix for its own classes', () => {
    const own = (strip(read()).match(/\.[a-z][\w-]*/g) ?? []).filter(name => !name.startsWith('.odc-bi-'))
    expect(own).toEqual([])
  })

  it('has its breakpoints on the numbers of the dashboard: phone below 768, two columns from 1024', () => {
    const widths = [...strip(read()).matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g)].map(match => Number(match[1]))
    widths.forEach(width => expect([767, 768, 1024, 1280]).toContain(width))
  })
})

// redesign bi AC (B1): /intelligence/business at 390 had its first figure at y = 434 (audit rubric-B, 2026-10-21). jsdom has
// no layout, so the heights are added up from the sheets themselves: every gap, padding and size is read from the rule that sets it
// (phone block of each sheet) and from the tokens (src/brand), and the sum is checked. Nothing is hidden or moved behind a tap: the same
// five presets, the same four pills and the same channels, only the rows are packed.
describe('the controls block on a phone · what it adds up to (B1)', () => {
  const components = path.join(__dirname, '..', '..', '..')
  const brand = path.resolve(__dirname, '../../../../../../../../../brand')
  const sheet = (file) => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const business = sheet(path.join(__dirname, '..', 'business-analytics.css'))
  const filters = sheet(path.join(components, 'BusinessIntelligence', 'AnalyticsKit', 'report-filters.css'))
  const filterBar = sheet(path.join(components, 'Shared', 'Product', 'filter-bar.css'))

  // the tokens, as the sheets of src/brand declare them; a value that is not a length or a number is an error, never a guess
  const tokens = {}
  ;[path.join(brand, 'ordering.tokens.generated.css'), path.join(brand, 'candidates.css')].forEach(file => {
    for (const [, name, value] of sheet(file).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim()
  })
  const px = (value) => {
    const text = String(value).trim()
    const token = /^var\((--[\w-]+)\)$/.exec(text)
    if (token) return px(tokens[token[1]])
    const length = /^(-?\d*\.?\d+)(px|rem)?$/.exec(text)
    if (!length) throw new Error(`not a length: ${text}`)
    return length[2] === 'rem' ? Number(length[1]) * 16 : Number(length[1])
  }

  const phone = (css) => [...css.matchAll(/@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/g)].map(match => match[1]).join('\n')
  // the value of `property` in the rule whose selector is exactly `selector` (null when the sheet has no such rule or property)
  const valueOf = (css, selector, property) => {
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selectors.split(',').map(part => part.trim()).includes(selector)) continue
      const declaration = new RegExp(`(?:^|[\\s;])${property}\\s*:\\s*([^;]+)`).exec(body)
      if (declaration) return declaration[1].trim()
    }
    return null
  }

  const control = px('var(--od-x-control-height)') // 32: a chip as it is seen
  const coarse = px('var(--od-x-target-coarse)') // 44: the area of a touch, and the height of a pill
  const BEFORE = 434 - 88 - 16 // the audit: first figure at 434, the controls start at 88 (16 + header 56 + gap 16), 16 of gap after them

  const controlsHeight = () => {
    const periodRowGap = valueOf(phone(filters), '.odc-bi-period-group', 'row-gap')
    const controlsGap = valueOf(phone(business), '.odc-bi-controls', 'gap')
    const mainPadding = valueOf(phone(filters), '.odc-bi-controls .odc-filterbar.odc-bi-filters .odc-filterbar-main', 'padding-block')
    const mainRowGap = valueOf(phone(filters), '.odc-bi-controls .odc-filterbar.odc-bi-filters .odc-filterbar-main', 'row-gap')
    const pillGap = valueOf(filterBar, '.odc-filterbar-filters', 'gap')
    expect(Object.values({ periodRowGap, controlsGap, mainPadding, mainRowGap, pillGap })).not.toContain(null)
    // period: two rows of chips (the four presets, then «Custom range» with the dates beside it)
    const period = 2 * control + px(periodRowGap)
    // filters: the four pills are two lines of 44 (a pill is 44 visible on a phone) with the gap of the bar; the bar adds no padding
    // and its empty «search / more» row no gap (the pill row is the only one)
    const pills = 2 * coarse + px(pillGap) + 2 * px(mainPadding) + px(mainRowGap)
    // channels: one row of chips of 32 (the scroller's padding and negative margin cancel on a phone)
    const channels = control
    return { period, pills, channels, gap: px(controlsGap), total: period + pills + channels + 2 * px(controlsGap) }
  }

  it('adds up to 220 px: 76 of period + 96 of pills + 32 of channels + two gaps of 8', () => {
    expect(controlsHeight()).toEqual({ period: 76, pills: 96, channels: 32, gap: 8, total: 220 })
  })

  it('is at least 100 px shorter than the 330 px of the audit (434 - 88 - 16), so the first figure is near y = 324', () => {
    expect(BEFORE).toBe(330)
    expect(BEFORE - controlsHeight().total).toBeGreaterThanOrEqual(100)
    expect(88 + controlsHeight().total + 16).toBeLessThanOrEqual(330)
  })

  // the 44 px areas of the chips (32 seen) reach 6 px beyond their box on each side; two rows of chips need 12 apart, a chip next to a
  // pill (a real box of 44) or to the channels need 6, and the pills are 44 boxes with no area to cross
  it('keeps the areas of touch apart: 12 px between rows of chips, at least 6 between a chip and the block next to it', () => {
    const { gap } = controlsHeight()
    expect(px(valueOf(phone(filters), '.odc-bi-period-group', 'row-gap'))).toBeGreaterThanOrEqual(coarse - control)
    expect(gap).toBeGreaterThanOrEqual((coarse - control) / 2)
  })

  it('does not change anything from 768: the phone rules are the only ones that name these values', () => {
    const wide = (css) => css.replace(/@media \(max-width: 767px\)\s*\{[\s\S]*?\n\}/g, '')
    expect(valueOf(wide(business), '.odc-bi-controls', 'gap')).toBe('var(--od-space-3)')
    expect(valueOf(wide(filters), '.odc-bi-controls .odc-filterbar.odc-bi-filters .odc-filterbar-main', 'padding-block')).toBeNull()
  })

  it('gives the chips of the active filters the 12 px the bar used to hold under the pills, so they do not touch them', () => {
    expect(valueOf(phone(filters), '.odc-bi-controls .odc-filterbar.odc-bi-filters .odc-filterbar-chips', 'padding-block-start')).toBe('var(--od-space-3)')
  })
})
