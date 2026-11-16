import React from 'react'
import moment from 'moment'
import { render, renderHook } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

// redesign W0-4a (T0-13, decision 13): parseDate here is the REAL helper of UtilsContext, not a copy of it, so the
// ETA and the SLA are pinned against what the project's dates_general_format really does to the default output.
const mocks = vi.hoisted(() => ({ configs: {}, parseDate: null }))
vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: true }, (_key, fallback) => fallback]
}))
// the table cells read the helper through the package barrel: hand them the real one
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{
    parseDate: (...args) => mocks.parseDate(...args),
    parsePrice: (value, { currency } = {}) => `${currency}${Number(value).toFixed(2)}`,
    optimizeImage: (url) => url,
    getTimeAgo: () => '2 hours ago'
  }],
  useConfig: () => [{ configs: mocks.configs }],
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

import { UtilsProviders, useUtils } from '../../../../../../contexts/UtilsContext'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { OrdersTable } from '..'
import { formatOrderEta, getOrderEta, getOrderEtaMoment } from '../orderEta'

const realParseDate = (configs = {}) => {
  mocks.configs = configs
  const { result } = renderHook(() => useUtils(), { wrapper: UtilsProviders })
  mocks.parseDate = result.current[0].parseDate
  return mocks.parseDate
}
const parseDate = realParseDate()

const NOW = moment('2026-10-05 12:00:00', 'YYYY-MM-DD HH:mm:ss')
const asUtc = (m) => moment(m).utc().format('YYYY-MM-DD HH:mm:ss')

describe('formatOrderEta', () => {
  it('shows only the time when the estimate falls today', () => {
    const order = { delivery_datetime_utc: asUtc(NOW), eta_time: 30 }
    expect(formatOrderEta(order, { parseDate, now: NOW })).toEqual({ time: '12:30', date: null })
  })

  it('shows short date plus time when the estimate falls on another day', () => {
    const order = { delivery_datetime_utc: asUtc(NOW), eta_time: 3 * 24 * 60 + 30 }
    expect(formatOrderEta(order, { parseDate, now: NOW })).toEqual({ time: '12:30', date: '08 Oct' })
  })

  it('adds the year only when the estimate falls in another year', () => {
    const order = { delivery_datetime_utc: asUtc(NOW), eta_time: 120 * 24 * 60 }
    // eta_time is absolute minutes, so a DST change in between shifts the wall clock
    const expected = moment(NOW).add(order.eta_time, 'minutes')
    expect(formatOrderEta(order, { parseDate, now: NOW })).toEqual({ time: expected.format('HH:mm'), date: expected.format('DD MMM YYYY') })
    expect(expected.year()).toBe(2027)
  })

  it('returns null when eta_time is missing or not a usable number of minutes', () => {
    const base = { delivery_datetime_utc: asUtc(NOW) }
    for (const etaTime of [undefined, null, '', 'soon', 0, -5, false]) {
      expect(formatOrderEta({ ...base, eta_time: etaTime }, { parseDate, now: NOW })).toBeNull()
    }
  })

  it('returns null when the order has no delivery date', () => {
    expect(formatOrderEta({ eta_time: 30 }, { parseDate, now: NOW })).toBeNull()
  })

  it('falls back to delivery_datetime (shifted by the legacy 300 min offset) when there is no delivery_datetime_utc', () => {
    const order = { delivery_datetime: asUtc(moment(NOW).subtract(300, 'minutes')), eta_time: 15 }
    expect(formatOrderEta(order, { parseDate, now: NOW })).toEqual({ time: '12:15', date: null })
  })

  it('prefers delivery_datetime_utc over delivery_datetime', () => {
    const order = {
      delivery_datetime_utc: asUtc(NOW),
      delivery_datetime: asUtc(moment(NOW).add(2, 'days')),
      eta_time: 30
    }
    expect(formatOrderEta(order, { parseDate, now: NOW })).toEqual({ time: '12:30', date: null })
  })

  it('honours the project 12h clock without going through parseTime', () => {
    const order = { delivery_datetime_utc: asUtc(NOW), eta_time: 30 }
    expect(formatOrderEta(order, { parseDate, formatTime: '12', now: NOW })).toEqual({ time: '12:30 PM', date: null })
    expect(formatOrderEta(order, { parseDate, formatTime: '24', now: NOW })).toEqual({ time: '12:30', date: null })
  })

  it('never yields the parseTime "invalid format" text', () => {
    const order = { delivery_datetime_utc: asUtc(NOW), eta_time: 45 }
    expect(JSON.stringify(formatOrderEta(order, { parseDate, now: NOW }))).not.toMatch(/invalid/i)
  })
})

