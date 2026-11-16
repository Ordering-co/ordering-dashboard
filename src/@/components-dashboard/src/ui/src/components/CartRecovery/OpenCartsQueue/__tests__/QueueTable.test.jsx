/* eslint-disable import/first */
// redesign OC-C (queue table): the list of open carts as a table (and as cards on a phone). Values come out of the REAL
// UtilsProviders (parseDate, parsePrice, getTimeAgo) and the real helpers of utils/openCarts.js; only the environment
// (language, config, toast, the phone and split-view flags) is simulated.
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: {},
  phone: false,
  split: { mode: 'split', open: false, expanded: false },
  showToast: vi.fn()
}))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils,
    useToast: () => [{}, { showToast: mocks.showToast }],
    ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' }
  }
})
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))
vi.mock('../../../Shared/Product/SplitView', async (importOriginal) => ({
  ...(await importOriginal()),
  useSplitView: () => mocks.split
}))

import { UtilsProviders, useUtils } from '../../../../../../contexts/UtilsContext'
import { contactNavigation } from '../useCartContact'
import { QueueTable } from '../QueueTable'

const NOW = '2026-10-09T12:12:00Z'

const cartOf = (id, { user, business, status = 0, updatedAt = '2026-10-09 12:00:00' } = {}) => ({
  id,
  uuid: `uuid-${id}`,
  user_id: 100 + id,
  status,
  updated_at: updatedAt,
  business: { name: 'Sample Burgers', logo: 'burgers.png', ...business },
  user
})

