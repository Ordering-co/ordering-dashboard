/* eslint-disable import/first */
// redesign F6i-1 (A3-01): the hidden text of the list (`.odc-sr-only`, absolutely positioned) never extends the page. An
// absolute box whose ancestors are not positioned is placed against a far ancestor and, when the list scrolls on its own
// (OrdersListContainer: overflow auto, no position), escapes its clip and makes the document taller: on a phone the page
// went on ~750px of blank after the last card. Every hidden text of the list has a positioned ancestor INSIDE the list.
// jsdom has no layout, so the test reads the structure and the stylesheets: the classes that set `position`, and the chain
// of ancestors of each hidden text.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
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
const allowColumns = {
  slaBar: column(-2),
  orderNumber: column(-1),
  dateTime: column(0),
  status: column(2, true, { title: 'Status' }),
  business: column(6, true, { title: 'Business' }),
  customer: column(7, true, { title: 'Customer' }),
  total: column(15)
}
const order = { id: 1, status: 1, delivery_type: 1, summary: { total: 5 }, currency: 'USD', business: { name: 'B' }, customer: { name: 'C' } }

const renderTable = (extra = {}) => render(
  <ThemeProvider theme={{ colors: {} }}>
    <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
      <OrdersTable
        orderList={{ loading: false, orders: [order] }}
        pagination={{ currentPage: 1, pageSize: 10, total: 1 }}
        selectedOrderIds={[]}
        groupStatus='completed'
        allowColumns={allowColumns}
        getPageOrders={vi.fn()}
        handleSelectedOrderIds={vi.fn()}
        setSelectedOrderIds={vi.fn()}
        handleOpenOrderDetail={vi.fn()}
        handleUpdateOrderStatus={vi.fn()}
        {...extra}
      />
    </ConfigFileContext.Provider>
  </ThemeProvider>
)

class MockResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

beforeEach(() => {
  window.localStorage.clear()
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

// The classes whose own rule (a selector list of single classes, no pseudo-element) positions the box.
const sheets = ['../orders-table.css', '../order-card.css', '../../../Shared/Product/record-card.css', '../../../Shared/Product/data-table.css', '../../../Shared/Product/tabs.css']
  .map(file => readFileSync(resolve(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''))
const positionedClasses = new Set()
sheets.forEach(css => {
  for (const match of css.matchAll(/([^{}@]+)\{([^}]*)\}/g)) {
    if (!/position:\s*(relative|absolute|sticky|fixed)/.test(match[2])) continue
    match[1].split(',').map(selector => selector.trim()).forEach(selector => {
      if (/^\.[\w-]+$/.test(selector)) positionedClasses.add(selector.slice(1))
    })
  }
})
const isPositioned = node => Array.from(node.classList).some(name => positionedClasses.has(name))
const positionedHost = (node, root) => {
  for (let parent = node.parentElement; parent && parent !== root; parent = parent.parentElement) {
    if (isPositioned(parent)) return parent
  }
  return null
}

const hiddenTexts = container => Array.from(container.querySelectorAll('.odc-sr-only'))

describe('OrdersTable hidden text: contained inside the list (A3-01)', () => {
  it('reads the stylesheets: the classes known to position a box are found', () => {
    expect(positionedClasses.has('odc-table-scroll')).toBe(true)
    expect(positionedClasses.has('odc-order-card')).toBe(true)
    expect(positionedClasses.has('odc-orders-live')).toBe(true)
  })

  it('the live region sits in a positioned host of its own, not in the page', () => {
    const { container } = renderTable()
    const region = container.querySelector('[role="status"]')
    expect(region).toHaveClass('odc-sr-only')
    expect(region.parentElement).toHaveClass('odc-orders-live')
    expect(container.contains(region.parentElement)).toBe(true)
    // the host takes no room: it holds only the 1px hidden box
    expect(region.parentElement.children).toHaveLength(1)
  })

  it('every hidden text of the table has a positioned ancestor inside the list, loaded and loading', () => {
    ;[{}, { orderList: { loading: true, orders: [] }, pagination: { currentPage: 1, pageSize: 10 } }].forEach(extra => {
      const { container, unmount } = renderTable(extra)
      const texts = hiddenTexts(container)
      expect(texts.length).toBeGreaterThan(0)
      texts.forEach(text => expect(positionedHost(text, container), text.outerHTML).not.toBeNull())
      unmount()
    })
  })

  it('every hidden text of the cards (a phone) has a positioned ancestor inside the list, loaded and loading', () => {
    mocks.narrow = true
    ;[{}, { orderList: { loading: true, orders: [] }, pagination: { currentPage: 1, pageSize: 10 } }].forEach(extra => {
      const { container, unmount } = renderTable(extra)
      const texts = hiddenTexts(container)
      expect(texts.length).toBeGreaterThan(0)
      texts.forEach(text => expect(positionedHost(text, container), text.outerHTML).not.toBeNull())
      unmount()
    })
  })

  it('the host of the live region and the list of cards are positioned in the stylesheet', () => {
    expect(sheets[0]).toMatch(/\.odc-orders-live,\s*\.odc-order-cards\s*\{\s*position:\s*relative/)
  })
})