describe('getOrderEtaMoment (shared with the SLA timer)', () => {
  it('keeps the exact math getDelayMinutes used before extraction', () => {
    // what the timer always meant: the delivery instant (UTC, or the CDT-shifted local value) plus eta_time minutes
    const legacy = (order) => {
      const offset = 300
      const cdtToutc = moment(order?.delivery_datetime).add(offset, 'minutes').format('YYYY-MM-DD HH:mm:ss')
      const _delivery = moment.utc(order?.delivery_datetime_utc || cdtToutc).local()
      return moment(_delivery).add(order?.eta_time, 'minutes')
    }
    const orders = [
      { delivery_datetime_utc: asUtc(NOW), eta_time: 45 },
      { delivery_datetime: asUtc(NOW), eta_time: 10 },
      { delivery_datetime_utc: asUtc(NOW) }
    ]
    for (const order of orders) {
      expect(getOrderEtaMoment(order, parseDate).valueOf()).toBe(legacy(order).valueOf())
    }
  })

  it('getOrderEta is null without eta_time even though the timer math still works', () => {
    const order = { delivery_datetime_utc: asUtc(NOW) }
    expect(getOrderEta(order, { parseDate })).toBeNull()
    expect(getOrderEtaMoment(order, parseDate).isValid()).toBe(true)
  })
})

// redesign W0-4a (T0-13, decision 13): the SLA timer and the ETA are data. They must give the same minutes whatever
// dates_general_format the project paints its dates with, because parseDate follows it now.
describe('SLA and ETA do not depend on dates_general_format (real parseDate)', () => {
  const FORMATS = [
    { label: 'no format configured', configs: {} },
    { label: 'DD/MM/YYYY hh:mm a', configs: { dates_general_format: { value: 'DD/MM/YYYY hh:mm a' }, format_time: { value: '12' } } },
    { label: 'MM/DD/YYYY hh:mm A', configs: { dates_general_format: { value: 'MM/DD/YYYY hh:mm A' } } },
    { label: 'DD MMM YYYY HH:mm', configs: { dates_general_format: { value: 'DD MMM YYYY HH:mm' } } },
    { label: 'YYYY-MM-DD HH:mm:ss', configs: { dates_general_format: { value: 'YYYY-MM-DD HH:mm:ss' } } }
  ]
  const minutesLeft = (eta, now) => Math.ceil(eta.diff(now, 'seconds') / 60)
  // 12:00 now, delivery due at 11:00, 45 minutes of estimate: 15 minutes late
  const order = { delivery_datetime_utc: asUtc(moment(NOW).subtract(60, 'minutes')), eta_time: 45 }
  const cdtOrder = { delivery_datetime: asUtc(moment(NOW).subtract(360, 'minutes')), eta_time: 45 }

  for (const { label, configs } of FORMATS) {
    it(`gives the same delay (-15 min) and the same ETA moment with ${label}`, () => {
      const parse = realParseDate(configs)
      expect(minutesLeft(getOrderEtaMoment(order, parse), NOW)).toBe(-15)
      expect(minutesLeft(getOrderEtaMoment(cdtOrder, parse), NOW)).toBe(-15)
      expect(getOrderEtaMoment(order, parse).valueOf()).toBe(moment(NOW).subtract(15, 'minutes').valueOf())
      expect(getOrderEta(order, { parseDate: parse }).valueOf()).toBe(moment(NOW).subtract(15, 'minutes').valueOf())
    })
  }

  it('paints the date of another day with the date part of the project format, never as ISO', () => {
    const far = { delivery_datetime_utc: asUtc(NOW), eta_time: 3 * 24 * 60 + 30 }
    const parse = realParseDate({ dates_general_format: { value: 'DD/MM/YYYY hh:mm a' } })
    expect(formatOrderEta(far, { parseDate: parse, formatTime: '12', now: NOW })).toEqual({ time: '12:30 PM', date: '08/10' })
    const nextYear = { delivery_datetime_utc: asUtc(NOW), eta_time: 120 * 24 * 60 }
    const { date } = formatOrderEta(nextYear, { parseDate: parse, now: NOW })
    expect(date).toMatch(/^\d{2}\/\d{2}\/2027$/)
    const us = realParseDate({ dates_general_format: { value: 'MM/DD/YYYY hh:mm A' } })
    expect(formatOrderEta(far, { parseDate: us, now: NOW }).date).toBe('10/08')
  })
})

