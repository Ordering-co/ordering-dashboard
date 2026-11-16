/* eslint-disable import/first */
// redesign F4 (C20, tracker D-07): the loading state of the orders list is the grid of the loaded list: the
// visible columns (each cell shaped as its content), the selection column, as many rows as the page size, the
// footer where the pager will be, and on a phone the cards in the shape of the real ones. The busy region says
// what it waits for in hidden text. Nothing of the logic of the table is under test here.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ configs: {}, narrow: false }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{
    parseDate: (date) => String(date),
    parsePrice: (value) => String(value),
    optimizeImage: (url) => url,
    getTimeAgo: () => '2 hours ago'
  }],
  useConfig: () => [{ configs: mocks.configs }],
  useSession: () => [{ user: { level: 0, id: 7 } }],
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../../../utils', () => ({
  getCurrenySymbol: () => '$',
  addQueryToUrl: vi.fn(),
  getOrderStatusPrefix: (status) => `Status ${status}`,
  isFinalOrderStatusLocked: () => false,
  getUserType: () => false
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { OrdersTable } from '..'

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
const defaultColumns = (overrides = {}) => ({
  slaBar: column(-2, true),
  orderNumber: column(-1),
  dateTime: column(0),
  status: column(2, true, { title: 'Status' }),
  business: column(6, true, { title: 'Business' }),
  customer: column(7, true, { title: 'Customer' }),
  driver: column(8, true, { title: 'Driver' }),
  total: column(15),
  ...overrides
})

const baseProps = (extra = {}) => ({
  orderList: { loading: true, orders: [] },
  pagination: { currentPage: 1, pageSize: 10 },
  selectedOrderIds: [],
  groupStatus: 'completed',
  allowColumns: defaultColumns(),
  getPageOrders: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  handleOpenOrderDetail: vi.fn(),
  handleUpdateOrderStatus: vi.fn(),
  ...extra
})

const renderTable = (extra = {}) => render(
  <ThemeProvider theme={{ colors: {} }}>
    <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
      <OrdersTable {...baseProps(extra)} />
    </ConfigFileContext.Provider>
  </ThemeProvider>
)

class MockResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

beforeEach(() => {
  window.localStorage.clear() // redesign F6d-4b: a loaded list keeps its columns for the next load
  mocks.configs = {}
  mocks.narrow = false
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  window.matchMedia = vi.fn((query) => ({
    get matches () { return mocks.narrow && query === '(max-width: 767px)' },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  }))
})
afterEach(() => {
  delete window.matchMedia
  vi.unstubAllGlobals()
})

const skeletonRows = container => Array.from(container.querySelectorAll('tbody tr[data-skeleton]'))
const cell = (container, header) => {
  const index = Array.from(container.querySelectorAll('thead th')).findIndex(th => th.textContent === header)
  return skeletonRows(container)[0].querySelectorAll('td')[index]
}
const lines = node => node.querySelectorAll('.odc-sk-lines > .odc-skeleton').length

