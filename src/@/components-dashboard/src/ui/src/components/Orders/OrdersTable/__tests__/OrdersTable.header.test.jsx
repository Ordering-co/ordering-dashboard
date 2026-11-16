/* eslint-disable import/first */
// redesign 5.2: the table is the Product DataTable. These tests keep what the old header
// tests protected (Total column, skeleton rows aligned with the header) in the new markup
// and cover the columns, SLA, driver, selection, footer and arrival of the 5.2-C brief.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import moment from 'moment'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: {},
  user: { level: 0 },
  locked: new Set(),
  addQueryToUrl: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{
    parseDate: (date) => String(date),
    parsePrice: (value, { currency } = {}) => `${currency}${Number(value).toFixed(2)}`,
    optimizeImage: (url) => url,
    getTimeAgo: () => '2 hours ago'
  }],
  useConfig: () => [{ configs: mocks.configs }],
  useSession: () => [{ user: mocks.user }],
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../../../utils', () => ({
  getCurrenySymbol: () => '$',
  addQueryToUrl: (...args) => mocks.addQueryToUrl(...args),
  getOrderStatusPrefix: (status) => ({ 0: 'Pending', 1: 'Completed by admin', 7: 'Accepted by business', 13: 'Preorder' }[status] ?? `Status ${status}`),
  isFinalOrderStatusLocked: (_project, _level, status) => mocks.locked.has(status)
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { OrdersTable, isDefaultColumnSet } from '..'
import { SplitView } from '../../../Shared/Product'
import { slaParityCases } from '../../__tests__/slaParityCases'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })

// Default model of OrdersManage (not showExternalId), with the SLA column on like the controller forces it.
const defaultColumns = (overrides = {}) => ({
  slaBar: column(-2, true),
  orderNumber: column(-1),
  dateTime: column(0),
  externalId: column(1, false, { title: 'External id', draggable: true }),
  status: column(2, true, { title: 'Status', draggable: true }),
  agent: column(3, false, { title: 'Agent', draggable: true }),
  cartGroupId: column(4, true, { title: 'Group Order', draggable: true }),
  driverGroupId: column(5, true, { title: 'Driver Group Id', draggable: true }),
  business: column(6, true, { title: 'Business', draggable: true }),
  customer: column(7, true, { title: 'Customer', draggable: true }),
  driver: column(8, true, { title: 'Driver', draggable: true }),
  advanced: column(9, true, { title: 'Advanced logistics', draggable: true, colSpan: 3 }),
  cloned: column(10, true, { title: 'Cloned', draggable: true }),
  timer: column(11, false, { title: 'SLA’s timer', draggable: true }),
  eta: column(12, true, { title: 'ETA', draggable: true }),
  channel: column(13, false, { title: 'Channel', draggable: true }),
  pod: column(14, true, { title: 'Pod', draggable: true }),
  total: column(15),
  ...overrides
})

const localStamp = (minutesFromNow) => moment().add(minutesFromNow, 'minutes').format('YYYY-MM-DD HH:mm:ss')

const makeOrder = (id, extra = {}) => ({
  id,
  status: 0,
  delivery_type: 1,
  delivery_datetime_utc: '2024-05-01 10:30:00',
  created_at: '2024-05-01 10:00:00',
  business: { name: 'Fast Bite', logo: 'logo.png', city: { name: 'New York' } },
  customer: { name: 'Grace Okafor', cellphone: '555-0100', photo: 'grace.png', orders_count: 3 },
  summary: { total: 35.2 },
  currency: 'USD',
  ...extra
})

const baseProps = (extra = {}) => ({
  orderList: { loading: false, orders: [makeOrder(13792)] },
  pagination: { currentPage: 1, pageSize: 10, total: 1 },
  selectedOrderIds: [],
  groupStatus: 'pending',
  allowColumns: defaultColumns(),
  setAllowColumns: vi.fn(),
  saveUserSettings: vi.fn(),
  getPageOrders: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  handleOpenOrderDetail: vi.fn(),
  ...extra
})

// redesign 5.2 audit-1: the page jump is the Select of Shared/UI, which reads the styled-components theme
// (the app always has one).
// redesign fix-qa C2: the list sits inside the real SplitView, as in OrdersManager; its context (mode, open, expanded) is
// how the table knows the order panel is beside it. 1440 is the window of the split mode (from 1280).
const tree = (props, { panelOpen = false, expanded = false } = {}) => (
  <ThemeProvider theme={{ colors: {} }}>
    <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
      <SplitView
        list={<OrdersTable {...props} />}
        panel={<p>Panel</p>}
        open={panelOpen}
        expanded={expanded}
        panelLabel='Order panel'
        resizeLabel='Resize the order panel'
      />
    </ConfigFileContext.Provider>
  </ThemeProvider>
)

