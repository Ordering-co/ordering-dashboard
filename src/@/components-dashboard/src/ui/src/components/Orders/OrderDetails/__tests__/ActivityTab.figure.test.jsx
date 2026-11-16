/* eslint-disable import/first */
import React from 'react'
import { screen, within } from '@testing-library/react'
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

// redesign W0-3a (T0-9, decisión 11a): the time of every event is a figure (the `<time>` of the timeline carries
// `odc-figure`) and the time of an attempt in the information view is a figure too. Words and ids around them are not.
describe('ActivityTab · times are figures (W0-3a, T0-9)', () => {
  beforeEach(() => {
    mocks.user = { id: 1, level: 0 }
    mockApi()
  })

  it('puts odc-figure on the <time> of every event and keeps the title out of it', async () => {
    renderTab()
    const items = within(await screen.findByRole('list', { name: 'Order activity' })).getAllByRole('listitem')
    expect(items.length).toBeGreaterThan(0)
    items.forEach(item => {
      expect(item.querySelector('time')).toHaveClass('odc-figure')
      expect(item.querySelector('time')).not.toHaveClass('odc-mono')
      expect(item.querySelector('.odc-feed-what')).not.toHaveClass('odc-figure')
    })
  })

  // redesign tramo A r3 (W0-QA1-09): the <time> of an event carries the machine value (ISO 8601, UTC) of the same instant
  it('gives every <time> a dateTime with the ISO instant of its event', async () => {
    renderTab()
    const items = within(await screen.findByRole('list', { name: 'Order activity' })).getAllByRole('listitem')
    const stamps = items.map(item => item.querySelector('time').getAttribute('datetime'))
    stamps.forEach(stamp => expect(stamp).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/))
    // the placed event (15:51), the status change (15:58) and the log (16:05) are in the feed, newest first
    expect(stamps).toContain('2026-10-02T15:51:00.000Z')
    expect(stamps).toContain('2026-10-02T15:58:00.000Z')
    expect(stamps).toContain('2026-10-02T16:05:00.000Z')
    expect([...stamps].sort().reverse()).toEqual(stamps)
  })

  it('puts odc-figure on the time of an attempt and not on «at» or on the driver group id', async () => {
    renderTab('?tab=logistic_information')
    const attempt = (await screen.findByText('Attempts history')).parentElement.querySelector('ul > li')
    const time = within(attempt).getByText('at 2026-10-02 16:05:00')
    expect(time).toHaveClass('odc-figure')
    expect(time.tagName).toBe('BDI')
    expect(attempt).not.toHaveClass('odc-figure')
    expect(within(attempt).getByText('67')).not.toHaveClass('odc-figure')
    expect(within(attempt).getByText('67')).toHaveClass('odc-mono')
  })
})
