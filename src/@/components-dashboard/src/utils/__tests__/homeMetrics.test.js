import { describe, expect, it } from 'vitest'
import {
  HOME_ATTENTION_KEYS,
  HOME_ATTENTION_PATHS,
  averageTicket,
  buildAttentionWhere,
  buildFailedCartsPath,
  countCancelled,
  dailySeries,
  evaluateSetupGuide,
  getHomeDays,
  percentChange,
  sumRows,
  sumUntilHour
} from '../homeMetrics'

// redesign home FB (D2, D4, D5, D9, HM-01, HM-11, HM-16, auditor 2, 3, 8, 10)

describe('getHomeDays', () => {
  it('reads the local day on the 9th of a month', () => {
    expect(getHomeDays(new Date(2026, 9, 9, 15, 30))).toEqual({
      today: '2026-10-09',
      lastWeekDay: '2026-10-02',
      trendFrom: '2026-09-09',
      trendTo: '2026-10-08',
      previousFrom: '2026-08-10',
      previousTo: '2026-09-08',
      monthStart: '2026-10-01',
      hour: 15
    })
  })

  it('on the 1st the month starts today and the window crosses into the previous month', () => {
    const days = getHomeDays(new Date(2026, 9, 1, 0, 5))
    expect(days.today).toBe('2026-10-01')
    expect(days.monthStart).toBe('2026-10-01')
    expect(days.trendTo).toBe('2026-09-30')
    expect(days.trendFrom).toBe('2026-09-01')
    expect(days.lastWeekDay).toBe('2026-09-24')
    expect(days.hour).toBe(0)
  })

  it('on the 31st the windows still hold 30 closed days each', () => {
    const days = getHomeDays(new Date(2026, 9, 31, 23, 59))
    expect(days.today).toBe('2026-10-31')
    expect(days.trendFrom).toBe('2026-10-01')
    expect(days.trendTo).toBe('2026-10-30')
    expect(days.previousFrom).toBe('2026-09-01')
    expect(days.previousTo).toBe('2026-09-30')
    expect(days.hour).toBe(23)
  })

  it('crosses a year change', () => {
    const days = getHomeDays(new Date(2027, 0, 5, 9, 0))
    expect(days.today).toBe('2027-01-05')
    expect(days.lastWeekDay).toBe('2026-12-29')
    expect(days.trendFrom).toBe('2026-12-06')
    expect(days.trendTo).toBe('2027-01-04')
    expect(days.previousFrom).toBe('2026-11-06')
    expect(days.previousTo).toBe('2026-12-05')
    expect(days.monthStart).toBe('2027-01-01')
  })

  it('a 30-day window has exactly 30 days', () => {
    const days = getHomeDays(new Date(2026, 2, 15, 12))
    const current = dailySeries([], days.trendFrom, days.trendTo, 'sales')
    const previous = dailySeries([], days.previousFrom, days.previousTo, 'sales')
    expect(current).toHaveLength(30)
    expect(previous).toHaveLength(30)
    expect(previous[29].day < current[0].day).toBe(true)
  })
})

describe('sumRows', () => {
  it('adds the key of every row and ignores what is not a number', () => {
    expect(sumRows([{ sales: 10.5 }, { sales: '4.5' }, { sales: null }, {}, { sales: 'x' }], 'sales')).toBe(15)
  })

  it('answers 0 for null and for anything that is not an array', () => {
    expect(sumRows(null, 'sales')).toBe(0)
    expect(sumRows(undefined, 'sales')).toBe(0)
    expect(sumRows({ sales: 4 }, 'sales')).toBe(0)
    expect(sumRows([], 'sales')).toBe(0)
  })
})