// The split view reads the window through (min|max)-width queries (the setup's matchMedia answers «no» to all), so the
// tests answer them against a width.
const ORIGINAL_MATCH_MEDIA = window.matchMedia
const installViewport = (width) => {
  window.innerWidth = width
  window.matchMedia = (query) => ({
    media: query,
    get matches () {
      return query.split(/\s+and\s+/).every(part => {
        const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
        if (!kind) return false
        return kind === 'min' ? width >= Number(value) : width <= Number(value)
      })
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
}

const renderTable = (extra = {}, { panelOpen = false, expanded = false, viewport = 1440 } = {}) => {
  installViewport(viewport)
  const props = baseProps(extra)
  const state = { panelOpen, expanded }
  const view = render(tree(props, state))
  const rerenderWith = (next = {}, options = {}) => {
    Object.assign(props, next)
    Object.assign(state, options)
    view.rerender(tree(props, state))
  }
  return { ...view, props, rerenderWith }
}

const headerTexts = (container) => Array.from(container.querySelectorAll('thead th')).map(th => th.textContent)
const firstRow = (container) => container.querySelector('tbody tr[data-row-id]')

let observers = []
class MockResizeObserver {
  constructor (callback) {
    this.callback = callback
    observers.push(this)
  }

  observe () {}
  unobserve () {}
  disconnect () { observers = observers.filter(item => item !== this) }
}

beforeEach(() => {
  mocks.configs = {}
  mocks.locked = new Set()
  mocks.addQueryToUrl.mockClear()
  observers = []
})
const WINDOW_WIDTH = window.innerWidth
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  window.innerWidth = WINDOW_WIDTH
  window.matchMedia = ORIGINAL_MATCH_MEDIA
})

describe('OrdersTable header: Total column', () => {
  it('renders a visible Total header as the last header cell, aligned to the end', () => {
    const { container } = renderTable()
    const headers = Array.from(container.querySelectorAll('thead th'))
    const total = screen.getByRole('columnheader', { name: 'Total' })
    expect(headers[headers.length - 1]).toBe(total)
    expect(total).toHaveAttribute('data-align', 'end')
    // the manage-columns button lives with the list tools (OrdersListing), not in the table
    expect(screen.queryByRole('button', { name: /columns/i })).toBeNull()
  })

  it('does not render a Total header when the column is hidden', () => {
    renderTable({ allowColumns: defaultColumns({ total: column(15, false) }) })
    expect(screen.queryByRole('columnheader', { name: 'Total' })).toBeNull()
  })

  it('keeps the header visible and fills it with skeleton rows while loading', () => {
    const { container } = renderTable({ orderList: { loading: true, orders: [] } })
    expect(screen.getByRole('table', { name: 'Orders list' })).toHaveAttribute('aria-busy', 'true')
    expect(headerTexts(container)).toContain('Status')
    const rows = container.querySelectorAll('tbody tr[data-skeleton]')
    expect(rows).toHaveLength(10)
    const cells = container.querySelectorAll('thead th').length
    rows.forEach(row => expect(row.querySelectorAll('td')).toHaveLength(cells))
  })

  it('shows the loading state while the column settings are not there yet', () => {
    renderTable({ allowColumns: undefined })
    expect(screen.getByRole('table', { name: 'Orders list' })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('OrdersTable columns follow allowColumns', () => {
  it('draws one column per visible key, in its order, with the select-all first', () => {
    const { container } = renderTable()
    expect(headerTexts(container)).toEqual([
      // redesign 5.2: the SLA column (formerly the fixed colour bar) follows the status.
      '', 'Order', 'Status', 'SLA', 'Group Order', 'Driver Group Id', 'Business', 'Customer', 'Driver',
      'Advanced logistics', 'Cloned', 'ETA', 'Pod', 'Total'
    ])
  })

  it('follows the order and visibility saved by the user', () => {
    const { container } = renderTable({
      allowColumns: defaultColumns({
        customer: column(3, true, { title: 'Customer' }),
        status: column(8, true, { title: 'Status' }),
        business: column(6, false, { title: 'Business' })
      })
    })
    const texts = headerTexts(container)
    expect(texts.indexOf('Customer')).toBeLessThan(texts.indexOf('Status'))
    expect(texts).not.toContain('Business')
  })

  it('shows the timer column only in pending and in progress', () => {
    const allowColumns = defaultColumns({ timer: column(11, true, { title: 'SLA’s timer' }) })
    const { unmount } = renderTable({ allowColumns, groupStatus: 'completed' })
    expect(screen.queryByRole('columnheader', { name: 'SLA’s timer' })).toBeNull()
    unmount()
    renderTable({ allowColumns, groupStatus: 'inProgress' })
    expect(screen.getByRole('columnheader', { name: 'SLA’s timer' })).toBeInTheDocument()
  })

  it('shows the external id column with the order external id, or a dash when it is missing', () => {
    renderTable({
      allowColumns: defaultColumns({ externalId: column(1, true, { title: 'External id' }) }),
      orderList: { loading: false, orders: [makeOrder(1, { external_id: 'EXT-77' }), makeOrder(2)] }
    })
    expect(screen.getByText('EXT-77')).toBeInTheDocument()
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0)
  })

  it('with change_order_id on, the first cell is the date of today and carries no order number', () => {
    mocks.configs = { change_order_id: { value: '1' } }
    const { container } = renderTable({
      allowColumns: defaultColumns({
        orderNumber: column(-1, false),
        dateTime: column(-1, true),
        slaBar: column(-2, false)
      })
    })
    const cell = firstRow(container).querySelectorAll('td')[1]
    expect(cell).toHaveTextContent('2024-05-01 10:30:00')
    expect(cell).not.toHaveTextContent('#13792')
  })

  it('shows the order number in mono type and the delivery date below it, with the time ago as title', () => {
    const { container } = renderTable({
      orderList: { loading: false, orders: [makeOrder(13792, { status: 0 })] }
    })
    // redesign F6h: the number is an isolated left-to-right run inside the mono element
    const number = screen.getByText('#13792').closest('.odc-mono')
    expect(number).toHaveClass('odc-mono')
    // redesign F6g: the date text sits in an isolated run inside the element that carries the title
    const date = within(firstRow(container)).getByText('2024-05-01 10:30:00').closest('[title]')
    expect(date).toHaveAttribute('title', '2 hours ago')
  })

  it('shows created and placed lines for catering orders', () => {
    const { container } = renderTable({
      orderList: { loading: false, orders: [makeOrder(5, { delivery_type: 7 })] }
    })
    expect(firstRow(container)).toHaveTextContent('Created at: 2024-05-01 10:00:00')
    expect(firstRow(container)).toHaveTextContent('Placed to: 2024-05-01 10:30:00')
  })

  // redesign W0-3a (T0-9, decisión 11a): the hours and dates of the list are figures; the words around them are not
  it('puts the date in mono and leaves «Created at:» and «Placed to:» as text', () => {
    const { container } = renderTable({
      orderList: { loading: false, orders: [makeOrder(5, { delivery_type: 7 })] }
    })
    const row = firstRow(container)
    const created = within(row).getByText('2024-05-01 10:00:00')
    const placed = within(row).getByText('2024-05-01 10:30:00')
    expect(created).toHaveClass('odc-figure')
    expect(placed).toHaveClass('odc-figure')
    expect(created.parentElement).toHaveTextContent('Created at:')
    expect(created.parentElement).not.toHaveClass('odc-figure')
    expect(placed.parentElement).toHaveTextContent('Placed to:')
    expect(placed.parentElement).not.toHaveClass('odc-figure')
  })

  it('puts the ETA time in mono and the ETA header and the order id out of it', () => {
    const { container } = renderTable({
      orderList: { loading: false, orders: [makeOrder(7, { eta_time: 20 })] }
    })
    // the figure is the node around the hour (the run inside it keeps the direction); the sub-line with the date is a figure too
    const cellEta = within(firstRow(container)).getByText('10:50').closest('.odc-figure')
    expect(cellEta).not.toBeNull()
    expect(cellEta.closest('.odc-orders-cell')).not.toHaveClass('odc-figure')
    expect(screen.getByRole('columnheader', { name: 'ETA' })).not.toHaveClass('odc-figure')
    expect(screen.getByText('#7').closest('.odc-mono')).not.toHaveClass('odc-figure')
  })

  it('names a reservation pre-order Reservation', () => {
    renderTable({
      orderList: { loading: false, orders: [makeOrder(6, { delivery_type: 9, status: 13 })] }
    })
    expect(screen.getByText('Reservation')).toBeInTheDocument()
    expect(screen.queryByText('Preorder')).toBeNull()
  })

  it('with isSelectedOrders it draws no selection and hides status, driver, advanced and external id', () => {
    const { container } = renderTable({
      isSelectedOrders: true,
      allowColumns: defaultColumns({ externalId: column(1, true, { title: 'External id' }) })
    })
    expect(screen.queryByRole('checkbox')).toBeNull()
    const texts = headerTexts(container)
    ;['Status', 'Driver', 'Advanced logistics', 'External id'].forEach(name => expect(texts).not.toContain(name))
    expect(texts).toContain('Business')
    expect(texts).toContain('Total')
  })

  it('writes the exact status with its family, and never truncates it', () => {
    renderTable({ orderList: { loading: false, orders: [makeOrder(1, { status: 7 }), makeOrder(2, { status: 1 })] } })
    const progress = screen.getByText('Accepted by business').closest('.odc-status')
    expect(progress).toHaveAttribute('data-family', 'progress')
    // redesign 5.2: one line on a desktop (columns step aside instead); the narrow list clips it
    // (a container query in orders-table.css), so the cell carries the status class.
    // redesign F6c: it no longer wraps in the narrow list either (OrdersTable.f6c5.test.jsx).
    expect(progress).not.toHaveAttribute('data-wrap')
    expect(progress.closest('td')).toHaveClass('odc-orders-col-status')
    expect(screen.getByText('Completed by admin').closest('.odc-status')).toHaveAttribute('data-family', 'done')
  })

  it('shows business, customer and the customer order count with the secondary line', () => {
    renderTable()
    expect(screen.getByText('Fast Bite')).toBeInTheDocument()
    expect(screen.getByText('New York')).toBeInTheDocument()
    expect(screen.getByText('Grace Okafor')).toBeInTheDocument()
    // redesign 5.2: the customer's order count is said in words on the secondary line.
    // redesign F6h: the phone is an isolated run, so the line is read through its text content
    expect(screen.getByText('555-0100').closest('.odc-orders-sub')).toHaveTextContent('555-0100 · 3 orders')
  })

  // redesign 5.2 audit-1: a customer without a name falls back to the email, then the phone, then «Unnamed customer».
  describe('customer without a name', () => {
    const nameOf = (container) => container.querySelector('.odc-orders-col-person .odc-orders-who-name')
    const cell = (customer) => renderTable({ orderList: { loading: false, orders: [makeOrder(7, { customer })] } })
    const customerCell = (container) => Array.from(container.querySelectorAll('.odc-orders-col-person'))
      .find(td => td.querySelector('.odc-orders-who-name') && !td.textContent.includes('Fast Bite'))

    it('shows the email as the name, and keeps the phone and the order count on the second line', () => {
      const { container } = cell({ name: '', email: 'ana@example.com', cellphone: '555-0100', orders_count: 76 })
      const td = customerCell(container)
      expect(td.querySelector('.odc-orders-who-name')).toHaveTextContent('ana@example.com')
      expect(td.querySelector('.odc-orders-sub')).toHaveTextContent('555-0100 · 76 orders')
    })

    it('shows the phone as the name when there is no email, and does not say it twice', () => {
      const { container } = cell({ name: '', cellphone: '555-0100', orders_count: 2 })
      const td = customerCell(container)
      expect(td.querySelector('.odc-orders-who-name')).toHaveTextContent('555-0100')
      expect(td.querySelector('.odc-orders-sub')).toHaveTextContent(/^2 orders$/)
    })

    it('says «Unnamed customer» when the record has nothing readable, and still counts the orders', () => {
      const { container } = cell({ name: '   ', orders_count: 1 })
      const td = customerCell(container)
      expect(td.querySelector('.odc-orders-who-name')).toHaveTextContent('Unnamed customer')
      expect(td.querySelector('.odc-orders-sub')).toHaveTextContent(/^1 order$/)
    })

    it('does not touch a customer that has a name, nor a guest', () => {
      const named = cell({ name: 'Grace', lastname: 'Okafor', email: 'g@example.com', cellphone: '555-0100', orders_count: 3 })
      expect(customerCell(named.container).querySelector('.odc-orders-who-name')).toHaveTextContent('Grace Okafor')
      named.unmount()
      const guest = cell({})
      expect(customerCell(guest.container).querySelector('.odc-orders-who-name')).toHaveTextContent('Guest user')
      expect(nameOf(guest.container)).toBeTruthy()
    })
  })

  it('formats the total like before, with the same currency symbol', () => {
    renderTable()
    // redesign W0-3a (T0-9, decisión 11a): the amount is a figure (mono, tabular); the Total header beside it is a label
    expect(screen.getByText('$35.20')).toHaveClass('odc-figure')
    expect(screen.getByRole('columnheader', { name: 'Total' })).not.toHaveClass('odc-figure')
  })

  it('shows the logistics and the cloned and pod data without raw keys', () => {
    renderTable({
      orderList: { loading: false, orders: [makeOrder(3, { logistic_status: 1, logistic_attemps: 2, priority: 2, cloned_order_id: 9, codigoPod: 'POD-9' })] }
    })
    expect(screen.getByText(/In progress/)).toBeInTheDocument()
    expect(screen.getByText(/Urgent/)).toBeInTheDocument()
    expect(screen.getByText('POD-9')).toBeInTheDocument()
    expect(screen.getByText('Cloned', { selector: '.odc-sr-only' })).toBeInTheDocument()
  })

  // redesign fix-qa C2 (coordinator decision, replaces E7's default-set rule): on the full-width list NO column
  // is hidden by width, default set or not (the table scrolls sideways, the order column stays; main showed
  // every column). Only while the order panel is open (split view) may the low-priority columns of the
  // untouched default set step aside, and they come back when it closes.
  describe('width (C2)', () => {
    const resizeTo = width => act(() => {
      observers.forEach(item => item.callback([{ contentRect: { width } }], item))
    })
    // What OrdersManage gives a user without saved settings: the timer is forced on.
    const defaultSet = (overrides = {}) => defaultColumns({ timer: column(11, true, { title: 'SLA’s timer', draggable: true }), ...overrides })
    const PRIORITY = [
      ['Advanced logistics', 'advanced'], ['Group Order', 'cartGroupId'], ['Driver Group Id', 'driverGroupId'],
      ['Cloned', 'cloned'], ['Pod', 'pod'], ['ETA', 'eta'], ['SLA’s timer', 'timer'], ['Business', 'business'], ['Customer', 'customer'], ['Driver', 'driver']
    ]

    it('full-width list, default set: every column stays at every width, the table scrolls instead', () => {
      vi.stubGlobal('ResizeObserver', MockResizeObserver)
      const onWidthHiddenChange = vi.fn()
      const { container } = renderTable({ allowColumns: defaultSet(), onWidthHiddenChange })
      const all = headerTexts(container)
      PRIORITY.forEach(([name]) => expect(all).toContain(name))
      ;[4000, 1440, 1152, 1024, 768, 500, 300].forEach(width => {
        resizeTo(width)
        expect(headerTexts(container), `width ${width}`).toEqual(all)
      })
      expect(onWidthHiddenChange).not.toHaveBeenCalledWith(expect.arrayContaining(['advanced']))
      expect(onWidthHiddenChange).not.toHaveBeenCalledWith(expect.arrayContaining(['business']))
    })

    it('full-width list: the selection column and the order column are the ones that stay while it scrolls', () => {
      vi.stubGlobal('ResizeObserver', MockResizeObserver)
      const { container } = renderTable({ allowColumns: defaultSet() })
      resizeTo(400)
      expect(container.querySelector('thead th[data-selection]')).not.toBeNull()
      expect(container.querySelector('thead th.odc-orders-col-sticky')).toHaveTextContent('Order')
    })

    describe('with the order panel open', () => {
      it('default set: drops columns by priority as the table narrows, never the locked ones', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const onWidthHiddenChange = vi.fn()
        const { container } = renderTable({ allowColumns: defaultSet(), onWidthHiddenChange }, { panelOpen: true })
        resizeTo(4000)
        expect(headerTexts(container)).toContain('Advanced logistics')
        expect(onWidthHiddenChange).not.toHaveBeenCalledWith(expect.arrayContaining(['advanced']))
        // The first width, going down, at which each column has stepped aside.
        const droppedAt = {}
        for (let width = 4000; width >= 300; width -= 10) {
          resizeTo(width)
          const texts = headerTexts(container)
          PRIORITY.forEach(([name]) => { if (!texts.includes(name) && droppedAt[name] === undefined) droppedAt[name] = width })
          ;['SLA', 'Order', 'Status', 'Total'].forEach(name => expect(texts).toContain(name))
        }
        PRIORITY.forEach(([name]) => expect(droppedAt[name], name).toBeDefined())
        for (let index = 1; index < PRIORITY.length; index++) {
          expect(droppedAt[PRIORITY[index - 1][0]], PRIORITY[index][0]).toBeGreaterThanOrEqual(droppedAt[PRIORITY[index][0]])
        }
        expect(onWidthHiddenChange).toHaveBeenLastCalledWith(expect.arrayContaining(PRIORITY.map(([, key]) => key)))
      })

      it('default set: only the lowest-priority columns step aside, so there is never a gap above a hidden one', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const { container } = renderTable({ allowColumns: defaultSet() }, { panelOpen: true })
        ;[1500, 1300, 1152, 1024, 968, 800].forEach(width => {
          resizeTo(width)
          const texts = headerTexts(container)
          const visible = PRIORITY.map(([name]) => texts.includes(name))
          // once a column in the priority list is shown, every column that outranks it is shown too
          const firstShown = visible.indexOf(true)
          if (firstShown >= 0) visible.slice(firstShown).forEach(shown => expect(shown, `width ${width}`).toBe(true))
        })
        resizeTo(4000)
        PRIORITY.forEach(([name]) => expect(headerTexts(container)).toContain(name))
      })

      it('default set: a wider list brings the columns back, one by one', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const { container } = renderTable({ allowColumns: defaultSet() }, { panelOpen: true })
        resizeTo(600)
        const narrow = PRIORITY.filter(([name]) => headerTexts(container).includes(name)).length
        resizeTo(1152)
        const mid = PRIORITY.filter(([name]) => headerTexts(container).includes(name)).length
        resizeTo(4000)
        const wide = PRIORITY.filter(([name]) => headerTexts(container).includes(name)).length
        expect(narrow).toBeLessThan(mid)
        expect(mid).toBeLessThan(wide)
        expect(wide).toBe(PRIORITY.length)
      })

      it('closing the panel brings every column back, whatever the width', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const onWidthHiddenChange = vi.fn()
        const { container, rerenderWith } = renderTable({ allowColumns: defaultSet(), onWidthHiddenChange }, { panelOpen: true })
        resizeTo(700)
        expect(headerTexts(container)).not.toContain('Business')
        expect(onWidthHiddenChange).toHaveBeenLastCalledWith(expect.arrayContaining(['business']))
        rerenderWith({}, { panelOpen: false })
        PRIORITY.forEach(([name]) => expect(headerTexts(container)).toContain(name))
        expect(onWidthHiddenChange).toHaveBeenLastCalledWith([])
        rerenderWith({}, { panelOpen: true })
        expect(headerTexts(container)).not.toContain('Business')
      })

      // Below 1280 the panel is a modal sheet over the list, and expanded hides the list: the list keeps its width,
      // so nothing steps aside for a panel that is not beside it.
      it('a panel that is not beside the list (overlay under 1280px, or expanded) takes no column away', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const overlay = renderTable({ allowColumns: defaultSet() }, { panelOpen: true, viewport: 1024 })
        const all = headerTexts(overlay.container)
        resizeTo(700)
        expect(headerTexts(overlay.container)).toEqual(all)
        overlay.unmount()
        const expanded = renderTable({ allowColumns: defaultSet() }, { panelOpen: true, expanded: true })
        const allExpanded = headerTexts(expanded.container)
        resizeTo(700)
        expect(headerTexts(expanded.container)).toEqual(allExpanded)
      })

      it('a column the user switched on is never hidden by width: the table scrolls instead', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const onWidthHiddenChange = vi.fn()
        const allowColumns = defaultSet({
          externalId: column(1, true, { title: 'External id', draggable: true }),
          agent: column(3, true, { title: 'Agent', draggable: true }),
          channel: column(13, true, { title: 'Channel', draggable: true })
        })
        const { container } = renderTable({ allowColumns, onWidthHiddenChange }, { panelOpen: true })
        const all = headerTexts(container)
        resizeTo(1152)
        expect(headerTexts(container)).toEqual(all)
        resizeTo(500)
        expect(headerTexts(container)).toEqual(all)
        expect(onWidthHiddenChange).not.toHaveBeenCalledWith(expect.arrayContaining(['business']))
        expect(onWidthHiddenChange).not.toHaveBeenCalledWith(expect.arrayContaining(['externalId']))
      })

      it('a set the user trimmed is theirs too: nothing steps aside at any width', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const allowColumns = defaultSet({ pod: column(14, false), cloned: column(10, false) })
        const { container } = renderTable({ allowColumns }, { panelOpen: true })
        const all = headerTexts(container)
        resizeTo(400)
        expect(headerTexts(container)).toEqual(all)
      })

      // B9: saved user settings are the user's. The timer is forced on only for a user without them, so a
      // timer that is off, and columns the user moved, mean the set is no longer the untouched default.
      it('a timer the user switched off makes the set theirs: nothing steps aside', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const { container } = renderTable({ allowColumns: defaultColumns() }, { panelOpen: true })
        const all = headerTexts(container)
        resizeTo(400)
        expect(headerTexts(container)).toEqual(all)
      })

      it('reordering columns is a user choice too: nothing steps aside', () => {
        vi.stubGlobal('ResizeObserver', MockResizeObserver)
        const allowColumns = defaultSet({ business: column(7, true, { title: 'Business' }), customer: column(6, true, { title: 'Customer' }) })
        const { container } = renderTable({ allowColumns }, { panelOpen: true })
        const all = headerTexts(container)
        expect(all.indexOf('Customer')).toBeLessThan(all.indexOf('Business'))
        resizeTo(400)
        expect(headerTexts(container)).toEqual(all)
      })
    })

    describe('isDefaultColumnSet', () => {
      it('is true for what a user without saved settings gets (SLA and timer on)', () => {
        expect(isDefaultColumnSet(defaultSet(), false)).toBe(true)
        expect(isDefaultColumnSet(defaultSet({ slaBar: column(-2, false) }), false)).toBe(true)
      })

      it('is false when the timer is off, a column was toggled, or two columns traded places', () => {
        expect(isDefaultColumnSet(defaultColumns(), false)).toBe(false)
        expect(isDefaultColumnSet(defaultSet({ pod: column(14, false) }), false)).toBe(false)
        expect(isDefaultColumnSet(defaultSet({ agent: column(3, true) }), false)).toBe(false)
        expect(isDefaultColumnSet(defaultSet({ driver: column(6, true), business: column(8, true) }), false)).toBe(false)
      })

      it('knows the order cell is the date with change_order_id on', () => {
        const withExternal = defaultSet({ orderNumber: column(-1, false), dateTime: column(-1, true) })
        expect(isDefaultColumnSet(withExternal, true)).toBe(true)
        expect(isDefaultColumnSet(withExternal, false)).toBe(false)
      })
    })

    it('keeps the order column (and the select-all before it) in place while the table scrolls sideways', () => {
      const { container } = renderTable()
      const header = container.querySelector('thead th.odc-orders-col-sticky')
      expect(header).toHaveTextContent('Order')
      expect(firstRow(container).querySelector('td.odc-orders-col-sticky')).toHaveTextContent('#13792')
      expect(container.querySelectorAll('.odc-orders-col-sticky')).toHaveLength(2)
    })

    it('with change_order_id on the date is the cell that stays; in a lateral list there is no selection column to clear', () => {
      mocks.configs = { change_order_id: { value: '1' } }
      const { container } = renderTable({
        isSelectedOrders: true,
        allowColumns: defaultColumns({ orderNumber: column(-1, false), dateTime: column(-1, true) })
      })
      expect(container.querySelector('thead th.odc-orders-col-sticky')).toHaveTextContent('Date')
    })

    it('the stylesheet pins the selection column and the order column and keeps their fill opaque', () => {
      const css = readFileSync(resolve(__dirname, '../orders-table.css'), 'utf8')
      const sticky = css.match(/\.odc-orders-col-sticky[^{]*\{([^}]*)\}/)
      expect(sticky).not.toBeNull()
      expect(sticky[1]).toMatch(/position:\s*sticky/)
      expect(sticky[1]).toMatch(/inset-inline-start:\s*var\(--od-x-selection-col\)/)
      expect(css).toMatch(/\[data-selection\][^{]*\{[^}]*position:\s*sticky/)
      expect(css).toMatch(/\[data-bounded\][^{]*odc-orders-col-sticky[^{]*\{[^}]*inset-inline-start:\s*0/)
      // an opaque base, so the columns that scroll under it never show through
      expect(css).toMatch(/background(-color)?:[^;]*var\(--od-bg\)/)
    })
  })

  // redesign 5.2 polish: the customer and driver order tabs keep their own scroll, with a ceiling.
  it('bounds the table height with isSelectedOrders and with no other screen', () => {
    const { container, unmount } = renderTable({ isSelectedOrders: true })
    expect(container.querySelector('.odc-orders-table')).toHaveAttribute('data-bounded')
    unmount()
    const view = renderTable()
    expect(view.container.querySelector('.odc-orders-table')).not.toHaveAttribute('data-bounded')
  })

  it('ties that ceiling to --od-x-detail-offset with no literal', () => {
    const css = readFileSync(resolve(__dirname, '../orders-table.css'), 'utf8')
    const rule = css.match(/\.odc-orders-table\[data-bounded\][^{]*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/max-block-size:\s*calc\(100dvh - var\(--od-x-detail-offset\)\)/)
  })

  it('passes the density to the table', () => {
    const { container } = renderTable({ density: 'compact' })
    expect(container.querySelector('table')).toHaveAttribute('data-density', 'compact')
  })
})

describe('OrdersTable SLA column', () => {
  const slaOrders = () => [
    makeOrder(1, { time_status: 'in_time', delivery_datetime_utc: localStamp(120), eta_time: 0 }),
    makeOrder(2, { time_status: 'at_risk', delivery_datetime_utc: localStamp(25), eta_time: 0 }),
    makeOrder(3, { time_status: 'delayed', delivery_datetime_utc: localStamp(-90), eta_time: 0 }),
    makeOrder(4, { delivery_datetime_utc: localStamp(30), eta_time: 0 })
  ]

  it('says it in words for the three levels and puts a dash when there is no level', () => {
    const { container } = renderTable({ orderList: { loading: false, orders: slaOrders() } })
    const rows = container.querySelectorAll('tbody tr[data-row-id]')
    const slaIndex = headerTexts(container).indexOf('SLA')
    const slaCell = row => row.querySelectorAll('td')[slaIndex]
    expect(slaCell(rows[0])).toHaveTextContent('On time')
    expect(slaCell(rows[0]).querySelector('[data-level]')).toHaveAttribute('data-level', 'ok')
    expect(slaCell(rows[1])).toHaveTextContent('Due in 25 min')
    expect(slaCell(rows[1]).querySelector('[data-level]')).toHaveAttribute('data-level', 'risk')
    expect(slaCell(rows[2])).toHaveTextContent('Delayed · 1 h 30 min')
    expect(slaCell(rows[2]).querySelector('[data-level]')).toHaveAttribute('data-level', 'late')
    expect(slaCell(rows[3])).toHaveTextContent('No data')
  })

  it('never measures a closed order against now: on time or late, without minutes (C16)', () => {
    const { container } = renderTable({
      orderList: {
        loading: false,
        orders: [
          makeOrder(5, { status: 11, time_status: 'delayed', delivery_datetime_utc: localStamp(-9000), eta_time: 0 }),
          makeOrder(6, { status: 1, time_status: 'in_time', delivery_datetime_utc: localStamp(-9000), eta_time: 0 })
        ]
      }
    })
    const slaIndex = headerTexts(container).indexOf('SLA')
    const rows = container.querySelectorAll('tbody tr[data-row-id]')
    expect(rows[0].querySelectorAll('td')[slaIndex]).toHaveTextContent(/^Late$/)
    expect(rows[1].querySelectorAll('td')[slaIndex]).toHaveTextContent(/^On time$/)
  })

  // (tanda Y): the criterion of on the cards. An open order the server calls in_time but whose ETA
  // already passed gets no «On time»; an open order still ahead of its ETA, and a closed one, keep it.
  it('drops «On time» from an open order whose ETA already passed', () => {
    const { container } = renderTable({
      orderList: {
        loading: false,
        orders: [
          makeOrder(21, { status: 0, time_status: 'in_time', delivery_datetime_utc: localStamp(-30), eta_time: 0 }),
          makeOrder(22, { status: 0, time_status: 'in_time', delivery_datetime_utc: localStamp(30), eta_time: 0 }),
          makeOrder(23, { status: 1, time_status: 'in_time', delivery_datetime_utc: localStamp(-30), eta_time: 0 }),
          makeOrder(24, { status: 2, time_status: 'in_time', delivery_datetime_utc: localStamp(-30), eta_time: 0 })
        ]
      }
    })
    const slaIndex = headerTexts(container).indexOf('SLA')
    const cells = [...container.querySelectorAll('tbody tr[data-row-id]')].map(row => row.querySelectorAll('td')[slaIndex])
    expect(cells[0]).not.toHaveTextContent('On time')
    expect(cells[0].querySelector('[data-level]')).toBeNull()
    expect(cells[1]).toHaveTextContent(/^On time$/)
    expect(cells[2]).toHaveTextContent(/^On time$/)
    expect(cells[3]).toHaveTextContent(/^On time$/)
  })

  // (tanda Y): the cases the delivery cards check too (slaParityCases), so table and card decide «On time» alike
  it.each(slaParityCases().map(item => [item.name, item]))('decides «On time» as the delivery card: %s', (_name, item) => {
    const { container } = renderTable({ orderList: { loading: false, orders: [{ ...makeOrder(item.order.id), ...item.order }] } })
    const slaIndex = headerTexts(container).indexOf('SLA')
    const cell = container.querySelector('tbody tr[data-row-id]').querySelectorAll('td')[slaIndex]
    expect(cell.textContent.includes('On time')).toBe(item.onTime)
  })

  // X-R6: closed orders only list under Completed and Cancelled, where the table has no «SLA timer» column
  it('has no count-down timer column for closed orders', () => {
    const { container } = renderTable({ groupStatus: 'completed', allowColumns: defaultColumns({ timer: column(11, true, { title: 'SLA’s timer', draggable: true }) }) })
    expect(headerTexts(container).some(text => /timer/i.test(text))).toBe(false)
  })

  it('tints the row with data-status only when row_in_color_enabled is on', () => {
    const { container, unmount } = renderTable({ orderList: { loading: false, orders: slaOrders() } })
    expect(container.querySelectorAll('tbody tr[data-status]')).toHaveLength(0)
    unmount()
    mocks.configs = { row_in_color_enabled: { value: '1' } }
    const view = renderTable({ orderList: { loading: false, orders: slaOrders() } })
    const rows = view.container.querySelectorAll('tbody tr[data-row-id]')
    expect(rows[1]).toHaveAttribute('data-status', 'at_risk')
    expect(rows[2]).toHaveAttribute('data-status', 'delayed')
  })

  it('shows the timer in numbers for pending and in progress', () => {
    renderTable({
      allowColumns: defaultColumns({ timer: column(11, true, { title: 'SLA’s timer' }) }),
      orderList: { loading: false, orders: [makeOrder(8, { time_status: 'at_risk', delivery_datetime_utc: localStamp(25), eta_time: 0 })] }
    })
    // redesign W0-3a (T0-9, decisión 11a): the timer is a figure; the SLA column title is a label
    expect(screen.getByText('00:25')).toHaveClass('odc-figure')
    expect(screen.getByRole('columnheader', { name: 'SLA’s timer' })).not.toHaveClass('odc-figure')
  })

  // redesign fix-qa E7: the timer keeps the colour of the order's time_status (main: Order.js `<p className={time_status}>`).
  it('carries the time_status on the timer so it is coloured like the SLA', () => {
    renderTable({
      allowColumns: defaultColumns({ timer: column(11, true, { title: 'SLA’s timer' }) }),
      orderList: { loading: false, orders: [makeOrder(8, { time_status: 'delayed', delivery_datetime_utc: localStamp(-25), eta_time: 0 })] }
    })
    expect(screen.getByText('- 00:25').closest('[data-status]')).toHaveAttribute('data-status', 'delayed')
  })

  it('colours the timer by that status with the brand tokens only', () => {
    const css = readFileSync(resolve(__dirname, '../orders-table.css'), 'utf8')
    expect(css).toMatch(/\.odc-orders-timer\[data-status='delayed'\][^{]*\{[^}]*color:\s*var\(--od-danger-functional\)/)
    expect(css).toMatch(/\.odc-orders-timer\[data-status='at_risk'\][^{]*\{[^}]*color:/)
  })

  // redesign fix-qa C2 (B15): an in-time timer is green again (main: OrdersTable/styles.js:416-418), from tokens only.
  it('colours an in-time timer green from the --od-x-timer-ok token, readable on both surfaces', () => {
    renderTable({
      allowColumns: defaultColumns({ timer: column(11, true, { title: 'SLA’s timer' }) }),
      orderList: { loading: false, orders: [makeOrder(8, { time_status: 'in_time', delivery_datetime_utc: localStamp(90), eta_time: 0 })] }
    })
    expect(screen.getByText('01:30').closest('[data-status]')).toHaveAttribute('data-status', 'in_time')
    const css = readFileSync(resolve(__dirname, '../orders-table.css'), 'utf8')
    expect(css).toMatch(/\.odc-orders-timer\[data-status='in_time'\][^{]*\{[^}]*color:\s*var\(--od-x-timer-ok\)/)
    const candidates = readFileSync(resolve(__dirname, '../../../../../../../../../brand/candidates.css'), 'utf8')
    // derived from the released success signal and the text colour (no literal): 6.3:1 on white at light, higher on the dark surface
    expect(candidates).toMatch(/--od-x-timer-ok:\s*color-mix\(in srgb,\s*var\(--od-success-signal\)\s*50%,\s*var\(--od-text\)\)/)
  })

  // redesign fix-qa E7: «time ago» of the delivery is a second line under the total again (main: Order.js:341-349).
  it('shows the time ago of the delivery under the total, except for closed orders', () => {
    const { container } = renderTable({
      orderList: { loading: false, orders: [makeOrder(1, { status: 0 }), makeOrder(2, { status: 1 })] }
    })
    const totalIndex = headerTexts(container).indexOf('Total')
    const rows = container.querySelectorAll('tbody tr[data-row-id]')
    const open = rows[0].querySelectorAll('td')[totalIndex]
    expect(open.querySelector('.odc-orders-sub')).toHaveTextContent('2 hours ago')
    expect(rows[1].querySelectorAll('td')[totalIndex].querySelector('.odc-orders-sub')).toBeNull()
  })
})

describe('OrdersTable driver column', () => {
  // redesign 5.2: an open delivery without a driver shows only «Assign» (named for its
  // order); «Unassigned» is for closed orders, where nothing can be assigned any more.
  it('offers Assign on a pending delivery, which opens the detail', async () => {
    const user = userEvent.setup()
    const order = makeOrder(11, { status: 0, delivery_type: 1 })
    const { props } = renderTable({ orderList: { loading: false, orders: [order] } })
    expect(screen.queryByText('Unassigned')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Assign a driver to order 11' }))
    expect(props.handleOpenOrderDetail).toHaveBeenCalledTimes(1)
    expect(props.handleOpenOrderDetail.mock.calls[0][0]).toBe(order)
  })

  it('does not offer Assign on a closed order or on a pickup', () => {
    renderTable({
      orderList: { loading: false, orders: [makeOrder(12, { status: 1, delivery_type: 1 }), makeOrder(13, { status: 0, delivery_type: 2 })] }
    })
    expect(screen.queryByRole('button', { name: 'Assign' })).toBeNull()
    expect(screen.getAllByText('Unassigned')).toHaveLength(1)
  })

  describe('manual assignment configs', () => {
    afterEach(() => { mocks.user = { level: 0 }; mocks.configs = {} })

    const pending = () => ({ loading: false, orders: [makeOrder(15, { status: 0, delivery_type: 1 })] })

    it('shows Unassigned instead of Assign to a delivery manager when their config is off', () => {
      mocks.user = { level: 5 }
      mocks.configs = { delivery_manager_manual_driver_assignment_enabled: { value: '0' } }
      renderTable({ orderList: pending() })
      expect(screen.queryByRole('button', { name: 'Assign a driver to order 15' })).toBeNull()
      expect(screen.getByText('Unassigned')).toBeInTheDocument()
    })

    it('shows Unassigned instead of Assign to a business owner when their config is off', () => {
      mocks.user = { level: 2 }
      mocks.configs = { store_app_manual_driver_assignment_enabled: { value: '0' } }
      renderTable({ orderList: pending() })
      expect(screen.queryByRole('button', { name: 'Assign a driver to order 15' })).toBeNull()
      expect(screen.getByText('Unassigned')).toBeInTheDocument()
    })

    it('keeps Assign for an administrator with both configs off', () => {
      mocks.configs = {
        store_app_manual_driver_assignment_enabled: { value: '0' },
        delivery_manager_manual_driver_assignment_enabled: { value: '0' }
      }
      renderTable({ orderList: pending() })
      expect(screen.getByRole('button', { name: 'Assign a driver to order 15' })).toBeInTheDocument()
    })
  })

  it('shows the driver with the photo avatar and the name', () => {
    renderTable({
      orderList: { loading: false, orders: [makeOrder(14, { status: 7, driver: { name: 'Dani Driver', cellphone: '555-0199' } })] }
    })
    expect(screen.getByText('Dani Driver')).toBeInTheDocument()
    expect(screen.getByText('555-0199')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Assign' })).toBeNull()
  })
})

describe('OrdersTable selection', () => {
  const orders = () => [makeOrder(1, { status: 0 }), makeOrder(2, { status: 1 }), makeOrder(3, { status: 0 })]

  // redesign fix-qa E7: while the page loads there is nothing to select, so «Select all» is inert (aria-disabled; the skeleton rows have no checkbox).
  it('makes Select all inert while the list loads and live once the rows are there', () => {
    const { unmount } = renderTable({ orderList: { loading: true, orders: [] } })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-disabled', 'true')
    unmount()
    renderTable()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).not.toHaveAttribute('aria-disabled')
  })

  it('draws no checkbox for a locked order, and keeps the orderCheckBox class on the others', () => {
    mocks.locked = new Set([1])
    renderTable({ orderList: { loading: false, orders: orders() } })
    expect(screen.queryByRole('checkbox', { name: 'Order 2' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Order 1' })).toHaveClass('orderCheckBox')
    expect(screen.getByRole('checkbox', { name: 'Order 3' })).toHaveClass('orderCheckBox')
  })

  it('toggles one order through handleSelectedOrderIds', async () => {
    const user = userEvent.setup()
    const { props } = renderTable({ orderList: { loading: false, orders: orders() } })
    await user.click(screen.getByRole('checkbox', { name: 'Order 3' }))
    expect(props.handleSelectedOrderIds).toHaveBeenCalledWith(3)
  })

  it('selects the page without the locked orders and without repeating ids', async () => {
    mocks.locked = new Set([1])
    const user = userEvent.setup()
    const { props } = renderTable({ orderList: { loading: false, orders: orders() }, selectedOrderIds: [3] })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'mixed')
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(props.setSelectedOrderIds).toHaveBeenCalledWith([3, 1])
  })

  it('deselects only the page when everything selectable is selected', async () => {
    mocks.locked = new Set([1])
    const user = userEvent.setup()
    const { props } = renderTable({ orderList: { loading: false, orders: orders() }, selectedOrderIds: [99, 1, 3] })
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(props.setSelectedOrderIds).toHaveBeenCalledWith([99])
  })

  it('opens the detail on a row click but not on a click in the checkbox, and anchors the tour on the first row', async () => {
    const user = userEvent.setup()
    const list = orders()
    const { props, container } = renderTable({ orderList: { loading: false, orders: list } })
    const rows = container.querySelectorAll('tbody tr[data-row-id]')
    expect(rows[0]).toHaveAttribute('data-tour', 'tour_start')
    expect(rows[1]).not.toHaveAttribute('data-tour')
    await user.click(screen.getByRole('checkbox', { name: 'Order 1' }))
    expect(props.handleOpenOrderDetail).not.toHaveBeenCalled()
    await user.click(within(rows[2]).getByText('Grace Okafor'))
    expect(props.handleOpenOrderDetail).toHaveBeenCalledWith(list[2], false, undefined)
  })

  it('marks the open order as the active row', () => {
    const { container } = renderTable({ orderList: { loading: false, orders: orders() }, orderDetailId: '3' })
    expect(container.querySelector('tr[data-row-id="3"]')).toHaveAttribute('aria-current', 'true')
  })
})

describe('OrdersTable footer', () => {
  it('says which orders are shown, with the numbers set apart for bidirectional text', () => {
    renderTable({ pagination: { currentPage: 2, pageSize: 10, total: 23 } })
    const text = screen.getByText(/Showing/)
    expect(text).toHaveTextContent('Showing 11–20 of 23')
    expect(Array.from(text.querySelectorAll('bdi.odc-num')).map(node => node.textContent)).toEqual(['11', '20', '23'])
  })

  it('shows the last page range cut at the total', () => {
    renderTable({ pagination: { currentPage: 3, pageSize: 10, total: 23 } })
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 21–23 of 23')
  })

  it('goes to the previous and next page with the same handler as before', async () => {
    const user = userEvent.setup()
    const { props } = renderTable({ pagination: { currentPage: 2, pageSize: 10, total: 35 } })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(props.getPageOrders).toHaveBeenLastCalledWith(10, 3)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(props.getPageOrders).toHaveBeenLastCalledWith(10, 1)
  })

  it('disables previous on the first page and next on the last', () => {
    const { unmount } = renderTable({ pagination: { currentPage: 1, pageSize: 10, total: 25 } })
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    unmount()
    renderTable({ pagination: { currentPage: 3, pageSize: 10, total: 25 } })
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  // redesign fix-qa E8: pressing Previous on page 2 lands on page 1 and disables the button that had the focus;
  // the focus used to drop to <body> (then the sidebar). It goes to the page field instead.
  it('keeps the focus in the pager when the pressed button gets disabled (first and last page)', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderTable({ pagination: { currentPage: 2, pageSize: 10, total: 25 } })
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    rerenderWith({ pagination: { currentPage: 1, pageSize: 10, total: 25 } })
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Page' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    rerenderWith({ pagination: { currentPage: 2, pageSize: 10, total: 25 } })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    rerenderWith({ pagination: { currentPage: 3, pageSize: 10, total: 25 } })
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Page' })).toHaveFocus()
  })

  it('leaves the focus alone when a page change did not come from the pager buttons', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderTable({ pagination: { currentPage: 1, pageSize: 10, total: 25 } })
    const menu = screen.getByRole('button', { name: '10' })
    menu.focus()
    rerenderWith({ pagination: { currentPage: 2, pageSize: 10, total: 25 } })
    expect(menu).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    rerenderWith({ pagination: { currentPage: 3, pageSize: 10, total: 25 } })
    expect(screen.getByRole('textbox', { name: 'Page' })).toHaveFocus()
  })

  it('changes the page size to 10, 25 or 50 and keeps the first order in view', async () => {
    const user = userEvent.setup()
    const { props } = renderTable({ pagination: { currentPage: 3, pageSize: 10, total: 120 } })
    await user.click(screen.getByRole('button', { name: '10' }))
    expect((await screen.findAllByRole('menuitem')).map(item => item.textContent)).toEqual(['10', '25', '50'])
    await user.click(screen.getByRole('menuitem', { name: '25' }))
    // first order of page 3 at size 10 is #21, which sits on page 1 at size 25
    expect(props.getPageOrders).toHaveBeenCalledWith(25, 1)
  })

  // redesign fix-qa E7: the jump to a page is a numeric field you can type in (it was a Select whose list of
  // every page left the viewport on long lists). Same handler as the arrows; Enter or leaving the field commits.
  const pageField = () => screen.getByRole('textbox', { name: 'Page' })
  const jumpTo = async (user, value) => {
    const field = pageField()
    await user.clear(field)
    await user.type(field, `${value}{Enter}`)
  }

  it('offers a numeric Page field set on the current page, with «of N» beside it, between the range text and the arrows', () => {
    const { container } = renderTable({ pagination: { currentPage: 2, pageSize: 10, total: 35 } })
    const field = pageField()
    expect(field).toHaveValue('2')
    expect(field).toHaveAttribute('inputmode', 'numeric')
    expect(container.querySelector('.odc-orders-foot select')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(container.querySelector('.odc-orders-pager')).toHaveTextContent('of 4')
    const foot = container.querySelector('.odc-orders-foot')
    const order = Array.from(foot.querySelectorAll('span[dir="auto"], input.odc-orders-page-input, button[aria-label="Previous page"]'))
    expect(order.map(node => node.tagName + (node.getAttribute('aria-label') || ''))).toEqual(['SPAN', 'INPUTPage', 'BUTTONPrevious page'])
  })

  it('jumps to the typed page with the same handler as the arrows', async () => {
    const user = userEvent.setup()
    const { props } = renderTable({ pagination: { currentPage: 2, pageSize: 25, total: 120 } })
    await jumpTo(user, 5)
    expect(props.getPageOrders).toHaveBeenCalledTimes(1)
    expect(props.getPageOrders).toHaveBeenCalledWith(25, 5)
  })

  it('also jumps when the field loses focus', async () => {
    const user = userEvent.setup()
    const { props } = renderTable({ pagination: { currentPage: 2, pageSize: 25, total: 120 } })
    await user.clear(pageField())
    await user.type(pageField(), '3')
    await user.tab()
    expect(props.getPageOrders).toHaveBeenCalledWith(25, 3)
  })

  it('keeps a page that does not exist inside the list: past the last goes to the last, below the first to the first', async () => {
    const user = userEvent.setup()
    const { props } = renderTable({ pagination: { currentPage: 2, pageSize: 10, total: 35 } })
    await jumpTo(user, 99)
    expect(props.getPageOrders).toHaveBeenLastCalledWith(10, 4)
    await jumpTo(user, 0)
    expect(props.getPageOrders).toHaveBeenLastCalledWith(10, 1)
  })

  it('does not reload for the current page, nor for something that is not a number, and puts the page back', async () => {
    const user = userEvent.setup()
    const { props } = renderTable({ pagination: { currentPage: 2, pageSize: 10, total: 35 } })
    await jumpTo(user, 2)
    expect(props.getPageOrders).not.toHaveBeenCalled()
    await user.clear(pageField())
    await user.type(pageField(), 'ab{Enter}')
    expect(props.getPageOrders).not.toHaveBeenCalled()
    expect(pageField()).toHaveValue('2')
  })

  it('keeps the field and the URL in sync once the controller moves to the chosen page', async () => {
    const user = userEvent.setup()
    const { props, rerenderWith } = renderTable({ isUseQuery: true, pagination: { currentPage: 1, pageSize: 10, total: 35 } })
    await jumpTo(user, 3)
    expect(props.getPageOrders).toHaveBeenCalledWith(10, 3)
    act(() => rerenderWith({ pagination: { currentPage: 3, pageSize: 10, total: 35 } }))
    expect(pageField()).toHaveValue('3')
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ page: 3, pageSize: 10 })
  })

  it('is 28px with a mouse and 44px with a touch, from tokens', () => {
    const css = readFileSync(resolve(__dirname, '../orders-table.css'), 'utf8')
    expect(css).toMatch(/\.odc-orders-page-input\s*\{[^}]*block-size:\s*var\(--od-x-control-height-sm\)/)
    const coarse = css.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}/)[1]
    expect(coarse).toMatch(/\.odc-orders-page-input[^{]*\{[^}]*block-size:\s*var\(--od-x-target-coarse\)/)
  })

  it('has no Page field when everything fits in one page', () => {
    renderTable({ pagination: { currentPage: 1, pageSize: 10, total: 7 } })
    expect(screen.queryByRole('textbox', { name: 'Page' })).toBeNull()
  })

  it('keeps the URL in sync with the page when it uses the query string', () => {
    renderTable({ isUseQuery: true, pagination: { currentPage: 2, pageSize: 25, total: 80 } })
    expect(mocks.addQueryToUrl).toHaveBeenCalledWith({ page: 2, pageSize: 25 })
  })

  it('does not touch the URL when the page does not use it', () => {
    renderTable({ pagination: { currentPage: 2, pageSize: 25, total: 80 } })
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
  })
})

describe('OrdersTable arrivals', () => {
  it('highlights an order that arrives while the page stays, announces it politely, and stops after 2.4s', () => {
    vi.useFakeTimers()
    const first = makeOrder(100)
    const { container, rerenderWith } = renderTable({ orderList: { loading: false, orders: [first] }, pagination: { currentPage: 1, pageSize: 10, total: 1 } })
    expect(container.querySelector('tr[data-new]')).toBeNull()
    act(() => rerenderWith({ orderList: { loading: false, orders: [makeOrder(101), first] }, pagination: { currentPage: 1, pageSize: 10, total: 2 } }))
    expect(container.querySelector('tr[data-row-id="101"]')).toHaveAttribute('data-new')
    expect(container.querySelector('tr[data-row-id="100"]')).not.toHaveAttribute('data-new')
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toHaveTextContent('New order #101')
    act(() => { vi.advanceTimersByTime(2400) })
    expect(container.querySelector('tr[data-new]')).toBeNull()
    expect(live).toBeEmptyDOMElement()
  })

  it('does not treat a page change as an arrival', () => {
    const { container, rerenderWith } = renderTable({ orderList: { loading: false, orders: [makeOrder(100)] } })
    act(() => rerenderWith({ orderList: { loading: true, orders: [] } }))
    act(() => rerenderWith({ orderList: { loading: false, orders: [makeOrder(200), makeOrder(201)] }, pagination: { currentPage: 2, pageSize: 10, total: 12 } }))
    expect(container.querySelector('tr[data-new]')).toBeNull()
  })
})

describe('OrdersTable with no rows', () => {
  // redesign 5.2 audit-1: sentence case and no full stop, like the empty states of the list.
  it('says there is nothing on this page instead of leaving a bare table', () => {
    renderTable({ orderList: { loading: false, orders: [] }, pagination: { currentPage: 1, pageSize: 10, total: 0 } })
    expect(screen.getByText('No orders')).toBeInTheDocument()
  })
})

describe('OrdersTable scroll region', () => {
  // redesign tanda AB (O-1): on /all-in-one the table (1024px) sits in a 698px column and scrolls sideways; the scroller is a
  // named region (the rows are interactive, so it is not a tab stop) and fades the edge that has more to show, as the Stores table does.
  it('names the sideways scroller as a region and fades its edge', () => {
    const { container } = renderTable()
    const scroller = container.querySelector('.odc-table-scroll')
    expect(scroller).toHaveAttribute('role', 'region')
    expect(scroller).toHaveAttribute('aria-label', 'Orders table, scrolls sideways')
    expect(scroller).toHaveClass('odc-fade-x')
    expect(screen.getByRole('region', { name: 'Orders table, scrolls sideways' })).toBe(scroller)
    expect(scroller).not.toHaveAttribute('tabindex') // the interactive rows are the tab stops
  })
})
