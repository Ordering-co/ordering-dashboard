// redesign (row 6, intelligence-reports P8, D-32): with more series than colors, the series that add up are grouped in «Other».
import { describe, expect, it } from 'vitest'

import { MAX_SERIES, barModel, groupSmallSeries, lineModel } from '../reportBodyData'

const make = (id, data) => ({ id: `s${id}`, label: `Series ${id}`, data })
const total = list => list.reduce((sum, item) => sum + item.data.reduce((acc, value) => acc + (value || 0), 0), 0)

describe('groupSmallSeries', () => {
  // totals: s1 = 3, s2 = 30, s3 = 12, s4 = 1, s5 = 21, s6 = 9, s7 = 2, s8 = 6
  const EIGHT = [
    make(1, [1, 2, 0]),
    make(2, [10, 10, 10]),
    make(3, [4, 4, 4]),
    make(4, [0, 1, 0]),
    make(5, [7, 7, 7]),
    make(6, [3, 3, 3]),
    make(7, [1, 0, 1]),
    make(8, [2, 2, 2])
  ]

  it('keeps the five largest by total and adds one «Other» that sums the rest at each label (6 in total)', () => {
    const grouped = groupSmallSeries(EIGHT, 'Other')
    expect(grouped).toHaveLength(MAX_SERIES)
    expect(grouped.slice(0, 5).map(item => item.id)).toEqual(['s2', 's5', 's3', 's6', 's8'])
    const other = grouped[5]
    expect(other.label).toBe('Other')
    // s1 + s4 + s7 at each label
    expect(other.data).toEqual([2, 3, 1])
  })

  it('loses nothing: the chart adds up to the same as the series', () => {
    expect(total(groupSmallSeries(EIGHT, 'Other'))).toBe(total(EIGHT))
  })

  it('leaves a gap in «Other» only where every grouped series has none, and sums what exists', () => {
    const series = [...EIGHT.slice(0, 7), make(8, [null, 2, 2])]
    series[0] = make(1, [null, 2, 0])
    series[3] = make(4, [null, 1, 0])
    series[6] = make(7, [null, 0, 1])
    const other = groupSmallSeries(series, 'Other').pop()
    expect(other.data).toEqual([null, 3, 1])
  })

  it('does not add floating point noise to money', () => {
    const money = [...Array.from({ length: 5 }, (_, index) => make(index + 1, [100])), make(6, [0.1]), make(7, [0.2])]
    expect(groupSmallSeries(money, 'Other').pop().data).toEqual([0.3])
  })

  it('breaks a tie by the order the series came in', () => {
    const tied = Array.from({ length: 8 }, (_, index) => make(index + 1, [5]))
    expect(groupSmallSeries(tied, 'Other').slice(0, 5).map(item => item.id)).toEqual(['s1', 's2', 's3', 's4', 's5'])
    expect(groupSmallSeries(tied, 'Other')[5].data).toEqual([15])
  })

  it('returns the same series when they fit in the colors', () => {
    const six = EIGHT.slice(0, 6)
    expect(groupSmallSeries(six, 'Other')).toBe(six)
    const few = EIGHT.slice(0, 2)
    expect(groupSmallSeries(few, 'Other')).toBe(few)
  })
})

describe('which series add up', () => {
  const PEOPLE = { dataset: { x: { labels: ['Week 2026-39'] }, dataset: [{ label: 'a', data: [{ x: 'Week 2026-39', y: 1 }] }] } }
  const SALES = { dataset: { x: { labels: ['Week 2026-39'] }, dataset: { label: 'Sales', data: [{ x: 'Week 2026-39', y: 10 }] } } }

  it('orders (13), sales (14) and new users by channel (15) are counts and money: they add up', () => {
    expect(lineModel(13, SALES).additive).toBe(true)
    expect(lineModel(14, SALES).additive).toBe(true)
    expect(lineModel(15, PEOPLE).additive).toBe(true)
  })

  const cell = (value, refers) => ({ value, colspan: 1, value_unit: 'number', value_refers: refers })
  const table = refers => ({
    header: { rows: [[{ value: 'Business', colspan: 2 }, { value: 'Week 2026-39', colspan: 1 }]] },
    body: { rows: [[{ value: 2, colspan: 1, value_unit: 'number', value_refers: 'id' }, { value: 'A', colspan: 1, value_unit: 'text', value_refers: 'business' }, cell(1, refers)]] },
    footer: { rows: [] }
  })

  it('the bars of reports 1 (averages) and 2 (percentages) do not: they stay a notice and a table', () => {
    expect(barModel({ id: 1 }, table('average')).additive).toBe(false)
    expect(barModel({ id: 2 }, table('percentage')).additive).toBe(false)
    expect(barModel({ id: 99 }, table('average')).additive).toBe(false)
  })
})
