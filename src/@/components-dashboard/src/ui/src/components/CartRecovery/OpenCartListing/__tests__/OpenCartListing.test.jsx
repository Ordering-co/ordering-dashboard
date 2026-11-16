/* eslint-disable import/first */
// redesign OC-B (page composition): the open carts page is a header (title, count, recovery line, day figures, four views,
// the Live now strip), the filters, the queue table with its foot, and the cart panel in a split view. The queue table,
// the filters and the panel are other pieces (OC-C, OC-D, OC-E) and are stubbed here: what is tested is how they are
// composed, which props they get and what the page owns (the URL, the open cart, the announcements).
import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// What each stub received on its last render, to pin the contract between the pieces.
const seen = vi.hoisted(() => ({ controller: null, table: null, filters: null, panel: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ parsePrice: value => `$${Number(value).toFixed(2)}` }],
  // the controller hands its props to the UI as the real one does; the test plays the controller
  OpenCartListing: ({ UIComponent, ...props }) => {
    seen.controller = props
    return <UIComponent {...props} />
  }
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../../OpenCartsQueue/QueueTable', () => ({
  QueueTable: (props) => {
    seen.table = props
    return (
      <div data-testid='queue-table' className='odc-table-scroll' role='region' aria-label='Open carts table'>
        {props.list.carts.map(cart => (
          // as DataTable's rows: `data-row-id`, a row that can take the focus
          <div key={cart.id} data-row-id={cart.id} tabIndex={-1}>
            <button type='button' onClick={() => props.onOpenCart(cart)}>Open cart {cart.id}</button>
          </div>
        ))}
        <button type='button' onClick={() => props.onClearFilters()}>Clear all</button>
      </div>
    )
  }
}))

vi.mock('../../OpenCartsQueue/QueueFilters', () => ({
  QueueFilters: (props) => {
    seen.filters = props
    return <div data-testid='queue-filters' />
  }
}))

vi.mock('../../OpenCartPanel', () => ({
  OpenCartPanel: (props) => {
    seen.panel = props
    return (
      <div data-testid='cart-panel'>
        <span>Panel of cart {props.cart.id}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => { props.onDelete(props.cart) }}>Delete this cart</button>
      </div>
    )
  }
}))

import { OpenCartListing } from '../index'

const cart = (id, extra = {}) => ({
  id,
  uuid: `uuid-${id}`,
  user_id: 400 + id,
  status: 0,
  updated_at: '2026-10-09 10:00:00',
  user: { name: `Customer${id}`, lastname: 'Ruiz', email: `c${id}@example.com` },
  business: { id: 7, name: 'Sample Burgers' },
  ...extra
})

const carts = [cart(90012), cart(90011, { user: {} }), cart(90007, { status: 4 })]
const list = (overrides = {}) => ({
  loading: false,
  error: null,
  carts,
  groups: null,
  page: 1,
  pageSize: 10,
  total: carts.length,
  totalPages: 1,
  capped: false,
  searchWithoutDigits: false,
  hiddenCount: 0,
  ...overrides
})

const baseProps = (overrides = {}) => ({
  isUseQuery: true,
  onCartRedirect: vi.fn(),
  view: 'followUp',
  onViewChange: vi.fn(),
  search: '',
  onSearchChange: vi.fn(),
  filters: { businessIds: [], customerIds: [], cityIds: [], lastActivity: { from: null, to: null } },
  onFiltersChange: vi.fn(),
  onClearFilters: vi.fn(),
  withContactOnly: true,
  onWithContactOnlyChange: vi.fn(),
  list: list(),
  onReload: vi.fn(),
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  counts: { followUp: 16, paymentFailed: 8, live: 2, all: 49 },
  details: {},
  ensureDetails: vi.fn(() => Promise.resolve()),
  rules: { loading: false, total: 8, enabled: 2 },
  dayFigures: { loading: false, activeToday: 2, atStakeToday: 49.1, capped: false },
  live: { lastUpdatedAt: null, refreshing: false, refresh: vi.fn(), newIds: [] },
  deleteCart: vi.fn(() => Promise.resolve({ ok: true, error: null })),
  businesses: [{ id: 7, name: 'Sample Burgers' }],
  cities: [],
  ...overrides
})

