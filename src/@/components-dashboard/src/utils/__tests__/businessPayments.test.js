import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatAmount,
  HISTORY_PRESETS,
  INVOICE_STATUS_FAMILY,
  billingPeriods,
  formatDateTimeForApi,
  getCutoffDates,
  historyPresetRange,
  invoiceStatusFamily,
  paymentHistoryFileName,
  paymentReportFileName,
  sortInvoicesNewestFirst
} from '../businessPayments'

// redesign business-payments FA (D3, D5, D6): the pure pieces of /intelligence/business-payments.

// ---- the reference: BPR:62-162 of main, verbatim (it reads the clock with `new Date()`) ----------------------------
const referenceGetCutoffDates = (method, count = 12) => {
  if (!method) return []

  const { cycle, cycle_day: cycleDay, cycle_time: cycleTime } = method
  const [hours, minutes] = (cycleTime || '00:00').split(':').map(Number)
  const now = new Date()
  const periods = []

  if (cycle === 'weekly') {
    const today = new Date(now)
    today.setHours(hours, minutes, 0, 0)

    let diff = today.getDay() - cycleDay
    if (diff < 0) diff += 7

    const latestCutoff = new Date(today)
    latestCutoff.setDate(latestCutoff.getDate() - diff)

    if (latestCutoff > now) {
      latestCutoff.setDate(latestCutoff.getDate() - 7)
    }

    for (let i = 0; i < count; i++) {
      const cutoff = new Date(latestCutoff)
      cutoff.setDate(cutoff.getDate() - (i * 7))

      const periodStart = new Date(cutoff)
      periodStart.setDate(periodStart.getDate() - 7)

      periods.push({
        cutoffDate: new Date(cutoff),
        startDate: new Date(periodStart),
        periodStart: referenceFormatDateTimeForApi(periodStart),
        periodEnd: referenceFormatDateTimeForApi(cutoff)
      })
    }
  } else if (cycle === 'monthly') {
    let year = now.getFullYear()
    let month = now.getMonth()

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const day = Math.min(cycleDay, daysInMonth)
    const latestCutoff = new Date(year, month, day, hours, minutes, 0, 0)

    if (latestCutoff > now) {
      month--
      if (month < 0) {
        month = 11
        year--
      }
      const prevDaysInMonth = new Date(year, month + 1, 0).getDate()
      const prevDay = Math.min(cycleDay, prevDaysInMonth)
      latestCutoff.setFullYear(year, month, prevDay)
    }

    const curYear = latestCutoff.getFullYear()
    const curMonth = latestCutoff.getMonth()

    for (let i = 0; i < count; i++) {
      const m = curMonth - i
      let y = curYear
      let adjustedMonth = m
      while (adjustedMonth < 0) {
        adjustedMonth += 12
        y--
      }

      const dim = new Date(y, adjustedMonth + 1, 0).getDate()
      const d = Math.min(cycleDay, dim)
      const cutoff = new Date(y, adjustedMonth, d, hours, minutes, 0, 0)

      let prevM = adjustedMonth - 1
      let prevY = y
      if (prevM < 0) {
        prevM = 11
        prevY--
      }
      const prevDim = new Date(prevY, prevM + 1, 0).getDate()
      const prevD = Math.min(cycleDay, prevDim)
      const periodStart = new Date(prevY, prevM, prevD, hours, minutes, 0, 0)

      periods.push({
        cutoffDate: new Date(cutoff),
        startDate: new Date(periodStart),
        periodStart: referenceFormatDateTimeForApi(periodStart),
        periodEnd: referenceFormatDateTimeForApi(cutoff)
      })
    }
  }

  return periods
}

