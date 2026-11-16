import { describe, expect, it } from 'vitest'
import {
  REPORT_RANGE_PRESETS,
  clipPeriod,
  defaultRange,
  fillSeries,
  parsePeriodLabel,
  presetOf,
  presetRange
} from '../reportPeriods'

// redesign reports FA2 (D3, D7, RP-07, auditor 1): the ranges of the period pill and the labels the reports API sends

const TODAY = '2026-10-10'
// 'YYYY-MM-DD' is read as UTC midnight, so the difference is a whole number of days
const daysIn = ({ from, to }) => (new Date(to) - new Date(from)) / 86400000 + 1

describe('REPORT_RANGE_PRESETS and presetRange', () => {
  it('lists the four presets of the period pill in order', () => {
    expect(REPORT_RANGE_PRESETS).toEqual(['today', 'yesterday', 'last_7_days', 'last_30_days'])
  })

  it('today is today..today and yesterday is yesterday..yesterday', () => {
    expect(presetRange('today', TODAY)).toEqual({ from: '2026-10-10', to: '2026-10-10' })
    expect(presetRange('yesterday', TODAY)).toEqual({ from: '2026-10-09', to: '2026-10-09' })
  })

  it('last_7_days is today - 7 .. today: the 8 dates main asks by default', () => {
    const range = presetRange('last_7_days', TODAY)
    expect(range).toEqual({ from: '2026-10-03', to: '2026-10-10' })
    expect(daysIn(range)).toBe(8)
  })

  it('last_30_days is today - 30 .. today', () => {
    const range = presetRange('last_30_days', TODAY)
    expect(range).toEqual({ from: '2026-09-10', to: '2026-10-10' })
    expect(daysIn(range)).toBe(31)
  })

  it('crosses months, years and leap days', () => {
    expect(presetRange('last_7_days', '2026-01-02')).toEqual({ from: '2025-12-26', to: '2026-01-02' })
    expect(presetRange('yesterday', '2024-03-01')).toEqual({ from: '2024-02-29', to: '2024-02-29' })
    expect(presetRange('last_30_days', '2024-03-01')).toEqual({ from: '2024-01-31', to: '2024-03-01' })
  })

  it('answers null for a preset it does not know and for a today that is not a day', () => {
    expect(presetRange('last_90_days', TODAY)).toBeNull()
    expect(presetRange('today', '2026-10-32')).toBeNull()
    expect(presetRange('today', 'today')).toBeNull()
    expect(presetRange('today', null)).toBeNull()
  })
})

describe('presetOf and defaultRange', () => {
  it('names the preset a range matches, or null', () => {
    REPORT_RANGE_PRESETS.forEach((preset) => {
      const { from, to } = presetRange(preset, TODAY)
      expect(presetOf(from, to, TODAY)).toBe(preset)
    })
    expect(presetOf('2026-10-04', '2026-10-10', TODAY)).toBeNull()
    expect(presetOf('2026-10-03', '2026-10-09', TODAY)).toBeNull()
    expect(presetOf(null, null, TODAY)).toBeNull()
  })

  it('a range that was a preset yesterday is no preset today', () => {
    const { from, to } = presetRange('last_7_days', TODAY)
    expect(presetOf(from, to, '2026-10-11')).toBeNull()
  })

  it('the default range is last_7_days', () => {
    expect(defaultRange(TODAY)).toEqual({ from: '2026-10-03', to: '2026-10-10' })
    expect(defaultRange(TODAY)).toEqual(presetRange('last_7_days', TODAY))
  })
})

