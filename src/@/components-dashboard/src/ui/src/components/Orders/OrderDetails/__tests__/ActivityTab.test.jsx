/* eslint-disable import/first */
import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// Redesign 5.3-C: the activity tab runs the REAL Messages, Logistics and LogisticInformation controllers
// (same endpoints as today) with only their contexts and fetch simulated.
const mocks = vi.hoisted(() => ({
  user: { id: 1, level: 0 },
  addQueryToUrl: vi.fn()
}))

const t = (key, fallback) => fallback ?? key
const sessionState = () => [{ user: mocks.user, token: 'token' }]
const utilsState = [{
  parseDate: (value) => `at ${value}`,
  getTimeAgo: (value) => `ago ${value}`,
  parseNumber: (value) => String(value),
  optimizeImage: (value) => value,
  getOrderState: (status) => `State ${status}`,
  parsePrice: (value) => `$${value}`,
  parseDistance: (value) => `${value} m`
}]

vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => sessionState() }))
vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../contexts/WebsocketContext', () => ({ useWebsocket: () => ({ on: vi.fn(), off: vi.fn(), join: vi.fn(), leave: vi.fn() }) }))
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }] }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, t] }))
vi.mock('../../../../../../contexts/UtilsContext', () => ({ useUtils: () => utilsState }))

vi.mock('../../../../../../index', async () => {
  const { Messages } = await vi.importActual('../../../../../../components/Messages')
  const { Logistics } = await vi.importActual('../../../../../../components/Logistics')
  const { LogisticInformation } = await vi.importActual('../../../../../../components/LogisticInformation')
  return {
    Messages,
    Logistics,
    LogisticInformation,
    useLanguage: () => [{}, t],
    useSession: () => sessionState(),
    useConfig: () => [{ configs: {} }],
    useUtils: () => utilsState
  }
})

// The Messages and Logistics controllers read capitalize and fallbackLogisticEventsText from this module too.
vi.mock('../../../../utils', () => ({
  addQueryToUrl: mocks.addQueryToUrl,
  capitalize: (value) => value,
  fallbackLogisticEventsText: () => 'Logistics started'
}))

import { ActivityTab } from '../ActivityTab'

const HISTORY = [
  { id: 1, type: 0, created_at: '2026-10-02 15:51:00', app_id: 'web', author_id: 5, author: { name: 'Customer', lastname: 'Demo' }, user_agent: 'UA/placed', ip: '10.0.0.1' },
  { id: 2, type: 1, created_at: '2026-10-02 15:58:00', change: { attribute: 'status', old: 0, new: 7 }, app_id: 'ordering-react-native', author_id: 6, author: { name: 'Ordering', lastname: 'Admin' }, user_agent: 'UA/status', ip: '10.0.0.2' },
  { id: 3, type: 1, created_at: '2026-10-02 16:30:00', change: { attribute: 'summary.refunded', old: 0, new: 10 } },
  { id: 4, type: 2, created_at: '2026-10-02 16:40:00', comment: 'A chat message', author_id: 5, can_see: [0, 2, 3] },
  { id: 5, type: 1, created_at: '2026-10-02 16:50:00', change: { attribute: 'comment' } }
]
const LOGS = [{ id: 11, event: 'logistic_started', updated_at: '2026-10-02 16:05:00', data: {} }]
const INFORMATION = {
  distance_customer_from_business: 2500,
  queues: [{ id: 1, name: 'Queue A', drivers: [{}, {}], priority: 3, orders_group_start_in_status: 7, orders: [{ id: 99 }] }],
  logistic_attempts: [{ id: 1, driver_group_id: 67, created_at: '2026-10-02 16:05:00' }]
}

