/* eslint-disable import/first */
// (bugs H): the SLA timer of a late order says «2 día», not «2 Día». The catalog word DAY is a title-case
// label («Día»); after a number it is a unit and is lower-cased in the language of the dashboard.
import React from 'react'
import { render } from '@testing-library/react'
import moment from 'moment'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ code: 'es', words: {} }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [{ dictionary: {}, language: { code: mocks.code } }, (key, text) => mocks.words[key] ?? text],
    useUtils,
    useConfig: () => [{ configs: {} }],
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

import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { OrdersTable } from '..'

const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
const order = {
  id: 13792,
  status: 0,
  delivery_type: 1,
  delivery_datetime_utc: '2026-03-04 15:30:45',
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
  allowColumns: {
    slaBar: column(-2, true),
    orderNumber: column(-1),
    dateTime: column(0),
    status: column(2, true, { title: 'Status', draggable: true }),
    timer: column(11, true, { title: 'SLA timer', draggable: true }),
    total: column(15)
  },
  setAllowColumns: vi.fn(),
  saveUserSettings: vi.fn(),
  getPageOrders: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  handleOpenOrderDetail: vi.fn()
}

// Two days and a half after the delivery time: the timer reads «- 2 <day> 00:2x».
const timerText = () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(moment.utc('2026-03-06 16:00:10', 'YYYY-MM-DD HH:mm:ss').toDate())
  const { container } = render(
    <ThemeProvider theme={{ colors: {} }}>
      <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
        <UtilsProviders><OrdersTable {...props} /></UtilsProviders>
      </ConfigFileContext.Provider>
    </ThemeProvider>
  )
  return container.querySelector('.odc-orders-timer').textContent
}

beforeEach(() => { mocks.code = 'es'; mocks.words = {} })
afterEach(() => { vi.useRealTimers() })

describe('OrdersTable SLA timer · the day unit after a number', () => {
  it('lower-cases the catalog «Día» to «día» in es', () => {
    mocks.words = { DAY: 'Día' }
    const text = timerText()
    expect(text).toMatch(/^- 2 día 00:\d\d$/)
    expect(text).not.toContain('Día')
  })

  it('lower-cases a shouted catalog word in tr too', () => {
    mocks.code = 'tr'
    mocks.words = { DAY: 'GÜN' }
    expect(timerText()).toMatch(/^- 2 gün 00:\d\d$/)
  })

  it('without a translation it keeps the text of the code', () => {
    mocks.code = 'en'
    expect(timerText()).toMatch(/^- 2 day 00:\d\d$/)
  })

  it('a language code the browser cannot use does not break the timer', () => {
    mocks.code = 'not a code'
    mocks.words = { DAY: 'Día' }
    expect(timerText()).toMatch(/^- 2 día 00:\d\d$/)
  })
})
