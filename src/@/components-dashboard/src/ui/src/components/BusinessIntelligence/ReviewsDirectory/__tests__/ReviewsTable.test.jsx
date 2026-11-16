/* eslint-disable import/first */
// redesign reviews FD1 (D1, D3, D9; RV-03, RV-05, RV-06, RV-08): the reviews list as a Product DataTable (and RecordCards under
// 768px). Numbers come out of the REAL UtilsProviders (parseNumber) and the real helpers of reviewsData.js; only the environment
// (language, the phone flag) is simulated. The Product wrappers are real.
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils
  }
})
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { ReviewsTable } from '../ReviewsTable'

const shop = { id: 1, name: 'Casa Pepe', address: 'Calle Mayor 1', logo: 'https://example.com/pepe.png', reviews: { total: 4.9, reviews_count: 63, reviews: [] } }
const bare = { id: 2, name: 'Cafe Nuevo', address: 'Plaza 3', logo: null, reviews: { total: 0, reviews_count: 0, reviews: [] } }
const rated = { id: 3, name: 'Taller Sur', address: null, reviews: { total: 3, reviews: [{ id: 1 }, { id: 2 }] } }

const ana = { id: 7, name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com', photo: 'https://example.com/ana.png', qualification: 4.5 }
const zero = { id: 8, name: 'Marco', lastname: 'Toss', email: 'marco@example.com', photo: null, qualification: 0 }
const none = { id: 9, name: 'Lena', lastname: '', email: null, qualification: null }
const gone = { id: 10, name: 'Gus', lastname: 'Off', email: 'gus@example.com', photo: null, qualification: 3, enabled: false }

const burger = { id: 11, name: 'Burger', images: 'https://example.com/burger.png', category: { id: 5 }, reviews: { total: 4.25 } }
const water = { id: 12, name: 'Water', images: null, category: { id: 5 }, reviews: { total: 0 } }

let current
const draw = (props = {}) => {
  current = {
    kind: 'business',
    label: 'Business',
    nameHeader: 'Business',
    rows: [shop, bare, rated],
    loading: false,
    error: null,
    onRetry: vi.fn(),
    pageSize: 10,
    activeId: undefined,
    onOpen: vi.fn(),
    ...props
  }
  const ui = (next) => <UtilsProviders><ReviewsTable {...next} /></UtilsProviders>
  const view = render(ui(current))
  return { ...view, rerenderWith: (extra) => { current = { ...current, ...extra }; view.rerender(ui(current)) } }
}

// jsdom has no layout: the width of the table's scroller is simulated (DataTable hides the columns whose `hideBelow` is above it)
let observers = []
class FakeResizeObserver {
  constructor (callback) { this.callback = callback }
  observe () { observers.push(this) }
  unobserve () {}
  disconnect () { observers = observers.filter(observer => observer !== this) }
}
const resizeTo = (width) => act(() => { observers.forEach(observer => observer.callback([{ contentRect: { width } }])) })

const rowOf = (container, id) => container.querySelector(`tr[data-row-id="${id}"]`)
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent).filter(Boolean)

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.phone = false
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ReviewsTable columns by kind', () => {
  it('business: Business, Rating and Reviews', () => {
    draw()
    expect(headers()).toEqual(['Business', 'Rating', 'Reviews'])
    expect(screen.getByRole('table', { name: 'Business' })).toBeInTheDocument()
  })

  it('user: the name header the page gives (Driver, Customer, Professional) and Rating; no Reviews', () => {
    const { unmount } = draw({ kind: 'user', label: 'Drivers', nameHeader: 'Driver', rows: [ana] })
    expect(headers()).toEqual(['Driver', 'Rating'])
    unmount()
    draw({ kind: 'user', label: 'Customers', nameHeader: 'Customer', rows: [ana] })
    expect(headers()).toEqual(['Customer', 'Rating'])
  })

  it('product: Product and Rating', () => {
    draw({ kind: 'product', label: 'Products', nameHeader: 'Product', rows: [burger] })
    expect(headers()).toEqual(['Product', 'Rating'])
  })

  it('the Rating and Reviews columns are aligned to the end', () => {
    draw()
    const [, rating, reviews] = screen.getAllByRole('columnheader')
    expect(rating).toHaveAttribute('data-align', 'end')
    expect(reviews).toHaveAttribute('data-align', 'end')
  })
})

