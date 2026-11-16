/* eslint-disable import/first */
import React from 'react'
import moment from 'moment'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign home C1 (D1, D2, D5-D8, HM-01, HM-02, HM-05, HM-07, HM-08, HM-10, HM-12, HM-13, HM-17, HM-18, auditor 1, 4, 5, 8, 11, 13):
// the page composition. It keeps what U/HomePage.test.jsx pinned (controller wiring, «Menu», «See more reports», «Visit my Website»)
// and adds the new header, the figures of today, the trend and the Intercom call.
const runtime = vi.hoisted(() => ({
  chart: null,
  controller: null,
  emit: vi.fn(),
  collapse: vi.fn(),
  push: vi.fn(),
  parseDate: null,
  session: null,
  project: null,
  collapsed: true,
  configsLoading: false,
  configs: {}
}))

vi.mock('react-chartjs-2', () => ({
  Line: props => { runtime.chart = props; return <div data-testid='sales-chart' /> },
  Bar: () => <div data-testid='bar-chart' />
}))
vi.mock('react-hubspot-form', () => ({ default: () => <div data-testid='hubspot-form' /> }))
vi.mock('react-router-dom', () => ({ useHistory: () => ({ push: runtime.push }) }))
vi.mock('~/components/Utils', () => ({
  getIntercomHash: vi.fn(() => Promise.resolve('hash')),
  setIntercomSettings: vi.fn()
}))
vi.mock('../../../../../../index', () => ({
  Home: props => { runtime.controller = props; return <div data-testid='home-controller' /> },
  useApi: () => [{ project: 'fixture' }, { configurations: { subdomain: 'ordering.co' } }],
  useConfig: () => [{ configs: runtime.configs, loading: runtime.configsLoading }],
  useEvent: () => [{ emit: runtime.emit }],
  useLanguage: () => [{ language: { code: 'en' } }, (key, fallback) => fallback || key],
  useSession: () => [runtime.session],
  useSite: () => [{ sites: [{ id: 1 }] }],
  useUtils: () => [{
    parsePrice: value => `$${Number(value).toFixed(2)}`,
    parseNumber: (value, options) => Number(value).toFixed(options?.decimal ?? 2),
    parseDate: (...args) => runtime.parseDate(...args)
  }]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: runtime.collapsed }, { handleMenuCollapse: runtime.collapse }] }))
vi.mock('../../../../contexts/ProjectContext', () => ({ useProjectState: () => [runtime.project] }))
vi.mock('../../../../utils', () => ({ getCurrentDiffDays: () => 3 }))
vi.mock('../../../../utils/getPreferredSiteUrl', () => ({ getPreferredSiteUrl: () => 'https://tenant.example' }))
vi.mock('../../../TrialExtension', () => ({ TrialExtensionHomeCard: () => <div data-testid='trial-card' /> }))

import { getIntercomHash, setIntercomSettings } from '~/components/Utils'
import { setIntercomAccess } from '../../../../utils/assistantIntercom'
import { HomePage, HomePageUI } from '../HomePage'

const FRIDAY = '2026-10-02' // the day of `lastWeek`: a Friday