const ana = cartOf(90012, { user: { name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com', cellphone: '+1 555 0100' } })
const guest = cartOf(90011, { user: {}, business: { name: 'Demo Bakery' }, updatedAt: '2026-10-09 11:47:00' })
const marco = cartOf(90007, {
  user: { name: 'Marco', lastname: 'Toss', email: 'marco@example.com', cellphone: '+1 555 0142' },
  business: { name: 'Test Wok' },
  status: 4,
  updatedAt: '2026-10-07 12:12:00'
})
const lena = cartOf(90009, { user: { name: 'Lena', lastname: 'Park', email: 'lena@example.com' }, business: { name: 'Example Café' }, updatedAt: '2026-10-06 12:12:00' })

const entry = (cart, products, total) => ({ loading: false, error: null, cart: { id: cart.id, total, products }, updatedAt: cart.updated_at })
const DETAILS = {
  90012: entry(ana, [{ name: 'Hamburger', quantity: 2 }, { name: 'Fries', quantity: 1 }], 34.2),
  90011: entry(guest, [{ name: 'Poke bowl', quantity: 1 }], 14.9),
  90007: entry(marco, [{ name: 'Pad thai', quantity: 3 }, { name: 'Spring rolls', quantity: 1 }, { name: 'Tea', quantity: 2 }], 63.4),
  90009: entry(lena, [{ name: 'Latte', quantity: 1 }], 5.1)
}

const listOf = (carts, extra = {}) => ({
  loading: false,
  error: null,
  carts,
  groups: null,
  page: 1,
  pageSize: 10,
  total: carts.length,
  totalPages: 1,
  hiddenCount: 0,
  searchWithoutDigits: false,
  ...extra
})
const FOLLOW_UP_LIST = listOf([ana, guest, marco, lena], {
  groups: [{ key: 'last24h', carts: [ana, guest] }, { key: 'earlier', carts: [marco, lena] }],
  hiddenCount: 3
})

const util = {}
const Probe = () => {
  Object.assign(util, useUtils()[0])
  return null
}

let current
const draw = (props = {}) => {
  current = {
    view: 'all',
    list: listOf([ana, guest, marco, lena]),
    details: DETAILS,
    ensureDetails: vi.fn(),
    activeCartId: undefined,
    onOpenCart: vi.fn(),
    withContactOnly: true,
    onWithContactOnlyChange: vi.fn(),
    onClearFilters: vi.fn(),
    onReload: vi.fn(),
    hasFilters: false,
    search: '',
    columnsUserId: 42,
    ...props
  }
  const ui = (next) => <UtilsProviders><Probe /><QueueTable {...next} /></UtilsProviders>
  const view = render(ui(current))
  return { ...view, rerenderWith: (extra) => { current = { ...current, ...extra }; view.rerender(ui(current)) } }
}

// redesign OC-F1 (OC-Q1-02): jsdom has no layout, so the width of the table's scroller is simulated: DataTable reads it from a
// ResizeObserver and hides the columns whose `hideBelow` is above it. `resizeTo(px)` is what the browser would report.
let observers = []
class FakeResizeObserver {
  constructor (callback) { this.callback = callback }
  observe () { observers.push(this) }
  unobserve () {}
  disconnect () { observers = observers.filter(observer => observer !== this) }
}
const resizeTo = (width) => act(() => { observers.forEach(observer => observer.callback([{ contentRect: { width } }])) })

const rowOf = (container, id) => container.querySelector(`tr[data-row-id="${id}"]`)
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent)

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.configs = {}
  mocks.phone = false
  mocks.split = { mode: 'split', open: false, expanded: false }
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOW))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('QueueTable columns and values', () => {
  it('has Customer, Cart, Business, Value, Last activity, Status and Contact; ID and City wait in the column manager', () => {
    draw()
    expect(headers()).toEqual(['Customer', 'Cart', 'Business', 'Value', 'Last activity', 'Status', 'Contact'])
    expect(screen.getByRole('button', { name: 'Manage columns' })).toBeInTheDocument()
  })

  it('draws a row with the real helpers: name, contact line, items, #id, business, value, relative time with the absolute one in title, status', () => {
    const { container } = draw()
    const row = rowOf(container, 90012)
    expect(within(row).getByRole('rowheader')).toHaveTextContent('Ana Ruiz')
    expect(within(row).getByText('ana@example.com · +1 555 0100')).toBeInTheDocument()
    expect(row.querySelector('.odc-oq-items').textContent).toBe('2× Hamburger · 1× Fries')
    expect(within(row).getByText('#90012')).toHaveClass('odc-mono')
    expect(within(row).getByText('Sample Burgers')).toBeInTheDocument()
    const value = within(row).getByText(util.parsePrice(34.2))
    expect(value).toHaveClass('odc-figure')
    expect(value.textContent).toContain('34')
    const ago = within(row).getByText('12 minutes ago')
    expect(ago).toHaveAttribute('title', util.parseDate('2026-10-09 12:00:00'))
    expect(ago.getAttribute('title')).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(within(row).getByText('Open').closest('.odc-status')).toHaveAttribute('data-family', 'pending')
  })

  it('a failed payment is the cancel family; the items after the second are counted, not listed', () => {
    const { container } = draw()
    const row = rowOf(container, 90007)
    expect(within(row).getByText('Payment failed').closest('.odc-status')).toHaveAttribute('data-family', 'cancel')
    expect(row.querySelector('.odc-oq-items').textContent).toMatch(/^3× Pad thai · 1× Spring rolls/)
    expect(within(row).getByText('+1 more items')).toHaveClass('odc-sr-only')
    expect(within(row).getByText('2 days ago')).toBeInTheDocument()
  })

  // the line of products was one text, so in an RTL page the bidi algorithm reordered «3× Piece McCrispy™ Strips»
  // into «Piece McCrispy™ Strips 3 ×1». Each product is its own isolate; the separator stays outside, so LTR reads the same.
  it('isolates each product of the items line (bdi), with the separator outside, and the visible text does not change', () => {
    const rtl = cartOf(90030, { user: { name: 'Ana', email: 'ana@example.com' } })
    const details = { 90030: entry(rtl, [{ name: 'Piece McCrispy™ Strips', quantity: 3 }, { name: 'وجبة دجاج', quantity: 1 }], 20) }
    const { container } = draw({ list: listOf([rtl]), details })
    const items = rowOf(container, 90030).querySelector('.odc-oq-items')
    const products = Array.from(items.querySelectorAll('bdi'))
    expect(products.map(node => node.textContent)).toEqual(['3× Piece McCrispy™ Strips', '1× وجبة دجاج'])
    // the separator is outside every isolate
    expect(items.textContent).toBe('3× Piece McCrispy™ Strips · 1× وجبة دجاج')
    products.forEach(node => expect(node.textContent).not.toContain(' · '))
    // the tooltip carries the same products, each isolated for the bidi algorithm
    expect(items.getAttribute('title')).toBe('\u20683× Piece McCrispy™ Strips\u2069 · \u20681× وجبة دجاج\u2069')
  })

  it('a customer with an email and no name is named by the email; with both, the phone goes under it', () => {
    const nameless = cartOf(90020, { user: { email: 'solo@example.com', cellphone: '+1 555 0111' } })
    const { container } = draw({ list: listOf([nameless]), details: {} })
    const header = within(rowOf(container, 90020)).getByRole('rowheader')
    expect(header).toHaveTextContent('solo@example.com')
    expect(header).toHaveTextContent('+1 555 0111')
    expect(within(header).queryByText('Guest')).toBeNull()
  })

  it('a guest is «Guest», says there are no contact details, and has no contact menu: a dash with the reason', () => {
    const { container } = draw()
    const row = rowOf(container, 90011)
    const header = within(row).getByRole('rowheader')
    expect(header).toHaveTextContent('Guest')
    expect(header).toHaveTextContent('No contact details')
    expect(within(row).queryByRole('button', { name: /Contact/ })).toBeNull()
    const dash = within(row).getByText('—')
    expect(dash).toHaveAttribute('title', 'No contact details')
  })

  it('shows a skeleton in the cart and value cells while the detail is on its way, and a dash if it failed', () => {
    const pending = cartOf(90030, { user: { name: 'Pia', email: 'pia@example.com' } })
    const broken = cartOf(90031, { user: { name: 'Bo', email: 'bo@example.com' } })
    const details = {
      90030: { loading: true, error: null, cart: null, updatedAt: pending.updated_at },
      90031: { loading: false, error: ['boom'], cart: null, updatedAt: broken.updated_at }
    }
    const { container } = draw({ list: listOf([pending, broken]), details })
    const loadingRow = rowOf(container, 90030)
    expect(loadingRow.querySelectorAll('.odc-skeleton').length).toBeGreaterThanOrEqual(2)
    expect(within(loadingRow).getByText('#90030')).toBeInTheDocument()
    const failedRow = rowOf(container, 90031)
    expect(failedRow.querySelectorAll('.odc-skeleton')).toHaveLength(0)
    expect(within(failedRow).getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('a value of zero is a value: a cart whose detail says 0 shows the formatted zero', () => {
    const empty = cartOf(90040, { user: { name: 'Zed', email: 'zed@example.com' } })
    const { container } = draw({ list: listOf([empty]), details: { 90040: entry(empty, [], 0) } })
    expect(within(rowOf(container, 90040)).getByText(util.parsePrice(0))).toHaveClass('odc-figure')
  })

  it('marks the open cart as the active row', () => {
    const { container } = draw({ activeCartId: 90012 })
    expect(rowOf(container, 90012)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 90011)).not.toHaveAttribute('aria-current')
  })
})

describe('QueueTable columns the user can bring', () => {
  it('ID and City come in from the column manager and the choice is kept per user', async () => {
    const user = userEvent.setup()
    const withCity = { ...ana, business: { ...ana.business, city: { name: 'Miami' } } }
    const { container, unmount } = draw({ list: listOf([withCity]) })
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    await user.click(await screen.findByRole('checkbox', { name: 'ID' }))
    await user.click(screen.getByRole('checkbox', { name: 'City' }))
    expect(headers()).toContain('ID')
    expect(headers()).toContain('City')
    expect(within(rowOf(container, 90012)).getByText('Miami')).toBeInTheDocument()
    const stored = JSON.parse(window.localStorage.getItem('odc-open-carts-columns:42'))
    expect(stored.find(column => column.id === 'id')).toMatchObject({ visible: true })
    expect(stored.find(column => column.id === 'city')).toMatchObject({ visible: true })
    unmount()
    draw({ list: listOf([withCity]) })
    expect(headers()).toContain('ID')
    expect(headers()).toContain('City')
  })

  it('a broken or foreign preference falls back to the default columns without throwing', () => {
    window.localStorage.setItem('odc-open-carts-columns:42', '{not json')
    draw()
    expect(headers()).toEqual(['Customer', 'Cart', 'Business', 'Value', 'Last activity', 'Status', 'Contact'])
    window.localStorage.setItem('odc-open-carts-columns:42', JSON.stringify([{ id: 'nonsense', visible: true }]))
    draw()
    expect(headers().filter(name => name === 'Customer').length).toBeGreaterThan(0)
  })

  it('a storage that throws never breaks the table or the manager', async () => {
    const user = userEvent.setup()
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('denied') })
    draw()
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    await user.click(await screen.findByRole('checkbox', { name: 'ID' }))
    expect(headers()).toContain('ID')
  })

  it('without a user id nothing is stored', async () => {
    const user = userEvent.setup()
    draw({ columnsUserId: undefined })
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    await user.click(await screen.findByRole('checkbox', { name: 'ID' }))
    expect(window.localStorage.length).toBe(0)
  })
})