describe('ReviewsTable cells', () => {
  it('business: a square avatar with the logo, the name and the address; the count is a figure', () => {
    const { container } = draw()
    const header = within(rowOf(container, 1)).getByRole('rowheader')
    expect(header.querySelector('.odc-avatar')).toHaveAttribute('data-kind', 'business')
    expect(header.querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://example.com/pepe.png')
    expect(within(header).getByText('Casa Pepe')).toBeInTheDocument()
    expect(header).toHaveTextContent('Calle Mayor 1')
    expect(within(rowOf(container, 1)).getByText('63')).toHaveClass('odc-figure')
  })

  it('business: without reviews_count the count is the length of the partial list', () => {
    const { container } = draw()
    expect(within(rowOf(container, 3)).getByText('2')).toHaveClass('odc-figure')
  })

  it('user: a round avatar, the full name and the email', () => {
    const { container } = draw({ kind: 'user', label: 'Customers', nameHeader: 'Customer', rows: [ana, none] })
    const header = within(rowOf(container, 7)).getByRole('rowheader')
    expect(header.querySelector('.odc-avatar')).toHaveAttribute('data-kind', 'person')
    expect(within(header).getByText('Ana Ruiz')).toBeInTheDocument()
    expect(header).toHaveTextContent('ana@example.com')
    expect(within(rowOf(container, 9)).getByRole('rowheader')).toHaveTextContent('Lena')
  })

  it('product: a square avatar and the name, with no second line', () => {
    const { container } = draw({ kind: 'product', label: 'Products', nameHeader: 'Product', rows: [burger] })
    const header = within(rowOf(container, 11)).getByRole('rowheader')
    expect(header.querySelector('.odc-avatar')).toHaveAttribute('data-kind', 'business')
    expect(header.querySelector('.odc-rv-sub')).toBeNull()
    expect(header).toHaveTextContent('Burger')
  })
})

// redesign (row 8, reviews P1): the reviews of a disabled driver, customer or professional are listed too, and its row says «Inactive»
describe('ReviewsTable inactive users (row 8)', () => {
  it('a disabled user row has the Inactive label as text; an enabled one, or one without `enabled`, has none', () => {
    const { container } = draw({ kind: 'user', label: 'Drivers', nameHeader: 'Driver', rows: [ana, { ...ana, id: 11, enabled: true }, gone] })
    expect(within(rowOf(container, 10)).getByRole('rowheader')).toHaveTextContent('Inactive')
    expect(within(rowOf(container, 7)).queryByText('Inactive')).toBeNull()
    expect(within(rowOf(container, 11)).queryByText('Inactive')).toBeNull()
  })

  it('the label is a Product status, with the name and the email still in the row', () => {
    const { container } = draw({ kind: 'user', label: 'Drivers', nameHeader: 'Driver', rows: [gone] })
    const header = within(rowOf(container, 10)).getByRole('rowheader')
    expect(within(header).getByText('Inactive').closest('.odc-status')).not.toBeNull()
    expect(header).toHaveTextContent('Gus Off')
    expect(header).toHaveTextContent('gus@example.com')
  })

  it('on a phone the card says Inactive too', () => {
    mocks.phone = true
    const { container } = draw({ kind: 'user', label: 'Drivers', nameHeader: 'Driver', rows: [ana, gone] })
    expect(container.querySelector('li[data-row-id="10"]')).toHaveTextContent('Inactive')
    expect(container.querySelector('li[data-row-id="7"]')).not.toHaveTextContent('Inactive')
  })

  it('only users get it: a business with enabled false is drawn as before', () => {
    const { container } = draw({ rows: [{ ...shop, enabled: false }] })
    expect(rowOf(container, 1)).not.toHaveTextContent('Inactive')
  })
})

describe('ReviewsTable rating (RV-03)', () => {
  it('draws two decimals in a figure, for every kind', () => {
    const { container, unmount } = draw()
    expect(within(rowOf(container, 1)).getByText(/^4[.,]90$/)).toHaveClass('odc-figure')
    expect(within(rowOf(container, 3)).getByText(/^3[.,]00$/)).toHaveClass('odc-figure')
    unmount()
    const users = draw({ kind: 'user', label: 'Customers', nameHeader: 'Customer', rows: [ana] })
    expect(within(rowOf(users.container, 7)).getByText(/^4[.,]50$/)).toHaveClass('odc-figure')
    users.unmount()
    const products = draw({ kind: 'product', label: 'Products', nameHeader: 'Product', rows: [burger] })
    expect(within(rowOf(products.container, 11)).getByText(/^4[.,]25$/)).toHaveClass('odc-figure')
  })

  it('a note of 0 or none is a dash with words for a screen reader, never a «0»', () => {
    const { container } = draw({ kind: 'user', label: 'Customers', nameHeader: 'Customer', rows: [zero, none] })
    for (const id of [8, 9]) {
      const row = rowOf(container, id)
      const cell = row.querySelectorAll('td')[0]
      expect(cell.querySelector('[aria-hidden="true"]')).toHaveTextContent('—')
      expect(cell.querySelector('.odc-sr-only')).toHaveTextContent('No data')
      expect(cell.textContent).not.toMatch(/0/)
    }
  })

  it('a business and a product with a note of 0 get a dash too, and the count a dash when unknown', () => {
    const { container, unmount } = draw()
    const bareRow = rowOf(container, 2)
    const [rating, count] = bareRow.querySelectorAll('td')
    expect(rating.textContent).toBe('—No data')
    // reviews_count 0 is a number: it is a count, not a missing note
    expect(count).toHaveTextContent('0')
    unmount()
    const noCount = draw({ rows: [{ id: 5, name: 'Sin datos', address: 'x', reviews: { total: 4 } }] })
    expect(rowOf(noCount.container, 5).querySelectorAll('td')[1].textContent).toBe('—No data')
    noCount.unmount()
    const products = draw({ kind: 'product', label: 'Products', nameHeader: 'Product', rows: [water] })
    expect(rowOf(products.container, 12).querySelector('td').textContent).toBe('—No data')
  })
})

describe('ReviewsTable width priorities (RV-06)', () => {
  it('with little width Reviews steps aside first; Rating and the name never do', () => {
    draw()
    resizeTo(400)
    expect(headers()).toEqual(['Business', 'Rating'])
    resizeTo(200)
    expect(headers()).toEqual(['Business', 'Rating'])
    resizeTo(900)
    expect(headers()).toEqual(['Business', 'Rating', 'Reviews'])
  })
})

describe('ReviewsTable rows (RV-05)', () => {
  it('has one tab stop: Tab reaches a row and Enter opens it', async () => {
    const { container } = draw()
    await userEvent.tab()
    expect(rowOf(container, 1)).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(current.onOpen).toHaveBeenCalledWith(shop)
    expect(container.querySelectorAll('tr[data-row-id][tabindex="0"]')).toHaveLength(1)
  })

  it('a click opens the row', async () => {
    const { container } = draw()
    await userEvent.click(within(rowOf(container, 3)).getByText('Taller Sur'))
    expect(current.onOpen).toHaveBeenCalledWith(rated)
  })

  it('the open row is aria-current and data-active', () => {
    const { container } = draw({ activeId: 2 })
    expect(rowOf(container, 2)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 2)).toHaveAttribute('data-active')
    expect(rowOf(container, 1)).not.toHaveAttribute('aria-current')
  })

  it('an activeId that comes from the URL as text still marks its row', () => {
    const { container } = draw({ activeId: '1' })
    expect(rowOf(container, 1)).toHaveAttribute('aria-current', 'true')
  })
})

