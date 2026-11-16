/* eslint-disable import/first */
// redesign F6h-3 (A2-04): in a right-to-left language the data the API sends (names, cities, phones, order numbers) is
// not translated copy. Each one is its own run, and a name that is cut by an ellipsis is cut at the end of ITS OWN direction
// («Customer Demo…», never «…stomer Demo»): the truncating element carries dir="auto".
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
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
  getOrderStatusPrefix: (status) => ({ 0: 'Pending' }[status] ?? `Status ${status}`),
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
  agent: column(5, true, { title: 'Agent' }),
  business: column(6, true, { title: 'Business' }),
  customer: column(7, true, { title: 'Customer' }),
  driver: column(8, true, { title: 'Driver' }),
  total: column(15)
})
const order = {
  id: 13861,
  status: 0,
  delivery_type: 1,
  delivery_datetime_utc: '2026-10-06 18:52:00',
  created_at: '2026-10-06 18:40:00',
  time_status: 'in_time',
  business: { name: 'Fast Bite', logo: 'logo.png', city: { name: 'New York' } },
  customer: { name: 'Customer', lastname: 'Demo', cellphone: '+1 555-0100', orders_count: 3 },
  driver: { name: 'Dana Driver', cellphone: '+1 555-0199' },
  agent: { name: 'Alan Agent', email: 'agent@example.com' },
  summary: { total: 35.2 },
  currency: 'USD'
}

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
const renderTable = (viewport) => {
  installViewport(viewport)
  return render(
    <ThemeProvider theme={{ colors: {} }}>
      <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
        <OrdersTable
          orderList={{ loading: false, orders: [order] }}
          pagination={{ currentPage: 1, pageSize: 10, total: 1 }}
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

const dirAuto = (text) => screen.getByText(text).closest('[dir="auto"]')

describe('F6h-3 · data of the table in a right-to-left language', () => {
  it('the names of the customer, the business and the driver truncate on a dir="auto" element, which is the one that clips', () => {
    renderTable(1440)
    for (const name of ['Customer Demo', 'Fast Bite', 'Dana Driver']) {
      const node = screen.getByText(name)
      expect(node).toHaveClass('odc-orders-who-name')
      expect(node).toHaveAttribute('dir', 'auto')
    }
  })

  it('the second line of a person (city, company, phone) is data too: dir="auto"', () => {
    renderTable(1440)
    expect(dirAuto('New York')).toHaveClass('odc-orders-sub')
    expect(dirAuto('+1 555-0199')).toHaveClass('odc-orders-sub')
  })

  it('the customer phone is its own left-to-right run inside the line that also says «3 orders»', () => {
    renderTable(1440)
    const phone = screen.getByText('+1 555-0100')
    expect(phone.tagName).toBe('BDI')
    expect(phone).toHaveAttribute('dir', 'ltr')
    expect(phone.closest('.odc-orders-sub')).toHaveAttribute('dir', 'auto')
    expect(phone.closest('.odc-orders-sub')).toHaveTextContent('+1 555-0100 · 3 orders')
  })

  it('the order number is its own left-to-right run, so «#13861» is never read «13861#»', () => {
    renderTable(1440)
    const id = screen.getByText('#13861')
    expect(id.tagName).toBe('BDI')
    expect(id).toHaveAttribute('dir', 'ltr')
  })

  it('the agent name and email are isolated', () => {
    renderTable(1440)
    expect(dirAuto('Alan Agent')).not.toBeNull()
    expect(dirAuto('agent@example.com')).not.toBeNull()
  })

  it('the phone card keeps the same rules: names on dir="auto", the number in a left-to-right run', () => {
    renderTable(390)
    for (const name of ['Customer Demo', 'Fast Bite', 'Dana Driver']) {
      expect(screen.getByText(name)).toHaveAttribute('dir', 'auto')
    }
    const id = document.querySelector('.odc-order-card-link bdi')
    expect(id).toHaveAttribute('dir', 'ltr')
    expect(id).toHaveTextContent('#13861')
  })
})

describe('F6h-3 · the CSS of the truncating elements', () => {
  const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rule = (css, selector) => {
    const start = css.indexOf(`${selector} {`)
    return start === -1 ? '' : css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  }

  it('the name and the second line are isolated and still end in an ellipsis', () => {
    const table = read('orders-table.css')
    for (const selector of ['.odc-orders-who-name', '.odc-orders-who-text .odc-orders-sub']) {
      expect(rule(table, selector)).toMatch(/unicode-bidi:\s*isolate/)
      expect(rule(table, selector)).toMatch(/text-overflow:\s*ellipsis/)
    }
  })

  it('the names of the card are isolated too', () => {
    const card = read('order-card.css')
    for (const selector of ['.odc-order-card-people .odc-orders-who-name', '.odc-order-card-driver .odc-orders-who-name']) {
      expect(rule(card, selector)).toMatch(/unicode-bidi:\s*isolate/)
      expect(rule(card, selector)).toMatch(/text-overflow:\s*ellipsis/)
    }
  })
})