describe('parsePeriodLabel', () => {
  it('reads an hour', () => {
    expect(parsePeriodLabel('Hour 2026-10-05 09:00')).toEqual({ unit: 'hour', start: '2026-10-05', end: '2026-10-05', hour: '09:00' })
  })

  it('reads a day', () => {
    expect(parsePeriodLabel('Day 2026-10-03')).toEqual({ unit: 'day', start: '2026-10-03', end: '2026-10-03' })
  })

  it('reads a month and a year', () => {
    expect(parsePeriodLabel('Month 2026-08')).toEqual({ unit: 'month', start: '2026-08-01', end: '2026-08-31' })
    expect(parsePeriodLabel('Month 2024-02')).toEqual({ unit: 'month', start: '2024-02-01', end: '2024-02-29' })
    expect(parsePeriodLabel('Year 2025')).toEqual({ unit: 'year', start: '2025-01-01', end: '2025-12-31' })
  })

  it('reads the weeks that start on Sunday (MySQL WEEK mode 0), as main measured live', () => {
    expect(parsePeriodLabel('Week 2026-39')).toEqual({ unit: 'week', start: '2026-09-27', end: '2026-10-03', number: 39 })
    expect(parsePeriodLabel('Week 2026-40')).toEqual({ unit: 'week', start: '2026-10-04', end: '2026-10-10', number: 40 })
    expect(parsePeriodLabel('Week 2026-01')).toEqual({ unit: 'week', start: '2026-01-04', end: '2026-01-10', number: 1 })
  })

  it('reads the weeks around the change of year', () => {
    expect(parsePeriodLabel('Week 2026-00')).toEqual({ unit: 'week', start: '2026-01-01', end: '2026-01-03', number: 0 })
    expect(parsePeriodLabel('Week 2025-52')).toEqual({ unit: 'week', start: '2025-12-28', end: '2026-01-03', number: 52 })
    expect(parsePeriodLabel('Week 2025-51')).toEqual({ unit: 'week', start: '2025-12-21', end: '2025-12-27', number: 51 })
  })

  it('knows the years that have a week 53 and the ones with an empty week 0', () => {
    // 2023 started on a Sunday: week 1 is 1-7 Jan, there is no week 0 and week 53 is 31 Dec - 6 Jan
    expect(parsePeriodLabel('Week 2023-00')).toBeNull()
    expect(parsePeriodLabel('Week 2023-01')).toEqual({ unit: 'week', start: '2023-01-01', end: '2023-01-07', number: 1 })
    expect(parsePeriodLabel('Week 2023-53')).toEqual({ unit: 'week', start: '2023-12-31', end: '2024-01-06', number: 53 })
    // 2026: week 53 would start in 2027
    expect(parsePeriodLabel('Week 2026-52')).toEqual({ unit: 'week', start: '2026-12-27', end: '2027-01-02', number: 52 })
    expect(parsePeriodLabel('Week 2026-53')).toBeNull()
  })

  it('returns null for anything else', () => {
    ;[
      '', null, undefined, 42, {},
      'Total', 'Semana 2026-39', 'week 2026-39', 'WEEK 2026-39', ' Day 2026-10-03', 'Day 2026-10-03 ',
      'Day 2026-10-3', 'Day 2026-02-30', 'Day 2026-13-01', 'Day 20261003',
      'Hour 2026-10-05 25:00', 'Hour 2026-10-05 9:00', 'Hour 2026-10-05', 'Hour 2026-10-05 09:60',
      'Week 2026-54', 'Week 2026-4', 'Week 2026', 'Month 2026-13', 'Month 2026-00', 'Month 2026', 'Year 25', 'Year 2025-01'
    ].forEach((label) => expect(parsePeriodLabel(label), String(label)).toBeNull())
  })
})

describe('clipPeriod', () => {
  it('cuts the dates of a group to the range of the report', () => {
    const week = parsePeriodLabel('Week 2026-39')
    expect(clipPeriod(week, '2026-10-03', '2026-10-10')).toEqual({ unit: 'week', start: '2026-10-03', end: '2026-10-03', number: 39 })
    expect(clipPeriod(parsePeriodLabel('Week 2026-40'), '2026-10-03', '2026-10-10')).toEqual({ unit: 'week', start: '2026-10-04', end: '2026-10-10', number: 40 })
    expect(clipPeriod(parsePeriodLabel('Week 2026-40'), '2026-10-03', '2026-10-08')).toEqual({ unit: 'week', start: '2026-10-04', end: '2026-10-08', number: 40 })
  })

  it('cuts both ends of a month and of a week that crosses the year', () => {
    expect(clipPeriod(parsePeriodLabel('Month 2026-08'), '2026-08-10', '2026-08-20')).toMatchObject({ start: '2026-08-10', end: '2026-08-20' })
    expect(clipPeriod(parsePeriodLabel('Week 2025-52'), '2025-12-30', '2026-01-02')).toMatchObject({ start: '2025-12-30', end: '2026-01-02' })
  })

  it('leaves a group that fits and keeps the hour', () => {
    const hour = parsePeriodLabel('Hour 2026-10-05 09:00')
    expect(clipPeriod(hour, '2026-10-05', '2026-10-05')).toEqual(hour)
  })

  it('does not change the period it is given', () => {
    const week = parsePeriodLabel('Week 2026-39')
    const copy = { ...week }
    clipPeriod(week, '2026-10-01', '2026-10-02')
    expect(week).toEqual(copy)
  })

  it('answers null when the group does not touch the range, or when there is no group', () => {
    expect(clipPeriod(parsePeriodLabel('Week 2026-39'), '2026-10-04', '2026-10-10')).toBeNull()
    expect(clipPeriod(null, '2026-10-04', '2026-10-10')).toBeNull()
  })
})