const baseToday = {
  loading: false,
  error: null,
  sales: 92.21,
  orders: 3,
  cancelled: 1,
  averageTicket: 30.74,
  lastWeek: {
    day: FRIDAY,
    byNow: { sales: 10, orders: 1 },
    fullDay: { sales: 35.23, orders: 2, cancelled: 0, averageTicket: 17.6 }
  }
}
const days = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`)
const baseTrend = {
  loading: false,
  error: null,
  days,
  current: days.map((_, index) => index),
  previous: days.map((_, index) => index + 1),
  total: 3412.8,
  previousTotal: 3000,
  change: 12.34,
  monthTotal: 904.32
}
const baseProps = () => ({
  today: baseToday,
  reloadToday: vi.fn(),
  trend: baseTrend,
  reloadTrend: vi.fn(),
  // n.º 13: the last 30 closed days (it crosses the month), in the `{ time, sales }` shape Intercom already holds
  last30SalesList: { loading: false, error: null, sales: [{ time: '2026-09-25 00:00:00', sales: 8 }, { time: '2026-10-01 00:00:00', sales: 12.5 }] },
  attention: { loading: false, error: null, counts: { pending: 4, late: 1, waitingDriver: 5, failedCarts: 8 } },
  reloadAttention: vi.fn(),
  attentionKeys: ['pending', 'late', 'waitingDriver', 'failedCarts'],
  guide: { loading: false, error: null, eligible: false, hidden: false, steps: [], doneCount: 0, requiredCount: 0 },
  hideGuide: vi.fn(),
  showGuide: vi.fn(),
  canOpen: () => true,
  disableSupportModule: true
})

const setProject = (project = {}, extra = {}) => {
  runtime.project = {
    loading: false,
    project: { id: 1, code: 'fixture', current_status: 'active', ...project },
    plan: {},
    planResolved: true,
    intercomAllowed: true,
    websiteProduct: 'web_marketplace_26',
    ...extra
  }
}

// parseDate as the project context paints it: a string is read as UTC unless `utc: false`, and then shown in local time
const fakeParseDate = (date, options = {}) => {
  const inputFormat = options.inputFormat || ['YYYY-MM-DD HH:mm:ss']
  const instant = (options.utc ?? true) ? moment.utc(date, inputFormat).local() : moment(date, inputFormat)
  return instant.format(options.omitYear ? 'D MMM' : 'D MMM YYYY')
}

beforeEach(() => {
  runtime.chart = null
  runtime.controller = null
  runtime.collapsed = true
  runtime.configsLoading = false
  runtime.configs = {}
  runtime.session = { token: 'token', user: { level: 0, name: 'Ada', email: 'ada@example.test', user_system_id: 9 } }
  runtime.parseDate = vi.fn(fakeParseDate)
  setProject()
  setIntercomAccess(true, 'home-fixture')
  vi.mocked(getIntercomHash).mockClear()
  vi.mocked(setIntercomSettings).mockClear()
  runtime.emit.mockClear()
  runtime.collapse.mockClear()
  runtime.push.mockClear()
})

afterEach(() => {
  setIntercomAccess(false)
  vi.useRealTimers()
  delete window.matchMedia
})

const renderPage = (overrides = {}) => render(<HomePageUI {...baseProps()} {...overrides} />)

describe('HomePage wiring', () => {
  it('hands the controller the UI, the attention keys the menu allows and the props of the page', () => {
    render(<HomePage marker='wired' disableSupportModule />)
    expect(runtime.controller).toMatchObject({ marker: 'wired', UIComponent: HomePageUI, disableSupportModule: true })
    expect(runtime.controller.attentionKeys).toEqual(['pending', 'late', 'waitingDriver', 'failedCarts'])
    expect(runtime.controller.sites).toEqual([{ id: 1 }])
    expect(runtime.controller.canOpen('/orders')).toBe(true)
    expect(runtime.controller.canOpen('/delivery/drivers-list?add=1')).toBe(true)
  })

  it('a business owner (level 2) gets neither deliveries nor failed carts', () => {
    runtime.session = { token: 'token', user: { level: 2, name: 'Bo', email: 'bo@example.test' } }
    render(<HomePage />)
    expect(runtime.controller.attentionKeys).toEqual(['pending', 'late'])
    expect(runtime.controller.canOpen('/cart-recovery/open-carts')).toBe(false)
    expect(runtime.controller.canOpen('/deliveries')).toBe(false)
    expect(runtime.controller.canOpen('/orders')).toBe(true)
  })
})

// redesign the guide asks `canOpen` for /stores/add, a route the menu does not list; the menu-only rule denied it for
// everybody and the primary action of a project with no stores fell to «Create a menu with products» (→ /stores/list)
describe('HomePage wiring: destinations outside the menu', () => {
  it('level 0 can open /stores/add (route guard levels), even though the menu does not list it', () => {
    render(<HomePage />)
    expect(runtime.controller.canOpen('/stores/add')).toBe(true)
    expect(runtime.controller.canOpen('/stores/add?x=1')).toBe(true)
  })

  it('level 2 opens /stores/add unless the project turned off the owners registering stores', () => {
    runtime.session = { token: 'token', user: { level: 2, name: 'Bo', email: 'bo@example.test' } }
    const { unmount } = render(<HomePage />)
    expect(runtime.controller.canOpen('/stores/add')).toBe(true)
    unmount()
    runtime.configs = { allow_business_owner_register_business: { value: '0' } }
    render(<HomePage />)
    expect(runtime.controller.canOpen('/stores/add')).toBe(false)
  })

  it('a level the route guard rejects (5) cannot open /stores/add', () => {
    runtime.session = { token: 'token', user: { level: 5, name: 'Dee', email: 'dee@example.test' } }
    render(<HomePage />)
    expect(runtime.controller.canOpen('/stores/add')).toBe(false)
  })

  it('a project with no stores gets «Start» on «Create your first store» with the real canOpen, as Shortcuts offers «Add new store»', () => {
    const { unmount } = render(<HomePage />)
    const { canOpen } = runtime.controller
    unmount()
    const steps = [
      { id: 'store', done: false, optional: false },
      { id: 'menu', done: false, optional: false },
      { id: 'zone', done: false, optional: false },
      { id: 'payment', done: false, optional: false },
      { id: 'first_order', done: false, optional: false }
    ]
    renderPage({ canOpen, guide: { loading: false, error: null, eligible: true, hidden: false, steps, doneCount: 0, requiredCount: 5 } })
    const primary = document.querySelectorAll('[data-slot="home-guide"] a[data-variant="primary"]')
    expect(primary).toHaveLength(1)
    expect(primary[0]).toHaveAttribute('aria-label', 'Start Create your first store')
    expect(primary[0]).toHaveAttribute('href', '/stores/add')
    expect(screen.getByRole('link', { name: 'Add new store' })).toHaveAttribute('href', '/stores/add')
  })

  it('a route that is in neither the menu nor the guard levels stays denied', () => {
    render(<HomePage />)
    expect(runtime.controller.canOpen('/not-a-route')).toBe(false)
  })

  it('a menu item the user cannot see stays denied even if the guard would let the level in', () => {
    runtime.session = { token: 'token', user: { level: 2, name: 'Bo', email: 'bo@example.test' } }
    render(<HomePage />)
    expect(runtime.controller.canOpen('/cart-recovery/open-carts')).toBe(false)
  })
})

describe('HomePageUI composition', () => {
  it('has one h1, the greeting, and the shell hooks (data-slot and classes)', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 15, 0, 0))
    renderPage()
    const root = document.querySelector('[data-slot="home-page"]')
    expect(root).toBeInTheDocument()
    expect(root).toHaveClass('od-ui', 'od-home-page')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good afternoon, Ada')
  })

  it.each([
    [9, 'Good morning, Ada'],
    [11, 'Good morning, Ada'],
    [12, 'Good afternoon, Ada'],
    [17, 'Good afternoon, Ada'],
    [18, 'Good evening, Ada'],
    [23, 'Good evening, Ada']
  ])('greets at %s:00 with «%s»', (hour, text) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, hour, 30, 0))
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(text)
  })

  it('without a name the h1 is the welcome line', () => {
    runtime.session = { token: 'token', user: { level: 0, email: 'a@example.test' } }
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to Ordering.co')
  })

  it('paints the blocks in the order of the sketch', () => {
    renderPage({ guide: { loading: false, error: null, eligible: true, hidden: false, doneCount: 1, requiredCount: 5, steps: [{ id: 'store', done: true }, { id: 'menu', done: false }] } })
    // redesign home C1 (D1, analysis §4): attention comes before the trend in the reading order (first screen on a phone); from 1280 the grid puts the trend on the start side
    // main no More services cards; support and onboarding (off in this fixture) are the only blocks after the shortcuts
    const order = ['home-header', 'home-guide', 'home-today', 'home-attention', 'home-trend', 'home-shortcuts']
    const nodes = order.map(slot => document.querySelector(`[data-slot="${slot}"]`))
    nodes.forEach((node, index) => expect(node, order[index]).toBeInTheDocument())
    nodes.slice(1).forEach((node, index) => {
      expect(nodes[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING, `${order[index]} before ${order[index + 1]}`).toBeTruthy()
    })
    expect(screen.getByTestId('trial-card')).toBeInTheDocument()
  })

  it('the trend and the attention card share a row; without attention keys the trend takes the row', () => {
    const { unmount } = renderPage()
    const row = document.querySelector('[data-slot="home-trend"]').parentElement
    expect(row).toContainElement(document.querySelector('[data-slot="home-attention"]'))
    expect(row).not.toHaveAttribute('data-solo')
    unmount()
    renderPage({ attentionKeys: [] })
    expect(document.querySelector('[data-slot="home-attention"]')).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="home-trend"]').parentElement).toHaveAttribute('data-solo')
  })

  it('navigates inside the dashboard with the router history', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('link', { name: /Orders waiting for acceptance/ }))
    expect(runtime.push).toHaveBeenCalledWith('/orders?status=pending')
  })

  it('the setup guide hides and comes back through the controller', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const steps = [{ id: 'store', done: false }, { id: 'menu', done: false }]
    const { unmount } = render(<HomePageUI {...props} guide={{ ...props.guide, eligible: true, steps, requiredCount: 5 }} />)
    await user.click(screen.getByRole('button', { name: 'Hide guide' }))
    expect(props.hideGuide).toHaveBeenCalledTimes(1)
    unmount()
    render(<HomePageUI {...props} guide={{ ...props.guide, eligible: true, hidden: true, steps }} />)
    await user.click(screen.getByRole('button', { name: 'Show setup guide' }))
    expect(props.showGuide).toHaveBeenCalledTimes(1)
  })

  // main: Home no longer offers More Services, to any level
  it('More Services is gone for level 0 and level 2', () => {
    const { unmount } = renderPage()
    expect(screen.queryByRole('heading', { name: 'More Services' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View source code' })).not.toBeInTheDocument()
    unmount()
    runtime.session = { token: 'token', user: { level: 2, name: 'Bo', email: 'bo@example.test' } }
    renderPage()
    expect(screen.queryByRole('heading', { name: 'More Services' })).not.toBeInTheDocument()
  })
})

describe('HomeHeader', () => {
  it('«Menu» opens the collapsed menu, and is absent when the menu is open', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(runtime.collapse).toHaveBeenCalledWith(false)
    unmount()
    runtime.collapsed = false
    renderPage()
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
  })

  it('shows today with parseDate, never an ISO date, and the active badge', () => {
    renderPage()
    expect(runtime.parseDate).toHaveBeenCalledWith(expect.any(Date), { dateOnly: true })
    const header = document.querySelector('[data-slot="home-header"]')
    expect(within(header).getByText(/^\d{1,2} \w{3} \d{4}$/)).toBeInTheDocument()
    expect(header.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(within(header).getByText('Project Active')).toBeInTheDocument()
  })

  it('«Visit my Website» opens the preferred site, never for level 2 and never without a status', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const first = renderPage()
    await user.click(screen.getByRole('button', { name: 'Visit my website' }))
    expect(open).toHaveBeenCalledWith('https://tenant.example', '_blank', 'noopener,noreferrer')
    first.unmount()

    runtime.session = { token: 'token', user: { level: 2, name: 'Bo', email: 'bo@example.test' } }
    const second = renderPage()
    expect(screen.queryByRole('button', { name: 'Visit my website' })).not.toBeInTheDocument()
    second.unmount()

    runtime.session = { token: 'token', user: { level: 0, name: 'Ada', email: 'ada@example.test' } }
    setProject({ current_status: undefined })
    renderPage()
    expect(screen.queryByRole('button', { name: 'Visit my website' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="home-header"] .odc-badge')).not.toBeInTheDocument()
    open.mockRestore()
  })

  it('«Visit my Website» is disabled without a website product', () => {
    setProject({}, { websiteProduct: undefined })
    renderPage()
    expect(screen.getByRole('button', { name: 'Visit my website' })).toBeDisabled()
  })

  it('past due: the short badge and the notice of main with the days filled in', () => {
    setProject({ current_status: 'past_due', current_status_until: '2026-10-12 00:00:00' })
    renderPage()
    const header = document.querySelector('[data-slot="home-header"]')
    expect(within(header).getByText('Payment past due')).toBeInTheDocument()
    expect(within(header).queryByText('Project Past Due Payment')).not.toBeInTheDocument()
    const notice = within(header).getByRole('status')
    expect(notice).toHaveTextContent('Your account will be suspended in the next 3 days due to your billing status, please check it to avoid any issues.')
  })

  it('past due without a date keeps the text as it is', () => {
    setProject({ current_status: 'past_due' })
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('in the next _days_ days')
  })

  it('an active project has no notice', () => {
    renderPage()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('while the project status loads it shows a skeleton in place of the badge and no website button', () => {
    runtime.project = { loading: true, project: {}, plan: {} }
    renderPage()
    const header = document.querySelector('[data-slot="home-header"]')
    expect(header.querySelector('.odc-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Visit my website' })).not.toBeInTheDocument()
  })
})

describe('TodaySummary', () => {
  const card = key => document.querySelector(`[data-card="${key}"]`)

  it('paints the four figures with the same weekday last week as reference', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Today' })).toBeInTheDocument()
    const sales = within(card('sales'))
    expect(sales.getByText('Sales today')).toBeInTheDocument()
    expect(sales.getByText('$92.21')).toBeInTheDocument()
    expect(sales.getByText(/Friday last week, by now/)).toHaveTextContent('$10.00')
    expect(sales.getByText(/Full day/)).toHaveTextContent('$35.23')

    const orders = within(card('orders'))
    expect(orders.getByText('Orders today')).toBeInTheDocument()
    expect(orders.getByText('3')).toBeInTheDocument()
    expect(orders.getByText(/Friday last week, by now/)).toHaveTextContent('1')
    expect(orders.getByText(/Full day/)).toHaveTextContent('2')

    const ticket = within(card('ticket'))
    expect(ticket.getByText('Average ticket today')).toBeInTheDocument()
    expect(ticket.getByText('$30.74')).toBeInTheDocument()
    expect(ticket.getByText(/Friday last week, full day/)).toHaveTextContent('$17.60')
    expect(ticket.queryByText(/by now/)).not.toBeInTheDocument()

    const cancelled = within(card('cancelled'))
    expect(cancelled.getByText('Cancelled today')).toBeInTheDocument()
    expect(cancelled.getByText('1')).toBeInTheDocument()
    expect(cancelled.getByText(/Friday last week, full day/)).toHaveTextContent('0')
  })

  // (tanda AK, AK-282): «by now» has no breakdown by status, so orders and ticket keep the cancelled orders and say it
  it('orders and the average ticket say they include cancelled orders; sales and cancelled do not', () => {
    renderPage()
    expect(within(card('orders')).getByText('Includes cancelled orders')).toBeInTheDocument()
    expect(within(card('ticket')).getByText('Includes cancelled orders')).toBeInTheDocument()
    expect(within(card('sales')).queryByText(/cancelled orders/)).not.toBeInTheDocument()
    expect(within(card('cancelled')).queryByText(/cancelled orders/)).not.toBeInTheDocument()
  })

  // each figure says the base the API answered it in
  it('with the mark of the API, sales, orders and the average ticket say they exclude cancelled orders', () => {
    renderPage({ today: { ...baseToday, excludesCancelled: { sales: true, orders: true } } })
    ;['sales', 'orders', 'ticket'].forEach(key => {
      expect(within(card(key)).getByText('Excludes cancelled orders')).toBeInTheDocument()
      expect(within(card(key)).queryByText('Includes cancelled orders')).not.toBeInTheDocument()
    })
    expect(within(card('cancelled')).queryByText(/cancelled orders/)).not.toBeInTheDocument()
  })

  it('mixed answers: each card tells its own base, the ticket says none and its dash is not «No orders yet», a reference across bases is a dash', () => {
    renderPage({
      today: {
        ...baseToday,
        excludesCancelled: { sales: true, orders: false },
        averageTicket: null,
        lastWeek: { ...baseToday.lastWeek, byNow: { ...baseToday.lastWeek.byNow, sales: null }, fullDay: { ...baseToday.lastWeek.fullDay, sales: null, averageTicket: null } }
      }
    })
    expect(within(card('sales')).getByText('Excludes cancelled orders')).toBeInTheDocument()
    expect(within(card('orders')).getByText('Includes cancelled orders')).toBeInTheDocument()
    expect(within(card('ticket')).queryByText(/cancelled orders/)).not.toBeInTheDocument()
    expect(within(card('ticket')).queryByRole('img', { name: 'No orders yet' })).not.toBeInTheDocument()
    expect(within(card('sales')).getByText(/last week, by now/)).toHaveTextContent('—')
    expect(within(card('sales')).queryByText(/\$0\.00/)).not.toBeInTheDocument()
  })

  it('every figure sits in an isolated .odc-figure node and no percentage is painted (D2)', () => {
    renderPage()
    const today = document.querySelector('[data-slot="home-today"]')
    const figures = today.querySelectorAll('.odc-figure')
    expect(figures.length).toBeGreaterThanOrEqual(10)
    figures.forEach(figure => expect(figure.querySelector('bdi'), figure.textContent).toBeInTheDocument())
    expect(today.textContent).not.toMatch(/%/)
  })

  it('a day with no orders shows a dash named «No orders yet» in the average ticket', () => {
    renderPage({ today: { ...baseToday, orders: 0, sales: 0, averageTicket: null } })
    const ticket = within(card('ticket'))
    expect(ticket.getByLabelText('No orders yet')).toHaveTextContent('—')
    expect(ticket.queryByText('$0.00')).not.toBeInTheDocument()
  })

  it('names the weekday with Intl in the language of the user', () => {
    renderPage({ today: { ...baseToday, lastWeek: { ...baseToday.lastWeek, day: '2026-10-04' } } })
    expect(within(card('sales')).getByText(/Sunday last week, by now/)).toBeInTheDocument()
  })

  it('loading keeps the four cards in place with skeletons', () => {
    renderPage({ today: { ...baseToday, loading: true } })
    expect(document.querySelectorAll('[data-slot="home-today"] [data-card]')).toHaveLength(4)
    expect(document.querySelector('[data-slot="home-today"]')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelectorAll('[data-slot="home-today"] .odc-skeleton').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByText('$92.21')).not.toBeInTheDocument()
  })

  it('an error is one line with «Try again» that reloads today only', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<HomePageUI {...props} today={{ ...baseToday, error: 'boom' }} />)
    const today = within(document.querySelector('[data-slot="home-today"]'))
    expect(today.getByRole('alert')).toHaveTextContent("Today's figures could not be loaded.")
    await user.click(today.getByRole('button', { name: 'Try again' }))
    expect(props.reloadToday).toHaveBeenCalledTimes(1)
    expect(props.reloadTrend).not.toHaveBeenCalled()
    expect(document.querySelector('[data-card]')).not.toBeInTheDocument()
    // the other blocks stay
    expect(document.querySelector('[data-slot="home-trend"]')).toBeInTheDocument()
  })
})

describe('SalesTrend', () => {
  const trend = () => within(document.querySelector('[data-slot="home-trend"]'))

  it('titles the card and keeps «See more reports» for every level', async () => {
    const user = userEvent.setup()
    runtime.session = { token: 'token', user: { level: 2, name: 'Bo', email: 'bo@example.test' } }
    renderPage()
    expect(trend().getByRole('heading', { level: 2, name: 'Sales, last 30 days' })).toBeInTheDocument()
    const link = trend().getByRole('link', { name: 'See more reports' })
    expect(link).toHaveAttribute('href', '/intelligence/business')
    await user.click(link)
    expect(runtime.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_analytics' })
  })

  it('a modified click is left to the browser', async () => {
    const user = userEvent.setup()
    renderPage()
    // jsdom cannot navigate: the browser's own handling is what the page must leave alone
    const browserDefault = vi.fn(event => event.preventDefault())
    document.addEventListener('click', browserDefault)
    await user.keyboard('{Control>}')
    await user.click(trend().getByRole('link', { name: 'See more reports' }))
    await user.keyboard('{/Control}')
    document.removeEventListener('click', browserDefault)
    expect(runtime.emit).not.toHaveBeenCalled()
  })

  it('paints the total, the signed change as text, and this month', () => {
    renderPage()
    expect(trend().getByText('$3412.80')).toBeInTheDocument()
    expect(trend().getByText('30 days to yesterday')).toBeInTheDocument()
    const change = trend().getByText('+12.3%')
    expect(change.closest('.odc-figure')).toBeInTheDocument()
    expect(change.closest('p')).toHaveTextContent('vs previous 30 days')
    expect(trend().getByText('This month sales')).toBeInTheDocument()
    expect(trend().getByText('$904.32')).toBeInTheDocument()
  })

  it('a drop carries its own sign, and no change is hidden', () => {
    const { unmount } = renderPage({ trend: { ...baseTrend, change: -4.5 } })
    expect(trend().getByText('−4.5%')).toBeInTheDocument()
    unmount()
    renderPage({ trend: { ...baseTrend, change: null, monthTotal: null } })
    expect(trend().queryByText(/vs previous 30 days/)).not.toBeInTheDocument()
    const month = trend().getByText('This month sales').parentElement
    expect(month).toHaveTextContent('—')
  })

  it('gives the chart readable labels, two series and the comparison as dashed', () => {
    renderPage()
    expect(runtime.chart).not.toBeNull()
    const { labels, datasets } = runtime.chart.data
    expect(labels).toHaveLength(30)
    labels.forEach(label => expect(label).not.toMatch(/\d{4}-\d{2}-\d{2}/))
    expect(labels[0]).toBe('1 Sep')
    expect(labels[29]).toBe('30 Sep')
    expect(datasets).toHaveLength(2)
    expect(datasets[0]).toMatchObject({ label: 'Sales', data: baseTrend.current })
    expect(datasets[1]).toMatchObject({ label: 'Previous 30 days', data: baseTrend.previous, borderDash: [4, 4] })
    expect(runtime.chart['aria-label']).toBe('Sales, last 30 days')
  })

  it('reads the local days as local (a day «2026-09-05» is the 5th in any time zone)', () => {
    renderPage()
    expect(runtime.parseDate).toHaveBeenCalledWith('2026-09-05', expect.objectContaining({ dateOnly: true, omitYear: true, utc: false }))
  })

  it('has the table alternative with the caption and the date header', () => {
    renderPage()
    const figure = document.querySelector('[data-slot="home-trend"] figure.odc-chart')
    const table = within(figure).getByRole('table', { hidden: true })
    expect(within(table).getByText('Sales, last 30 days')).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Date', hidden: true })).toBeInTheDocument()
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(31)
  })

  it('uses the compact chart on a phone and the default one otherwise', () => {
    const { unmount } = renderPage()
    expect(document.querySelector('figure.odc-chart')).toHaveAttribute('data-size', 'default')
    unmount()
    window.matchMedia = query => ({ matches: query === '(max-width: 767px)', addEventListener: () => {}, removeEventListener: () => {} })
    renderPage()
    expect(document.querySelector('figure.odc-chart')).toHaveAttribute('data-size', 'compact')
  })

  it('loading is a skeleton of the chart height, not the chart', () => {
    renderPage({ trend: { ...baseTrend, loading: true, change: null, monthTotal: null } })
    expect(screen.queryByTestId('sales-chart')).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="home-trend"]')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelectorAll('[data-slot="home-trend"] .odc-skeleton').length).toBeGreaterThan(0)
  })

  it('an error is a block-level alert with «Try again» that reloads the trend only', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<HomePageUI {...props} trend={{ ...baseTrend, error: 'boom' }} />)
    expect(trend().getByRole('alert')).toHaveTextContent('Sales could not be loaded.')
    await user.click(trend().getByRole('button', { name: 'Try again' }))
    expect(props.reloadTrend).toHaveBeenCalledTimes(1)
    expect(props.reloadToday).not.toHaveBeenCalled()
    expect(screen.queryByTestId('sales-chart')).not.toBeInTheDocument()
    expect(trend().getByRole('link', { name: 'See more reports' })).toBeInTheDocument()
  })
})

describe('Intercom (HM-10, HM-17, auditor 5)', () => {
  // main (#472): the project's /current/support answer (intercomAllowed) and a blocked workspace gate the support
  // identity; a stale hash is dropped
  it('never asks for a hash when the project does not allow Intercom (plan 581), even with access allowed', async () => {
    setProject({}, { plan: { id: '581' }, intercomAllowed: false })
    render(<HomePageUI {...baseProps()} />)
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
    expect(setIntercomSettings).not.toHaveBeenCalled()
  })

  it('waits until the project allows Intercom and the workspace does too', async () => {
    setProject({}, { intercomAllowed: undefined })
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} />)
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
    setIntercomAccess(false)
    setProject()
    rerender(<HomePageUI {...props} />)
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
    setIntercomAccess(true, 'home-fixture')
    setProject()
    rerender(<HomePageUI {...props} />)
    await waitFor(() => expect(setIntercomSettings).toHaveBeenCalledTimes(1))
  })

  it('drops the hash of a project that changed before it arrived and sends the new one', async () => {
    let resolveOld
    vi.mocked(getIntercomHash).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} />)
    setProject({ id: 2, code: 'beta' }, { plan: { id: 101 } })
    vi.mocked(getIntercomHash).mockImplementationOnce(() => Promise.resolve('new-hash'))
    rerender(<HomePageUI {...props} />)
    await act(async () => {})
    await act(async () => resolveOld('stale-hash'))
    expect(setIntercomSettings).toHaveBeenCalledTimes(1)
    expect(vi.mocked(setIntercomSettings).mock.calls[0][0]).toMatchObject({ user_hash: 'new-hash', project_plan: 101, company: { id: 2, name: 'beta' } })
  })

  it('drops a hash that arrives after Home unmounted', async () => {
    let resolveOld
    vi.mocked(getIntercomHash).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const { unmount } = render(<HomePageUI {...baseProps()} />)
    unmount()
    await act(async () => resolveOld('stale-hash'))
    expect(setIntercomSettings).not.toHaveBeenCalled()
  })

  it('is sent once, with the last 30 days series as project_sales_last_30_days and the status date as it is', async () => {
    setProject({ current_status_until: '2026-10-12 00:00:00', code: 'acme' })
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} />)
    await waitFor(() => expect(setIntercomSettings).toHaveBeenCalledTimes(1))
    expect(getIntercomHash).toHaveBeenCalledTimes(1)
    const [values] = vi.mocked(setIntercomSettings).mock.calls[0]
    expect(values).toMatchObject({
      project_code: 'acme',
      project_owner_id: 9,
      project_current_status: 'active',
      project_current_status_until: undefined, // HM-17: the field of `main` (project_current_status_until), not current_status_until
      project_sales_last_30_days: props.last30SalesList.sales,
      user_hash: 'hash'
    })
    rerender(<HomePageUI {...props} today={{ ...baseToday, sales: 100 }} last30SalesList={{ ...props.last30SalesList }} />)
    rerender(<HomePageUI {...props} trend={{ ...baseTrend, total: 1 }} />)
    // «Try again» on the trend reloads the series: loading goes up and down again, and Intercom is not told twice
    rerender(<HomePageUI {...props} last30SalesList={{ loading: true, error: null, sales: [] }} />)
    rerender(<HomePageUI {...props} last30SalesList={{ loading: false, error: null, sales: [{ time: '2026-10-02 00:00:00', sales: 5 }] }} />)
    await act(async () => {})
    expect(setIntercomSettings).toHaveBeenCalledTimes(1)
  })

  it('waits for the last 30 days, the configs and the project status', async () => {
    const props = baseProps()
    runtime.configsLoading = true
    const { rerender } = render(<HomePageUI {...props} last30SalesList={{ loading: true, error: null, sales: [] }} />)
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
    runtime.configsLoading = false
    rerender(<HomePageUI {...props} last30SalesList={{ loading: true, error: null, sales: [] }} />)
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
    rerender(<HomePageUI {...props} />)
    await waitFor(() => expect(setIntercomSettings).toHaveBeenCalledTimes(1))
  })

  // redesign home R1 (Q-10, PA-1): as in `main`, a failed report tells Intercom nothing («no sales» is a claim about the project);
  // a retry that succeeds sends it, once
  it('a last 30 days report that failed sends nothing, and the retry that succeeds sends once', async () => {
    const props = baseProps()
    const failed = { loading: false, error: 'boom', sales: [] }
    const { rerender } = render(<HomePageUI {...props} last30SalesList={failed} />)
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
    expect(setIntercomSettings).not.toHaveBeenCalled()
    rerender(<HomePageUI {...props} last30SalesList={{ loading: true, error: null, sales: [] }} />)
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
    const sales = [{ time: '2026-10-02 00:00:00', sales: 5 }]
    rerender(<HomePageUI {...props} last30SalesList={{ loading: false, error: null, sales }} />)
    await waitFor(() => expect(setIntercomSettings).toHaveBeenCalledTimes(1))
    expect(vi.mocked(setIntercomSettings).mock.calls[0][0].project_sales_last_30_days).toEqual(sales)
    // the error that follows a sent report does not send again, and neither does a new success
    rerender(<HomePageUI {...props} last30SalesList={failed} />)
    rerender(<HomePageUI {...props} last30SalesList={{ loading: false, error: null, sales }} />)
    await act(async () => {})
    expect(setIntercomSettings).toHaveBeenCalledTimes(1)
  })

  it('a last 30 days report that failed while the configs or the project status load still waits for them after the retry', async () => {
    runtime.project = { loading: true, project: {}, plan: {} }
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} last30SalesList={{ loading: false, error: 'boom', sales: [] }} />)
    rerender(<HomePageUI {...props} last30SalesList={{ loading: false, error: null, sales: [] }} />)
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
  })

  it('does not report while the project status loads', async () => {
    runtime.project = { loading: true, project: {}, plan: {} }
    renderPage()
    await act(async () => {})
    expect(getIntercomHash).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────
// redesign home R1 (F2): the page, the header, today and the trend after the review of round 1
// ─────────────────────────────────────────────────────────────────────────────────────────────
const cssOf = name => readFileSync(path.join(__dirname, '..', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const metricCss = readFileSync(path.join(__dirname, '..', '..', '..', 'Shared', 'Product', 'metric.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') // redesign bi FA0 (promoción, auditor 10)
const ruleOf = (css, selector) => {
  const escaped = selector.replace(/[.[\]'=\-()>:*]/g, '\\$&')
  return css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^{}]*)\\}`))?.[1]
}
const classesOf = node => Array.from(node.children).map(child => child.className)