// redesign OC-F1 (OC-Q1-02, OC-Q1-03): the columns step aside by the width of the list, not by whether the panel is open:
// Contact first, then Business, then Last activity (Orders' pattern). What steps aside keeps its datum: the Cart cell's
// second line carries the business and the time; Contact stays in the panel and on the cards.
describe('QueueTable width priorities', () => {
  const FULL = ['Customer', 'Cart', 'Business', 'Value', 'Last activity', 'Status', 'Contact']
  const subOf = (container, id) => rowOf(container, id).querySelector('.odc-oq-sub .odc-mono').closest('.odc-oq-sub')

  it('at 544px (1280 with the panel) shows Customer, Cart, Value and Status, with the business and the time under the cart', () => {
    const { container } = draw()
    resizeTo(544)
    expect(headers()).toEqual(['Customer', 'Cart', 'Value', 'Status'])
    const sub = subOf(container, 90012)
    expect(sub).toHaveTextContent('#90012 · Sample Burgers · 12 minutes ago')
    expect(within(sub).getByText('12 minutes ago')).toHaveAttribute('title', util.parseDate('2026-10-09 12:00:00'))
    expect(sub).toHaveAttribute('title', '#90012 · Sample Burgers · 12 minutes ago')
    expect(within(rowOf(container, 90012)).queryByRole('button', { name: /Contact/ })).toBeNull()
  })

  it('at 728px (1024 without the panel) keeps Last activity and only the business moves under the cart', () => {
    const { container } = draw()
    resizeTo(728)
    expect(headers()).toEqual(['Customer', 'Cart', 'Value', 'Last activity', 'Status'])
    expect(subOf(container, 90012)).toHaveTextContent('#90012 · Sample Burgers')
    expect(subOf(container, 90012)).not.toHaveTextContent('minutes ago')
  })

  it('from about 1100px every column is a column and the cart line is only the number', () => {
    const { container } = draw()
    resizeTo(1100)
    expect(headers()).toEqual(FULL)
    expect(subOf(container, 90012)).toHaveTextContent(/^#90012$/)
  })

  it('does not depend on the panel: open or closed, the same width gives the same columns', () => {
    mocks.split = { mode: 'split', open: true, expanded: false }
    const { unmount } = draw()
    resizeTo(1100)
    expect(headers()).toEqual(FULL)
    unmount()
    mocks.split = { mode: 'split', open: false, expanded: false }
    draw()
    resizeTo(544)
    expect(headers()).toEqual(['Customer', 'Cart', 'Value', 'Status'])
  })

  it('steps aside one by one: Contact, then Business, then Last activity', () => {
    draw()
    resizeTo(1000)
    expect(headers()).toContain('Contact')
    resizeTo(950)
    expect(headers()).not.toContain('Contact')
    expect(headers()).toContain('Business')
    resizeTo(800)
    expect(headers()).not.toContain('Business')
    expect(headers()).toContain('Last activity')
    resizeTo(600)
    expect(headers()).not.toContain('Last activity')
  })

  it('the column manager says which ones are hidden at this width', async () => {
    const user = userEvent.setup()
    draw()
    resizeTo(544)
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    ;['Business', 'Last activity', 'Contact'].forEach(name => {
      expect(screen.getByRole('checkbox', { name })).toHaveAccessibleDescription('Hidden at this width')
    })
    expect(screen.getByRole('checkbox', { name: 'Value' })).not.toHaveAccessibleDescription('Hidden at this width')
  })

  it('a column the person turned off is theirs: no note, and its datum is not added under the cart', async () => {
    window.localStorage.setItem('odc-open-carts-columns:42', JSON.stringify([
      { id: 'customer', visible: true }, { id: 'cart', visible: true }, { id: 'business', visible: false },
      { id: 'value', visible: true }, { id: 'lastActivity', visible: true }, { id: 'status', visible: true }, { id: 'contact', visible: true }
    ]))
    const user = userEvent.setup()
    const { container } = draw()
    resizeTo(1200)
    expect(headers()).toEqual(['Customer', 'Cart', 'Value', 'Last activity', 'Status', 'Contact'])
    resizeTo(544)
    expect(subOf(container, 90012)).toHaveTextContent('#90012 · 12 minutes ago')
    expect(subOf(container, 90012)).not.toHaveTextContent('Sample Burgers')
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    expect(screen.getByRole('checkbox', { name: 'Business' })).not.toHaveAccessibleDescription('Hidden at this width')
  })

  it('ID and City, when the person turns them on, never step aside (they scroll) but they count in the width the rest needs', () => {
    window.localStorage.setItem('odc-open-carts-columns:42', JSON.stringify([
      { id: 'customer', visible: true }, { id: 'id', visible: true }, { id: 'cart', visible: true }, { id: 'business', visible: true },
      { id: 'city', visible: true }, { id: 'value', visible: true }, { id: 'lastActivity', visible: true }, { id: 'status', visible: true }, { id: 'contact', visible: true }
    ]))
    draw()
    resizeTo(1000)
    // without them 1000px keeps Contact (see «steps aside one by one»); with them the same width asks Contact to step aside
    expect(headers()).not.toContain('Contact')
    expect(headers()).toContain('ID')
    expect(headers()).toContain('City')
    resizeTo(300)
    expect(headers()).toEqual(expect.arrayContaining(['Customer', 'ID', 'City']))
  })

  it('keeps every column in the overlay mode when the browser reports no width, and in the expanded panel', () => {
    mocks.split = { mode: 'overlay', open: true, expanded: false }
    const { unmount } = draw()
    expect(headers()).toContain('Business')
    expect(headers()).toContain('Contact')
    unmount()
    mocks.split = { mode: 'split', open: true, expanded: true }
    draw()
    expect(headers()).toContain('Business')
  })
})

// redesign OC-F1 (OC-Q1-04): Retry removes the button that had the focus (the list goes back to loading); the focus must not
// fall to <body>. It goes to the first row once the carts are back.
describe('QueueTable focus after Retry', () => {
  it('moves to the first row when the reload brings the carts', async () => {
    const user = userEvent.setup()
    const { container, rerenderWith } = draw({ list: listOf([], { error: ['Server error'] }) })
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onReload).toHaveBeenCalledTimes(1)
    rerenderWith({ list: listOf([], { loading: true }) })
    expect(document.activeElement).toBe(document.body)
    rerenderWith({ list: listOf([ana, guest]) })
    expect(document.activeElement).toBe(rowOf(container, 90012))
  })

  it('moves to the table region when the reload brings no carts', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = draw({ list: listOf([], { error: ['Server error'] }) })
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    rerenderWith({ list: listOf([], { loading: true }) })
    rerenderWith({ list: listOf([]) })
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Open carts table, scrolls sideways' }))
  })

  it('goes to the new Retry when the list failed again, and does not steal the focus on later changes', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = draw({ list: listOf([], { error: ['Server error'] }) })
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    rerenderWith({ list: listOf([], { loading: true }) })
    rerenderWith({ list: listOf([], { error: ['Still down'] }) })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry' }))
  })

  it('a refresh that failed: the notice is gone once it works and the focus is on the first row', async () => {
    const user = userEvent.setup()
    const { container, rerenderWith } = draw({ list: listOf([ana, guest], { error: ['Network'] }) })
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    rerenderWith({ list: listOf([ana, guest]) })
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.activeElement).toBe(rowOf(container, 90012))
  })

  it('on a phone it goes to the first card', async () => {
    mocks.phone = true
    const user = userEvent.setup()
    const { container, rerenderWith } = draw({ list: listOf([], { error: ['Server error'] }) })
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    rerenderWith({ list: listOf([], { loading: true }) })
    rerenderWith({ list: listOf([ana, guest]) })
    expect(document.activeElement).toBe(container.querySelector('a.odc-order-card-link'))
  })

  it('does nothing without a Retry: the focus is not moved when the list loads', () => {
    const { rerenderWith } = draw({ list: listOf([], { loading: true }) })
    rerenderWith({ list: listOf([ana]) })
    expect(document.activeElement).toBe(document.body)
  })
})