const mockApi = ({ history = HISTORY, logs = LOGS, information = INFORMATION, failHistory = false, failLogs = false, failInformation = null } = {}) => {
  global.fetch = vi.fn(async (url) => {
    const respond = (result, error = false, ok = true) => ({ ok, json: async () => ({ error, result }) })
    if (url.includes('/messages?mode=dashboard')) return failHistory ? respond(['no'], true) : respond(history)
    if (url.includes('/logs?order_id=')) return failLogs ? Promise.reject(new Error('boom')) : respond(logs)
    if (url.includes('/logistic/orders/')) return failInformation ? respond(failInformation, true, false) : respond(information)
    return respond([])
  })
}

const order = {
  id: 42,
  app_id: 'web',
  created_at: '2026-10-02 15:51:00',
  delivery_datetime: '2026-10-02 16:00:00',
  delivery_datetime_utc: null
}

const renderTab = (search = '') => renderWithProviders(
  <ActivityTab order={{ order, loading: false }} onSelectTab={vi.fn()} />,
  { initialEntries: [`/orders${search}`] }
)

const timeline = async () => screen.findByRole('list', { name: 'Order activity' })
const entries = async () => within(await timeline()).getAllByRole('listitem')

describe('ActivityTab: one timeline, three sources', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.addQueryToUrl.mockClear()
    mockApi()
  })

  it('reads history and logistics from the same endpoints as today', async () => {
    renderTab()
    await timeline()
    const urls = global.fetch.mock.calls.map(([url]) => url)
    expect(urls).toContain('https://api.test/orders/42/messages?mode=dashboard')
    expect(urls).toContain('https://api.test/orders/42/logs?order_id=42')
    expect(urls.some(url => url.includes('/logistic/orders/'))).toBe(false)
  })

  it('merges history and logistics in one list, newest first, with absolute times', async () => {
    renderTab()
    const items = await entries()
    // chat messages (type 2) and empty comments are not activity
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('at 2026-10-02 16:30:00')
    expect(items[0]).toHaveTextContent('Refunded')
    expect(items[1]).toHaveTextContent('at 2026-10-02 16:05:00')
    expect(items[1]).toHaveTextContent('Logistics started')
    expect(items[2]).toHaveTextContent('at 2026-10-02 15:58:00')
    expect(items[2]).toHaveTextContent('changed from State 0 to State 7')
    expect(items[3]).toHaveTextContent('at 2026-10-02 15:51:00')
    expect(items[3]).toHaveTextContent(/Order placed for .*via.*Web/)
    expect(screen.queryByText('A chat message')).not.toBeInTheDocument()
  })

  // redesign F6g-2: an event time is one left-to-right run, so it does not reorder inside a right-to-left feed
  it('draws every event time as an isolated left-to-right run', async () => {
    renderTab()
    const items = await entries()
    const times = items.map(item => item.querySelector('time'))
    expect(times.length).toBeGreaterThan(0)
    times.forEach(time => {
      expect(time.querySelector('bdi[dir="ltr"]')).not.toBeNull()
      expect(time.querySelector('bdi').textContent).toMatch(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
    })
  })

  it('names the author and the app on the line under the title', async () => {
    renderTab()
    const items = await entries()
    expect(items[2]).toHaveTextContent('by Ordering Admin · ordering-react-native')
    expect(items[3]).toHaveTextContent('by Customer Demo · web')
  })

  it('never mounts raw HTML from the data: values are escaped like today', async () => {
    mockApi({
      history: [{ id: 8, type: 1, created_at: '2026-10-02 16:00:00', change: { attribute: 'phone', old: '1', new: '<img src=x onerror=alert(1)>' } }],
      logs: []
    })
    const { container } = renderTab()
    const items = await entries()
    expect(items[0]).toHaveTextContent('<img src=x onerror=alert(1)>')
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('ActivityTab: the Show filter', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.addQueryToUrl.mockClear()
    mockApi()
  })

  it('offers All, Status, Logistics and Payments as one named group with All chosen', async () => {
    renderTab()
    await timeline()
    const group = screen.getByRole('group', { name: 'Show' })
    expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['All', 'Status', 'Logistics', 'Payments'])
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([
    ['Status', ['changed from State 0 to State 7']],
    ['Logistics', ['Logistics started']],
    ['Payments', ['Refunded']]
  ])('%s keeps only its own events', async (name, expected) => {
    renderTab()
    await timeline()
    await userEvent.click(screen.getByRole('button', { name }))
    const items = await entries()
    expect(items).toHaveLength(expected.length)
    expected.forEach((text, index) => expect(items[index]).toHaveTextContent(text))
  })

  it('says so, without losing the filter, when a view has no events', async () => {
    mockApi({ logs: [] })
    renderTab()
    await timeline()
    await userEvent.click(screen.getByRole('button', { name: 'Logistics' }))
    expect(await screen.findByText('No events match this view')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument()
  })
})

describe('ActivityTab: technical details (same visibility as main)', () => {
  beforeEach(() => {
    mocks.addQueryToUrl.mockClear()
    mockApi()
  })

  it.each([0, 2])('level %i finds app, user agent and IP folded, closed by default', async (level) => {
    mocks.user = { id: 1, level }
    renderTab()
    const items = await entries()
    const status = items[2]
    const summary = within(status).getByText('Technical details')
    const details = summary.closest('details')
    expect(details).not.toHaveAttribute('open')
    expect(within(details).getByText('ordering-react-native')).toBeInTheDocument()
    expect(within(details).getByText('UA/status')).toBeInTheDocument()
    expect(within(details).getByText('10.0.0.2')).toBeInTheDocument()
    // the same facts are not repeated in the title
    expect(status.querySelector('.odc-feed-what')).not.toHaveTextContent('UA/status')
    expect(status.querySelector('.odc-feed-what')).not.toHaveTextContent('10.0.0.2')
    // the placed event folds its own
    expect(within(items[3]).getByText('UA/placed')).toBeInTheDocument()
  })

  // Who sees what is the one of main. Placed (type 0) showed app, author, user agent and IP at ANY level:
  // it still does (now folded). The technical tail of a status/driver change was only for levels 0 and 2.
  it.each([0, 1, 2, 3, 5])('level %i still sees the placed event author, app, user agent and IP, folded', async (level) => {
    mocks.user = { id: 1, level }
    renderTab()
    const items = await entries()
    const placed = items[3]
    expect(placed).toHaveTextContent('by Customer Demo · web')
    const details = within(placed).getByText('Technical details').closest('details')
    expect(details).not.toHaveAttribute('open')
    expect(within(details).getByText('UA/placed')).toBeInTheDocument()
    expect(within(details).getByText('10.0.0.1')).toBeInTheDocument()
    expect(within(details).getByText('web')).toBeInTheDocument()
  })

  it.each([1, 3, 5])('level %i sees no author, fold or facts on a status change (restricted to 0 and 2 in main)', async (level) => {
    mocks.user = { id: 1, level }
    renderTab()
    const items = await entries()
    expect(items).toHaveLength(4)
    const status = items[2]
    expect(status).toHaveTextContent('changed from State 0 to State 7')
    expect(within(status).queryByText('Technical details')).not.toBeInTheDocument()
    expect(within(status).queryByText(/Ordering Admin/)).not.toBeInTheDocument()
    expect(screen.queryByText('UA/status')).not.toBeInTheDocument()
    expect(screen.queryByText('10.0.0.2')).not.toBeInTheDocument()
  })

  it('draws the static location map inside the fold only', async () => {
    mocks.user = { id: 1, level: 0 }
    mockApi({
      history: [{ id: 2, type: 1, created_at: '2026-10-02 15:58:00', change: { attribute: 'status', old: 0, new: 7 }, location: { lat: 40.5, lng: -73.9 }, ip: '10.0.0.2' }],
      logs: []
    })
    renderTab()
    const [item] = await entries()
    const map = within(item).getByRole('img', { name: 'Location' })
    expect(map.getAttribute('src')).toMatch(/^https:\/\/maps\.googleapis\.com\/maps\/api\/staticmap\?center=40\.5,-73\.9&/)
    expect(map.closest('details')).not.toBeNull()
  })
})

describe('ActivityTab: ?tab=', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.addQueryToUrl.mockClear()
    mockApi()
  })

  // redesign fix-qa E6 (main: Messages/index.js:363-372,463-467): `?tab=order_history` was the history
  // alone, with no logistics events and no /logs request. It opens that view (no filter option is lit, and
  // a line says it is the history only, with a "Show logistics" action) and All adds the logistics.
  it('tab=order_history opens the history alone, without asking for the logistics events', async () => {
    renderTab('?tab=order_history')
    const items = await entries()
    expect(screen.getByText(/Showing the order history only/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show logistics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(items).toHaveLength(3)
    expect(screen.queryByText('Logistics started')).not.toBeInTheDocument()
    expect(global.fetch.mock.calls.map(([url]) => url).some(url => url.includes('/logs?'))).toBe(false)
  })

  it.each([['Show logistics'], ['All']])('from the history alone, "%s" brings the logistics in', async (name) => {
    renderTab('?tab=order_history')
    await timeline()
    await userEvent.click(screen.getByRole('button', { name }))
    await waitFor(() => expect(screen.getByText('Logistics started')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Show logistics' })).toBeNull()
    expect(global.fetch.mock.calls.map(([url]) => url).some(url => url.includes('/logs?'))).toBe(true)
  })

  it('opens All with the logistics when there is no ?tab=', async () => {
    renderTab()
    await timeline()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Show logistics' })).toBeNull()
  })

  it('tab=logistics opens Logistics', async () => {
    renderTab('?tab=logistics')
    const items = await entries()
    expect(screen.getByRole('button', { name: 'Logistics' })).toHaveAttribute('aria-pressed', 'true')
    expect(items).toHaveLength(1)
  })

  it('writes the tab with the existing helper: logistics, and order_history for the rest', async () => {
    renderTab()
    await timeline()
    await userEvent.click(screen.getByRole('button', { name: 'Logistics' }))
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'logistics' })
    await userEvent.click(screen.getByRole('button', { name: 'Status' }))
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'order_history' })
  })

  // inside a user's record (isSelectedOrders) ?tab= is the record's section (staff ?tab=orders): never read or written
  it('inside a user record the filter stays in memory and the record\'s ?tab is not read', async () => {
    renderWithProviders(
      <ActivityTab order={{ order, loading: false }} onSelectTab={vi.fn()} isSelectedOrders />,
      { initialEntries: ['/users/business-owners?id=9406&tab=logistics'] }
    )
    await timeline()
    expect(screen.getByRole('button', { name: 'Logistics' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Logistics' }))
    expect(screen.getByRole('button', { name: 'Logistics' })).toHaveAttribute('aria-pressed', 'true')
    expect(mocks.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('reaches the logistics information from Logistics, and goes back to it', async () => {
    renderTab('?tab=logistics')
    await timeline()
    expect(screen.queryByText('Queue A')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Logistics information' }))
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'logistic_information' })
    expect(await screen.findByText(/Queue A/)).toBeInTheDocument()
    expect(global.fetch.mock.calls.map(([url]) => url)).toContain('https://api.test/logistic/orders/42/information')
    await userEvent.click(screen.getByRole('button', { name: 'Back to activity' }))
    expect(mocks.addQueryToUrl).toHaveBeenLastCalledWith({ tab: 'logistics' })
    expect(await screen.findByRole('list', { name: 'Order activity' })).toBeInTheDocument()
  })

  it('tab=logistic_information opens the information view with its queues and attempts', async () => {
    renderTab('?tab=logistic_information')
    expect(await screen.findByText(/Queue A/)).toBeInTheDocument()
    expect(screen.getByText('2.5 km')).toBeInTheDocument()
    expect(screen.getByText('Accepted by business')).toBeInTheDocument()
    expect(screen.getByText('67')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Show' })).not.toBeInTheDocument()
  })
})

describe('ActivityTab: reload, empty and error', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.addQueryToUrl.mockClear()
  })

  it('Reload asks the logistics endpoint again, as the old Reload did', async () => {
    mockApi()
    renderTab()
    await timeline()
    const logCalls = () => global.fetch.mock.calls.filter(([url]) => url.includes('/logs?order_id=')).length
    expect(logCalls()).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(logCalls()).toBe(2))
  })

  // redesign fix-qa E8: Reload disappeared with the Status and Payments filters; it is there with all four, and not
  // in the history-only view (which asks for no logistics at all).
  it.each(['All', 'Status', 'Logistics', 'Payments'])('Reload is available with the %s filter and asks the logistics endpoint again', async (filter) => {
    mockApi()
    renderTab()
    await timeline()
    await userEvent.click(screen.getByRole('button', { name: filter }))
    await timeline()
    const logCalls = () => global.fetch.mock.calls.filter(([url]) => url.includes('/logs?order_id=')).length
    const before = logCalls()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(logCalls()).toBe(before + 1))
  })

  it('has no Reload in the history-only view', async () => {
    mockApi()
    renderTab('?tab=order_history')
    await timeline()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
  })

  it('shows a skeleton in the shape of the list while loading', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const { container } = renderTab()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Order activity' })).not.toBeInTheDocument()
  })

  it('shows an empty state when nothing has happened', async () => {
    mockApi({ history: [], logs: [] })
    renderTab()
    expect(await screen.findByText('No activity yet')).toBeInTheDocument()
  })

  it('announces a history that cannot be read', async () => {
    mockApi({ failHistory: true, logs: [] })
    renderTab()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Couldn\'t load the order activity')
  })

  it('keeps the history when only the logistics call fails and says what is missing', async () => {
    mockApi({ failLogs: true })
    renderTab()
    const items = await entries()
    expect(items).toHaveLength(3)
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn\'t load the logistics events')
  })
})