// redesign bi FA0 (promoción, auditor 10): the Today cards are P/Metric now, so the class names are .odc-metric-*
describe('Q-01 · the skeletons take the box of what they replace', () => {
  const todayCards = () => Array.from(document.querySelectorAll('[data-slot="home-today"] [data-card]'))

  it('Today: each loading card has the same container classes as the loaded card, texts replaced by skeletons', () => {
    const loaded = renderPage()
    const expected = todayCards().map(classesOf)
    loaded.unmount()
    renderPage({ today: { ...baseToday, loading: true } })
    const cards = todayCards()
    expect(cards).toHaveLength(4)
    expect(cards.map(classesOf)).toEqual(expected)
    // one wrapper less: no separate skeleton container between the card and its lines
    expect(document.querySelector('.odc-today-skeleton')).not.toBeInTheDocument()
    // the figure line and every reference line hold a skeleton (and no text)
    cards.forEach(card => {
      expect(card.querySelector('.odc-metric-value .odc-skeleton')).toBeInTheDocument()
      const refs = card.querySelectorAll('.odc-metric-ref')
      expect(refs.length).toBeGreaterThan(0)
      refs.forEach(ref => {
        expect(ref.querySelector('.odc-skeleton')).toBeInTheDocument()
        expect(ref.textContent).toBe('')
      })
    })
  })

  it('Today: the skeleton lines are the height of the real lines (display size by title leading, caption by UI leading)', () => {
    renderPage({ today: { ...baseToday, loading: true } })
    const value = document.querySelector('[data-card="sales"] .odc-metric-value .odc-skeleton').getAttribute('style')
    expect(value).toContain('var(--od-x-type-display-size)')
    expect(value).toContain('var(--od-x-leading-title)')
    const ref = document.querySelector('[data-card="sales"] .odc-metric-ref .odc-skeleton').getAttribute('style')
    expect(ref).toContain('var(--od-x-type-caption-size)')
    expect(ref).toContain('var(--od-x-leading-ui)')
  })

  it('Today: the lines that wrap on a phone are reserved at two lines (the first reference of each card), by CSS', () => {
    renderPage({ today: { ...baseToday, loading: true } })
    const leads = document.querySelectorAll('[data-slot="home-today"] .odc-metric-ref[data-lead]')
    expect(leads).toHaveLength(4)
    expect(document.querySelectorAll('[data-slot="home-today"] .odc-metric-ref')).toHaveLength(8) // orders and ticket add «Includes cancelled orders»
    const phone = metricCss.split('@media (max-width: 767px)')[1] // redesign bi FA0 (promoción, auditor 10): the rule moved to metric.css
    expect(phone).toMatch(/\.odc-metric-ref\[data-lead\]\s*\{[^}]*min-block-size:\s*calc\(var\(--od-x-type-caption-size\)\s*\*\s*var\(--od-x-leading-ui\)\s*\*\s*2\)/)
    // the loaded card paints no marker
    expect(document.querySelector('[data-slot="home-today"]')).toHaveAttribute('aria-busy', 'true')
  })

  it('the trend: the figures row (two figures, three captions), the chart box and the legend row, on the classes of the loaded block', () => {
    const loaded = renderPage()
    const trendOf = () => document.querySelector('[data-slot="home-trend"]')
    const expectedSection = classesOf(trendOf())
    const expectedFigures = classesOf(trendOf().querySelector('.odc-trend-figures'))
    const expectedFirstFigure = classesOf(trendOf().querySelectorAll('.odc-trend-figure')[0])
    // the visually hidden table of the chart takes no room (out of flow): only the boxes that do are compared
    const expectedChart = classesOf(trendOf().querySelector('figure.odc-chart')).filter(name => name !== 'odc-sr-only')
    loaded.unmount()

    renderPage({ trend: { ...baseTrend, loading: true, change: null, monthTotal: null } })
    expect(classesOf(trendOf())).toEqual(expectedSection)
    expect(classesOf(trendOf().querySelector('.odc-trend-figures'))).toEqual(expectedFigures)
    expect(classesOf(trendOf().querySelectorAll('.odc-trend-figure')[0])).toEqual(expectedFirstFigure)
    expect(trendOf().querySelectorAll('.odc-trend-figure')).toHaveLength(2)
    expect(trendOf().querySelectorAll('.odc-trend-caption')).toHaveLength(3)
    const chart = trendOf().querySelector('figure.odc-chart')
    expect(chart).toHaveAttribute('data-size', 'default')
    expect(classesOf(chart)).toEqual(expectedChart)
    expect(chart.querySelector('.odc-chart-plot .odc-skeleton')).toBeInTheDocument()
    expect(chart.querySelectorAll('.odc-chart-legend .odc-chart-legend-item')).toHaveLength(2)
    expect(trendOf().querySelector('.odc-trend-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sales-chart')).not.toBeInTheDocument()
  })

  it('the trend: the loading chart box takes the compact size on a phone, as the chart does', () => {
    window.matchMedia = query => ({ matches: query === '(max-width: 767px)', addEventListener: () => {}, removeEventListener: () => {} })
    renderPage({ trend: { ...baseTrend, loading: true } })
    expect(document.querySelector('[data-slot="home-trend"] figure.odc-chart')).toHaveAttribute('data-size', 'compact')
  })

  it('the trend: the skeleton is hidden from assistive tech and the block says it is busy', () => {
    renderPage({ trend: { ...baseTrend, loading: true } })
    const trend = document.querySelector('[data-slot="home-trend"]')
    expect(trend).toHaveAttribute('aria-busy', 'true')
    const ghosts = trend.querySelectorAll('.odc-skeleton')
    expect(ghosts.length).toBeGreaterThanOrEqual(7)
    ghosts.forEach(ghost => expect(ghost).toHaveAttribute('aria-hidden', 'true'))
    expect(within(trend).queryByText('$3412.80')).not.toBeInTheDocument()
  })
})

