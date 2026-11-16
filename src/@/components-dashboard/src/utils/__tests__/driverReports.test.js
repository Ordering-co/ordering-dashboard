import { describe, expect, it } from 'vitest'
import { pairsByAt, periodOfChartReport, rowsOfChartReport, secondsOf, seriesOfChartReport, spendSeries, topDriverItems } from '../driverReports'

// redesign drivers FB (D6, DR-03, DR-13, DR-19): the pure derivations of the data of /intelligence/drivers

const ordersReport = (data) => ({ type: 'chart', dataset: { dataset: { label: 'Orders', data } } })
const salesReport = (...series) => ({ type: 'chart', dataset: { dataset: series } })
const withPeriod = (from, to) => ({ type: 'chart', dataset: { x: { from, to }, dataset: [] } })

// redesign drivers FB (phase-1 audit: Sales draws every series, as main)
describe('seriesOfChartReport', () => {
  it('gives one entry per series of the array form, with its label and rows', () => {
    const result = salesReport(
      { label: 'A', data: [{ x: '2026-09-10 10:00:00', y: 50 }] },
      { label: 'B', data: [{ x: '2026-09-10 11:00', y: '7' }, { x: '2026-09-10 12:00:00', y: 1 }] }
    )
    expect(seriesOfChartReport(result, 'sales')).toEqual([
      { label: 'A', rows: [{ time: '2026-09-10 10:00:00', sales: 50 }] },
      { label: 'B', rows: [{ time: '2026-09-10 11:00:00', sales: 7 }, { time: '2026-09-10 12:00:00', sales: 1 }] }
    ])
  })

  it('gives a single entry for the object form', () => {
    expect(seriesOfChartReport(ordersReport([{ x: '2026-09-10 10:00', y: 2 }]), 'orders')).toEqual([
      { label: 'Orders', rows: [{ time: '2026-09-10 10:00:00', orders: 2 }] }
    ])
  })

  it('a series without points has no rows, and a missing label is an empty text', () => {
    expect(seriesOfChartReport(salesReport({ label: 'A' }, { data: [{ x: '2026-09-10', y: 1 }] }), 'sales')).toEqual([
      { label: 'A', rows: [] },
      { label: '', rows: [{ time: '2026-09-10 00:00:00', sales: 1 }] }
    ])
  })

  it('is [] for anything else', () => {
    ;[null, undefined, 0, 'x', [], {}, { dataset: {} }, { dataset: { dataset: null } }, salesReport(), salesReport(null)]
      .forEach(value => expect(seriesOfChartReport(value, 'sales')).toEqual([]))
  })

  it('does not mutate the input', () => {
    const result = salesReport({ label: 'A', data: [{ x: '2026-09-10 12:00', y: '5' }] }, { label: 'B', data: [] })
    const copy = JSON.parse(JSON.stringify(result))
    seriesOfChartReport(result, 'sales')
    expect(result).toEqual(copy)
  })
})

// redesign drivers FB (phase-1 audit: the axis follows the range the response carries, not the zone)
describe('periodOfChartReport', () => {
  it('is hour when from is to', () => {
    expect(periodOfChartReport(withPeriod('2026-10-09 00:00:00', '2026-10-09 23:59:59'))).toEqual({ from: '2026-10-09', to: '2026-10-09', granularity: 'hour' })
  })

  it('is day from 2 to 31 days, both ends counted', () => {
    expect(periodOfChartReport(withPeriod('2026-10-08', '2026-10-09'))).toEqual({ from: '2026-10-08', to: '2026-10-09', granularity: 'day' })
    expect(periodOfChartReport(withPeriod('2026-09-09', '2026-10-09'))).toEqual({ from: '2026-09-09', to: '2026-10-09', granularity: 'day' })
  })

  it('is month beyond 31 days', () => {
    expect(periodOfChartReport(withPeriod('2026-09-08', '2026-10-09'))).toEqual({ from: '2026-09-08', to: '2026-10-09', granularity: 'month' })
    expect(periodOfChartReport(withPeriod('2026-01-01', '2026-10-09')).granularity).toBe('month')
  })

  it('is null when the range is missing or unreadable', () => {
    ;[null, undefined, 0, 'x', [], {}, { dataset: {} }, { dataset: { x: null } }, { dataset: { x: { from: '2026-10-09' } } },
      { dataset: { x: { from: 'soon', to: 'later' } } }].forEach(value => expect(periodOfChartReport(value)).toBeNull())
  })
})