describe('OrdersTable skeleton: the same columns as the loaded list', () => {
  it('has one cell per visible column and the selection cell, in the order of the header', () => {
    const { container } = renderTable()
    const headers = Array.from(container.querySelectorAll('thead th')).map(th => th.textContent)
    expect(headers).toEqual(['', 'Order', 'Status', 'SLA', 'Business', 'Customer', 'Driver', 'Total'])
    skeletonRows(container).forEach(row => expect(row.querySelectorAll('td')).toHaveLength(headers.length))
    expect(skeletonRows(container)[0].querySelector('td[data-selection]')).not.toBeNull()
  })

  it('follows the columns the user chose, not a fixed set', () => {
    const { container } = renderTable({ allowColumns: defaultColumns({ business: column(6, false), driver: column(8, false) }) })
    expect(Array.from(container.querySelectorAll('thead th')).map(th => th.textContent)).toEqual(['', 'Order', 'Status', 'SLA', 'Customer', 'Total'])
    skeletonRows(container).forEach(row => expect(row.querySelectorAll('td')).toHaveLength(6))
  })

  it('gives each cell the shape of its content', () => {
    const { container } = renderTable()
    // order: the id and the date (two lines), at the width of the date, in the pinned column
    expect(lines(cell(container, 'Order'))).toBe(2)
    // redesign F6e-3 (Q4-03): the floor sits on the cell, as on the real one
    expect(cell(container, 'Order').style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-sk-order)')
    expect(cell(container, 'Order')).toHaveClass('odc-orders-col-sticky')
    // status: a dot and its name
    expect(cell(container, 'Status').querySelector('.odc-skeleton[data-shape="round"]')).not.toBeNull()
    expect(lines(cell(container, 'Status'))).toBe(1)
    expect(cell(container, 'Status').style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-col-floor-status)')
    expect(cell(container, 'Status')).toHaveClass('odc-orders-col-status')
    // sla: a badge
    expect(cell(container, 'SLA').style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-col-floor-sla)')
    // business: a square avatar and two lines, in the people column; customer and driver: a round avatar and two lines
    expect(cell(container, 'Business').querySelector('.odc-skeleton[data-shape="box"]')).not.toBeNull()
    expect(lines(cell(container, 'Business'))).toBe(2)
    expect(cell(container, 'Business')).toHaveClass('odc-orders-col-person')
    expect(cell(container, 'Customer').querySelector('.odc-skeleton[data-shape="round"]')).not.toBeNull()
    expect(lines(cell(container, 'Customer'))).toBe(2)
    expect(lines(cell(container, 'Driver'))).toBe(2)
    // total: the amount and «2 hours ago», at the end
    expect(cell(container, 'Total')).toHaveAttribute('data-align', 'end')
    expect(lines(cell(container, 'Total'))).toBe(2)
    expect(cell(container, 'Total').style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-col-floor-total)')
  })

  it('draws no avatar where the list shows none (hidePhoto)', () => {
    const { container } = renderTable({ hidePhoto: true })
    expect(cell(container, 'Business').querySelector('.odc-skeleton[data-shape="box"]')).toBeNull()
    expect(cell(container, 'Customer').querySelector('.odc-skeleton[data-shape="round"]')).toBeNull()
    expect(lines(cell(container, 'Customer'))).toBe(2)
  })

  it('has as many rows as the page size, and ten when the page size is not known yet', () => {
    expect(skeletonRows(renderTable({ pagination: { currentPage: 1, pageSize: 25 } }).container)).toHaveLength(25)
    expect(skeletonRows(renderTable({ pagination: { currentPage: 1, pageSize: 5 } }).container)).toHaveLength(5)
    expect(skeletonRows(renderTable({ pagination: {} }).container)).toHaveLength(10)
  })

  it('keeps the density of the list on the skeleton rows', () => {
    const { container } = renderTable({ density: 'compact' })
    expect(container.querySelector('table')).toHaveAttribute('data-density', 'compact')
  })

  // redesign F6d-4b (Q3-04): with no saved set known yet, the skeleton draws only what every user has (never the default set, which
  // a saved set then replaces and reflows). It used to draw the default columns.
  it('draws only the columns every user has while the settings of the columns are not there yet', () => {
    const { container } = renderTable({ allowColumns: undefined })
    const headers = Array.from(container.querySelectorAll('thead th')).map(th => th.textContent)
    expect(headers).toEqual(['', 'Order', 'Status', 'SLA', 'Total'])
    skeletonRows(container).forEach(row => expect(row.querySelectorAll('td')).toHaveLength(headers.length))
  })
})

