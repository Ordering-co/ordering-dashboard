/* eslint-disable import/first */
// redesign cierre W0 (W0-QA4-01, W0-QA4-03): the own pager of OrdersTable keeps «Previous page» and «Next page» together, and with a
// coarse pointer their areas and the one of «Select all» do not cross.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: {},
  viewOnly: false,
  level: 0,
  addQueryToUrl: vi.fn()
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{
    parseDate: (date) => String(date),
    parsePrice: (value, { currency } = {}) => `${currency}${Number(value).toFixed(2)}`,
    optimizeImage: (url) => url,
    getTimeAgo: () => '12 min ago'
  }],
  useConfig: () => [{ configs: mocks.configs }],
  useSession: () => [{ user: { level: mocks.level } }],
  useApi: () => [{ project: 'demo' }]
}))
vi.mock('../../../../utils', () => ({
  getCurrenySymbol: () => '$',
  addQueryToUrl: (...args) => mocks.addQueryToUrl(...args),
  getOrderStatusPrefix: (status) => ({ 0: 'Pending', 1: 'Completed by admin', 7: 'Accepted by business' }[status] ?? `Status ${status}`),
  isFinalOrderStatusLocked: () => false,
  getUserType: (type) => type === 'readOnlyAdmin' ? mocks.viewOnly : false
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { OrdersTable } from '..'

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
const defaultColumns = () => ({
  slaBar: column(-2, true),
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
  status: 0,
  delivery_type: 1,
  delivery_datetime_utc: '2024-05-01 10:30:00',
  created_at: '2024-05-01 10:00:00',
  time_status: 'in_time',
  business: { name: 'Fast Bite', logo: 'logo.png', city: { name: 'New York' } },
  customer: { name: 'Grace', lastname: 'Okafor', cellphone: '555-0100', photo: 'grace.png', orders_count: 3 },
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
  getPageOrders: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  handleOpenOrderDetail: vi.fn(),
  handleUpdateOrderStatus: vi.fn().mockResolvedValue({ error: false }),
  ...extra
})

const tree = (props) => (
  <ThemeProvider theme={{ colors: {} }}>
    <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
      <OrdersTable {...props} />
    </ConfigFileContext.Provider>
  </ThemeProvider>
)

beforeEach(() => {
  mocks.configs = {}
  mocks.viewOnly = false
  mocks.level = 0
  window.matchMedia = vi.fn((query) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))
  vi.stubGlobal('ResizeObserver', class { observe () {} unobserve () {} disconnect () {} })
})
afterEach(() => {
  delete window.matchMedia
  vi.unstubAllGlobals()
})

describe('redesign cierre W0 (W0-QA4-01, W0-QA4-03): the pager steps and the coarse pointer', () => {
  const css = (file) => readFileSync(resolve(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = (text) => Array.from(text.matchAll(/([^{}@]+)\{([^{}]*)\}/g)).map(([, selector, body]) => ({ selector: selector.trim(), body }))
  const bodyOf = (text, selector) => rules(text).filter(rule => rule.selector.split(',').some(item => item.trim() === selector)).map(rule => rule.body).join(' ')

  it('Previous page and Next page are the two children of one group that does not split', () => {
    render(tree(baseProps({ pagination: { currentPage: 2, pageSize: 10, total: 35 } })))
    const previous = screen.getByRole('button', { name: 'Previous page' })
    const next = screen.getByRole('button', { name: 'Next page' })
    expect(previous.parentElement).toBe(next.parentElement)
    expect(previous.parentElement).toHaveClass('odc-orders-pager-steps')
    expect(previous.parentElement.children).toHaveLength(2)
    expect(previous.parentElement.parentElement).toHaveClass('odc-orders-pager')
    const steps = bodyOf(css('orders-table.css'), '.odc-orders-pager-steps')
    expect(steps).toMatch(/display:\s*inline-flex/)
    expect(steps).toMatch(/flex:\s*none/)
  })

  it('with cards (a phone) the group keeps its 44px buttons together with the usual gap', () => {
    expect(bodyOf(css('order-card.css'), '.odc-orders-foot[data-cards] .odc-orders-pager-steps')).toMatch(/gap:\s*var\(--od-space-2\)/)
  })

  it('a coarse pointer on desktop separates the 28px steps by the 16px their two 44px areas need', () => {
    const text = css('orders-table.css')
    const block = text.match(/@media \(pointer: coarse\) \{[^@]*?\.odc-orders-pager-steps \{([^}]*)\}/)
    expect(block).not.toBeNull()
    expect(block[1]).toMatch(/gap:\s*var\(--od-space-4\)/)
  })

  it('a coarse pointer makes the header row as tall as a row, so the areas of «Select all» and of the first checkbox do not cross', () => {
    const text = css('orders-table.css')
    const coarse = text.match(/@media \(pointer: coarse\) \{[\s\S]*?\n\}/g).join('\n')
    expect(coarse).toMatch(/\.odc-orders-table \.odc-table thead th\s*\{[^}]*block-size:\s*var\(--od-x-target-coarse\)/)
    expect(coarse).toMatch(/tbody td\s*\{[^}]*block-size:\s*var\(--od-x-target-coarse\)/)
  })
})
