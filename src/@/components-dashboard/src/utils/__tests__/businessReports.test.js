import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  REPORT_PRESETS,
  bucketSeries,
  comparisonPlan,
  csvCell,
  daysBetween,
  downloadCsv,
  periodOf,
  shiftDay,
  splitDuration,
  sumByNow,
  toCsv,
  zonedNow
} from '../businessReports'

// redesign bi FA1 (D2, D3, D7, BI-01, BI-07, BI-16, BI-22, auditor 1, 2, 3, 8): pure helpers of /intelligence/business

// "Now" is Friday 2026-10-09 15:30 local time
const NOW = new Date(2026, 9, 9, 15, 30)
const sum = (series) => series.reduce((total, item) => total + item.value, 0)
const sumOfRows = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

describe('REPORT_PRESETS', () => {
  it('lists the four lapses of main in order', () => {
    expect(REPORT_PRESETS).toEqual(['today', 'yesterday', 'last_7_days', 'last_30_days'])
  })
})

describe('shiftDay and daysBetween', () => {
  it('moves a local day across month and year ends', () => {
    expect(shiftDay('2026-10-09', -1)).toBe('2026-10-08')
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2027-03-01', -1)).toBe('2027-02-28')
    expect(shiftDay('2026-10-09', 0)).toBe('2026-10-09')
  })

  it('counts both ends', () => {
    expect(daysBetween('2026-10-09', '2026-10-09')).toBe(1)
    expect(daysBetween('2026-10-02', '2026-10-09')).toBe(8)
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(4)
  })

  it('does not drift on the days the clocks change', () => {
    expect(daysBetween('2026-03-25', '2026-03-30')).toBe(6)
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(4)
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('periodOf', () => {
  it('today is one day answered by hour', () => {
    expect(periodOf('today', NOW)).toEqual({ from: '2026-10-09', to: '2026-10-09', days: 1, includesToday: true, granularity: 'hour' })
  })

  it('yesterday is one closed day answered by hour', () => {
    expect(periodOf('yesterday', NOW)).toEqual({ from: '2026-10-08', to: '2026-10-08', days: 1, includesToday: false, granularity: 'hour' })
  })

  it('last_7_days is 7 closed days plus today: 8 dates by day', () => {
    expect(periodOf('last_7_days', NOW)).toEqual({ from: '2026-10-02', to: '2026-10-09', days: 8, includesToday: true, granularity: 'day' })
  })

  it('last_30_days is 30 closed days plus today: 31 dates by day', () => {
    expect(periodOf('last_30_days', NOW)).toEqual({ from: '2026-09-09', to: '2026-10-09', days: 31, includesToday: true, granularity: 'day' })
  })

  it('a custom range of 31 dates is by day and of 32 dates is by month', () => {
    expect(periodOf('2026-09-01,2026-10-01', NOW)).toEqual({ from: '2026-09-01', to: '2026-10-01', days: 31, includesToday: false, granularity: 'day' })
    expect(periodOf('2026-09-01,2026-10-02', NOW)).toMatchObject({ days: 32, granularity: 'month' })
  })

  it('a custom range of one date is answered by hour, and includes today only when it is today', () => {
    expect(periodOf('2026-10-03,2026-10-03', NOW)).toEqual({ from: '2026-10-03', to: '2026-10-03', days: 1, includesToday: false, granularity: 'hour' })
    expect(periodOf('2026-10-09,2026-10-09', NOW)).toMatchObject({ includesToday: true, granularity: 'hour' })
  })

  it('a custom range that reaches today includes it', () => {
    expect(periodOf('2026-10-01,2026-10-09', NOW)).toMatchObject({ days: 9, includesToday: true, granularity: 'day' })
  })

  it('crosses a year change', () => {
    const january = new Date(2027, 0, 5, 9, 0)
    expect(periodOf('last_7_days', january)).toMatchObject({ from: '2026-12-29', to: '2027-01-05', days: 8 })
    expect(periodOf('last_30_days', january)).toMatchObject({ from: '2026-12-06', to: '2027-01-05', days: 31 })
    expect(periodOf('2026-12-30,2027-01-02', january)).toMatchObject({ days: 4, granularity: 'day' })
  })

  it('reads the local day, not the UTC day, at the end of the evening', () => {
    expect(periodOf('today', new Date(2026, 9, 9, 23, 59))).toMatchObject({ from: '2026-10-09', to: '2026-10-09' })
    expect(periodOf('today', new Date(2026, 9, 9, 0, 1))).toMatchObject({ from: '2026-10-09', to: '2026-10-09' })
  })

  it('falls back to today for an unknown lapse', () => {
    expect(periodOf('nonsense', NOW)).toMatchObject({ from: '2026-10-09', to: '2026-10-09', granularity: 'hour' })
    expect(periodOf(undefined, NOW)).toMatchObject({ from: '2026-10-09', to: '2026-10-09' })
  })
})

describe('comparisonPlan (D2, auditor 1)', () => {
  it('today compares by now with yesterday up to the current hour', () => {
    expect(comparisonPlan('today', NOW)).toEqual({ mode: 'byNow', previous: '2026-10-08,2026-10-08', hour: 15 })
  })

  it('a custom range of one day that is today works like today', () => {
    expect(comparisonPlan('2026-10-09,2026-10-09', new Date(2026, 9, 9, 0, 5))).toEqual({
      mode: 'byNow', previous: '2026-10-08,2026-10-08', hour: 0
    })
  })

  it('yesterday compares with the day before', () => {
    expect(comparisonPlan('yesterday', NOW)).toEqual({ mode: 'previous', previous: '2026-10-07,2026-10-07', days: 1 })
  })

  it('a past range compares with the same number of days right before', () => {
    expect(comparisonPlan('2026-09-01,2026-09-10', NOW)).toEqual({ mode: 'previous', previous: '2026-08-22,2026-08-31', days: 10 })
    expect(comparisonPlan('2026-10-03,2026-10-03', NOW)).toEqual({ mode: 'previous', previous: '2026-10-02,2026-10-02', days: 1 })
  })

  it('last_7_days compares the closed days only', () => {
    expect(comparisonPlan('last_7_days', NOW)).toEqual({
      mode: 'closed', current: '2026-10-02,2026-10-08', previous: '2026-09-25,2026-10-01', days: 7
    })
  })

  it('last_30_days compares 30 closed days with the 30 before', () => {
    const plan = comparisonPlan('last_30_days', NOW)
    expect(plan).toEqual({
      mode: 'closed', current: '2026-09-09,2026-10-08', previous: '2026-08-10,2026-09-08', days: 30
    })
    expect(daysBetween(...plan.current.split(','))).toBe(30)
    expect(daysBetween(...plan.previous.split(','))).toBe(30)
  })

  it('a range that reaches today compares its closed days', () => {
    expect(comparisonPlan('2026-10-01,2026-10-09', NOW)).toEqual({
      mode: 'closed', current: '2026-10-01,2026-10-08', previous: '2026-09-23,2026-09-30', days: 8
    })
  })

  it('crosses a year change', () => {
    expect(comparisonPlan('last_7_days', new Date(2027, 0, 5, 9))).toEqual({
      mode: 'closed', current: '2026-12-29,2027-01-04', previous: '2026-12-22,2026-12-28', days: 7
    })
    expect(comparisonPlan('yesterday', new Date(2027, 0, 1, 9))).toEqual({
      mode: 'previous', previous: '2026-12-30,2026-12-30', days: 1
    })
  })

  it('a range that starts in the future is compared like a past one, never crashing', () => {
    expect(comparisonPlan('2026-10-12,2026-10-14', NOW)).toMatchObject({ mode: 'previous', days: 3, previous: '2026-10-09,2026-10-11' })
  })
})

// redesign bi R1 (F1: the time zone the user picked decides today, the period and the comparison)
// 2026-10-10T04:06:00Z is 23:06 on 09-10 in Chicago, 13:06 on 10-10 in Tokyo and 06:06 on 10-10 in Madrid
describe('zonedNow (R1 F1)', () => {
  const INSTANT = new Date('2026-10-10T04:06:00Z')
  const fields = (date) => [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]

  it('gives a date whose local fields are the wall clock of the zone', () => {
    expect(fields(zonedNow('Asia/Tokyo', INSTANT))).toEqual([2026, 9, 10, 13, 6])
    expect(fields(zonedNow('America/Chicago', INSTANT))).toEqual([2026, 9, 9, 23, 6])
    expect(fields(zonedNow('Europe/Madrid', INSTANT))).toEqual([2026, 9, 10, 6, 6])
  })

  it('reads midnight as hour 0 of the new day, never as 24', () => {
    // 15:00Z is 00:00 of 11-10 in Tokyo
    expect(fields(zonedNow('Asia/Tokyo', new Date('2026-10-10T15:00:00Z')))).toEqual([2026, 9, 11, 0, 0])
  })

  it('crosses a year end in the zone', () => {
    expect(fields(zonedNow('Pacific/Auckland', new Date('2026-12-31T12:30:00Z')))).toEqual([2027, 0, 1, 1, 30])
  })

  it('an empty or invalid zone gives the instant as it is', () => {
    ;['', undefined, null, 'Not/AZone'].forEach((zone) => {
      expect(zonedNow(zone, INSTANT).getTime()).toBe(INSTANT.getTime())
    })
  })

  it('defaults to the current instant', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(INSTANT)
    expect(fields(zonedNow('Asia/Tokyo'))).toEqual([2026, 9, 10, 13, 6])
    vi.useRealTimers()
  })

  it('today in Tokyo compares with the 09-10 up to hour 13, not with the day of the browser', () => {
    expect(comparisonPlan('today', zonedNow('Asia/Tokyo', INSTANT))).toEqual({ mode: 'byNow', previous: '2026-10-09,2026-10-09', hour: 13 })
    expect(periodOf('today', zonedNow('Asia/Tokyo', INSTANT))).toMatchObject({ from: '2026-10-10', to: '2026-10-10' })
  })

  it('last 7 days in Madrid compares the closed days 03-10 to 09-10', () => {
    const now = zonedNow('Europe/Madrid', INSTANT)
    expect(comparisonPlan('last_7_days', now)).toEqual({
      mode: 'closed', current: '2026-10-03,2026-10-09', previous: '2026-09-26,2026-10-02', days: 7
    })
    expect(periodOf('last_7_days', now)).toMatchObject({ from: '2026-10-03', to: '2026-10-10', days: 8 })
  })
})

// redesign (row 71 Q-10): the zone's wall hour may not exist in the browser's zone (its clock change), and `new Date(y, m, d, h)`
// then moves it one hour forward. The test does not depend on the TZ of the runner: it stands in for the browser with a `Date` whose
// local clock skips 02:00-02:59 on 2026-10-10 (what `new Date(2026, 9, 10, 2, 30)` does in a zone that springs forward that night).
describe('zonedNow · hour inside the browser clock change (Q-10)', () => {
  const RealDate = Date
  const skipsHour = () => {
    class GapDate extends RealDate {
      constructor (...args) {
        if (args.length >= 4 && args[0] === 2026 && args[1] === 9 && args[2] === 10 && args[3] === 2) {
          super(args[0], args[1], args[2], 3, ...args.slice(4))
        } else {
          super(...args)
        }
      }
    }
    vi.stubGlobal('Date', GapDate)
  }
  afterEach(() => vi.unstubAllGlobals())

  // 2026-10-09T17:30Z is 02:30 on 10-10 in Tokyo
  const INSTANT = new RealDate('2026-10-09T17:30:00Z')

  it('keeps the hour of the zone: 02:30, not 03:30', () => {
    skipsHour()
    const date = zonedNow('Asia/Tokyo', INSTANT)
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2026, 9, 10, 2, 30])
  })

  it('«today» compares with yesterday up to hour 2, not 3', () => {
    skipsHour()
    expect(comparisonPlan('today', zonedNow('Asia/Tokyo', INSTANT))).toEqual({ mode: 'byNow', previous: '2026-10-09,2026-10-09', hour: 2 })
  })

  it('leaves a date outside the gap as a plain Date', () => {
    skipsHour()
    const date = zonedNow('Asia/Tokyo', new RealDate('2026-10-10T04:06:00Z')) // 13:06 in Tokyo
    expect(date.getHours()).toBe(13)
    expect(Object.prototype.hasOwnProperty.call(date, 'getHours')).toBe(false)
  })
})

describe('bucketSeries · hour (D7, BI-01)', () => {
  const yesterday = periodOf('yesterday', NOW)

  it('has 24 elements and puts each row on the hour where it starts (measured case)', () => {
    const rows = [
      { time: '2026-10-08 14:00:00', orders: 1 },
      { time: '2026-10-08 15:00:00', orders: 2 },
      { time: '2026-10-09 00:00:00', orders: 4 }
    ]
    const series = bucketSeries(rows, 'orders', yesterday)
    expect(series).toHaveLength(24)
    expect(series[0].bucket).toBe('2026-10-08 00')
    expect(series[23].bucket).toBe('2026-10-08 23')
    expect(series[13]).toEqual({ bucket: '2026-10-08 13', value: 1 })
    expect(series[14]).toEqual({ bucket: '2026-10-08 14', value: 2 })
    expect(series[23]).toEqual({ bucket: '2026-10-08 23', value: 4 })
    expect(series.filter(item => item.value === 0)).toHaveLength(21)
    expect(sum(series)).toBe(7)
  })

  it('a row stamped D 00:00 goes to hour 00', () => {
    const series = bucketSeries([{ time: '2026-10-08 00:00:00', orders: 3 }], 'orders', yesterday)
    expect(series[0]).toEqual({ bucket: '2026-10-08 00', value: 3 })
    expect(sum(series)).toBe(3)
  })

  it('the 01:00 row is the hour 00 and the 24:00 one the hour 23', () => {
    const series = bucketSeries([
      { time: '2026-10-08 01:00:00', sales: 5 },
      { time: '2026-10-08 23:00:00', sales: 6 }
    ], 'sales', yesterday)
    expect(series[0].value).toBe(5)
    expect(series[22].value).toBe(6)
  })

  it('never discards a row: the ones outside the day are clamped to the first or last hour', () => {
    const rows = [
      { time: '2026-10-07 10:00:00', orders: 1 },
      { time: '2026-10-10 10:00:00', orders: 2 }
    ]
    const series = bucketSeries(rows, 'orders', yesterday)
    expect(series).toHaveLength(24)
    expect(sum(series)).toBe(3)
  })

  it('answers 24 zeros with no rows, null, or rows without a readable time', () => {
    expect(bucketSeries([], 'orders', yesterday)).toHaveLength(24)
    expect(sum(bucketSeries(null, 'orders', yesterday))).toBe(0)
    expect(sum(bucketSeries([{ orders: 5 }, null, { time: 'x', orders: 4 }], 'orders', yesterday))).toBe(0)
  })
})

describe('bucketSeries · day (D7, BI-01, BI-22)', () => {
  const period = { from: '2026-10-02', to: '2026-10-06', granularity: 'day' }

  it('has one element per day, with 0 in the gaps and nothing outside the range', () => {
    const rows = [
      { time: '2026-10-03 00:00:00', sales: 10 },
      { time: '2026-10-05 00:00:00', sales: 7 }
    ]
    expect(bucketSeries(rows, 'sales', period)).toEqual([
      { bucket: '2026-10-02', value: 0 },
      { bucket: '2026-10-03', value: 10 },
      { bucket: '2026-10-04', value: 0 },
      { bucket: '2026-10-05', value: 7 },
      { bucket: '2026-10-06', value: 0 }
    ])
  })

  it('a row stamped the day after the range (the last hour of the last day) is added to the last day', () => {
    const rows = [
      { time: '2026-10-06 00:00:00', sales: 4 },
      { time: '2026-10-07 00:00:00', sales: 3 }
    ]
    const series = bucketSeries(rows, 'sales', period)
    expect(series).toHaveLength(5)
    expect(series[4]).toEqual({ bucket: '2026-10-06', value: 7 })
    expect(sum(series)).toBe(7)
  })

  it('a row before the range is added to the first day', () => {
    const series = bucketSeries([{ time: '2026-10-01 00:00:00', sales: 5 }, { time: '2026-10-02 00:00:00', sales: 1 }], 'sales', period)
    expect(series[0]).toEqual({ bucket: '2026-10-02', value: 6 })
    expect(series).toHaveLength(5)
  })

  it('adds rows of the same day and reads text numbers', () => {
    const rows = [{ time: '2026-10-04 08:00:00', orders: 1 }, { time: '2026-10-04 12:00:00', orders: '2' }]
    expect(bucketSeries(rows, 'orders', period)[2]).toEqual({ bucket: '2026-10-04', value: 3 })
  })

  it('the sum of the series is the sum of the key of every row (invariant)', () => {
    const rows = [
      { time: '2026-09-28 00:00:00', sales: 11.5 },
      { time: '2026-10-02 00:00:00', sales: 2 },
      { time: '2026-10-03 00:00:00', sales: '3.25' },
      { time: '2026-10-06 00:00:00', sales: 4 },
      { time: '2026-10-07 00:00:00', sales: 5 },
      { time: '2026-10-20 00:00:00', sales: 6 }
    ]
    expect(sum(bucketSeries(rows, 'sales', period))).toBeCloseTo(sumOfRows(rows, 'sales'), 10)
  })

  it('crosses a year end without skipping a day', () => {
    const series = bucketSeries([], 'sales', { from: '2026-12-30', to: '2027-01-02', granularity: 'day' })
    expect(series.map(item => item.bucket)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('a 31-day period has 31 elements', () => {
    const series = bucketSeries([], 'sales', periodOf('last_30_days', NOW))
    expect(series).toHaveLength(31)
  })
})

describe('bucketSeries · month (D7)', () => {
  const period = { from: '2026-01-15', to: '2026-04-02', granularity: 'month' }

  it('has one element per month from the first to the last, in YYYY-MM', () => {
    const rows = [
      { time: '2026-01-01 00:00:00', orders: 1 },
      { time: '2026-03-01 00:00:00', orders: 3 }
    ]
    expect(bucketSeries(rows, 'orders', period)).toEqual([
      { bucket: '2026-01', value: 1 },
      { bucket: '2026-02', value: 0 },
      { bucket: '2026-03', value: 3 },
      { bucket: '2026-04', value: 0 }
    ])
  })

  it('never discards a row: before the first month or after the last go to the ends', () => {
    const rows = [
      { time: '2025-12-01 00:00:00', orders: 10 },
      { time: '2026-04-01 00:00:00', orders: 20 },
      { time: '2026-05-01 00:00:00', orders: 30 }
    ]
    const series = bucketSeries(rows, 'orders', period)
    expect(series[0].value).toBe(10)
    expect(series[3].value).toBe(50)
    expect(sum(series)).toBe(60)
  })

  it('crosses a year change', () => {
    const series = bucketSeries([], 'orders', { from: '2025-11-03', to: '2026-02-20', granularity: 'month' })
    expect(series.map(item => item.bucket)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('sumByNow (D2: yesterday by this time)', () => {
  const rows = [
    { time: '2026-10-08 10:00:00', orders: 1, sales: 10 },
    { time: '2026-10-08 14:00:00', orders: 2, sales: 20 },
    { time: '2026-10-08 15:00:00', orders: 4, sales: 40 },
    { time: '2026-10-08 16:00:00', orders: 8, sales: 80 },
    { time: '2026-10-09 00:00:00', orders: 16, sales: 160 }
  ]

  it('adds the rows whose hour started at or before the current hour', () => {
    // 15:00 closes the hour that starts at 14
    expect(sumByNow(rows, 'orders', 14, '2026-10-08')).toBe(1 + 2 + 4)
    expect(sumByNow(rows, 'orders', 13, '2026-10-08')).toBe(1 + 2)
    expect(sumByNow(rows, 'orders', 9, '2026-10-08')).toBe(1)
    expect(sumByNow(rows, 'orders', 8, '2026-10-08')).toBe(0)
  })

  it('counts the row of the next midnight as the hour 24, only at 23', () => {
    expect(sumByNow(rows, 'orders', 22, '2026-10-08')).toBe(15)
    expect(sumByNow(rows, 'orders', 23, '2026-10-08')).toBe(31)
  })

  it('infers the day from the earliest row when it is not given', () => {
    expect(sumByNow(rows, 'sales', 14)).toBe(70)
    expect(sumByNow(rows, 'sales', 23)).toBe(310)
  })

  it('a row stamped D 00:00 counts from the first hour', () => {
    expect(sumByNow([{ time: '2026-10-08 00:00:00', orders: 3 }], 'orders', 0, '2026-10-08')).toBe(3)
  })

  it('answers 0 with nothing', () => {
    expect(sumByNow(null, 'orders', 10)).toBe(0)
    expect(sumByNow([], 'orders', 10)).toBe(0)
    expect(sumByNow([{ orders: 3 }], 'orders', 10)).toBe(0)
  })
})

describe('splitDuration (BI-11)', () => {
  it('splits the measured 30-day value into 5 h 45 min 5 s', () => {
    expect(splitDuration(20704.95)).toEqual({ hours: 5, minutes: 45, seconds: 5 })
  })

  it('accepts text and the measured 7-day value', () => {
    expect(splitDuration('19014')).toEqual({ hours: 5, minutes: 16, seconds: 54 })
    expect(splitDuration('20704.95')).toEqual({ hours: 5, minutes: 45, seconds: 5 })
  })

  it('rounds to the second and carries into the minute', () => {
    expect(splitDuration(59.4)).toEqual({ hours: 0, minutes: 0, seconds: 59 })
    expect(splitDuration(59.6)).toEqual({ hours: 0, minutes: 1, seconds: 0 })
    expect(splitDuration(3599.7)).toEqual({ hours: 1, minutes: 0, seconds: 0 })
  })

  it('zero is a valid duration', () => {
    expect(splitDuration(0)).toEqual({ hours: 0, minutes: 0, seconds: 0 })
    expect(splitDuration('0')).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })

  it('is null for a negative or non-numeric value', () => {
    expect(splitDuration(-1)).toBeNull()
    expect(splitDuration('-3')).toBeNull()
    expect(splitDuration('x')).toBeNull()
    expect(splitDuration('')).toBeNull()
    expect(splitDuration(null)).toBeNull()
    expect(splitDuration(undefined)).toBeNull()
    expect(splitDuration(NaN)).toBeNull()
    expect(splitDuration([])).toBeNull()
    expect(splitDuration({})).toBeNull()
  })
})

describe('csvCell and toCsv (BI-16)', () => {
  it('leaves a plain value as it is', () => {
    expect(csvCell('Pizza')).toBe('Pizza')
    expect(csvCell(12.5)).toBe('12.5')
    expect(csvCell(0)).toBe('0')
    expect(csvCell('2026-10-08 14:00:00')).toBe('2026-10-08 14:00:00')
  })

  it('quotes a value with a comma, a quote or a line break, doubling the quotes', () => {
    expect(csvCell('Pizza, large')).toBe('"Pizza, large"')
    expect(csvCell('The "best" one')).toBe('"The ""best"" one"')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell('carriage\rreturn')).toBe('"carriage\rreturn"')
  })

  it('writes an empty cell for null and undefined', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('keeps the shape of main: «A, B» header and every row ending in a comma', () => {
    expect(toCsv(['Time', 'Orders'], [['2026-10-08 14:00:00', 3], ['2026-10-08 15:00:00', 5]]))
      .toBe('Time, Orders\n2026-10-08 14:00:00,3,\n2026-10-08 15:00:00,5,\n')
  })

  it('a name like «Pizza, large» comes out quoted and the row keeps its trailing comma', () => {
    expect(toCsv(['Name', 'Sales'], [['Pizza, large', 12]])).toBe('Name, Sales\n"Pizza, large",12,\n')
  })

  it('writes the header alone for no rows, and survives null rows', () => {
    expect(toCsv(['A', 'B'], [])).toBe('A, B\n')
    expect(toCsv(['A', 'B'], null)).toBe('A, B\n')
  })
})

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clicks a link with the file name and the BOM plus the CSV as a data URL, like main', async () => {
    const clicked = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.push({ download: this.download, href: this.href })
    })
    downloadCsv('orders_1.csv', 'A, B\n1,2,\n')
    await vi.waitFor(() => expect(clicked).toHaveLength(1))
    expect(clicked[0].download).toBe('orders_1.csv')
    expect(clicked[0].href.startsWith('data:text/csv')).toBe(true)
    const encoded = clicked[0].href.split(',').slice(1).join(',')
    expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe('﻿A, B\n1,2,\n')
  })
})