describe('rowsOfChartReport', () => {
  it('turns the object of driver_orders_v2 into rows of the value key', () => {
    const result = ordersReport([{ x: '2026-09-10 10:00:00', y: 2 }, { x: '2026-09-10 11:00:00', y: '3' }])
    expect(rowsOfChartReport(result, 'orders')).toEqual([
      { time: '2026-09-10 10:00:00', orders: 2 },
      { time: '2026-09-10 11:00:00', orders: 3 }
    ])
  })

  it('takes only the first series of the array of driver_sales_v2 (P7, as main)', () => {
    const result = salesReport(
      { label: 'A', data: [{ x: '2026-09-10 10:00:00', y: 50 }] },
      { label: 'B', data: [{ x: '2026-09-10 10:00:00', y: 999 }] }
    )
    expect(rowsOfChartReport(result, 'sales')).toEqual([{ time: '2026-09-10 10:00:00', sales: 50 }])
  })

  it('completes an x without seconds', () => {
    const result = ordersReport([{ x: '2026-09-10 12:00', y: 1 }])
    expect(rowsOfChartReport(result, 'orders')).toEqual([{ time: '2026-09-10 12:00:00', orders: 1 }])
  })

  it('completes an x that is only a day', () => {
    const result = ordersReport([{ x: '2026-09-10', y: 1 }])
    expect(rowsOfChartReport(result, 'orders')).toEqual([{ time: '2026-09-10 00:00:00', orders: 1 }])
  })

  it('returns an array of rows as it comes', () => {
    const rows = [{ time: '2026-09-10 10:00:00', orders: 4 }]
    expect(rowsOfChartReport(rows, 'orders')).toBe(rows)
    expect(rowsOfChartReport([], 'orders')).toEqual([])
  })

  it('gives [] for anything else, an empty series included', () => {
    ;[null, undefined, 0, 'x', {}, { dataset: {} }, { dataset: { dataset: null } }, ordersReport([]), ordersReport(null), salesReport(), salesReport(null)]
      .forEach(value => expect(rowsOfChartReport(value, 'orders')).toEqual([]))
  })

  it('does not mutate the input', () => {
    const result = salesReport({ label: 'A', data: [{ x: '2026-09-10 12:00', y: '5' }] })
    const copy = JSON.parse(JSON.stringify(result))
    rowsOfChartReport(result, 'sales')
    expect(result).toEqual(copy)
  })
})

describe('secondsOf', () => {
  it('reads a finite number or a numeric text', () => {
    expect(secondsOf(600)).toBe(600)
    expect(secondsOf('20704.95')).toBe(20704.95)
    expect(secondsOf(0)).toBe(0)
    expect(secondsOf('0')).toBe(0)
  })

  it('is null for anything that is not a duration', () => {
    ;[null, undefined, '', '  ', 'abc', NaN, Infinity, [], {}, true].forEach(value => expect(secondsOf(value)).toBeNull())
  })

  it('is null for a negative average (DR-19)', () => {
    expect(secondsOf(-1)).toBeNull()
    expect(secondsOf('-40.5')).toBeNull()
  })
})