describe('ReviewsTable states (RV-08)', () => {
  it('loading draws one skeleton row per page-size and no data', () => {
    const { container } = draw({ loading: true, pageSize: 25, rows: [] })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(25)
    expect(screen.queryByText('Casa Pepe')).toBeNull()
  })

  it('an error replaces the list with a message and «Try again», which calls onRetry', async () => {
    draw({ error: ['boom'], rows: [] })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the list.")
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
  })

  it('an error as text counts too, and loading wins over a stale error', () => {
    const { rerenderWith } = draw({ error: 'Network down', rows: [] })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerenderWith({ loading: true })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('no rows: «No results found», no «Try again»', () => {
    draw({ rows: [] })
    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})

describe('ReviewsTable on a phone (390): cards', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws cards, no table: the name, the second line and the note as a figure', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const card = container.querySelector('li[data-row-id="1"]')
    expect(within(card).getByRole('link', { name: 'Casa Pepe' })).toBeInTheDocument()
    expect(card).toHaveTextContent('Calle Mayor 1')
    expect(within(card).getByText(/^4[.,]90$/)).toHaveClass('odc-figure')
  })

  // redesign reviews R1 (Q1-9): the count of a card says «review» / «reviews» as the panel does
  it('the count of a card is «63 reviews», «1 review» in the singular', () => {
    const one = { ...rated, id: 4, reviews: { total: 5, reviews_count: 1, reviews: [] } }
    const { container } = draw({ rows: [shop, one] })
    expect(container.querySelector('li[data-row-id="1"] .odc-rv-card-count').textContent).toBe('63 reviews')
    expect(container.querySelector('li[data-row-id="4"] .odc-rv-card-count').textContent).toBe('1 review')
  })

  it('a note of 0 is a dash on a card too', () => {
    const { container } = draw()
    const card = container.querySelector('li[data-row-id="2"]')
    expect(card.querySelector('.odc-sr-only')).toHaveTextContent('No data')
    // the figure of the card is the note: a dash, not a «0» (the count of reviews beside it is a count)
    expect(card.querySelector('.odc-order-card-total').textContent).toBe('—No data')
  })

  it('the link is ?id= for businesses and users, ?category=&product= for products', () => {
    window.history.replaceState({}, '', '/intelligence/reviews?tab=business&page=2')
    const { container, unmount } = draw()
    const href = container.querySelector('li[data-row-id="1"] a').getAttribute('href')
    expect(href).toContain('tab=business')
    expect(href).toContain('id=1')
    unmount()
    const users = draw({ kind: 'user', label: 'Drivers', nameHeader: 'Driver', rows: [ana] })
    expect(users.container.querySelector('li[data-row-id="7"] a').getAttribute('href')).toContain('id=7')
    users.unmount()
    const products = draw({ kind: 'product', label: 'Products', nameHeader: 'Product', rows: [burger] })
    const productHref = products.container.querySelector('li[data-row-id="11"] a').getAttribute('href')
    expect(productHref).toContain('category=5')
    expect(productHref).toContain('product=11')
    expect(productHref).not.toContain('id=11')
    window.history.replaceState({}, '', '/')
  })

  it('a plain click on a card calls onOpen with the row; the open card is aria-current', async () => {
    const { container } = draw({ activeId: 3 })
    expect(container.querySelector('li[data-row-id="3"]')).toHaveAttribute('aria-current', 'true')
    await userEvent.click(within(container.querySelector('li[data-row-id="1"]')).getByRole('link', { name: 'Casa Pepe' }))
    expect(current.onOpen).toHaveBeenCalledWith(shop)
  })

  it('error with «Try again», and the empty state, as on the table', async () => {
    const { unmount } = draw({ error: 'x', rows: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    unmount()
    draw({ rows: [] })
    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('loading draws one skeleton card per page-size', () => {
    const { container } = draw({ loading: true, pageSize: 5, rows: [] })
    expect(container.querySelectorAll('li[data-skeleton]')).toHaveLength(5)
  })
})