describe('sumUntilHour', () => {
  const rows = [
    { time: '2026-10-02 14:00:00', sales: 10, orders: 1 },
    { time: '2026-10-02 15:00:00', sales: 20, orders: 2 },
    { time: '2026-10-02 16:00:00', sales: 40, orders: 4 }
  ]

  it('counts the rows up to and including the given hour', () => {
    expect(sumUntilHour(rows, 'sales', 15)).toBe(30)
    expect(sumUntilHour(rows, 'orders', 15)).toBe(3)
  })

  it('counts nothing before the first row and everything after the last', () => {
    expect(sumUntilHour(rows, 'sales', 13)).toBe(0)
    expect(sumUntilHour(rows, 'sales', 23)).toBe(70)
  })

  it('reads the hour from the text and skips rows without a time', () => {
    expect(sumUntilHour([{ time: 'bad', sales: 5 }, { sales: 5 }, { time: '2026-10-02 00:00:00', sales: 1 }], 'sales', 0)).toBe(1)
    expect(sumUntilHour(null, 'sales', 10)).toBe(0)
  })
})

describe('dailySeries', () => {
  it('has one element per day of the range, with 0 where the API sent no row', () => {
    const rows = [
      { time: '2026-10-03 00:00:00', sales: 10 },
      { time: '2026-10-05 00:00:00', sales: 7 }
    ]
    expect(dailySeries(rows, '2026-10-02', '2026-10-06', 'sales')).toEqual([
      { day: '2026-10-02', value: 0 },
      { day: '2026-10-03', value: 10 },
      { day: '2026-10-04', value: 0 },
      { day: '2026-10-05', value: 7 },
      { day: '2026-10-06', value: 0 }
    ])
  })

  it('HM-01: never draws days outside the requested range, even if the API sent them', () => {
    const rows = [
      { time: '2026-09-30 00:00:00', sales: 99 },
      { time: '2026-10-01 00:00:00', sales: 5 },
      { time: '2026-10-02 00:00:00', sales: 6 },
      { time: '2026-10-09 00:00:00', sales: 99 }
    ]
    const series = dailySeries(rows, '2026-10-01', '2026-10-02', 'sales')
    expect(series.map(item => item.day)).toEqual(['2026-10-01', '2026-10-02'])
    expect(series.map(item => item.value)).toEqual([5, 6])
  })

  it('HM-01: a range that starts on day 1 has no day before day 1', () => {
    const series = dailySeries([], '2026-10-01', '2026-10-03', 'sales')
    expect(series[0].day).toBe('2026-10-01')
    expect(series).toHaveLength(3)
  })

  it('HM-01: 30 days with rows only from day 1 are 0 before day 1 because the requested range includes them', () => {
    const rows = [{ time: '2026-10-01 00:00:00', sales: 8 }, { time: '2026-10-02 00:00:00', sales: 2 }]
    const series = dailySeries(rows, '2026-09-09', '2026-10-08', 'sales')
    expect(series).toHaveLength(30)
    expect(series.slice(0, 22).every(item => item.value === 0)).toBe(true)
    expect(series[22]).toEqual({ day: '2026-10-01', value: 8 })
    expect(series[23]).toEqual({ day: '2026-10-02', value: 2 })
  })

  it('adds the rows that fall on the same day and tolerates null rows', () => {
    const rows = [{ time: '2026-10-01 00:00:00', orders: 1 }, { time: '2026-10-01 12:00:00', orders: '2' }]
    expect(dailySeries(rows, '2026-10-01', '2026-10-01', 'orders')).toEqual([{ day: '2026-10-01', value: 3 }])
    expect(dailySeries(null, '2026-10-01', '2026-10-02', 'orders')).toHaveLength(2)
  })

  it('crosses month and year ends without skipping or repeating a day', () => {
    const series = dailySeries([], '2026-12-30', '2027-01-02', 'sales')
    expect(series.map(item => item.day)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  // redesign bi FA1 (BI-22: Home and Business Intelligence count the same; the API stamps the last hour of day `to` on `to` + 1)
  it('BI-22: a row stamped the day after `to` is added to `to`, so no sale is lost', () => {
    const rows = [
      { time: '2026-10-08 00:00:00', x: 2 },
      { time: '2026-10-09 00:00:00', x: 3 }
    ]
    const series = dailySeries(rows, '2026-10-02', '2026-10-08', 'x')
    expect(series).toHaveLength(7)
    expect(series[6]).toEqual({ day: '2026-10-08', value: 5 })
    expect(series.reduce((total, item) => total + item.value, 0)).toBe(5)
  })
})

describe('countCancelled', () => {
  it('adds the orders of the cancelled family only', () => {
    expect(countCancelled([{ status: 2, orders: 7 }, { status: 7, orders: 4 }, { status: 6, orders: 1 }])).toBe(8)
  })

  it('answers 0 with nothing', () => {
    expect(countCancelled(null)).toBe(0)
    expect(countCancelled([{ status: 1, orders: 3 }])).toBe(0)
  })
})

describe('averageTicket and percentChange', () => {
  it('divides sales by orders and is null without orders (HM-16)', () => {
    expect(averageTicket(90, 3)).toBe(30)
    expect(averageTicket(90, 0)).toBeNull()
  })

  it('is null against a previous of 0, and a signed percent otherwise', () => {
    expect(percentChange(10, 0)).toBeNull()
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
    expect(percentChange(0, 100)).toBe(-100)
  })
})

describe('buildAttentionWhere', () => {
  const hasItems = (where) => where.conditions.find(condition => condition.conector === 'OR')
  const find = (where, attribute) => where.conditions.find(condition => condition.attribute === attribute)

  it('lists the rows and the destination of each', () => {
    expect(HOME_ATTENTION_KEYS).toEqual(['pending', 'late', 'waitingDriver', 'failedCarts', 'googleNotShown'])
    expect(HOME_ATTENTION_PATHS).toEqual({
      pending: '/orders?status=pending',
      // (D-22): the two rows open their page already filtered (Late; Unassigned)
      late: '/orders?status=inProgress&late=1',
      // redesign home R1 (Q-05): the Deliveries tab reads ?status=, so the row opens the tab that holds its deliveries
      waitingDriver: '/deliveries?status=inProgress&unassigned=1',
      failedCarts: '/cart-recovery/open-carts?view=paymentFailed',
      // Connect › Order with Google, filtered on the stores Google is not showing
      googleNotShown: '/connect/order-with-google?state=skipped'
    })
  })

  it.each(['pending', 'late', 'waitingDriver'])('%s is ANDed on top and carries the has_items block of the Orders tab', (key) => {
    const where = buildAttentionWhere(key)
    expect(where.conector).toBe('AND')
    expect(hasItems(where)).toEqual({
      conector: 'OR',
      conditions: [
        { attribute: 'has_items', value: { condition: '=', value: true } },
        { attribute: 'cloned_order_id', value: { condition: '!=', value: null } },
        { attribute: 'delivery_type', value: { condition: '=', value: 9 } }
      ]
    })
  })

  it('pending is status 0 and 13', () => {
    expect(find(buildAttentionWhere('pending'), 'status').value).toEqual([0, 13])
  })

  it('late is the open statuses with time_status delayed', () => {
    const where = buildAttentionWhere('late')
    expect([...find(where, 'status').value].sort((a, b) => a - b)).toEqual(
      [0, 3, 4, 7, 8, 9, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26]
    )
    expect(find(where, 'time_status').value).toBe('delayed')
  })

  it('waitingDriver is 7, 4, 14, 22 for delivery without driver nor driver company', () => {
    const where = buildAttentionWhere('waitingDriver')
    expect(find(where, 'status').value).toEqual([7, 4, 14, 22])
    expect(find(where, 'delivery_type').value).toEqual({ condition: '=', value: 1 })
    expect(find(where, 'driver_id').value).toEqual({ condition: '=', value: null })
    expect(find(where, 'driver_company_id').value).toEqual({ condition: '=', value: null })
  })

  it('failedCarts is not an orders count', () => {
    expect(buildAttentionWhere('failedCarts')).toBeNull()
    expect(buildAttentionWhere('nope')).toBeNull()
    const path = buildFailedCartsPath()
    expect(path.startsWith('/carts/dashboard?page=1&page_size=1&where=')).toBe(true)
    expect(JSON.parse(decodeURIComponent(path.split('where=')[1]))).toEqual([{ attribute: 'status', value: [4] }])
  })
})

describe('evaluateSetupGuide', () => {
  const store = { id: 1, enabled: true, menus_count: 2, zones: [{ id: 5 }] }
  const complete = {
    businesses: [store],
    paymethodsByBusiness: { 1: [{ id: 1, enabled: true }] },
    driversTotal: 3,
    sites: [{ domain: 'shop.example.com', ssl_process_status: 'ended' }]
  }
  const byId = (guide) => Object.fromEntries(guide.steps.map(step => [step.id, step]))

  it('level 0 adds the optional drivers and domain, which do not count', () => {
    const guide = evaluateSetupGuide({ level: 0, ...complete })
    expect(guide.steps.map(step => step.id)).toEqual(['store', 'menu', 'zone', 'payment', 'first_order', 'drivers', 'domain'])
    expect(byId(guide).drivers).toEqual({ id: 'drivers', done: true, optional: true })
    expect(byId(guide).domain).toEqual({ id: 'domain', done: true, optional: true })
    expect(guide.requiredCount).toBe(5)
    expect(guide.doneCount).toBe(4)
  })

  it('level 2 has no drivers nor domain', () => {
    const guide = evaluateSetupGuide({ level: 2, ...complete })
    expect(guide.steps.map(step => step.id)).toEqual(['store', 'menu', 'zone', 'payment', 'first_order'])
    expect(guide.requiredCount).toBe(5)
    expect(guide.doneCount).toBe(4)
  })

  it('first_order is never done: the guide only exists on projects without orders', () => {
    expect(byId(evaluateSetupGuide({ level: 0, ...complete })).first_order).toEqual({ id: 'first_order', done: false, optional: false })
  })

  it('an empty project has nothing done', () => {
    const guide = evaluateSetupGuide({ level: 0, businesses: [], paymethodsByBusiness: {}, driversTotal: 0, sites: [] })
    expect(guide.doneCount).toBe(0)
    expect(guide.requiredCount).toBe(5)
    expect(guide.steps.every(step => step.done === false)).toBe(true)
  })

  it('looks at any store, not the first one', () => {
    const guide = evaluateSetupGuide({
      level: 2,
      businesses: [{ id: 1, menus_count: 0, zones: [] }, { id: 2, menus_count: 1, zones: [{ id: 1 }] }],
      paymethodsByBusiness: {}
    })
    expect(byId(guide).store.done).toBe(true)
    expect(byId(guide).menu.done).toBe(true)
    expect(byId(guide).zone.done).toBe(true)
  })

  it('payment: a list without any enabled method is not done', () => {
    const guide = evaluateSetupGuide({
      level: 2,
      businesses: [store],
      paymethodsByBusiness: { 1: [{ id: 1, enabled: false }, { id: 2 }], 2: [] }
    })
    expect(byId(guide).payment.done).toBe(false)
  })

  it('payment: one enabled entry in any list is done', () => {
    const guide = evaluateSetupGuide({
      level: 2,
      businesses: [store],
      paymethodsByBusiness: { 1: [{ id: 1, enabled: false }], 2: [{ id: 2, enabled: true }] }
    })
    expect(byId(guide).payment.done).toBe(true)
  })

  it('domain needs a published site with SSL ended', () => {
    const guide = evaluateSetupGuide({
      level: 0,
      ...complete,
      sites: [{ domain: 'a.com', ssl_process_status: 'pending' }, { ssl_process_status: 'ended' }]
    })
    expect(byId(guide).domain.done).toBe(false)
  })
})