// redesign F6e-3 (Q4-03): the loaded list asks each column for the same width the skeleton asked, so the columns do not move when
// the rows arrive (they moved 15 to 28px). The floors are the same tokens, on the header and on the real cells.
describe('OrdersTable skeleton: the loaded columns keep the width of the loading ones', () => {
  const order = { id: 1, status: 1, delivery_type: 1, summary: { total: 5 }, currency: 'USD', business: { name: 'B' }, customer: { name: 'C' } }
  const floorsOf = nodes => Object.fromEntries(nodes.map(node => [node.textContent.trim() || 'select', node.style.getPropertyValue('--odc-col-floor')]).filter(([, floor]) => floor))
  const floorsInRow = (container, row) => {
    const headers = Array.from(container.querySelectorAll('thead th')).map(th => th.textContent.trim() || 'select')
    return Object.fromEntries(Array.from(row.querySelectorAll('td')).map((td, index) => [headers[index], td.style.getPropertyValue('--odc-col-floor')]).filter(([, floor]) => floor))
  }

  it('gives the header, the loading cells and the real cells the same floors, in the default set and in another', () => {
    ;[defaultColumns(), defaultColumns({ business: column(6, false), driver: column(8, false) })].forEach(allowColumns => {
      const loading = renderTable({ allowColumns })
      const header = floorsOf(Array.from(loading.container.querySelectorAll('thead th')))
      const skeleton = floorsInRow(loading.container, skeletonRows(loading.container)[0])
      loading.unmount()
      const loaded = renderTable({ allowColumns, orderList: { loading: false, orders: [order] }, pagination: { currentPage: 1, pageSize: 10, total: 1 } })
      const loadedHeader = floorsOf(Array.from(loaded.container.querySelectorAll('thead th')))
      const real = floorsInRow(loaded.container, loaded.container.querySelector('tbody tr[data-row-id]'))
      loaded.unmount()
      expect(header).toEqual({
        Order: 'var(--od-x-sk-order)',
        Status: 'var(--od-x-col-floor-status)',
        SLA: 'var(--od-x-col-floor-sla)',
        Total: 'var(--od-x-col-floor-total)'
      })
      expect(skeleton).toEqual(header)
      expect(loadedHeader).toEqual(header)
      expect(real).toEqual(header)
    })
  })

  it('the floors are tokens that exist, and the widest status name measured (193px) fits in the status one', () => {
    const candidates = readFileSync(resolve(__dirname, '../../../../../../../../../brand/candidates.css'), 'utf8')
    const px = name => Number((candidates.match(new RegExp(`${name}:\\s*(\\d+)px`)) || [])[1])
    expect(px('--od-x-col-floor-status')).toBeGreaterThanOrEqual(193)
    expect(px('--od-x-col-floor-sla')).toBeGreaterThanOrEqual(61)
    expect(px('--od-x-col-floor-total')).toBeGreaterThanOrEqual(71)
  })
})