// The router's history, to play what the ⌘K palette does (navigate to a URL while the page is open)
const historyRef = { current: null }
const Capture = () => {
  historyRef.current = useHistory()
  return null
}

const renderPage = (overrides = {}, route = '/cart-recovery/open-carts') => {
  const props = baseProps(overrides)
  const view = (next) => <><Capture /><OpenCartListing {...next} /></>
  const utils = renderWithProviders(view(props), { initialEntries: [route] })
  return {
    props,
    ...utils,
    update: (changes) => {
      const next = { ...props, ...changes }
      Object.assign(props, next)
      utils.rerender(view(next))
    }
  }
}

const tabOf = (name) => screen.getByRole('tab', { name })

// jsdom answers matchMedia with `matches: false`: the split view reads (min|max)-width queries, so one is installed that
// evaluates them against a width (1440: the split mode, the panel sits beside the list)
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

let restoreViewport
beforeEach(() => {
  window.history.replaceState(null, '', '/cart-recovery/open-carts')
  restoreViewport = installViewport(1440)
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  seen.table = null
  seen.filters = null
  seen.panel = null
})

afterEach(() => {
  vi.useRealTimers()
  restoreViewport()
})

describe('header: title, count, recovery line, day figures', () => {
  it('draws the page title with the count of every open cart and the Learn entry', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Open carts' })).toHaveClass('odc-pagehead-title')
    // the count's accessible name, in the title and in the All tab
    expect(screen.getAllByText('49 carts')).toHaveLength(2)
    expect(document.querySelector('.odc-pagehead-count')).toHaveTextContent('49 carts')
    expect(screen.getByRole('button', { name: /Learn/ })).toBeInTheDocument()
  })

  it('says how many of the recovery rules are on, with a link to manage them', () => {
    renderPage()
    const line = screen.getByText(/Automatic recovery:/).closest('[data-oc-recovery]')
    expect(line).toHaveTextContent('Automatic recovery: 2 of 8 rules on')
    expect(line.querySelectorAll('.odc-figure')).toHaveLength(2)
    expect(within(line).getByRole('link', { name: 'Manage rules' })).toHaveAttribute('href', '/cart-recovery/recovery-actions')
  })

  it('paints «Active today» and «At stake today» in figures, with a plus on the sum when it was capped', () => {
    const { update } = renderPage()
    const active = screen.getByText('Active today').closest('[data-oc-figure]')
    expect(within(active).getByText('2')).toHaveClass('odc-figure')
    const stake = screen.getByText('At stake today').closest('[data-oc-figure]')
    expect(within(stake).getByText('$49.10')).toHaveClass('odc-figure')

    update({ dayFigures: { loading: false, activeToday: 80, atStakeToday: 1200.5, capped: true } })
    expect(within(screen.getByText('At stake today').closest('[data-oc-figure]')).getByText('$1200.50+')).toHaveClass('odc-figure')
    // «Active today» is the API's own total: exact, never a lower bound
    expect(within(screen.getByText('Active today').closest('[data-oc-figure]')).getByText('80')).toBeInTheDocument()
  })

  it('hides a figure whose value is null and paints a skeleton while it loads', () => {
    const { update } = renderPage({ dayFigures: { loading: false, activeToday: null, atStakeToday: 10, capped: false } })
    expect(screen.queryByText('Active today')).not.toBeInTheDocument()
    expect(screen.getByText('At stake today')).toBeInTheDocument()

    update({ dayFigures: { loading: true, activeToday: null, atStakeToday: null, capped: false } })
    expect(screen.getByText('Active today').closest('[data-oc-figure]').querySelector('.odc-skeleton')).not.toBeNull()
  })

  it('keeps the link when the rules did not load, and a skeleton while they do', () => {
    const { update } = renderPage({ rules: { loading: true, total: null, enabled: null } })
    expect(document.querySelector('[data-oc-recovery] .odc-skeleton')).not.toBeNull()
    update({ rules: { loading: false, total: null, enabled: null, error: ['x'] } })
    expect(screen.queryByText(/Automatic recovery:/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage rules' })).toBeInTheDocument()
  })

  it('has the open-menu button only with the sidebar collapsed', async () => {
    const { unmount } = renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
    unmount()
    infoShare.isCollapse = true
    renderPage()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the lead block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })
})

describe('the four views', () => {
  it('draws one tab per view with its count, the current one selected, in the order Follow up, Payment failed, Live now, All', () => {
    renderPage({ view: 'paymentFailed' })
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.querySelector('.odc-tab-label').textContent)).toEqual(['Follow up', 'Payment failed', 'Live now', 'All'])
    expect(tabOf(/Payment failed/)).toHaveAttribute('aria-selected', 'true')
    expect(tabOf(/Follow up/)).toHaveAttribute('aria-selected', 'false')
    expect(within(tabOf(/Follow up/)).getByText('16')).toBeInTheDocument()
    expect(within(tabOf(/Live now/)).getByText('2')).toBeInTheDocument()
    expect(within(tabOf(/^All/)).getByText('49')).toBeInTheDocument()
    expect(screen.getByRole('tablist')).toHaveAccessibleName('Views')
  })

  it('marks Payment failed as attention only when it has carts', () => {
    const { update } = renderPage()
    expect(tabOf(/Payment failed/).querySelector('.odc-count')).toHaveAttribute('data-attention')
    expect(tabOf(/Follow up/).querySelector('.odc-count')).not.toHaveAttribute('data-attention')
    update({ counts: { followUp: 16, paymentFailed: 0, live: 2, all: 49 } })
    expect(tabOf(/Payment failed/).querySelector('.odc-count')).not.toHaveAttribute('data-attention')
  })

  it('shows a skeleton for a count that has not arrived and reads the counts to screen readers', () => {
    renderPage({ counts: { followUp: null, paymentFailed: 1, live: null, all: null } })
    expect(tabOf(/Follow up/).querySelector('.odc-skeleton')).not.toBeNull()
    expect(within(tabOf(/Payment failed/)).getByText('1 cart')).toHaveClass('odc-sr-only')
    expect(within(tabOf(/^All/)).queryByText(/carts/)).not.toBeInTheDocument()
    // no count in the title yet
    expect(screen.queryByText(/\d+ carts/)).not.toBeInTheDocument()
  })

  it('changing the view asks the controller, writes ?view= in the URL, and the default view leaves it out', async () => {
    const { props, update } = renderPage()
    await userEvent.click(tabOf(/Payment failed/))
    expect(props.onViewChange).toHaveBeenCalledWith('paymentFailed')
    expect(new URLSearchParams(window.location.search).get('view')).toBe('paymentFailed')

    update({ view: 'live' })
    await userEvent.click(tabOf(/Follow up/))
    expect(props.onViewChange).toHaveBeenLastCalledWith('followUp')
    expect(new URLSearchParams(window.location.search).has('view')).toBe(false)
  })

  it('keeps the other query values when it writes the view', async () => {
    window.history.replaceState(null, '', '/cart-recovery/open-carts?id=90012&pageSize=25')
    renderPage({ list: list({ pageSize: 25 }) })
    await userEvent.click(tabOf(/^All/))
    const query = new URLSearchParams(window.location.search)
    expect(query.get('view')).toBe('all')
    expect(query.get('id')).toBe('90012')
    expect(query.get('pageSize')).toBe('25')
  })

  it('starts the controller on the view and the page of the URL, and ignores what it does not know', () => {
    const { unmount } = renderPage({}, '/cart-recovery/open-carts?view=live&page=3&pageSize=25')
    expect(seen.controller.initialView).toBe('live')
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
    unmount()
    renderPage({}, '/cart-recovery/open-carts?view=nonsense&page=x&pageSize=7')
    expect(seen.controller.initialView).toBeUndefined()
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('follows a ?view= the router navigates to while the page is open (the palette)', () => {
    const { props, update } = renderPage({ view: 'followUp' })
    act(() => { historyRef.current.push('/cart-recovery/open-carts?view=live') })
    expect(props.onViewChange).toHaveBeenCalledWith('live')
    update({ view: 'live' })
    act(() => { historyRef.current.push('/cart-recovery/open-carts') })
    expect(props.onViewChange).toHaveBeenLastCalledWith('followUp')
  })
})

// redesign OC-F3 (OC-Q1-08): «With contact only» lives in the URL (?contact=all when it is off), as ?view=
describe('the contact switch and the URL', () => {
  const contactParam = () => new URLSearchParams(window.location.search).get('contact')
  const guest = cart(90099, { user: {} })

  it('writes ?contact=all when the switch goes off, removes it when it goes on, and tells the controller', () => {
    const { props } = renderPage()
    act(() => { seen.table.onWithContactOnlyChange(false) })
    expect(props.onWithContactOnlyChange).toHaveBeenLastCalledWith(false)
    expect(contactParam()).toBe('all')
    act(() => { seen.table.onWithContactOnlyChange(true) })
    expect(props.onWithContactOnlyChange).toHaveBeenLastCalledWith(true)
    expect(new URLSearchParams(window.location.search).has('contact')).toBe(false)
  })

  it('keeps the other query values when it writes it', () => {
    window.history.replaceState(null, '', '/cart-recovery/open-carts?view=live&pageSize=25')
    renderPage({ list: list({ pageSize: 25 }) })
    act(() => { seen.table.onWithContactOnlyChange(false) })
    const query = new URLSearchParams(window.location.search)
    expect(query.get('contact')).toBe('all')
    expect(query.get('view')).toBe('live')
    expect(query.get('pageSize')).toBe('25')
  })

  it('starts the controller with the guests shown when the URL says ?contact=all, hidden otherwise', () => {
    const { unmount } = renderPage({}, '/cart-recovery/open-carts?contact=all')
    expect(seen.controller.initialWithContactOnly).toBe(false)
    unmount()
    renderPage({}, '/cart-recovery/open-carts?contact=nonsense')
    expect(seen.controller.initialWithContactOnly).not.toBe(false) // the controller's default (on) applies
  })

  it('opens the cart of a guest from a deep link: turns the switch off, writes ?contact=all and does not drop ?id=', async () => {
    const { props, update } = renderPage({ list: list({ hiddenCount: 1 }) }, '/cart-recovery/open-carts?id=90099')
    await waitFor(() => expect(props.onWithContactOnlyChange).toHaveBeenCalledWith(false))
    expect(contactParam()).toBe('all')
    expect(props.onCartRedirect).not.toHaveBeenCalled()
    // the controller answers with the guests in the list
    update({ withContactOnly: false, list: list({ carts: [...carts, guest], hiddenCount: 0 }) })
    expect(await screen.findByText('Panel of cart 90099')).toBeInTheDocument()
    expect(props.onCartRedirect).not.toHaveBeenCalled()
    expect(props.onWithContactOnlyChange).toHaveBeenCalledTimes(1)
  })

  it('opens the guest cart of a deep link even when every cart of the list is a guest', async () => {
    const { props, update } = renderPage({ list: list({ carts: [], total: 0, hiddenCount: 3 }) }, '/cart-recovery/open-carts?id=90099')
    await waitFor(() => expect(props.onWithContactOnlyChange).toHaveBeenCalledWith(false))
    update({ withContactOnly: false, list: list({ carts: [guest], hiddenCount: 0 }) })
    expect(await screen.findByText('Panel of cart 90099')).toBeInTheDocument()
  })

  it('still drops ?id= when the cart is not in the list even with the guests shown', async () => {
    const { props, update } = renderPage({ list: list({ hiddenCount: 1 }) }, '/cart-recovery/open-carts?id=123456')
    await waitFor(() => expect(props.onWithContactOnlyChange).toHaveBeenCalledWith(false))
    update({ withContactOnly: false, list: list({ hiddenCount: 0 }) })
    await waitFor(() => expect(props.onCartRedirect).toHaveBeenCalledWith())
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument()
  })

  it('leaves the switch alone when nothing is hidden, when it is already off, or outside Follow up', async () => {
    const first = renderPage({ list: list({ hiddenCount: 0 }) }, '/cart-recovery/open-carts?id=90099')
    await waitFor(() => expect(first.props.onCartRedirect).toHaveBeenCalledWith())
    expect(first.props.onWithContactOnlyChange).not.toHaveBeenCalled()
    first.unmount()
    const off = renderPage({ withContactOnly: false, list: list({ hiddenCount: 2 }) }, '/cart-recovery/open-carts?id=90099')
    await waitFor(() => expect(off.props.onCartRedirect).toHaveBeenCalledWith())
    expect(off.props.onWithContactOnlyChange).not.toHaveBeenCalled()
    off.unmount()
    const other = renderPage({ view: 'all', list: list({ hiddenCount: 2 }) }, '/cart-recovery/open-carts?id=90099')
    await waitFor(() => expect(other.props.onCartRedirect).toHaveBeenCalledWith())
    expect(other.props.onWithContactOnlyChange).not.toHaveBeenCalled()
  })

  it('does not touch the URL when the page does not use it', () => {
    renderPage({ isUseQuery: false })
    act(() => { seen.table.onWithContactOnlyChange(false) })
    expect(contactParam()).toBeNull()
  })
})

describe('Live now', () => {
  const LIVE = { lastUpdatedAt: null, refreshing: false, refresh: vi.fn(), newIds: [] }

  it('has no strip in the other views', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-oc-live]')).toBeNull()
  })

  it('says what the view shows, when it was updated, and refreshes by hand', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-10-09T12:00:30Z'))
    const refresh = vi.fn()
    renderPage({ view: 'live', live: { ...LIVE, refresh, lastUpdatedAt: new Date('2026-10-09T12:00:10Z').getTime() } })
    const strip = document.querySelector('[data-oc-live]')
    expect(strip).toHaveTextContent('Carts with activity in the last 30 min · Updated 20 s ago')
    const figures = strip.querySelectorAll('.odc-figure') // the window's 30 and the seconds
    expect([...figures].map(node => node.textContent)).toEqual(['30', '20'])
    fireEvent.click(within(strip).getByRole('button', { name: 'Refresh' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('updates the «ago» text every 10 seconds', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-09T12:00:10Z'))
    renderPage({ view: 'live', live: { ...LIVE, lastUpdatedAt: new Date('2026-10-09T12:00:00Z').getTime() } })
    const strip = () => document.querySelector('[data-oc-live]')
    expect(strip()).toHaveTextContent('Updated 10 s ago')
    act(() => { vi.advanceTimersByTime(10000) })
    expect(strip()).toHaveTextContent('Updated 20 s ago')
    act(() => { vi.advanceTimersByTime(30000) })
    expect(strip()).toHaveTextContent('Updated 50 s ago')
    act(() => { vi.advanceTimersByTime(20000) })
    expect(strip()).toHaveTextContent('Updated a minute ago')
  })

  it('says «just now» in the first seconds and says nothing before the first load', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-09T12:00:03Z'))
    const { update } = renderPage({ view: 'live', live: { ...LIVE, lastUpdatedAt: new Date('2026-10-09T12:00:00Z').getTime() } })
    expect(document.querySelector('[data-oc-live]')).toHaveTextContent('Updated just now')
    update({ live: { ...LIVE, lastUpdatedAt: null } })
    expect(document.querySelector('[data-oc-live]')).not.toHaveTextContent('Updated')
  })

  it('keeps the Refresh button focusable and busy (not disabled) while it refreshes, and ignores clicks', () => {
    const refresh = vi.fn()
    renderPage({ view: 'live', live: { ...LIVE, refresh, refreshing: true, lastUpdatedAt: Date.now() } })
    const button = screen.getByRole('button', { name: 'Refresh' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).not.toBeDisabled()
    fireEvent.click(button)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('the list, its foot and what the pieces receive', () => {
  it('gives the table what the plan fixes, and the filters theirs', () => {
    renderPage({ search: '18' })
    expect(seen.table).toMatchObject({
      view: 'followUp',
      withContactOnly: true,
      hasFilters: true,
      search: '18',
      activeCartId: null
    })
    expect(seen.table.list.carts).toHaveLength(3)
    expect(typeof seen.table.onOpenCart).toBe('function')
    expect(typeof seen.table.ensureDetails).toBe('function')
    expect(seen.table.onReload).toBeDefined()
    expect(seen.filters).toMatchObject({ search: '18', view: 'followUp' })
    expect(seen.filters.businesses).toHaveLength(1)
    expect(typeof seen.filters.onFiltersChange).toBe('function')
  })

  it('knows when there are no filters', () => {
    renderPage()
    expect(seen.table.hasFilters).toBe(false)
  })

  it('counts a city, a customer, a business or a date range as filters', () => {
    const { update } = renderPage()
    update({ filters: { businessIds: [], customerIds: [], cityIds: [3], lastActivity: { from: null, to: null } } })
    expect(seen.table.hasFilters).toBe(true)
    update({ filters: { businessIds: [], customerIds: [], cityIds: [], lastActivity: { from: null, to: new Date() } } })
    expect(seen.table.hasFilters).toBe(true)
  })

  it('draws the foot only with more than one page, and never in Live now', async () => {
    const { props, update } = renderPage({ list: list({ total: 95, totalPages: 10, page: 2 }) })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(props.onPageChange).toHaveBeenCalledWith(3)

    update({ list: list({ total: 3, totalPages: 1 }) })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()

    update({ view: 'live', list: list({ total: 95, totalPages: 10 }) })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('keeps ?page and ?pageSize in the URL once the list is loaded', () => {
    const { update } = renderPage({ list: list({ loading: true, page: 1, pageSize: 10 }) })
    expect(new URLSearchParams(window.location.search).has('page')).toBe(false)
    update({ list: list({ total: 95, totalPages: 4, page: 3, pageSize: 25 }) })
    const query = new URLSearchParams(window.location.search)
    expect(query.get('page')).toBe('3')
    expect(query.get('pageSize')).toBe('25')
  })

  it('says when the list is only the most recent carts', () => {
    const { update } = renderPage()
    expect(screen.queryByText(/most recent carts/)).not.toBeInTheDocument()
    update({ list: list({ capped: true }) })
    expect(screen.getByText('Showing only the most recent carts. Use the filters to find others.')).toBeInTheDocument()
  })

  it('does not wrap the page in the legacy container', () => {
    renderPage()
    expect(document.querySelector('.odc-oc-split')).not.toBeNull()
    expect(document.querySelector('[data-testid="queue-table"]').closest('.odc-split-list')).not.toBeNull()
  })
})

describe('the cart panel', () => {
  it('opens when a row is opened: asks for its detail, writes ?id= and hands the panel the detail', async () => {
    const detail = { id: 90012, products: [] }
    const { props } = renderPage({ details: { 90012: { loading: false, error: null, cart: detail, full: true } } })
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))

    expect(props.onCartRedirect).toHaveBeenCalledWith(90012)
    expect(props.ensureDetails).toHaveBeenCalledWith([carts[0]], { full: true })
    expect(await screen.findByText('Panel of cart 90012')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Cart #90012' })).toContainElement(screen.getByTestId('cart-panel'))
    expect(seen.panel.cart).toBe(carts[0])
    expect(seen.panel.detail).toBe(detail)
    expect(seen.panel.detailState).toMatchObject({ loading: false })
    expect(seen.panel.rules).toBe(props.rules)
    expect(seen.panel.expanded).toBe(false)
    expect(typeof seen.panel.onExpandedChange).toBe('function')
    expect(seen.table.activeCartId).toBe(90012)
  })

  it('hands the panel no detail while it only has what the list brought (params=totals), so it waits for the whole one', async () => {
    const listed = { id: 90012, subtotal: 20, total: 20, products: [{ id: 1, name: 'Burger', price: 20 }] }
    const { update } = renderPage({ details: { 90012: { loading: false, error: null, cart: listed, partial: true } } })
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    expect(seen.panel.detail).toBeUndefined()

    update({ details: { 90012: { loading: true, error: null, cart: listed } } })
    expect(seen.panel.detail).toBeUndefined()

    update({ details: { 90012: { loading: false, error: ['boom'], cart: listed } } })
    expect(seen.panel.detail).toBeUndefined()
    expect(seen.panel.detailState).toMatchObject({ error: ['boom'] })

    const whole = { ...listed, taxes: [], fees: [] }
    update({ details: { 90012: { loading: false, error: null, cart: whole, full: true } } })
    expect(seen.panel.detail).toBe(whole)
  })

  it('retries a detail that failed', async () => {
    const failed = { loading: false, error: ['boom'], cart: null }
    const { props } = renderPage({ details: { 90012: failed } })
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    props.ensureDetails.mockClear()
    seen.panel.onRetry()
    expect(props.ensureDetails).toHaveBeenCalledWith([carts[0]], { retry: true })
  })

  it('closes with its own button: removes ?id= through the page and frees the table', async () => {
    const { props } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    props.onCartRedirect.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(props.onCartRedirect).toHaveBeenCalledWith()
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument()
    expect(seen.table.activeCartId).toBeNull()
  })

  it('stays open when a reload leaves the cart out of the list (Live now, a delete of another cart)', async () => {
    const { update } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    update({ list: list({ carts: [carts[1], carts[2]], total: 2 }) })
    expect(screen.getByText('Panel of cart 90012')).toBeInTheDocument()
    expect(seen.panel.cart.id).toBe(90012)
    update({ list: list({ loading: true, carts: [], total: 0 }) })
    expect(screen.getByText('Panel of cart 90012')).toBeInTheDocument()
    update({ view: 'all', list: list({ carts: [], total: 0 }) })
    expect(screen.getByText('Panel of cart 90012')).toBeInTheDocument()
  })

  it('shows the fresh version of the open cart when the reload brings it', async () => {
    const { update } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    const fresh = { ...carts[0], updated_at: '2026-10-09 10:05:00' }
    update({ list: list({ carts: [fresh, carts[1]], total: 2 }) })
    expect(seen.panel.cart).toBe(fresh)
    expect(seen.table.list.carts[0]).toBe(fresh)
  })

  it('opens the cart of ?id= once the list has loaded, and does not ask the URL for it again', async () => {
    const { props, update } = renderPage({ list: list({ loading: true, carts: [], total: 0 }) }, '/cart-recovery/open-carts?id=90011')
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument()
    update({ list: list() })
    expect(await screen.findByText('Panel of cart 90011')).toBeInTheDocument()
    expect(props.onCartRedirect).not.toHaveBeenCalled() // the id is already in the URL
    expect(props.ensureDetails).toHaveBeenCalledWith([carts[1]], { full: true })
  })

  it('drops ?id= when the cart is not in the loaded list (as main does)', async () => {
    const { props } = renderPage({}, '/cart-recovery/open-carts?id=123456')
    await waitFor(() => expect(props.onCartRedirect).toHaveBeenCalledWith())
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument()
  })

  it('waits for the list before it decides, and decides only once', async () => {
    const { props, update } = renderPage({ list: list({ loading: true, carts: [], total: 0 }) }, '/cart-recovery/open-carts?id=123456')
    expect(props.onCartRedirect).not.toHaveBeenCalled()
    update({ list: list() })
    await waitFor(() => expect(props.onCartRedirect).toHaveBeenCalledTimes(1))
    update({ list: list({ carts: [...carts] }) })
    expect(props.onCartRedirect).toHaveBeenCalledTimes(1)
  })

  it('leaves the URL alone when the list failed to load (nothing to decide on)', () => {
    const { props } = renderPage({ list: list({ error: ['Network'], carts: [], total: 0 }) }, '/cart-recovery/open-carts?id=90012')
    expect(props.onCartRedirect).not.toHaveBeenCalled()
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument()
  })

  it('ignores an id that is not a number', async () => {
    const { props } = renderPage({}, '/cart-recovery/open-carts?id=abc')
    await waitFor(() => expect(props.onCartRedirect).toHaveBeenCalledWith())
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument()
  })

  it('deleting the cart closes the panel once the controller says ok', async () => {
    const { props } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    props.onCartRedirect.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Delete this cart' }))
    expect(props.deleteCart).toHaveBeenCalledWith(carts[0])
    await waitFor(() => expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument())
    expect(props.onCartRedirect).toHaveBeenCalledWith()
  })

  // redesign OC-F2 (OC-Q1-04): the focus does not fall to <body> when the cart that had it is deleted
  describe('after deleting a cart the focus moves to the list', () => {
    let page
    const deleteFrom = async (name, remaining) => {
      const deleteCart = vi.fn(async (cart) => {
        page.update({ list: list({ carts: remaining(cart), total: remaining(cart).length }) })
        return { ok: true, error: null }
      })
      page = renderPage({ deleteCart })
      await userEvent.click(screen.getByRole('button', { name }))
      await userEvent.click(screen.getByRole('button', { name: 'Delete this cart' }))
      await waitFor(() => expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument())
      return page
    }
    const focusedRow = () => document.activeElement?.closest?.('[data-row-id]')?.getAttribute('data-row-id')

    it('goes to the row that took its place', async () => {
      await deleteFrom('Open cart 90011', cart => carts.filter(item => item.id !== cart.id))
      await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-row-id="90007"]')))
    })

    it('goes to the row before it when it was the last one', async () => {
      await deleteFrom('Open cart 90007', cart => carts.filter(item => item.id !== cart.id))
      await waitFor(() => expect(focusedRow()).toBe('90011'))
      expect(document.activeElement).not.toBe(document.body)
    })

    it('goes to the table when the list is empty now', async () => {
      await deleteFrom('Open cart 90012', () => [])
      await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('queue-table')))
    })

    it('stays where it is when the delete fails', async () => {
      const deleteCart = vi.fn(() => Promise.resolve({ ok: false, error: ['Not allowed'] }))
      renderPage({ deleteCart })
      await userEvent.click(screen.getByRole('button', { name: 'Open cart 90011' }))
      await userEvent.click(screen.getByRole('button', { name: 'Delete this cart' }))
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })
      expect(screen.getByTestId('cart-panel')).toBeInTheDocument()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete this cart' }))
    })
  })

  it('closes once when the panel also calls onClose after an ok delete (the real panel does)', async () => {
    const { props } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    props.onCartRedirect.mockClear()
    const onClose = seen.panel.onClose
    await act(async () => {
      const answer = await seen.panel.onDelete(carts[0])
      if (answer.ok) onClose()
    })
    expect(screen.queryByTestId('cart-panel')).not.toBeInTheDocument()
    expect(props.onCartRedirect).toHaveBeenCalledTimes(1)
  })

  it('hands the answer of a failed delete back to the panel and keeps it open', async () => {
    const deleteCart = vi.fn(() => Promise.resolve({ ok: false, error: ['Not allowed'] }))
    renderPage({ deleteCart })
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    let answer
    await act(async () => { answer = await seen.panel.onDelete(seen.panel.cart) })
    expect(answer).toEqual({ ok: false, error: ['Not allowed'] })
    expect(screen.getByTestId('cart-panel')).toBeInTheDocument()
  })

  it('does not close a panel that now shows another cart when an earlier delete answers', async () => {
    let resolveDelete
    const deleteCart = vi.fn(() => new Promise(resolve => { resolveDelete = resolve }))
    renderPage({ deleteCart })
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    const pending = seen.panel.onDelete(carts[0])
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90011' }))
    await act(async () => { resolveDelete({ ok: true, error: null }); await pending })
    expect(screen.getByText('Panel of cart 90011')).toBeInTheDocument()
  })

  it('expands and collapses through the panel prop', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Open cart 90012' }))
    act(() => { seen.panel.onExpandedChange(true) })
    expect(seen.panel.expanded).toBe(true)
    expect(document.querySelector('.odc-split')).toHaveAttribute('data-expanded')
  })
})

describe('new carts in Live now', () => {
  const LIVE = { lastUpdatedAt: Date.now(), refreshing: false, refresh: vi.fn(), newIds: [] }
  const region = () => document.querySelector('[aria-live="polite"]')

  it('has a polite live region that is empty until something arrives', () => {
    renderPage({ view: 'live' })
    expect(region()).toBeInTheDocument()
    expect(region()).toBeEmptyDOMElement()
  })

  it('announces «New cart from _name_» once per refresh with new ids', () => {
    const { update } = renderPage({ view: 'live', live: LIVE })
    update({ live: { ...LIVE, newIds: [90012] } })
    expect(region()).toHaveTextContent('New cart from Customer90012 Ruiz')
    // a refresh with nothing new does not erase or repeat it
    update({ live: { ...LIVE, newIds: [] } })
    expect(region()).toHaveTextContent('New cart from Customer90012 Ruiz')
  })

  it('names a guest, and counts when several arrived in the same refresh', () => {
    const { update } = renderPage({ view: 'live', live: LIVE })
    update({ live: { ...LIVE, newIds: [90011] } })
    expect(region()).toHaveTextContent('New cart from a guest')
    update({ live: { ...LIVE, newIds: [90011, 90012] } })
    expect(region()).toHaveTextContent('2 new carts')
  })

  it('hands the new rows to the table for 2 seconds', () => {
    vi.useFakeTimers()
    const { update } = renderPage({ view: 'live', live: LIVE })
    expect(seen.table.highlightIds).toEqual([])
    update({ live: { ...LIVE, newIds: [90012] } })
    expect(seen.table.highlightIds).toEqual([90012])
    act(() => { vi.advanceTimersByTime(2000) })
    expect(seen.table.highlightIds).toEqual([])
  })
})