// redesign W0-4a (T0-13, decision 13): the cells of /orders (delivery date, ETA, SLA timer) with a non-ISO project format
describe('OrdersTable cells with a non-ISO dates_general_format (real parseDate)', () => {
  const column = (order, visable = true, extra = {}) => ({ visable, title: extra.title ?? '', className: '', draggable: false, colSpan: 1, order, ...extra })
  const columns = {
    slaBar: column(-2),
    orderNumber: column(-1),
    dateTime: column(0),
    status: column(2, true, { title: 'Status' }),
    business: column(6, true, { title: 'Business' }),
    customer: column(7, true, { title: 'Customer' }),
    timer: column(9, true, { title: 'Timer' }),
    eta: column(10, true, { title: 'ETA' }),
    total: column(15)
  }
  const ISO = /\d{4}-\d{2}-\d{2}/
  const delivery = moment().add(3, 'days').startOf('hour')
  const order = {
    id: 13861,
    status: 0,
    delivery_type: 1,
    delivery_datetime_utc: asUtc(delivery),
    created_at: '2026-10-06 18:40:00',
    time_status: 'in_time',
    eta_time: 30,
    business: { name: 'Fast Bite', logo: 'logo.png', city: { name: 'New York' } },
    customer: { name: 'Customer', lastname: 'Demo', cellphone: '+1 555-0100', orders_count: 3 },
    summary: { total: 35.2 },
    currency: 'USD'
  }
  const ORIGINAL_MATCH_MEDIA = window.matchMedia
  const renderTable = () => {
    window.matchMedia = (query) => ({ media: query, matches: query.includes('min-width'), addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })
    return render(
      <ThemeProvider theme={{ colors: {} }}>
        <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
          <OrdersTable
            orderList={{ loading: false, orders: [order] }}
            pagination={{ currentPage: 1, pageSize: 10, total: 1 }}
            selectedOrderIds={[]}
            groupStatus='pending'
            allowColumns={columns}
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

  it('paints the delivery and ETA dates with the project format and no ISO date, and the SLA timer still counts', () => {
    realParseDate({ dates_general_format: { value: 'DD/MM/YYYY hh:mm a' }, format_time: { value: '12' } })
    const { container } = renderTable()
    window.matchMedia = ORIGINAL_MATCH_MEDIA
    const text = container.textContent
    expect(text).toContain(delivery.format('DD/MM/YYYY hh:mm a'))
    const eta = moment(delivery).add(30, 'minutes')
    expect(text).toContain(eta.format('hh:mm A'))
    expect(text).toContain(eta.isSame(moment(), 'year') ? eta.format('DD/MM') : eta.format('DD/MM/YYYY'))
    expect(text).not.toMatch(ISO)
    expect(text).not.toMatch(/invalid format/i)
    // the SLA timer is computed from the machine format, so it is a clock (three days ahead), not NaN
    expect(text).not.toMatch(/NaN/)
    expect(text).toMatch(/[23] day\s+\d{2}:\d{2}/)
  })

  it('does not paint an ISO date either when the project has no format configured', () => {
    realParseDate({})
    const { container } = renderTable()
    window.matchMedia = ORIGINAL_MATCH_MEDIA
    expect(container.textContent).not.toMatch(ISO)
    expect(container.textContent).toContain(delivery.format('DD MMM YYYY HH:mm'))
  })
})