const referenceFormatDateTimeForApi = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:00`
}

const WEEKLY_MONDAY = { gateway: 'stripe', cycle: 'weekly', cycle_day: 1, cycle_time: '05:00' }
const MONTHLY = (cycleDay, cycleTime = '00:00') => ({ gateway: 'check', cycle: 'monthly', cycle_day: cycleDay, cycle_time: cycleTime })

const pairs = (periods) => periods.map(p => [p.periodStart, p.periodEnd])

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDateTimeForApi', () => {
  it('writes the local date and time with the seconds at 00, padded', () => {
    expect(formatDateTimeForApi(new Date(2026, 0, 3, 4, 5, 59))).toBe('2026-01-03 04:05:00')
    expect(formatDateTimeForApi(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31 23:59:00')
  })
})

describe('getCutoffDates (characterization of BPR:62-162)', () => {
  it('no method, or a cycle it does not know, gives no periods', () => {
    expect(getCutoffDates(null, 12, new Date(2026, 9, 10))).toEqual([])
    expect(getCutoffDates({ cycle: 'daily', cycle_day: 1 }, 12, new Date(2026, 9, 10))).toEqual([])
  })

  it('weekly, after the cut-off hour of the day: that day is the latest cut-off', () => {
    const periods = getCutoffDates(WEEKLY_MONDAY, 3, new Date(2026, 9, 5, 6, 0))
    expect(pairs(periods)).toEqual([
      ['2026-09-28 05:00:00', '2026-10-05 05:00:00'],
      ['2026-09-21 05:00:00', '2026-09-28 05:00:00'],
      ['2026-09-14 05:00:00', '2026-09-21 05:00:00']
    ])
    expect(periods[0].cutoffDate).toEqual(new Date(2026, 9, 5, 5, 0))
    expect(periods[0].startDate).toEqual(new Date(2026, 8, 28, 5, 0))
  })

  it('weekly, before the cut-off hour of the day: the week before is the latest', () => {
    const periods = getCutoffDates(WEEKLY_MONDAY, 2, new Date(2026, 9, 5, 4, 59))
    expect(pairs(periods)).toEqual([
      ['2026-09-21 05:00:00', '2026-09-28 05:00:00'],
      ['2026-09-14 05:00:00', '2026-09-21 05:00:00']
    ])
  })

  it('weekly, in the middle of the week', () => {
    expect(pairs(getCutoffDates(WEEKLY_MONDAY, 1, new Date(2026, 9, 10, 12, 0)))).toEqual([['2026-09-28 05:00:00', '2026-10-05 05:00:00']])
  })

  it('weekly, the default count is 12', () => {
    expect(getCutoffDates(WEEKLY_MONDAY, undefined, new Date(2026, 9, 10))).toHaveLength(12)
  })

  it('monthly, a 31 cut-off in a month of 28 days falls on the 28th and goes back to the 31st', () => {
    const periods = getCutoffDates(MONTHLY(31), 4, new Date(2026, 1, 28, 12, 0))
    expect(pairs(periods)).toEqual([
      ['2026-01-31 00:00:00', '2026-02-28 00:00:00'],
      ['2025-12-31 00:00:00', '2026-01-31 00:00:00'],
      ['2025-11-30 00:00:00', '2025-12-31 00:00:00'],
      ['2025-10-31 00:00:00', '2025-11-30 00:00:00']
    ])
  })

  it('monthly, before the cut-off of a 28-day month the latest is the previous month (31st)', () => {
    const periods = getCutoffDates(MONTHLY(31), 3, new Date(2026, 1, 15))
    expect(pairs(periods)).toEqual([
      ['2025-12-31 00:00:00', '2026-01-31 00:00:00'],
      ['2025-11-30 00:00:00', '2025-12-31 00:00:00'],
      ['2025-10-31 00:00:00', '2025-11-30 00:00:00']
    ])
  })

  it('monthly, a 30 cut-off before March 30 uses the 28th of February and starts on January 30', () => {
    const periods = getCutoffDates(MONTHLY(30), 2, new Date(2026, 2, 10))
    expect(pairs(periods)).toEqual([
      ['2026-01-30 00:00:00', '2026-02-28 00:00:00'],
      ['2025-12-30 00:00:00', '2026-01-30 00:00:00']
    ])
  })

  it('monthly, a month of 30 days: the 31st is the 30th', () => {
    const periods = getCutoffDates(MONTHLY(31), 2, new Date(2026, 4, 31, 12, 0))
    expect(pairs(periods)).toEqual([
      ['2026-04-30 00:00:00', '2026-05-31 00:00:00'],
      ['2026-03-31 00:00:00', '2026-04-30 00:00:00']
    ])
  })

  it('monthly, the cut-off hour decides on the day of the cut-off', () => {
    const before = getCutoffDates(MONTHLY(15, '12:00'), 1, new Date(2026, 5, 15, 11, 59))
    const after = getCutoffDates(MONTHLY(15, '12:00'), 1, new Date(2026, 5, 15, 12, 0))
    expect(pairs(before)).toEqual([['2026-04-15 12:00:00', '2026-05-15 12:00:00']])
    expect(pairs(after)).toEqual([['2026-05-15 12:00:00', '2026-06-15 12:00:00']])
  })

  it('monthly, across the new year', () => {
    const periods = getCutoffDates(MONTHLY(5), 3, new Date(2026, 0, 10))
    expect(pairs(periods)).toEqual([
      ['2025-12-05 00:00:00', '2026-01-05 00:00:00'],
      ['2025-11-05 00:00:00', '2025-12-05 00:00:00'],
      ['2025-10-05 00:00:00', '2025-11-05 00:00:00']
    ])
  })

  it('gives the same periods as main on a grid of moments, cycles and cut-offs', () => {
    const moments = [
      new Date(2025, 0, 1, 0, 0),
      new Date(2025, 11, 31, 23, 59),
      new Date(2026, 0, 1, 5, 0),
      new Date(2026, 1, 28, 0, 0),
      new Date(2026, 2, 1, 4, 59),
      new Date(2026, 2, 30, 12, 0),
      new Date(2026, 3, 30, 23, 0),
      new Date(2026, 4, 31, 12, 0),
      new Date(2026, 9, 5, 4, 59),
      new Date(2026, 9, 5, 5, 0),
      new Date(2026, 9, 10, 12, 0),
      new Date(2028, 1, 29, 8, 30)
    ]
    const methods = [
      WEEKLY_MONDAY,
      { cycle: 'weekly', cycle_day: 0, cycle_time: '00:00' },
      { cycle: 'weekly', cycle_day: 6, cycle_time: '23:30' },
      { cycle: 'weekly', cycle_day: 3 },
      MONTHLY(1, '05:00'),
      MONTHLY(15, '12:00'),
      MONTHLY(28),
      MONTHLY(29),
      MONTHLY(30),
      MONTHLY(31, '23:59')
    ]
    moments.forEach(moment => {
      vi.setSystemTime(moment)
      methods.forEach(method => {
        const expected = referenceGetCutoffDates(method, 30)
        expect(getCutoffDates(method, 30, moment)).toEqual(expected)
        // with no `now`, it reads the clock as main did
        expect(getCutoffDates(method, 30)).toEqual(expected)
      })
    })
  })
})

describe('billingPeriods', () => {
  it('no method gives no periods', () => {
    expect(billingPeriods(null)).toEqual([])
  })

  // redesign (D-19): the last 52 weeks, like the monthly list offers the last 12; main listed every week since 1 January 2025
  it('weekly: the last 52, newest first, the first is the last closed cut-off', () => {
    const now = new Date(2026, 9, 10, 12, 0)
    vi.setSystemTime(now)
    const periods = billingPeriods(WEEKLY_MONDAY, now)
    expect(periods[0]).toMatchObject({ key: 'stripe|2026-10-05 05:00:00', periodStart: '2026-09-28 05:00:00', periodEnd: '2026-10-05 05:00:00' })
    expect(periods[0].cutoffDate).toEqual(new Date(2026, 9, 5, 5, 0))
    expect(periods[0].startDate).toEqual(new Date(2026, 8, 28, 5, 0))
    expect(periods[1].key).toBe('stripe|2026-09-28 05:00:00')
    expect(periods).toHaveLength(52)
    expect(periods.map(p => p.periodEnd)).toEqual(referenceGetCutoffDates(WEEKLY_MONDAY, 52).map(p => p.periodEnd))
    // newest first, one week apart
    periods.slice(1).forEach((period, index) => {
      expect(period.cutoffDate < periods[index].cutoffDate).toBe(true)
    })
  })

  it('weekly: the oldest period is 51 weeks before the latest cut-off, and the list does not grow with time', () => {
    const periods = billingPeriods(WEEKLY_MONDAY, new Date(2026, 9, 10, 12, 0))
    expect(periods[periods.length - 1].periodEnd).toBe('2025-10-13 05:00:00')
    expect(billingPeriods(WEEKLY_MONDAY, new Date(2028, 0, 10, 12, 0))).toHaveLength(52)
  })

  it('monthly: the last 12, newest first, key is the end of the period', () => {
    const now = new Date(2026, 9, 10, 12, 0)
    vi.setSystemTime(now)
    const periods = billingPeriods(MONTHLY(1, '05:00'), now)
    expect(periods).toHaveLength(12)
    expect(periods[0]).toMatchObject({ key: 'check|2026-10-01 05:00:00', periodStart: '2026-09-01 05:00:00', periodEnd: '2026-10-01 05:00:00' })
    expect(periods[11].key).toBe('check|2025-11-01 05:00:00')
    expect(periods.map(p => p.periodEnd)).toEqual(referenceGetCutoffDates(MONTHLY(1, '05:00'), 12).map(p => p.periodEnd))
  })

  it('reads the clock when it gets no `now`', () => {
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0))
    expect(billingPeriods(MONTHLY(1, '05:00'))[0].key).toBe('check|2026-10-01 05:00:00')
  })
})

describe('sortInvoicesNewestFirst', () => {
  it('orders by period_end descending and, on a tie, by id descending', () => {
    const invoices = [
      { id: 1, period_end: '2026-09-21 05:00:00' },
      { id: 3, period_end: '2026-10-05 05:00:00' },
      { id: 2, period_end: '2026-09-28 05:00:00' },
      { id: 10, period_end: '2026-09-28 05:00:00' },
      { id: 9, period_end: '2026-09-28 05:00:00' }
    ]
    expect(sortInvoicesNewestFirst(invoices).map(i => i.id)).toEqual([3, 10, 9, 2, 1])
  })

  it('does not mutate and tolerates null', () => {
    const invoices = [{ id: 1, period_end: '2026-01-01 00:00:00' }, { id: 2, period_end: '2026-02-01 00:00:00' }]
    const copy = [...invoices]
    const sorted = sortInvoicesNewestFirst(invoices)
    expect(sorted).not.toBe(invoices)
    expect(invoices).toEqual(copy)
    expect(sortInvoicesNewestFirst(null)).toEqual([])
    expect(sortInvoicesNewestFirst(undefined)).toEqual([])
  })

  it('an invoice with no period_end goes last', () => {
    const sorted = sortInvoicesNewestFirst([{ id: 5 }, { id: 1, period_end: '2026-01-01 00:00:00' }])
    expect(sorted.map(i => i.id)).toEqual([1, 5])
  })
})

describe('invoiceStatusFamily', () => {
  it.each([
    ['pending', 'pending'],
    ['paid', 'done'],
    ['completed', 'done'],
    ['cancelled', 'cancel'],
    ['canceled', 'cancel'],
    ['void', 'cancel'],
    ['PAID', 'done'],
    ['on_hold', 'review'],
    ['failed', 'review']
  ])('%s is %s', (status, family) => {
    expect(invoiceStatusFamily(status)).toBe(family)
  })

  it('no status is null', () => {
    expect(invoiceStatusFamily(undefined)).toBeNull()
    expect(invoiceStatusFamily(null)).toBeNull()
    expect(invoiceStatusFamily('')).toBeNull()
  })

  it('exposes the map', () => {
    expect(INVOICE_STATUS_FAMILY).toEqual({ pending: 'pending', paid: 'done', completed: 'done', cancelled: 'cancel', canceled: 'cancel', void: 'cancel' })
  })
})

describe('historyPresetRange', () => {
  it('lists the four presets', () => {
    expect(HISTORY_PRESETS).toEqual(['this_month', 'last_month', 'last_3_months', 'this_year'])
  })

  it('this month: the 1st to today', () => {
    expect(historyPresetRange('this_month', '2026-10-10')).toEqual({ from: '2026-10-01', to: '2026-10-10' })
    expect(historyPresetRange('this_month', '2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-01' })
  })

  it('last month: the 1st to the last day of the previous month', () => {
    expect(historyPresetRange('last_month', '2026-10-10')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(historyPresetRange('last_month', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(historyPresetRange('last_month', '2028-03-05')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(historyPresetRange('last_month', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('last 3 months: the 1st of two months ago to today', () => {
    expect(historyPresetRange('last_3_months', '2026-10-10')).toEqual({ from: '2026-08-01', to: '2026-10-10' })
    expect(historyPresetRange('last_3_months', '2026-02-10')).toEqual({ from: '2025-12-01', to: '2026-02-10' })
  })

  it('this year: 1 January to today', () => {
    expect(historyPresetRange('this_year', '2026-10-10')).toEqual({ from: '2026-01-01', to: '2026-10-10' })
    expect(historyPresetRange('this_year', '2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-01' })
  })

  it('a preset that does not exist is null', () => {
    expect(historyPresetRange('yesterday', '2026-10-10')).toBeNull()
  })
})

describe('file names', () => {
  it('the payment history PDF (BPR:342)', () => {
    expect(paymentHistoryFileName(2, '2026-10-03', '2026-10-09')).toBe('payment_history_2_2026-10-03_to_2026-10-09.pdf')
  })

  it('the payment report CSV takes the day of the end of the period (BPR:383-384)', () => {
    expect(paymentReportFileName('stripe', '2026-10-05 05:00:00')).toBe('payment-report-stripe-2026-10-05.csv')
  })
})

describe('formatAmount (BP-M6)', () => {
  // the shape of the project's parsePrice: currency, space, grouped number (it groups a negative with its minus sign)
  const parsePrice = (value) => `$ ${Number(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
  it('puts the sign in front of the currency instead of inside the digits', () => {
    expect(formatAmount(parsePrice, -177.76)).toBe('-$ 177.76')
    expect(formatAmount(parsePrice, '-0.12')).toBe('-$ 0.12')
  })
  it('leaves positive amounts and zero as parsePrice paints them; null is 0', () => {
    expect(formatAmount(parsePrice, 1234.5)).toBe('$ 1,234.50')
    expect(formatAmount(parsePrice, 0)).toBe('$ 0.00')
    expect(formatAmount(parsePrice, null)).toBe('$ 0.00')
  })
})

describe('billingPeriods · the key names the method too (review r1 H4)', () => {
  it('two weekly methods with the same cycle do not share keys', () => {
    const now = new Date(2026, 9, 10, 12, 0, 0)
    const ach = { ...WEEKLY_MONDAY, gateway: 'ach' }
    const a = billingPeriods(WEEKLY_MONDAY, now)
    const b = billingPeriods(ach, now)
    expect(a[0].periodEnd).toBe(b[0].periodEnd)
    expect(a[0].key).not.toBe(b[0].key)
  })
})