describe('QueueTable opening a cart', () => {
  it('a click on the row opens that cart', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    await user.click(within(rowOf(container, 90007)).getByText('Marco Toss'))
    expect(current.onOpenCart).toHaveBeenCalledTimes(1)
    expect(current.onOpenCart).toHaveBeenCalledWith(marco)
  })

  it('Enter on the focused row opens it; the table has one tab stop and the arrows move between rows', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    const rows = [...container.querySelectorAll('tbody tr[data-row-id]')]
    expect(rows.filter(row => row.tabIndex === 0)).toHaveLength(1)
    // the controls of every other row are out of the tab order
    const others = rows.filter(row => row.tabIndex !== 0).flatMap(row => [...row.querySelectorAll('button')])
    expect(others.length).toBeGreaterThan(0)
    expect(others.filter(button => button.tabIndex === 0)).toHaveLength(0)
    rows[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(rows[1])
    await user.keyboard('{ArrowDown}{Enter}')
    expect(current.onOpenCart).toHaveBeenCalledWith(marco)
  })

  it('the contact menu does not open the cart, neither the button nor what it chooses', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(contactNavigation, 'open').mockImplementation(() => {})
    const { container } = draw()
    const button = within(rowOf(container, 90012)).getByRole('button', { name: 'Contact Ana Ruiz' })
    expect(button).toHaveTextContent('Contact')
    await user.click(button)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Email customer', 'Call +1 555 0100', 'Copy phone', 'Copy email'
    ])
    await user.click(within(menu).getByRole('menuitem', { name: 'Call +1 555 0100' }))
    expect(open).toHaveBeenCalledWith('tel:+15550100')
    expect(current.onOpenCart).not.toHaveBeenCalled()
  })

  it('a customer with only an email gets a menu with only the email actions', async () => {
    const user = userEvent.setup()
    const { container } = draw()
    await user.click(within(rowOf(container, 90009)).getByRole('button', { name: 'Contact Lena Park' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Email customer', 'Copy email'])
  })
})

describe('QueueTable asks for the details of the visible carts', () => {
  it('once for the carts it shows, not again for the same carts, and again when they change', () => {
    const { rerenderWith } = draw()
    expect(current.ensureDetails).toHaveBeenCalledTimes(1)
    expect(current.ensureDetails).toHaveBeenCalledWith(current.list.carts)
    rerenderWith({ list: listOf([ana, guest, marco, lena]), details: { ...DETAILS } })
    expect(current.ensureDetails).toHaveBeenCalledTimes(1)
    rerenderWith({ list: listOf([ana, guest]) })
    expect(current.ensureDetails).toHaveBeenCalledTimes(2)
    expect(current.ensureDetails).toHaveBeenLastCalledWith([ana, guest])
  })

  it('asks again for a cart whose last activity moved', () => {
    const { rerenderWith } = draw({ list: listOf([ana]) })
    rerenderWith({ list: listOf([{ ...ana, updated_at: '2026-10-09 12:05:00' }]) })
    expect(current.ensureDetails).toHaveBeenCalledTimes(2)
  })

  // redesign OC-integration (OC-Q1-09): a failed detail is asked again after 11 s even when nothing on screen changes
  it('asks again for a failed detail after 11 s with the screen still, and stops at three attempts', () => {
    vi.useRealTimers()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    try {
      const failed = { ...DETAILS, [ana.id]: { loading: false, error: ['Failed to fetch'], cart: null, attempts: 1 } }
      const { rerenderWith } = draw({ list: listOf([ana]), details: failed })
      expect(current.ensureDetails).toHaveBeenCalledTimes(1)
      act(() => { vi.advanceTimersByTime(10999) })
      expect(current.ensureDetails).toHaveBeenCalledTimes(1)
      act(() => { vi.advanceTimersByTime(2) })
      expect(current.ensureDetails).toHaveBeenCalledTimes(2)
      rerenderWith({ details: { ...DETAILS, [ana.id]: { loading: false, error: ['Failed to fetch'], cart: null, attempts: 3 } } })
      act(() => { vi.advanceTimersByTime(30000) })
      expect(current.ensureDetails).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
      vi.useFakeTimers({ toFake: ['Date'] })
    }
  })

  it('does not ask while the list loads or has failed', () => {
    draw({ list: listOf([], { loading: true }) })
    draw({ list: listOf([], { error: ['boom'] }) })
    expect(current.ensureDetails).not.toHaveBeenCalled()
  })
})

describe('QueueTable follow up: bands and the contact switch', () => {
  it('writes the band once, in the first row of each, and every row of a band names it for a screen reader', () => {
    const { container } = draw({ view: 'followUp', list: FOLLOW_UP_LIST })
    const kickers = [...container.querySelectorAll('.odc-oq-group')]
    expect(kickers.map(node => node.textContent)).toEqual(['Last 24 hours', '1–7 days ago'])
    expect(rowOf(container, 90012).contains(kickers[0])).toBe(true)
    expect(rowOf(container, 90007).contains(kickers[1])).toBe(true)
    expect(rowOf(container, 90012)).toHaveAttribute('data-group-start')
    expect(rowOf(container, 90011)).not.toHaveAttribute('data-group-start')
    expect(within(rowOf(container, 90011)).getByRole('rowheader')).toHaveTextContent('Last 24 hours')
    expect(within(rowOf(container, 90009)).getByRole('rowheader')).toHaveTextContent('1–7 days ago')
    // still one table, one tab stop
    expect(container.querySelectorAll('table')).toHaveLength(1)
    expect([...container.querySelectorAll('tbody tr[data-row-id]')].filter(row => row.tabIndex === 0)).toHaveLength(1)
  })

  it('has no bands outside follow up', () => {
    const { container } = draw({ view: 'all', list: { ...FOLLOW_UP_LIST, groups: null } })
    expect(container.querySelectorAll('.odc-oq-group')).toHaveLength(0)
  })

  it('«With contact only» is a switch, on, with the number it hides', async () => {
    const user = userEvent.setup()
    draw({ view: 'followUp', list: FOLLOW_UP_LIST })
    const toggle = screen.getByRole('switch', { name: 'With contact only' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('hidden', { exact: false, selector: '.odc-oq-note' })).toHaveTextContent('3 hidden')
    await user.click(toggle)
    expect(current.onWithContactOnlyChange).toHaveBeenCalledWith(false)
  })

  it('is not there in the other views, and says nothing when nothing is hidden', () => {
    draw({ view: 'all' })
    expect(screen.queryByRole('switch')).toBeNull()
    draw({ view: 'followUp', list: { ...FOLLOW_UP_LIST, hiddenCount: 0 } })
    expect(screen.getByRole('switch', { name: 'With contact only' })).toBeInTheDocument()
    expect(document.querySelector('.odc-oq-note')).toBeNull()
  })
})

describe('QueueTable empty and error states', () => {
  it('the first time: «No open carts», no action', () => {
    draw({ list: listOf([]) })
    expect(screen.getByText('No open carts')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('with filters or a search: «No carts match these filters» and Clear filters', async () => {
    const user = userEvent.setup()
    draw({ list: listOf([]), hasFilters: true })
    expect(screen.getByText('No carts match these filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(current.onClearFilters).toHaveBeenCalledTimes(1)
  })

  it('a search with no result is a filter too', () => {
    draw({ list: listOf([]), search: '99' })
    expect(screen.getByText('No carts match these filters')).toBeInTheDocument()
  })

  it('live now with nothing: says nobody has added to a cart in the last 30 minutes', () => {
    draw({ view: 'live', list: listOf([]) })
    expect(screen.getByText('Nobody has added to a cart in the last 30 minutes.')).toBeInTheDocument()
  })

  it('a search with no digits asks for a cart number', () => {
    draw({ list: listOf([], { searchWithoutDigits: true }), search: 'abc' })
    expect(screen.getByText('Search by cart number')).toBeInTheDocument()
    expect(screen.queryByText('No carts match these filters')).toBeNull()
  })

  it('follow up with everything hidden by the switch explains it instead of saying there are none', () => {
    draw({ view: 'followUp', list: listOf([], { groups: [], hiddenCount: 5 }) })
    expect(screen.getByText('No open carts')).toBeInTheDocument()
    expect(screen.getByText(/Turn off “With contact only”/)).toBeInTheDocument()
  })

  it('an error takes the place of the list, is announced, gives the reason and retries', async () => {
    const user = userEvent.setup()
    draw({ list: listOf([], { error: ['Server error'] }) })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the carts.")
    expect(alert).toHaveTextContent('Server error')
    expect(screen.queryByRole('table')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onReload).toHaveBeenCalledTimes(1)
  })

  it('a refresh that failed keeps the carts on screen and offers the retry beside the notice', async () => {
    const user = userEvent.setup()
    const { container } = draw({ list: listOf([ana], { error: ['Network'] }) })
    expect(rowOf(container, 90012)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent("We couldn't refresh the carts.")
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onReload).toHaveBeenCalledTimes(1)
  })

  it('while loading it shows skeleton rows with a label, and no empty state', () => {
    const { container } = draw({ list: listOf([], { loading: true }) })
    expect(container.querySelectorAll('tr[data-skeleton]').length).toBeGreaterThan(0)
    expect(screen.getByText('Loading carts')).toBeInTheDocument()
    expect(screen.queryByText('No open carts')).toBeNull()
  })
})

describe('QueueTable on a phone: cards', () => {
  beforeEach(() => { mocks.phone = true })

  it('is a list of cards, not a table, with what the row has: customer, items, business, value, activity, status, contact', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Open carts' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    const card = container.querySelector('li[data-row-id="90012"]')
    expect(within(card).getByRole('link', { name: 'Cart #90012 · Ana Ruiz' })).toHaveTextContent('#90012')
    expect(card).toHaveTextContent('Ana Ruiz')
    expect(card).toHaveTextContent('Sample Burgers')
    expect(card).toHaveTextContent('2× Hamburger · 1× Fries')
    expect(card).toHaveTextContent(util.parsePrice(34.2))
    expect(within(card).getByText('12 minutes ago')).toHaveAttribute('title', util.parseDate('2026-10-09 12:00:00'))
    expect(within(card).getByText('Open')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Contact Ana Ruiz' })).toBeInTheDocument()
  })

  it('a guest card says Guest and has no contact menu', () => {
    const { container } = draw()
    const card = container.querySelector('li[data-row-id="90011"]')
    expect(card).toHaveTextContent('Guest')
    expect(card).toHaveTextContent('No contact details')
    expect(within(card).queryByRole('button')).toBeNull()
  })

  it('a card opens its cart; its contact menu does not', async () => {
    const user = userEvent.setup()
    vi.spyOn(contactNavigation, 'open').mockImplementation(() => {})
    const { container } = draw()
    const card = container.querySelector('li[data-row-id="90007"]')
    await user.click(within(card).getByRole('link'))
    expect(current.onOpenCart).toHaveBeenCalledTimes(1)
    expect(current.onOpenCart).toHaveBeenCalledWith(marco)
    await user.click(within(card).getByRole('button', { name: 'Contact Marco Toss' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Copy email' }))
    expect(current.onOpenCart).toHaveBeenCalledTimes(1)
  })

  it('follow up keeps its bands as headings, and the switch stays', () => {
    draw({ view: 'followUp', list: FOLLOW_UP_LIST })
    expect(screen.getAllByRole('heading').map(heading => heading.textContent)).toEqual(['Last 24 hours', '1–7 days ago'])
    expect(screen.getAllByRole('list')).toHaveLength(2)
    expect(screen.getByRole('switch', { name: 'With contact only' })).toBeInTheDocument()
  })

  it('has no column manager (there are no columns) and shows the empty and error states', async () => {
    const user = userEvent.setup()
    draw({ list: listOf([], { error: ['x'] }) })
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(current.onReload).toHaveBeenCalled()
    draw({ list: listOf([]), hasFilters: true })
    expect(screen.getByText('No carts match these filters')).toBeInTheDocument()
  })

  it('asks for the details of the cards too', () => {
    draw()
    expect(current.ensureDetails).toHaveBeenCalledWith(current.list.carts)
  })
})