describe('fillSeries', () => {
  it('puts a 0 on the days the API did not send', () => {
    const points = [{ label: 'Day 2026-10-03', value: 5 }, { label: 'Day 2026-10-05', value: 2 }]
    expect(fillSeries(points, '2026-10-03', '2026-10-06', 'day')).toEqual({
      points: [
        { label: 'Day 2026-10-03', value: 5 },
        { label: 'Day 2026-10-04', value: 0 },
        { label: 'Day 2026-10-05', value: 2 },
        { label: 'Day 2026-10-06', value: 0 }
      ],
      unknown: []
    })
  })

  it('fills the week that has no row (the default range has two weeks)', () => {
    const points = [{ label: 'Week 2026-40', value: 7 }]
    expect(fillSeries(points, '2026-10-03', '2026-10-10', 'week').points).toEqual([
      { label: 'Week 2026-39', value: 0 },
      { label: 'Week 2026-40', value: 7 }
    ])
  })

  it('numbers the weeks across the change of year the way the API does (2025-51, 2025-52, 2026-01)', () => {
    const result = fillSeries([{ label: 'Week 2025-52', value: 4 }], '2025-12-20', '2026-01-05', 'week')
    expect(result.points.map(point => point.label)).toEqual(['Week 2025-50', 'Week 2025-51', 'Week 2025-52', 'Week 2026-01'])
    expect(result.points.map(point => point.value)).toEqual([0, 0, 4, 0])
    expect(result.unknown).toEqual([])
  })

  it('fills the months of the range', () => {
    const result = fillSeries([{ label: 'Month 2026-09', value: 3 }], '2026-08-15', '2026-10-10', 'month')
    expect(result.points).toEqual([
      { label: 'Month 2026-08', value: 0 },
      { label: 'Month 2026-09', value: 3 },
      { label: 'Month 2026-10', value: 0 }
    ])
  })

  it('crosses the year with months', () => {
    expect(fillSeries([], '2025-11-20', '2026-01-02', 'month').points.map(point => point.label)).toEqual(['Month 2025-11', 'Month 2025-12', 'Month 2026-01'])
  })

  it('keeps the other fields of a point the API sent', () => {
    const sent = { label: 'Day 2026-10-03', value: 5, extra: 'x' }
    const result = fillSeries([sent], '2026-10-03', '2026-10-04', 'day')
    expect(result.points[0]).toEqual(sent)
  })

  it('keeps at the end the points whose label it does not recognise, and says so', () => {
    const points = [{ label: 'Total', value: 9 }, { label: 'Day 2026-10-04', value: 1 }, { label: 'Week 2026-39', value: 2 }]
    const result = fillSeries(points, '2026-10-03', '2026-10-04', 'day')
    expect(result.points).toEqual([
      { label: 'Day 2026-10-03', value: 0 },
      { label: 'Day 2026-10-04', value: 1 },
      { label: 'Total', value: 9 },
      { label: 'Week 2026-39', value: 2 }
    ])
    expect(result.unknown).toEqual(['Total', 'Week 2026-39'])
  })

  it('does not drop a label the API repeats: the second one stays at the end', () => {
    const points = [{ label: 'Day 2026-10-03', value: 1 }, { label: 'Day 2026-10-03', value: 2 }]
    const result = fillSeries(points, '2026-10-03', '2026-10-03', 'day')
    expect(result.points).toEqual([
      { label: 'Day 2026-10-03', value: 1 },
      { label: 'Day 2026-10-03', value: 2 }
    ])
    expect(result.unknown).toEqual(['Day 2026-10-03'])
  })

  // redesign a real group of the same unit that falls outside the range is data, so it goes in its place in time, never after the last group
  it('puts a group of the same unit outside the range in its chronological place and keeps its data', () => {
    const points = [{ label: 'Day 2026-11-01', value: 3 }, { label: 'Day 2026-10-03', value: 1 }, { label: 'Day 2026-09-30', value: 4 }]
    const result = fillSeries(points, '2026-10-03', '2026-10-04', 'day')
    expect(result.points).toEqual([
      { label: 'Day 2026-09-30', value: 4 },
      { label: 'Day 2026-10-03', value: 1 },
      { label: 'Day 2026-10-04', value: 0 },
      { label: 'Day 2026-11-01', value: 3 }
    ])
    expect(result.unknown).toEqual(['Day 2026-11-01', 'Day 2026-09-30'])
  })

  // redesign (review, low): a label outside the range that the API sends twice gets the same treatment as one inside: the first
  // takes its place in time, the second goes to the end, so it is not drawn twice in the line
  it('puts the second appearance of a repeated label outside the range at the end, as it does inside', () => {
    const points = [{ label: 'Day 2026-09-30', value: 4 }, { label: 'Day 2026-10-03', value: 1 }, { label: 'Day 2026-09-30', value: 6 }]
    const result = fillSeries(points, '2026-10-03', '2026-10-04', 'day')
    expect(result.points).toEqual([
      { label: 'Day 2026-09-30', value: 4 },
      { label: 'Day 2026-10-03', value: 1 },
      { label: 'Day 2026-10-04', value: 0 },
      { label: 'Day 2026-09-30', value: 6 }
    ])
    expect(result.points.filter(point => point.label === 'Day 2026-09-30')).toHaveLength(2)
    expect(result.unknown).toEqual(['Day 2026-09-30', 'Day 2026-09-30'])
  })

  // redesign the API sent `Week 2026-37` for a range that starts on Sunday 2026-09-20; with Sunday weeks that is 13-09..19-09, outside it
  it('orders a week the API numbers outside the range before the weeks of the range, not after them', () => {
    const points = [{ label: 'Week 2026-37', value: 5 }, { label: 'Week 2026-39', value: 2 }]
    const result = fillSeries(points, '2026-09-20', '2026-10-20', 'week')
    expect(result.points.map(point => point.label)).toEqual(['Week 2026-37', 'Week 2026-38', 'Week 2026-39', 'Week 2026-40', 'Week 2026-41', 'Week 2026-42'])
    expect(result.points.map(point => point.value)).toEqual([5, 0, 2, 0, 0, 0])
  })

  it('does not fill hours or years: it only puts the points in order', () => {
    const hours = [{ label: 'Hour 2026-10-05 11:00', value: 1 }, { label: 'Hour 2026-10-05 09:00', value: 2 }, { label: 'x', value: 3 }]
    expect(fillSeries(hours, '2026-10-05', '2026-10-05', 'hour')).toEqual({
      points: [{ label: 'Hour 2026-10-05 09:00', value: 2 }, { label: 'Hour 2026-10-05 11:00', value: 1 }, { label: 'x', value: 3 }],
      unknown: ['x']
    })
    const years = [{ label: 'Year 2026', value: 1 }, { label: 'Year 2025', value: 2 }]
    expect(fillSeries(years, '2025-01-01', '2026-12-31', 'year').points.map(point => point.label)).toEqual(['Year 2025', 'Year 2026'])
  })

  it('does not change the list it is given and survives a missing list or a bad range', () => {
    const points = [{ label: 'Day 2026-10-04', value: 1 }]
    fillSeries(points, '2026-10-03', '2026-10-05', 'day')
    expect(points).toEqual([{ label: 'Day 2026-10-04', value: 1 }])
    expect(fillSeries(null, '2026-10-03', '2026-10-04', 'day').points).toHaveLength(2)
    expect(fillSeries(points, '2026-10-05', '2026-10-03', 'day')).toEqual({ points, unknown: [] })
    expect(fillSeries(points, 'x', 'y', 'day')).toEqual({ points, unknown: [] })
  })
})
