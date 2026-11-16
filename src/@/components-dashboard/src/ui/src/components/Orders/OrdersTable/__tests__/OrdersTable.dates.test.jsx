/* eslint-disable import/first */
// redesign tramo A r2 (W0-PA1-09 b, W0-PA1-04): the date of the order cell comes out of the REAL UtilsProviders (the other
// OrdersTable tests mock parseDate as identity, so the most visible date of /orders had no test with the helper), and the
// SLA timer reads the delivery at the minute, as main did.
import React from 'react'
import { render } from '@testing-library/react'
import moment from 'moment'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ configs: {} }))

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
    useConfig: () => [{ configs: mocks.configs }],
    useSession: () => [{ user: { level: 0 } }],
    useApi: () => [{ project: 'demo' }]
  }
})
vi.mock('../../../../utils', () => ({
  getCurrenySymbol: () => '$',
  addQueryToUrl: vi.fn(),
  getOrderStatusPrefix: (status) => `Status ${status}`,
  isFinalOrderStatusLocked: () => false
}))

import { UtilsProviders, useUtils } from '../../../../../../contexts/UtilsContext'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { OrdersTable } from '..'
import { getOrderEtaMoment, SLA_PARSE_OPTIONS, MACHINE_PARSE_OPTIONS } from '../orderEta'

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
const allowColumns = {
  slaBar: column(-2, true),
  orderNumber: column(-1),
  dateTime: column(0),
  status: column(2, true, { title: 'Status', draggable: true }),
  total: column(15)
}
const STAMP = '2026-03-04 15:30:45'
const order = {
  id: 13792,
  status: 0,
  delivery_type: 1,
  delivery_datetime_utc: STAMP,
  created_at: '2026-03-04 10:00:00',
  business: { name: 'Fast Bite', logo: 'logo.png', city: { name: 'New York' } },
  customer: { name: 'Grace Okafor', cellphone: '555-0100', photo: 'grace.png', orders_count: 3 },
  summary: { total: 35.2 },
  currency: 'USD'
}
const props = {
  orderList: { loading: false, orders: [order] },
  pagination: { currentPage: 1, pageSize: 10, total: 1 },
  selectedOrderIds: [],
  groupStatus: 'pending',
  allowColumns,
  setAllowColumns: vi.fn(),
  saveUserSettings: vi.fn(),
  getPageOrders: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  handleOpenOrderDetail: vi.fn()
}

const renderTable = () => render(
  <ThemeProvider theme={{ colors: {} }}>
    <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
      <UtilsProviders><OrdersTable {...props} /></UtilsProviders>
    </ConfigFileContext.Provider>
  </ThemeProvider>
)

beforeEach(() => { mocks.configs = {} })
afterEach(() => { vi.useRealTimers() })

describe('OrdersTable date cell with the real parseDate', () => {
  it('paints the delivery date in the project format when it is not ISO', () => {
    mocks.configs = { dates_general_format: { value: 'DD/MM/YYYY hh:mm a' } }
    const { container } = renderTable()
    const expected = moment.utc(STAMP, 'YYYY-MM-DD HH:mm:ss').local().format('DD/MM/YYYY hh:mm a')
    expect(container.textContent).toContain(expected)
    expect(container.textContent).not.toContain(moment.utc(STAMP).local().format('YYYY-MM-DD HH:mm'))
  })

  it('paints a worded month when the project has no format, never an ISO date', () => {
    const { container } = renderTable()
    const expected = moment.utc(STAMP, 'YYYY-MM-DD HH:mm:ss').local().format('DD MMM YYYY HH:mm')
    expect(container.textContent).toContain(expected)
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})

describe('SLA timer reads the delivery at the minute (W0-PA1-04)', () => {
  const probe = (options) => {
    mocks.configs = {}
    vi.useFakeTimers()
    vi.setSystemTime(moment.utc('2026-03-04 15:30:10', 'YYYY-MM-DD HH:mm:ss').toDate())
    let minutes
    const Consumer = () => {
      const [{ parseDate }] = useUtils()
      minutes = Math.ceil(getOrderEtaMoment(order, parseDate, options).diff(moment().utc(), 'seconds') / 60)
      return null
    }
    render(<UtilsProviders><Consumer /></UtilsProviders>)
    return minutes
  }

  it('the table timer cell reads 00:00 for a delivery at 15:30:45 seen at 15:30:10, as main did', () => {
    mocks.configs = {}
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(moment.utc('2026-03-04 15:30:10', 'YYYY-MM-DD HH:mm:ss').toDate())
    props.allowColumns = { ...allowColumns, timer: column(11, true, { title: 'SLA timer', draggable: true }) }
    try {
      const { container } = renderTable()
      expect(container.querySelector('.odc-orders-timer').textContent).toBe('00:00')
    } finally {
      props.allowColumns = allowColumns
    }
  })

  it('with SLA_PARSE_OPTIONS a delivery at 15:30:45 seen at 15:30:10 is 00 minutes, like main', () => {
    expect(probe(SLA_PARSE_OPTIONS) + 0).toBe(0)
  })

  it('the machine format (with seconds) would say 1 minute: it stays for the ETA column only', () => {
    expect(probe(MACHINE_PARSE_OPTIONS)).toBe(1)
  })
})