describe('Q-02 · the header reserves the row of the action', () => {
  const header = () => document.querySelector('[data-slot="home-header"]')

  it('while the project status loads (level other than 2) a skeleton holds the place of «Visit my Website», sized by the button itself', () => {
    runtime.project = { loading: true, project: {}, plan: {} }
    renderPage()
    const action = header().querySelector('.odc-home-header-action')
    expect(action).toBeInTheDocument()
    expect(action.querySelector('.odc-skeleton')).toBeInTheDocument()
    // the real button, hidden, gives the width and height in any language
    const sizer = action.querySelector('.odc-btn')
    expect(sizer).toHaveAttribute('aria-hidden', 'true')
    expect(sizer).toHaveTextContent('Visit my website')
    expect(sizer).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Visit my website' })).not.toBeInTheDocument()
  })

  it('a business owner (level 2) never gets the row, loading or not', () => {
    runtime.session = { token: 'token', user: { level: 2, name: 'Bo', email: 'bo@example.test' } }
    runtime.project = { loading: true, project: {}, plan: {} }
    const first = renderPage()
    expect(header().querySelector('.odc-home-header-action')).not.toBeInTheDocument()
    first.unmount()
    setProject()
    renderPage()
    expect(header().querySelector('.odc-home-header-action')).not.toBeInTheDocument()
  })

  it('once loaded the skeleton is gone and the real button takes the same row', () => {
    runtime.project = { loading: true, project: {}, plan: {} }
    const { rerender } = renderPage()
    setProject()
    rerender(<HomePageUI {...baseProps()} />)
    const action = header().querySelectorAll('.odc-home-header-action')
    expect(action).toHaveLength(1)
    expect(action[0].querySelector('.odc-skeleton')).not.toBeInTheDocument()
    expect(within(action[0]).getByRole('button', { name: 'Visit my website' })).toBeEnabled()
  })

  it('the hidden sizer cannot be focused or announced (aria-hidden and the CSS hides it)', () => {
    const rule = ruleOf(cssOf('home.css'), '.odc-home-header-action[data-loading] > .odc-btn')
    expect(rule).toMatch(/visibility:\s*hidden/)
  })
})