// redesign drivers FB (phase-1 audit: `at` is an hour in Today/Yesterday, a day in 2-31 days, a month beyond, so it is never reduced)
describe('pairsByAt', () => {
  it('joins the two lists by the exact `at` and gives the seconds (hourly)', () => {
    const result = {
      available: [{ at: '2026-09-10 10:00:00', time: 3600 }, { at: '2026-09-10 11:00:00', time: '7200' }],
      not_available: [{ at: '2026-09-10 10:00:00', time: 1800 }, { at: '2026-09-10 11:00:00', time: 900 }]
    }
    expect(pairsByAt(result, 'available', 'not_available')).toEqual([
      { at: '2026-09-10 10:00:00', first: 3600, second: 1800 },
      { at: '2026-09-10 11:00:00', first: 7200, second: 900 }
    ])
  })

  it('keeps the hours of a day apart, they are not merged into the day (daily vs hourly)', () => {
    const result = {
      available: [{ at: '2026-09-10 10:00:00', time: 1 }, { at: '2026-09-10 11:00:00', time: 2 }],
      not_available: []
    }
    expect(pairsByAt(result, 'available', 'not_available')).toHaveLength(2)
  })

  it('joins by day when `at` is a day (2 to 31 days)', () => {
    const result = {
      available: [{ at: '2026-09-10', time: 3600 }, { at: '2026-09-11', time: 7200 }],
      not_available: [{ at: '2026-09-10', time: 1800 }, { at: '2026-09-11', time: 900 }]
    }
    expect(pairsByAt(result, 'available', 'not_available')).toEqual([
      { at: '2026-09-10', first: 3600, second: 1800 },
      { at: '2026-09-11', first: 7200, second: 900 }
    ])
  })

  it('joins by month when `at` is a month (beyond 31 days)', () => {
    const result = { busy: [{ at: '2026-08', time: 5 }, { at: '2026-09', time: 6 }], not_busy: [{ at: '2026-09', time: 60 }] }
    expect(pairsByAt(result, 'busy', 'not_busy')).toEqual([
      { at: '2026-08', first: 5, second: null },
      { at: '2026-09', first: 6, second: 60 }
    ])
  })

  it('orders by `at`, whatever the order they come in (DR-03)', () => {
    const result = {
      busy: [{ at: '2026-09-12', time: 3 }, { at: '2026-09-10', time: 1 }, { at: '2026-09-11', time: 2 }],
      not_busy: [{ at: '2026-09-11', time: 20 }, { at: '2026-09-12', time: 30 }, { at: '2026-09-10', time: 10 }]
    }
    expect(pairsByAt(result, 'busy', 'not_busy').map(pair => pair.at)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12'])
    expect(pairsByAt(result, 'busy', 'not_busy')).toEqual([
      { at: '2026-09-10', first: 1, second: 10 },
      { at: '2026-09-11', first: 2, second: 20 },
      { at: '2026-09-12', first: 3, second: 30 }
    ])
  })

  it('an `at` that is only in one list carries null in the other, and they are ordered across both', () => {
    const result = {
      available: [{ at: '2026-09-12', time: 5 }, { at: '2026-09-10', time: 1 }],
      not_available: [{ at: '2026-09-11', time: 8 }]
    }
    expect(pairsByAt(result, 'available', 'not_available')).toEqual([
      { at: '2026-09-10', first: 1, second: null },
      { at: '2026-09-11', first: null, second: 8 },
      { at: '2026-09-12', first: 5, second: null }
    ])
  })

  it('does not join two different labels of the same day', () => {
    const result = { available: [{ at: '2026-09-10 00:00:00', time: 1 }], not_available: [{ at: '2026-09-10', time: 2 }] }
    expect(pairsByAt(result, 'available', 'not_available')).toEqual([
      { at: '2026-09-10', first: null, second: 2 },
      { at: '2026-09-10 00:00:00', first: 1, second: null }
    ])
  })

  it('a negative or missing duration is null (DR-19)', () => {
    const result = { available: [{ at: '2026-09-10', time: -5 }], not_available: [{ at: '2026-09-10' }] }
    expect(pairsByAt(result, 'available', 'not_available')).toEqual([{ at: '2026-09-10', first: null, second: null }])
  })

  it('is [] for empty, missing or malformed results', () => {
    ;[null, undefined, [], {}, 'x', { available: null, not_available: 3 }, { available: [], not_available: [] }]
      .forEach(value => expect(pairsByAt(value, 'available', 'not_available')).toEqual([]))
  })

  it('skips an entry without an `at`', () => {
    const result = { available: [{ at: null, time: 1 }, { time: 2 }, { at: '', time: 3 }, { at: '2026-09-10', time: 4 }], not_available: [] }
    expect(pairsByAt(result, 'available', 'not_available')).toEqual([{ at: '2026-09-10', first: 4, second: null }])
  })

  it('does not mutate the input, nor sort it in place', () => {
    const result = {
      available: [{ at: '2026-09-12', time: 3 }, { at: '2026-09-10', time: 1 }],
      not_available: [{ at: '2026-09-11', time: 2 }]
    }
    const copy = JSON.parse(JSON.stringify(result))
    pairsByAt(result, 'available', 'not_available')
    expect(result).toEqual(copy)
  })
})

describe('spendSeries', () => {
  it('maps the rows of drivers_spend_times to the four durations, ordered by `at`', () => {
    const rows = [
      { time: '2026-09-11', accept_spend: 20, pickup_spend: '30', delivery_spend: 40, complete_spend: 50 },
      { time: '2026-09-10', accept_spend: 10, pickup_spend: 11, delivery_spend: 12, complete_spend: 13 }
    ]
    expect(spendSeries(rows)).toEqual([
      { at: '2026-09-10', accept: 10, pickup: 11, delivery: 12, complete: 13 },
      { at: '2026-09-11', accept: 20, pickup: 30, delivery: 40, complete: 50 }
    ])
  })

  it('keeps the exact `time` as `at`: an hour, a day or a month', () => {
    const rows = [
      { time: '2026-09-10 11:00:00', accept_spend: 2 },
      { time: '2026-09-10 10:00:00', accept_spend: 1 },
      { time: '2026-08', accept_spend: 0 }
    ]
    expect(spendSeries(rows).map(item => item.at)).toEqual(['2026-08', '2026-09-10 10:00:00', '2026-09-10 11:00:00'])
  })

  // redesign drivers FB (auditor 6): the chart keeps a negative day with its sign (main draws it too); only the figures hide it
  it('gives null for a missing or empty field, keeps a real 0 and a negative value', () => {
    const rows = [{ time: '2026-09-10 00:00:00', accept_spend: 0, pickup_spend: '', delivery_spend: -3, complete_spend: '-12.5' }]
    expect(spendSeries(rows)).toEqual([{ at: '2026-09-10 00:00:00', accept: 0, pickup: null, delivery: -3, complete: -12.5 }])
  })

  it('skips a row without a `time`', () => {
    expect(spendSeries([{ accept_spend: 1 }, { time: '', accept_spend: 2 }, { time: null }])).toEqual([])
  })

  it('is [] for anything that is not an array of rows', () => {
    ;[null, undefined, {}, 'x', 3, []].forEach(value => expect(spendSeries(value)).toEqual([]))
  })

  it('does not mutate the input', () => {
    const rows = [{ time: '2026-09-11', accept_spend: 1 }, { time: '2026-09-10', accept_spend: 2 }]
    const copy = JSON.parse(JSON.stringify(rows))
    spendSeries(rows)
    expect(rows).toEqual(copy)
  })
})

describe('topDriverItems', () => {
  it('keeps the order of the API and numbers the figures', () => {
    const rows = [
      { id: 7, name: 'Ana', orders_count: 12, orders_percentage: '46.25' },
      { id: 8, name: 'Beto', orders_count: '3', orders_percentage: 12.5 }
    ]
    expect(topDriverItems(rows)).toEqual([
      { id: 7, name: 'Ana', count: 12, percent: 46.25, duplicate: false },
      { id: 8, name: 'Beto', count: 3, percent: 12.5, duplicate: false }
    ])
  })

  it('marks every driver whose name is repeated, with different ids', () => {
    const rows = [
      { id: 1, name: 'Fattelo', orders_count: 5, orders_percentage: '50.00' },
      { id: 2, name: 'Ana', orders_count: 3, orders_percentage: '30.00' },
      { id: 3, name: 'Fattelo', orders_count: 2, orders_percentage: '20.00' }
    ]
    expect(topDriverItems(rows).map(item => [item.id, item.duplicate])).toEqual([[1, true], [2, false], [3, true]])
  })

  it('compares the names without the spaces at the sides', () => {
    const rows = [{ id: 1, name: ' Fattelo ', orders_count: 1, orders_percentage: 1 }, { id: 2, name: 'Fattelo', orders_count: 1, orders_percentage: 1 }]
    expect(topDriverItems(rows).map(item => item.duplicate)).toEqual([true, true])
  })

  it('does not call duplicates two drivers without a name', () => {
    const rows = [{ id: 1, orders_count: 1 }, { id: 2, name: '  ', orders_count: 1 }]
    expect(topDriverItems(rows).map(item => item.duplicate)).toEqual([false, false])
  })

  it('is [] for anything that is not an array', () => {
    ;[null, undefined, {}, 'x', []].forEach(value => expect(topDriverItems(value)).toEqual([]))
  })

  it('gives numbers even if a figure is missing', () => {
    const [item] = topDriverItems([{ id: 1, name: 'Ana' }])
    expect(item.count).toBe(0)
    expect(item.percent).toBe(0)
  })

  it('does not mutate the input', () => {
    const rows = [{ id: 1, name: 'Fattelo', orders_count: '5', orders_percentage: '50.00' }, { id: 2, name: 'Fattelo', orders_count: 1, orders_percentage: '1.00' }]
    const copy = JSON.parse(JSON.stringify(rows))
    topDriverItems(rows)
    expect(rows).toEqual(copy)
  })
})
