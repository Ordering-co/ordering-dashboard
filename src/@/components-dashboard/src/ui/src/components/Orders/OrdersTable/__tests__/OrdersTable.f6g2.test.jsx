/* eslint-disable import/first */
// redesign F6g-2: RTL of the list — the pager chevrons follow the reading direction and dates keep their own direction.
import React from 'react'
import { render, screen } from '@testing-library/react'
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

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
const columns = () => ({
  slaBar: column(-2),
  orderNumber: column(-1),
  dateTime: column(0),
  status: column(2, true, { title: 'Status' }),
  business: column(6, true, { title: 'Business' }),
  customer: column(7, true, { title: 'Customer' }),
  driver: column(8, true, { title: 'Driver' }),
  eta: column(9, true, { title: 'ETA' }),
  total: column(15)
})
const makeOrder = (id, extra = {}) => ({
  id,
  status: 0,
  delivery_type: 1,
  delivery_datetime_utc: '2026-10-06 18:52:00',
  created_at: '2026-10-06 18:40:00',
  eta_time: 25,
  time_status: 'in_time',
  business: { name: 'Fast Bite', logo: 'logo.png', city: { name: 'New York' } },
  customer: { name: 'Grace Okafor', cellphone: '555-0100', orders_count: 3 },
  summary: { total: 35.2 },
  currency: 'USD',
  ...extra
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
const renderTable = (orders, viewport, pagination) => {
  installViewport(viewport)
  return render(
    <ThemeProvider theme={{ colors: {} }}>
      <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
        <OrdersTable
          orderList={{ loading: false, orders }}
          pagination={pagination ?? { currentPage: 1, pageSize: 10, total: orders.length }}
          selectedOrderIds={[]}
          groupStatus='pending'
          allowColumns={columns()}
          getPageOrders={vi.fn()}
          handleSelectedOrderIds={vi.fn()}
          setSelectedOrderIds={vi.fn()}
          handleOpenOrderDetail={vi.fn()}
          handleUpdateOrderStatus={vi.fn()}
        />
      </ConfigFileContext.Provider>
    </ThemeProvider>
  )
}
afterEach(() => { window.matchMedia = ORIGINAL_MATCH_MEDIA })

const isolated = (node) => node.closest('bdi[dir="ltr"]')

describe('F6g-2 · the list in a right-to-left language', () => {
  it('the pager chevrons carry the flip class, so «Previous» points to the start side in RTL', () => {
    renderTable([makeOrder(1)], 1440, { currentPage: 2, pageSize: 10, total: 30 })
    for (const name of ['Previous page', 'Next page']) {
      expect(screen.getByRole('button', { name }).querySelector('svg')).toHaveClass('odc-icon-flip')
    }
  })

  it('the date of the order cell is its own left-to-right run', () => {
    renderTable([makeOrder(1)], 1440)
    expect(isolated(screen.getByText('2026-10-06 18:52:00'))).not.toBeNull()
  })

  it('the time of the ETA cell is its own left-to-right run', () => {
    renderTable([makeOrder(1)], 1440)
    const times = Array.from(document.querySelectorAll('bdi[dir="ltr"]')).filter(node => /^\d\d:\d\d/.test(node.textContent))
    expect(times.length).toBeGreaterThan(0)
  })

  it('the phone card isolates the delivery date, the ETA time and the ETA date, with the label outside them', () => {
    renderTable([makeOrder(1)], 390)
    const card = document.querySelector('.odc-order-card-when')
    expect(card).not.toBeNull()
    const runs = Array.from(card.querySelectorAll('bdi[dir="ltr"]')).map(node => node.textContent)
    expect(runs).toContain('2026-10-06 18:52:00')
    expect(runs.some(text => /^\d\d:\d\d$/.test(text))).toBe(true)
    expect(card.textContent).toMatch(/ETA \d\d:\d\d/)
  })
})