// redesign fix-qa E6
describe('ActivityTab: images and logistics information errors (fix-qa E6)', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mocks.addQueryToUrl.mockClear()
  })

  const withPhoto = [
    { id: 20, type: 1, created_at: '2026-10-02 16:10:00', change: { attribute: 'status', old: 7, new: 11 }, source: 'https://img.test/door.png', author: { name: 'Dan', lastname: 'Driver' } }
  ]

  // main (Messages/index.js:510-512) opened the picture in a preview; the redesign sent it to a new tab.
  it('opens the image of an event in a preview, not in a new tab', async () => {
    mockApi({ history: withPhoto, logs: [] })
    renderTab()
    const items = await entries()
    expect(within(items[0]).queryByRole('link', { name: /Image/ })).toBeNull()
    await userEvent.click(within(items[0]).getByRole('button', { name: 'Click to expand' }))
    const dialog = await screen.findByRole('dialog', { name: 'Image preview' })
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'https://img.test/door.png')
    expect(within(dialog).getByRole('link', { name: 'Open original image' })).toHaveAttribute('href', 'https://img.test/door.png')
  })

  it('closes the preview and returns to the timeline', async () => {
    mockApi({ history: withPhoto, logs: [] })
    renderTab()
    const items = await entries()
    await userEvent.click(within(items[0]).getByRole('button', { name: 'Click to expand' }))
    await screen.findByRole('dialog', { name: 'Image preview' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull())
  })

  it('says why the logistics information failed when the error is a list', async () => {
    mockApi({ failInformation: ['Not allowed', 'Try later'] })
    renderTab('?tab=logistic_information')
    expect(await screen.findByText('Couldn\'t load the logistics information')).toBeInTheDocument()
    expect(screen.getByText('Not allowed Try later')).toBeInTheDocument()
  })

  it('and when it is one string', async () => {
    mockApi({ failInformation: 'Forbidden' })
    renderTab('?tab=logistic_information')
    expect(await screen.findByText('Forbidden')).toBeInTheDocument()
  })
})