describe('Q-12 · the «Menu» button keeps its size and the title gives', () => {
  it('«Menu» does not shrink in the lead row and the h1 can break its line', () => {
    const css = cssOf('home.css')
    expect(ruleOf(css, '.odc-home-header-lead .odc-btn')).toMatch(/flex:\s*none/)
    expect(ruleOf(css, '.odc-home-title')).toMatch(/min-inline-size:\s*0/)
    expect(ruleOf(css, '.odc-home-title')).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('Q-11 · no badge without a label', () => {
  it('a status that is neither active nor past due paints no badge (a dot without text is worse than nothing)', () => {
    setProject({ current_status: 'canceled' })
    renderPage()
    expect(document.querySelector('[data-slot="home-header"] .odc-badge')).not.toBeInTheDocument()
  })

  it('active and past due keep their badge', () => {
    const first = renderPage()
    expect(document.querySelector('[data-slot="home-header"] .odc-badge')).toBeInTheDocument()
    first.unmount()
    setProject({ current_status: 'past_due' })
    renderPage()
    expect(document.querySelector('[data-slot="home-header"] .odc-badge')).toBeInTheDocument()
  })
})

describe('Q-04 · the focus does not fall to the body', () => {
  const todayHeading = () => screen.getByRole('heading', { level: 2, name: 'Today' })
  const trendHeading = () => screen.getByRole('heading', { level: 2, name: 'Sales, last 30 days' })
  const attentionHeading = () => screen.getByRole('heading', { level: 2, name: 'Needs attention' })
  const guideSteps = [{ id: 'store', done: false }, { id: 'menu', done: false }]
  const guideOf = (extra = {}) => ({ loading: false, error: null, eligible: true, hidden: false, expected: true, steps: guideSteps, doneCount: 0, requiredCount: 5, ...extra })

  it('the headings can take focus without joining the tab order (tabindex -1)', () => {
    renderPage()
    expect(todayHeading()).toHaveAttribute('tabindex', '-1')
    expect(trendHeading()).toHaveAttribute('tabindex', '-1')
  })

  it('«Try again» of today: when it finishes loading, the focus goes to its heading', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} today={{ ...baseToday, error: 'boom' }} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadToday).toHaveBeenCalledTimes(1)
    rerender(<HomePageUI {...props} today={{ ...baseToday, loading: true }} />)
    expect(todayHeading()).not.toHaveFocus() // not while it loads
    rerender(<HomePageUI {...props} today={baseToday} />)
    expect(todayHeading()).toHaveFocus()
  })

  it('«Try again» of the trend: the focus goes to its heading when it loads', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} trend={{ ...baseTrend, error: 'boom' }} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadTrend).toHaveBeenCalledTimes(1)
    rerender(<HomePageUI {...props} trend={{ ...baseTrend, loading: true }} />)
    rerender(<HomePageUI {...props} trend={baseTrend} />)
    expect(trendHeading()).toHaveFocus()
  })

  it('«Try again» of attention: the focus goes to its heading when it loads', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} attention={{ loading: false, error: 'boom', counts: {} }} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadAttention).toHaveBeenCalledTimes(1)
    rerender(<HomePageUI {...props} attention={{ loading: true, error: null, counts: {} }} />)
    rerender(<HomePageUI {...props} />)
    expect(attentionHeading()).toHaveFocus()
  })

  it('«Hide guide»: the focus goes to the button «Show setup guide»', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} guide={guideOf()} />)
    await user.click(screen.getByRole('button', { name: 'Hide guide' }))
    expect(props.hideGuide).toHaveBeenCalledTimes(1)
    rerender(<HomePageUI {...props} guide={guideOf({ hidden: true })} />)
    expect(screen.getByRole('button', { name: 'Show setup guide' })).toHaveFocus()
  })

  it('«Show setup guide»: the focus goes to the title of the guide', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} guide={guideOf({ hidden: true })} />)
    await user.click(screen.getByRole('button', { name: 'Show setup guide' }))
    expect(props.showGuide).toHaveBeenCalledTimes(1)
    rerender(<HomePageUI {...props} guide={guideOf()} />)
    const title = screen.getByRole('heading', { level: 2, name: 'Set up your marketplace' })
    expect(title).toHaveFocus()
    expect(title).toHaveAttribute('tabindex', '-1')
  })

  it('nothing steals the focus when no retry was asked: a block that loads on its own leaves the focus where it was', () => {
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} today={{ ...baseToday, loading: true }} trend={{ ...baseTrend, loading: true }} />)
    screen.getByRole('link', { name: 'See more reports' }).focus()
    rerender(<HomePageUI {...props} />)
    expect(screen.getByRole('link', { name: 'See more reports' })).toHaveFocus()
  })

  it('one retry moves the focus once: the next load does not pull it back', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    const { rerender } = render(<HomePageUI {...props} today={{ ...baseToday, error: 'boom' }} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    rerender(<HomePageUI {...props} today={{ ...baseToday, loading: true }} />)
    rerender(<HomePageUI {...props} today={baseToday} />)
    expect(todayHeading()).toHaveFocus()
    screen.getByRole('link', { name: 'See more reports' }).focus()
    rerender(<HomePageUI {...props} today={{ ...baseToday, loading: true }} />)
    rerender(<HomePageUI {...props} today={baseToday} />)
    expect(screen.getByRole('link', { name: 'See more reports' })).toHaveFocus()
  })
})