describe('OrdersTable skeleton: the busy region and the footer', () => {
  it('marks the region busy and reads «Loading orders» once, hidden', () => {
    const { container } = renderTable()
    const region = container.querySelector('#orderTable')
    expect(region).toHaveAttribute('aria-busy', 'true')
    const label = within(region).getByText('Loading orders')
    expect(label).toHaveClass('odc-sr-only')
    expect(screen.getByRole('table', { name: 'Orders list' })).toHaveAttribute('aria-busy', 'true')
  })

  it('draws the footer where the pager will be while the total is not known', () => {
    const { container } = renderTable()
    const foot = container.querySelector('.odc-orders-foot[data-skeleton]')
    expect(foot).not.toBeNull()
    expect(foot).toHaveAttribute('aria-hidden', 'true')
    expect(foot.querySelectorAll('.odc-skeleton').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull()
  })

  it('keeps the real footer when the total is known (a page change)', () => {
    const { container } = renderTable({ pagination: { currentPage: 2, pageSize: 10, total: 45 } })
    expect(container.querySelector('.odc-orders-foot[data-skeleton]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument()
  })

  it('leaves no skeleton, no busy mark and no label once the orders are there', () => {
    const order = { id: 1, status: 1, delivery_type: 1, summary: { total: 5 }, currency: 'USD', business: { name: 'B' }, customer: { name: 'C' } }
    const { container } = renderTable({ orderList: { loading: false, orders: [order] }, pagination: { currentPage: 1, pageSize: 10, total: 1 } })
    expect(container.querySelector('[data-skeleton]')).toBeNull()
    expect(container.querySelector('#orderTable')).not.toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Loading orders')).toBeNull()
  })
})

describe('OrdersTable skeleton: cards on a phone', () => {
  beforeEach(() => { mocks.narrow = true })
  const cards = container => Array.from(container.querySelectorAll('.odc-order-card[data-skeleton]'))

  it('draws as many cards as the page size, never a table', () => {
    const { container } = renderTable({ pagination: { currentPage: 1, pageSize: 25 } })
    expect(screen.queryByRole('table')).toBeNull()
    expect(cards(container)).toHaveLength(25)
    expect(cards(renderTable({ pagination: {} }).container)).toHaveLength(10)
  })

  it('draws the four rows of a real card: id and status, business to customer, driver and dates, SLA and total', () => {
    const { container } = renderTable()
    const card = cards(container)[0]
    expect(card.querySelector('.odc-order-card-top')).not.toBeNull()
    const people = card.querySelector('.odc-order-card-people')
    expect(people.querySelectorAll('.odc-skeleton[data-shape="box"], .odc-skeleton[data-shape="round"]')).toHaveLength(2)
    expect(card.querySelector('.odc-order-card-logistics')).not.toBeNull()
    expect(card.querySelector('.odc-order-card-meta')).not.toBeNull()
    expect(card).toHaveAttribute('aria-hidden', 'true')
  })

  it('marks the list busy and reads «Loading orders» once, hidden', () => {
    const { container } = renderTable()
    const list = container.querySelector('ul[aria-busy="true"]')
    expect(list).not.toBeNull()
    expect(container.querySelector('.odc-order-cards').contains(screen.getByText('Loading orders'))).toBe(true)
    expect(screen.getByText('Loading orders')).toHaveClass('odc-sr-only')
  })

  it('draws the cards footer while the total is not known', () => {
    const { container } = renderTable()
    const foot = container.querySelector('.odc-orders-foot[data-skeleton]')
    expect(foot).not.toBeNull()
    expect(foot).toHaveAttribute('data-cards', '')
  })
})

describe('OrdersTable skeleton: stylesheet', () => {
  const tableCss = readFileSync(resolve(__dirname, '../orders-table.css'), 'utf8')
  const cardCss = readFileSync(resolve(__dirname, '../../../Shared/Product/record-card.css'), 'utf8') // redesign W1-1 (T1-1)

  it('the footer skeleton is as tall as the real footer, from the control height', () => {
    expect(tableCss).toMatch(/\.odc-orders-foot\[data-skeleton\][^{]*\{[^}]*min-block-size:\s*var\(--od-x-control-height\)/)
  })

  // redesign F6c-5 (Q2-05): the status no longer wraps in the narrow list (it clips with an ellipsis), so its loading cell asks for
  // the same width there as everywhere: the one of the Status ghost, never the longest word.
  it('the loading status cell has no narrower floor in the narrow list beside the panel: the name no longer wraps', () => {
    expect(tableCss).not.toMatch(/\.odc-orders-col-status \.odc-sk-cell/)
  })

  it('the skeleton cards use the rows of the real card, in tokens', () => {
    expect(cardCss).toMatch(/\.odc-order-card\[data-skeleton\]/)
    expect(cardCss).not.toMatch(/\.odc-order-card\[data-skeleton\][^{]*\{[^}]*\d+px/)
  })
})

// redesign F6d-4b (Q3-04): the controller starts with its own default model (the SLA and timer columns off) and replaces it when the
// saved settings arrive. The list says so with `columnsReady={false}`; until then it shows the last saved set it kept on this device,
// or only the columns every user has, and never the default set that a saved one would then replace.
describe('OrdersTable waits for the column preference (Q3-04)', () => {
  const CACHE_KEY = 'odc-orders-columns:7'
  const savedSeven = () => defaultColumns({
    status: column(2, true, { title: 'Status' }),
    business: column(6, true, { title: 'Business' }),
    customer: column(7, true, { title: 'Customer' }),
    driver: column(8, true, { title: 'Driver' }),
    cartGroupId: column(4, false, { title: 'Group order' }),
    driverGroupId: column(5, false, { title: 'Driver group ID' }),
    advanced: column(9, false, { title: 'Advanced logistics' }),
    cloned: column(10, false, { title: 'Cloned' }),
    eta: column(12, false, { title: 'ETA' }),
    pod: column(14, false, { title: 'Pod' })
  })
  // what OrdersManage starts with: the default set, the SLA column and the timer off
  const controllerDefault = () => defaultColumns({
    slaBar: column(-2, false),
    cartGroupId: column(4, true, { title: 'Group order' }),
    driverGroupId: column(5, true, { title: 'Driver group ID' }),
    advanced: column(9, true, { title: 'Advanced logistics' }),
    cloned: column(10, true, { title: 'Cloned' }),
    timer: column(11, false, { title: 'SLA timer' }),
    eta: column(12, true, { title: 'ETA' }),
    pod: column(14, true, { title: 'Pod' })
  })
  const headersOf = container => Array.from(container.querySelectorAll('thead th')).map(th => th.textContent)
  const pendingProps = (extra = {}) => ({ allowColumns: controllerDefault(), columnsReady: false, ...extra })
  const SEVEN = ['', 'Order', 'Status', 'SLA', 'Business', 'Customer', 'Driver', 'Total']

  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('does not draw the default set while the saved one is on its way and none is known: only the columns every user has', () => {
    const { container } = renderTable(pendingProps())
    expect(headersOf(container)).toEqual(['', 'Order', 'Status', 'SLA', 'Total'])
    expect(container.querySelector('#orderTable')).toHaveAttribute('aria-busy', 'true')
  })

  it('stays loading when the orders arrive before the columns: no real rows in a set that is about to change', () => {
    const { container } = renderTable(pendingProps({
      orderList: { loading: false, orders: [{ id: 1, status: 0, summary: {}, business: {}, customer: {} }] },
      pagination: { currentPage: 1, pageSize: 10, total: 1 }
    }))
    expect(skeletonRows(container).length).toBeGreaterThan(0)
    expect(container.querySelector('#orderTable')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('tbody tr:not([data-skeleton])')).toBeNull()
  })

  it('uses the last saved set of this user while the settings load: the same columns from the first frame', () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(savedSeven()))
    const { container } = renderTable(pendingProps())
    expect(headersOf(container)).toEqual(SEVEN)
    skeletonRows(container).forEach(row => expect(row.querySelectorAll('td')).toHaveLength(SEVEN.length))
  })

  it('shows the real rows with the kept set once the orders are there, without waiting for the columns', () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(savedSeven()))
    const { container } = renderTable(pendingProps({
      orderList: { loading: false, orders: [{ id: 1, status: 0, summary: {}, business: {}, customer: {} }] },
      pagination: { currentPage: 1, pageSize: 10, total: 1 }
    }))
    expect(headersOf(container)).toEqual(SEVEN)
    expect(skeletonRows(container)).toHaveLength(0)
    expect(container.querySelector('#orderTable')).not.toHaveAttribute('aria-busy')
  })

  it('ignores a kept set that is not a set of columns', () => {
    window.localStorage.setItem(CACHE_KEY, '{not json')
    expect(headersOf(renderTable(pendingProps()).container)).toEqual(['', 'Order', 'Status', 'SLA', 'Total'])
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ status: 'yes' }))
    expect(headersOf(renderTable(pendingProps()).container)).toEqual(['', 'Order', 'Status', 'SLA', 'Total'])
  })

  it('keeps the settings that arrived for the next load, and the next load starts from them', () => {
    const first = renderTable({ allowColumns: savedSeven(), columnsReady: true })
    expect(JSON.parse(window.localStorage.getItem(CACHE_KEY)).driver).toMatchObject({ visable: true, order: 8 })
    first.unmount()
    const { container } = renderTable(pendingProps())
    expect(headersOf(container)).toEqual(SEVEN)
  })

  it('follows a change of the columns in the kept set too', () => {
    const view = renderTable({ allowColumns: savedSeven(), columnsReady: true })
    view.unmount()
    renderTable({ allowColumns: defaultColumns({ driver: column(8, false, { title: 'Driver' }) }), columnsReady: true })
    expect(JSON.parse(window.localStorage.getItem(CACHE_KEY)).driver.visable).toBe(false)
  })

  it('never keeps the controller default that is shown before the settings arrive', () => {
    renderTable(pendingProps())
    expect(window.localStorage.getItem(CACHE_KEY)).toBeNull()
  })

  it('uses the loaded set over a kept one', () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(savedSeven()))
    const { container } = renderTable({ allowColumns: defaultColumns({ business: column(6, false) }), columnsReady: true })
    expect(headersOf(container)).toEqual(['', 'Order', 'Status', 'SLA', 'Customer', 'Driver', 'Total'])
  })

  it('does not wait for the columns on a phone, where the list is cards', () => {
    mocks.narrow = true
    const { container } = renderTable(pendingProps({ orderList: { loading: false, orders: [{ id: 1, status: 0, summary: {}, business: {}, customer: {} }] }, pagination: { currentPage: 1, pageSize: 10, total: 1 } }))
    expect(container.querySelector('#orderTable')).not.toHaveAttribute('aria-busy')
  })

  it('without the prop (a list that has no controller default) behaves as before', () => {
    const { container } = renderTable({ allowColumns: defaultColumns() })
    expect(headersOf(container)).toEqual(['', 'Order', 'Status', 'SLA', 'Business', 'Customer', 'Driver', 'Total'])
  })
})
