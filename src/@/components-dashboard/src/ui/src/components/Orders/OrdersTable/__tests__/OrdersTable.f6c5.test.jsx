/* eslint-disable import/first */
// redesign F6c-5: the list beside the order panel (Q2-05), compact rows (Q2-22) and the phone card of a closed order (Q2-27).
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{
    parseDate: (date) => String(date),
    parsePrice: (value, { currency } = {}) => `${currency}${Number(value).toFixed(2)}`,
    optimizeImage: (url) => url,
    getTimeAgo: () => '2 hours ago'
  }],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../../../utils', () => ({
  getCurrenySymbol: () => '$',
  addQueryToUrl: vi.fn(),
  getOrderStatusPrefix: (status) => ({ 0: 'Pending', 1: 'Completed by admin', 11: 'Delivery completed by driver' }[status] ?? `Status ${status}`),
  isFinalOrderStatusLocked: () => false,
  getUserType: () => false
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { OrdersTable } from '..'

const here = (file) => readFileSync(resolve(__dirname, file), 'utf8')
const tableCss = () => here('../orders-table.css')
const candidates = () => readFileSync(resolve(__dirname, '../../../../../../../../../brand/candidates.css'), 'utf8')

// The rules of a stylesheet as { selector, body }, at-rule blocks flattened (a container query keeps its rules).
const rulesOf = (css) => {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return Array.from(flat.matchAll(/([^{}@]+)\{([^{}]*)\}/g)).map(([, selector, body]) => ({ selector: selector.trim(), body }))
}
const rulesFor = (css, part) => rulesOf(css).filter(({ selector }) => selector.split(',').some(item => item.includes(part)))

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
const columns = () => ({
  slaBar: column(-2),
  orderNumber: column(-1),
  dateTime: column(0),
  status: column(2, true, { title: 'Status' }),
  business: column(6, true, { title: 'Business' }),
  customer: column(7, true, { title: 'Customer' }),
  driver: column(8, true, { title: 'Driver' }),
  total: column(15)
})
const makeOrder = (id, extra = {}) => ({
  id,
  status: 11,
  delivery_type: 1,
  delivery_datetime_utc: '2024-05-01 10:30:00',
  created_at: '2024-05-01 10:00:00',
  time_status: 'in_time',
  business: { name: 'Fast Bite', logo: 'logo.png', city: { name: 'New York' } },
  customer: { name: 'Grace Okafor', cellphone: '555-0100', orders_count: 3 },
  summary: { total: 35.2 },
  currency: 'USD',
  ...extra
})
const baseProps = (orders) => ({
  orderList: { loading: false, orders },
  pagination: { currentPage: 1, pageSize: 10, total: orders.length },
  selectedOrderIds: [],
  groupStatus: 'completed',
  allowColumns: columns(),
  getPageOrders: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  handleOpenOrderDetail: vi.fn(),
  handleUpdateOrderStatus: vi.fn()
})

const ORIGINAL_MATCH_MEDIA = window.matchMedia
const installViewport = (width) => {
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
const renderTable = (orders, viewport) => {
  installViewport(viewport)
  return render(
    <ThemeProvider theme={{ colors: {} }}>
      <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
        <OrdersTable {...baseProps(orders)} />
      </ConfigFileContext.Provider>
    </ThemeProvider>
  )
}
afterEach(() => { window.matchMedia = ORIGINAL_MATCH_MEDIA })

describe('F6c-5 · Q2-05 · the list beside the order panel keeps one line per status', () => {
  it('carries the whole status name as its title, so a clipped name is still readable', () => {
    renderTable([makeOrder(1)], 1440)
    expect(screen.getByText('Delivery completed by driver').closest('.odc-status')).toHaveAttribute('title', 'Delivery completed by driver')
  })

  it('the status never wraps, not even in the narrow list: it clips with an ellipsis up to a maximum width', () => {
    const css = tableCss()
    rulesFor(css, '.odc-orders-col-status').forEach(({ body }) => expect(body).not.toMatch(/white-space:\s*normal/))
    const bound = rulesFor(css, '.odc-orders-col-status .odc-status').find(({ body }) => /max-inline-size:\s*var\(--od-x-col-status-max\)/.test(body))
    expect(bound).toBeTruthy()
    const label = rulesFor(css, '.odc-orders-col-status .odc-status > span:last-child').find(({ body }) => /text-overflow:\s*ellipsis/.test(body))
    expect(label).toBeTruthy()
    expect(label.body).toMatch(/overflow:\s*hidden/)
  })

  it('the maximum is wide enough for the longest status names (about 190px)', () => {
    const token = candidates().match(/--od-x-col-status-max:\s*(\d+)px/)
    expect(token).not.toBeNull()
    expect(Number(token[1])).toBeGreaterThanOrEqual(180)
  })

  it('the loading cell of the status asks for the same width in every list, wrapped or not', () => {
    const css = tableCss()
    expect(css).not.toMatch(/od-x-sk-status-wrap/)
  })

  it('shows a cue while the table has more to scroll to: an edge shadow that follows the scroller, never the content', () => {
    const rule = rulesOf(tableCss()).find(({ selector }) => selector.includes('data-overflow-end') && selector.includes('::after'))
    expect(rule).toBeTruthy()
    expect(rule.body).toMatch(/pointer-events:\s*none/)
    expect(rule.body).toMatch(/inset-inline-end:\s*0/)
    expect(rule.body).toMatch(/var\(--od-x-edge-shadow\)/)
  })

  it('names the shadow in the candidates, light and dark readable (a mix of the text colour)', () => {
    expect(candidates()).toMatch(/--od-x-edge-shadow:[^;]*var\(--od-text\)/)
  })
})

describe('F6c-5 · Q2-22 · compact rows hold two lines without touching the border', () => {
  it('a compact row is at least 40px tall', () => {
    const compact = rulesFor(tableCss(), "[data-density='compact'] tbody td").find(({ body }) => /block-size:\s*var\(--od-x-row-compact-orders\)/.test(body))
    expect(compact).toBeTruthy()
    const token = candidates().match(/--od-x-row-compact-orders:\s*(\d+)px/)
    expect(token).not.toBeNull()
    expect(Number(token[1])).toBeGreaterThanOrEqual(40)
  })

  it('a coarse pointer still gets the 44px target in compact rows', () => {
    const coarse = tableCss().match(/@media \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/g) || []
    const compactCoarse = coarse.join('\n')
    expect(compactCoarse).toMatch(/\[data-density='compact'\] tbody td[^{]*\{[^}]*block-size:\s*var\(--od-x-target-coarse\)/)
  })
})

describe('F6c-5 · Q2-27 · the phone card of a closed order says the date once', () => {
  const card = () => screen.getByRole('link', { name: 'Order #1' }).closest('li')
  const DATE = '2024-05-01 10:30:00'

  it('a closed order shows the delivery date on the logistics line and nowhere else', () => {
    renderTable([makeOrder(1, { status: 11 })], 600)
    expect(within(card()).getAllByText(DATE)).toHaveLength(1)
  })

  it('an open order keeps the date and says how long ago it is on the SLA line', () => {
    renderTable([makeOrder(1, { status: 0 })], 600)
    expect(within(card()).getAllByText(DATE)).toHaveLength(1)
    expect(within(card()).getByText('2 hours ago')).toBeInTheDocument()
  })
})