describe('Q-03 · the guide is reserved from the first paint when it is expected', () => {
  it('expected: the guide (its skeleton) is painted while today and the trend still load', () => {
    renderPage({
      today: { ...baseToday, loading: true },
      trend: { ...baseTrend, loading: true },
      guide: { loading: false, error: null, eligible: false, expected: true, hidden: false, steps: [], doneCount: 0, requiredCount: 0 }
    })
    const guide = document.querySelector('[data-slot="home-guide"]')
    expect(guide).toBeInTheDocument()
    expect(guide).toHaveAttribute('aria-busy', 'true')
    // above today, as in the sketch
    expect(guide.compareDocumentPosition(document.querySelector('[data-slot="home-today"]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('not expected and not eligible: nothing is reserved', () => {
    renderPage({
      today: { ...baseToday, loading: true },
      trend: { ...baseTrend, loading: true },
      guide: { loading: false, error: null, eligible: false, expected: false, hidden: false, steps: [], doneCount: 0, requiredCount: 0 }
    })
    expect(document.querySelector('[data-slot="home-guide"]')).not.toBeInTheDocument()
  })
})

describe('Q-08 · the trend gives the previous period its own days', () => {
  const tableOf = () => document.querySelector('[data-slot="home-trend"] figure.odc-chart table[id]')

  it('the days of the previous series are the current days shifted 30 days back, formatted like the current ones', () => {
    renderPage()
    // 2026-09-01 − 30 days = 2026-08-02 ; 2026-09-30 − 30 days = 2026-08-31
    expect(runtime.parseDate).toHaveBeenCalledWith('2026-08-02', expect.objectContaining({ dateOnly: true, omitYear: true, inputFormat: 'YYYY-MM-DD', utc: false }))
    expect(runtime.parseDate).toHaveBeenCalledWith('2026-08-31', expect.objectContaining({ utc: false }))
    const rows = tableOf().querySelectorAll('tbody tr')
    expect(rows).toHaveLength(30)
    expect(rows[0].children[0].textContent).toBe('1 Sep')
    expect(rows[0].children[2].textContent).toBe('2 Aug')
    expect(rows[29].children[2].textContent).toBe('31 Aug')
  })

  it('shifts across a month and a year boundary and a leap day without time zone drift', () => {
    const jan = ['2027-01-05', '2027-03-01']
    renderPage({ trend: { ...baseTrend, days: jan, current: [1, 2], previous: [3, 4] } })
    expect(runtime.parseDate).toHaveBeenCalledWith('2026-12-06', expect.any(Object)) // 2027-01-05 − 30
    expect(runtime.parseDate).toHaveBeenCalledWith('2027-01-30', expect.any(Object)) // 2027-03-01 − 30 (not a leap year)
  })

  it('the table has a date column for the previous period, and no ISO date anywhere', () => {
    renderPage()
    const headers = within(tableOf()).getAllByRole('columnheader', { hidden: true }).map(cell => cell.textContent)
    expect(headers).toEqual(['Date', 'Sales', 'Previous 30 days · Date', 'Previous 30 days'])
    expect(tableOf().textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('the tooltip row of the previous period says its own day, the current one does not', () => {
    renderPage()
    const { label, title } = runtime.chart.options.plugins.tooltip.callbacks
    expect(title([{ label: '22 Sep' }])).toBe('22 Sep')
    // 2026-09-22 − 30 = 2026-08-23 → «23 Aug», index 21
    expect(label({ datasetIndex: 1, dataIndex: 21, dataset: { label: 'Previous 30 days' }, parsed: { y: 0 } })).toBe('23 Aug · Previous 30 days: $0.00')
    expect(label({ datasetIndex: 0, dataIndex: 21, dataset: { label: 'Sales' }, parsed: { y: 21 } })).toBe('Sales: $21.00')
  })
})
