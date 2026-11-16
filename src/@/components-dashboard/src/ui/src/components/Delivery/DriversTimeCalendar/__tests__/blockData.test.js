// redesign DT-B1 (DT-09, DT-20, DT-21, DT-24): the pure data of the drivers' time calendar.
//
// Zones (DT-20): Node re-reads `process.env.TZ` whenever it changes and both `Date` and `moment` follow it, so each zone group
// sets TZ in `beforeEach` and restores it in `afterEach`, inside the same vitest worker (no second vitest invocation, so CI runs
// it as any other test). The same approach is used by `UtilsContext.timezones.test.jsx`. `expect(offset)` proves the zone really
// applied: a test that silently ran in UTC would not prove DT-20.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  QUARTERS,
  addBody,
  blockSpan,
  blocksOnDay,
  buildRule,
  daysOf,
  describeRule,
  editBody,
  emptyForm,
  exceedsRangeLimit,
  firstHour,
  formFromBlock,
  formatClock,
  localBlocks,
  minutesOf,
  rangeLength,
  rangeOf,
  ruleOf,
  shiftRange,
  timeErrors,
  timeOf,
  timeOptions,
  todayDay,
  toRequestRange,
  untilBounds
} from '../blockData'

const WEEK_OF_11_OCT = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']

describe('QUARTERS and todayDay', () => {
  it('has the 96 quarters of the day and 23:59 at the end', () => {
    expect(QUARTERS).toHaveLength(97)
    expect(QUARTERS[0]).toBe('00:00')
    expect(QUARTERS[1]).toBe('00:15')
    expect(QUARTERS[95]).toBe('23:45')
    expect(QUARTERS[96]).toBe('23:59')
  })

  it('todayDay is a local YYYY-MM-DD', () => {
    expect(todayDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('ranges', () => {
  it('rangeOf day is that day alone', () => {
    expect(rangeOf('day', '2026-10-14')).toEqual({ from: '2026-10-14', to: '2026-10-14' })
  })

  it('rangeOf week gives the 7 days of the week that holds the day, from the first day of the week', () => {
    // 11 Oct 2026 is a Sunday
    expect(rangeOf('week', '2026-10-11', 0)).toEqual({ from: '2026-10-11', to: '2026-10-17' })
    expect(rangeOf('week', '2026-10-14', 0)).toEqual({ from: '2026-10-11', to: '2026-10-17' })
    expect(rangeOf('week', '2026-10-11', 1)).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    expect(rangeOf('week', '2026-10-14', 1)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(rangeOf('week', '2026-10-14', 6)).toEqual({ from: '2026-10-10', to: '2026-10-16' })
  })

  it('rangeOf week crosses a month and a year', () => {
    expect(rangeOf('week', '2026-11-01', 1)).toEqual({ from: '2026-10-26', to: '2026-11-01' })
    expect(rangeOf('week', '2027-01-01', 1)).toEqual({ from: '2026-12-28', to: '2027-01-03' })
  })

  it('rangeLength counts the days included', () => {
    expect(rangeLength({ from: '2026-10-14', to: '2026-10-14' })).toBe(1)
    expect(rangeLength({ from: '2026-10-11', to: '2026-10-17' })).toBe(7)
    expect(rangeLength({ from: '2026-10-15', to: '2026-11-15' })).toBe(32)
  })

  it('shiftRange moves one length forward or back (a day, a week or N days)', () => {
    expect(shiftRange({ from: '2026-10-14', to: '2026-10-14' }, 1)).toEqual({ from: '2026-10-15', to: '2026-10-15' })
    expect(shiftRange({ from: '2026-10-14', to: '2026-10-14' }, -1)).toEqual({ from: '2026-10-13', to: '2026-10-13' })
    expect(shiftRange({ from: '2026-10-11', to: '2026-10-17' }, 1)).toEqual({ from: '2026-10-18', to: '2026-10-24' })
    expect(shiftRange({ from: '2026-10-11', to: '2026-10-17' }, -1)).toEqual({ from: '2026-10-04', to: '2026-10-10' })
    expect(shiftRange({ from: '2026-10-10', to: '2026-10-12' }, 1)).toEqual({ from: '2026-10-13', to: '2026-10-15' })
    expect(shiftRange({ from: '2026-10-28', to: '2026-11-03' }, 1)).toEqual({ from: '2026-11-04', to: '2026-11-10' })
  })

  it('exceedsRangeLimit keeps main\'s limit (diff in days greater than 31)', () => {
    expect(exceedsRangeLimit({ from: '2026-10-01', to: '2026-11-01' })).toBe(false) // diff 31
    expect(exceedsRangeLimit({ from: '2026-10-01', to: '2026-11-02' })).toBe(true) // diff 32
    expect(exceedsRangeLimit({ from: '2026-10-14', to: '2026-10-14' })).toBe(false)
  })

  it('daysOf lists every day of the range', () => {
    expect(daysOf({ from: '2026-10-30', to: '2026-11-02' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(daysOf({ from: '2026-10-14', to: '2026-10-14' })).toEqual(['2026-10-14'])
  })
})

// A zone by number of hours from UTC: Madrid is ahead (UTC+2 in October), Chicago behind (UTC-5), UTC is the reference.
const ZONES = [
  {
    tz: 'Europe/Madrid',
    offsetMinutes: -120,
    week: { from: '2026-10-10 22:00:00', to: '2026-10-17 21:59:59' },
    day: { from: '2026-10-13 22:00:00', to: '2026-10-14 21:59:59' },
    utcMidnightLocal: '2026-10-14 02:00:00',
    endLocal: '2026-10-14 03:00:00',
    breakLocal: '2026-10-14 02:20:00'
  },
  {
    tz: 'America/Chicago',
    offsetMinutes: 300,
    week: { from: '2026-10-11 05:00:00', to: '2026-10-18 04:59:59' },
    day: { from: '2026-10-14 05:00:00', to: '2026-10-15 04:59:59' },
    utcMidnightLocal: '2026-10-13 19:00:00',
    endLocal: '2026-10-13 20:00:00',
    breakLocal: '2026-10-13 19:20:00'
  },
  {
    tz: 'UTC',
    offsetMinutes: 0,
    week: { from: '2026-10-11 00:00:00', to: '2026-10-17 23:59:59' },
    day: { from: '2026-10-14 00:00:00', to: '2026-10-14 23:59:59' },
    utcMidnightLocal: '2026-10-14 00:00:00',
    endLocal: '2026-10-14 01:00:00',
    breakLocal: '2026-10-14 00:20:00'
  }
]

describe.each(ZONES)('DT-20 · the range is local days and turns UTC only in the request ($tz)', ({ tz, offsetMinutes, week, day, utcMidnightLocal, endLocal, breakLocal }) => {
  const originalTZ = process.env.TZ

  beforeEach(() => {
    process.env.TZ = tz
    // the zone really applied (getTimezoneOffset is minutes behind UTC, so UTC+2 is -120)
    expect(new Date(2026, 9, 11, 12).getTimezoneOffset()).toBe(offsetMinutes)
  })

  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('daysOf the week of 11 Oct 2026 are the 7 right days, none before and none lost', () => {
    const range = rangeOf('week', '2026-10-11', 0)
    expect(range).toEqual({ from: '2026-10-11', to: '2026-10-17' })
    expect(daysOf(range)).toEqual(WEEK_OF_11_OCT)
    expect(rangeLength(range)).toBe(7)
    expect(shiftRange(range, 1)).toEqual({ from: '2026-10-18', to: '2026-10-24' })
  })

  it('toRequestRange of that week asks the API for the local week in UTC', () => {
    expect(toRequestRange({ from: '2026-10-11', to: '2026-10-17' })).toEqual([week.from, week.to])
  })

  it('toRequestRange of one day covers that local day', () => {
    expect(toRequestRange({ from: '2026-10-14', to: '2026-10-14' })).toEqual([day.from, day.to])
  })

  it('localBlocks reads the API\'s UTC as local (start, end, break and until)', () => {
    const [block] = localBlocks([{
      id: 1,
      start: '2026-10-14 00:00:00',
      end: '2026-10-14 01:00:00',
      break_start: '2026-10-14 00:20:00',
      break_end: null,
      until: '2026-10-14 00:00:00'
    }])
    expect(block.start).toBe(utcMidnightLocal)
    expect(block.end).toBe(endLocal)
    expect(block.break_start).toBe(breakLocal)
    expect(block.break_end).toBeNull()
    expect(block.until).toBe(utcMidnightLocal)
  })

  it('addBody sends start, end and until as UTC from the local day', () => {
    const body = addBody({ ...emptyForm({ day: '2026-10-14', startTime: '09:00' }), end: '17:00' })
    const utc = (time) => {
      const d = new Date(2026, 9, 14, ...time.split(':').map(Number))
      return d.toISOString().slice(0, 19).replace('T', ' ')
    }
    expect(body.start).toBe(utc('09:00'))
    expect(body.end).toBe(utc('17:00'))
    expect(body.until).toBe(new Date(2026, 9, 14, 23, 59, 59).toISOString().slice(0, 19).replace('T', ' '))
  })
})

describe('localBlocks', () => {
  it('DT-24: gives [] when blocks are missing', () => {
    expect(localBlocks(undefined)).toEqual([])
    expect(localBlocks(null)).toEqual([])
    expect(localBlocks([])).toEqual([])
  })

  it('keeps the rest of the block and does not mutate the input', () => {
    const input = [{ id: 7, name: 'Morning', start: '2026-10-14 08:00:00', end: '2026-10-14 12:00:00', rrule: 'FREQ=DAILY', until: null }]
    const frozen = JSON.parse(JSON.stringify(input))
    const [block] = localBlocks(input)
    expect(block).toMatchObject({ id: 7, name: 'Morning', rrule: 'FREQ=DAILY', until: null, break_start: null, break_end: null })
    expect(input).toEqual(frozen)
    expect(block).not.toBe(input[0])
  })
})

describe('blocksOnDay (DT-09: by full date, not by day of the month)', () => {
  const blocks = [
    { id: 3, start: '2026-11-15 09:00:00', end: '2026-11-15 10:00:00' },
    { id: 2, start: '2026-10-15 14:00:00', end: '2026-10-15 15:00:00' },
    { id: 1, start: '2026-10-15 09:00:00', end: '2026-10-15 10:00:00' },
    { id: 4, start: '2026-10-16 09:00:00', end: '2026-10-16 10:00:00' }
  ]

  it('15 Oct–15 Nov: each 15th shows only its own blocks', () => {
    expect(blocksOnDay(blocks, '2026-10-15').map(b => b.id)).toEqual([1, 2])
    expect(blocksOnDay(blocks, '2026-11-15').map(b => b.id)).toEqual([3])
    expect(blocksOnDay(blocks, '2026-10-17')).toEqual([])
  })

  it('does not lose or throw on missing blocks (DT-24)', () => {
    expect(blocksOnDay(undefined, '2026-10-15')).toEqual([])
  })
})

describe('minutesOf and blockSpan', () => {
  it('minutesOf counts from 00:00', () => {
    expect(minutesOf('2026-10-14 00:00:00')).toBe(0)
    expect(minutesOf('2026-10-14 09:30:00')).toBe(570)
    expect(minutesOf('2026-10-14 23:59:00')).toBe(1439)
  })

  it('blockSpan gives the minutes of the day, break included', () => {
    expect(blockSpan({ start: '2026-10-14 09:00:00', end: '2026-10-14 17:00:00', break_start: '2026-10-14 13:00:00', break_end: '2026-10-14 13:30:00' }, '2026-10-14'))
      .toEqual({ start: 540, end: 1020, breakStart: 780, breakEnd: 810 })
  })

  it('blockSpan has null break without break', () => {
    expect(blockSpan({ start: '2026-10-14 09:00:00', end: '2026-10-14 17:00:00', break_start: null, break_end: null }, '2026-10-14'))
      .toEqual({ start: 540, end: 1020, breakStart: null, breakEnd: null })
  })

  it('blockSpan clips a block that crosses midnight to the end of the day', () => {
    expect(blockSpan({ start: '2026-10-14 22:00:00', end: '2026-10-15 02:00:00' }, '2026-10-14'))
      .toEqual({ start: 1320, end: 1440, breakStart: null, breakEnd: null })
  })

  it('blockSpan clips what starts before the day to 0', () => {
    expect(blockSpan({ start: '2026-10-13 22:00:00', end: '2026-10-14 02:00:00' }, '2026-10-14'))
      .toEqual({ start: 0, end: 120, breakStart: null, breakEnd: null })
  })
})

describe('firstHour', () => {
  const user = (...starts) => ({ delivery_blocks: starts.map((start, i) => ({ id: i, start, end: start })) })

  it('is the hour of the first start of the day minus one', () => {
    const users = [user('2026-10-14 13:30:00'), user('2026-10-14 09:15:00', '2026-10-14 18:00:00')]
    expect(firstHour(users, '2026-10-14')).toBe(8)
  })

  it('never goes below 0', () => {
    expect(firstHour([user('2026-10-14 00:30:00')], '2026-10-14')).toBe(0)
  })

  it('is 8 without blocks that day (DT-24: nor with users without delivery_blocks)', () => {
    expect(firstHour([], '2026-10-14')).toBe(8)
    expect(firstHour([user('2026-10-15 09:00:00')], '2026-10-14')).toBe(8)
    expect(firstHour([{ id: 1 }, { id: 2, delivery_blocks: null }], '2026-10-14')).toBe(8)
    expect(firstHour(undefined, '2026-10-14')).toBe(8)
  })
})

describe('timeOptions', () => {
  const now = new Date(2026, 9, 14, 10, 20, 0)

  it('a future day has every quarter and 23:59', () => {
    expect(timeOptions({ day: '2026-10-15', now })).toEqual(QUARTERS)
  })

  it('today drops the past hours and the quarters up to the minutes of now', () => {
    const options = timeOptions({ day: '2026-10-14', now })
    expect(options[0]).toBe('10:30')
    expect(options).not.toContain('10:15')
    expect(options).not.toContain('09:45')
    expect(options.at(-1)).toBe('23:59')
    expect(options).toContain('10:30')
  })

  it('in the current hour a quarter equal to the minute is also gone (as main: <=)', () => {
    expect(timeOptions({ day: '2026-10-14', now: new Date(2026, 9, 14, 10, 15, 0) })[0]).toBe('10:30')
    expect(timeOptions({ day: '2026-10-14', now: new Date(2026, 9, 14, 10, 0, 0) })[0]).toBe('10:15')
  })

  it('a past day filters like main (day <= today)', () => {
    expect(timeOptions({ day: '2026-10-13', now })[0]).toBe('10:30')
  })

  it('adds the hours of the block being edited, sorted and without repeats', () => {
    const options = timeOptions({ day: '2026-10-14', now, extra: ['08:10', '10:30', '23:59', '17:05'] })
    expect(options[0]).toBe('08:10')
    expect(options).toContain('17:05')
    expect(options.indexOf('17:05')).toBe(options.indexOf('17:00') + 1)
    expect(options.filter(o => o === '10:30')).toHaveLength(1)
    expect(options.filter(o => o === '23:59')).toHaveLength(1)
    expect(options.at(-1)).toBe('23:59')
    expect([...options].sort()).toEqual(options)
  })
})

describe('formatClock and timeOf', () => {
  it('24 hours is the same text', () => {
    expect(formatClock('09:00', { is12: false })).toBe('09:00')
    expect(formatClock('23:59', {})).toBe('23:59')
  })

  it('12 hours', () => {
    expect(formatClock('09:00', { is12: true })).toBe('09:00 AM')
    expect(formatClock('00:15', { is12: true })).toBe('12:15 AM')
    expect(formatClock('12:00', { is12: true })).toBe('12:00 PM')
    expect(formatClock('12:45', { is12: true })).toBe('12:45 PM')
    expect(formatClock('13:30', { is12: true })).toBe('01:30 PM')
    expect(formatClock('23:59', { is12: true })).toBe('11:59 PM')
  })

  it('12 hours with the translated am/pm', () => {
    expect(formatClock('09:00', { is12: true, am: 'a. m.', pm: 'p. m.' })).toBe('09:00 a. m.')
    expect(formatClock('21:00', { is12: true, am: 'a. m.', pm: 'p. m.' })).toBe('09:00 p. m.')
  })

  it('timeOf takes HH:mm from a datetime', () => {
    expect(timeOf('2026-10-14 09:05:00')).toBe('09:05')
    expect(timeOf('2026-10-14 23:59:59')).toBe('23:59')
  })
})

describe('rules (DT-21)', () => {
  it('ruleOf reads a weekly rule with its days (0 = Monday)', () => {
    expect(ruleOf({ start: '2026-10-14 09:00:00', rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE' })).toEqual({ freq: 'weekly', byweekday: [0, 2] })
    expect(ruleOf({ start: '2026-10-14 09:00:00', rrule: 'FREQ=WEEKLY;BYDAY=SU' })).toEqual({ freq: 'weekly', byweekday: [6] })
  })

  it('ruleOf: a weekly rule without BYDAY has no days (the day of DTSTART is not marked)', () => {
    expect(ruleOf({ start: '2026-10-14 09:00:00', rrule: 'FREQ=WEEKLY' })).toEqual({ freq: 'weekly', byweekday: [] })
    expect(ruleOf({ start: '2026-10-14 09:00:00', rrule: 'RRULE:FREQ=WEEKLY' })).toEqual({ freq: 'weekly', byweekday: [] })
  })

  it('ruleOf: a daily rule has [] and not null as days', () => {
    expect(ruleOf({ start: '2026-10-14 09:00:00', rrule: 'FREQ=DAILY' })).toEqual({ freq: 'daily', byweekday: [] })
    expect(ruleOf({ start: '2026-10-14 09:00:00', rrule: 'RRULE:FREQ=DAILY;BYDAY=FR' })).toEqual({ freq: 'daily', byweekday: [4] })
  })

  it('ruleOf without rule', () => {
    expect(ruleOf({ start: '2026-10-14 09:00:00', rrule: null })).toEqual({ freq: null, byweekday: [] })
    expect(ruleOf({ start: '2026-10-14 09:00:00' })).toEqual({ freq: null, byweekday: [] })
  })

  it('buildRule is null without freq and the rrule string with it (as main)', () => {
    expect(buildRule({ freq: null, byweekday: [] })).toBeNull()
    expect(buildRule({ freq: 'weekly', byweekday: [0, 2] })).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,WE')
    expect(buildRule({ freq: 'weekly', byweekday: [] })).toBe('RRULE:FREQ=WEEKLY')
    expect(buildRule({ freq: 'daily', byweekday: [] })).toBe('RRULE:FREQ=DAILY')
    expect(buildRule({ freq: 'daily', byweekday: [4] })).toBe('RRULE:FREQ=DAILY;BYDAY=FR')
  })

  it('ruleOf reads what buildRule writes', () => {
    const rule = { freq: 'weekly', byweekday: [1, 3, 5] }
    expect(ruleOf({ start: '2026-10-14 09:00:00', rrule: buildRule(rule) })).toEqual(rule)
  })
})

describe('forms', () => {
  const block = {
    id: 9,
    name: 'Lunch shift',
    description: 'Downtown',
    start: '2026-10-14 09:00:00',
    end: '2026-10-14 17:30:00',
    break_start: '2026-10-14 13:00:00',
    break_end: '2026-10-14 13:30:00',
    rrule: 'RRULE:FREQ=WEEKLY;BYDAY=WE',
    until: '2026-11-04 23:59:59'
  }

  it('formFromBlock fills the form from the block', () => {
    expect(formFromBlock(block, '2026-10-14')).toEqual({
      name: 'Lunch shift',
      description: 'Downtown',
      day: '2026-10-14',
      start: '09:00',
      end: '17:30',
      showBreak: true,
      breakStart: '13:00',
      breakEnd: '13:30',
      freq: 'weekly',
      byweekday: [2],
      untilDay: '2026-11-04'
    })
  })

  it('formFromBlock of a plain block: no break, no rule, until is the day', () => {
    const form = formFromBlock({ id: 1, start: '2026-10-14 09:00:00', end: '2026-10-14 10:00:00', break_start: null, break_end: null, rrule: null, until: null }, '2026-10-14')
    expect(form).toMatchObject({ name: '', description: '', showBreak: false, freq: null, byweekday: [], untilDay: '2026-10-14', start: '09:00', end: '10:00' })
  })

  it('emptyForm starts at the pressed hour, ends at 23:59 and its until is the day', () => {
    expect(emptyForm({ day: '2026-10-20', startTime: '09:00' })).toMatchObject({
      name: '', description: '', day: '2026-10-20', start: '09:00', end: '23:59', showBreak: false, freq: null, byweekday: [], untilDay: '2026-10-20'
    })
  })

  it('emptyForm without a pressed hour starts at the first option (the next quarter today)', () => {
    expect(emptyForm({ day: '2026-10-15', now: new Date(2026, 9, 14, 10, 20) }).start).toBe('00:00')
    expect(emptyForm({ day: '2026-10-14', now: new Date(2026, 9, 14, 10, 20) }).start).toBe('10:30')
  })

  it('timeErrors is empty for a valid form', () => {
    expect(timeErrors({ start: '09:00', end: '17:00', showBreak: false })).toEqual({})
    expect(timeErrors({ start: '09:00', end: '17:00', showBreak: true, breakStart: '13:00', breakEnd: '13:30' })).toEqual({})
  })

  it('timeErrors: end not after start', () => {
    expect(timeErrors({ start: '09:00', end: '09:00', showBreak: false })).toEqual({ end: 'END_TIME_LATER' })
    expect(timeErrors({ start: '10:00', end: '09:00', showBreak: false })).toEqual({ end: 'END_TIME_LATER' })
  })

  it('timeErrors: break outside (start, end) or reversed', () => {
    expect(timeErrors({ start: '09:00', end: '17:00', showBreak: true, breakStart: '09:00', breakEnd: '10:00' })).toEqual({ breakStart: 'BREAK_START_TIME_LATER' })
    expect(timeErrors({ start: '09:00', end: '17:00', showBreak: true, breakStart: '13:00', breakEnd: '17:00' })).toEqual({ breakEnd: 'BREAK_END_TIME_EARLY' })
    expect(timeErrors({ start: '09:00', end: '17:00', showBreak: true, breakStart: '14:00', breakEnd: '13:00' })).toEqual({ breakStart: 'BREAK_START_TIME_LATER', breakEnd: 'BREAK_END_TIME_EARLY' })
    expect(timeErrors({ start: '09:00', end: '17:00', showBreak: true, breakStart: '', breakEnd: '' })).toEqual({ breakStart: 'BREAK_START_TIME_LATER', breakEnd: 'BREAK_END_TIME_EARLY' })
  })

  it('timeErrors ignores the break when it is off', () => {
    expect(timeErrors({ start: '09:00', end: '17:00', showBreak: false, breakStart: '20:00', breakEnd: '08:00' })).toEqual({})
  })

  it('untilBounds goes from the day to two months later', () => {
    expect(untilBounds('2026-10-14')).toEqual({ min: '2026-10-14', max: '2026-12-14' })
    expect(untilBounds('2026-12-31')).toEqual({ min: '2026-12-31', max: '2027-02-28' })
  })
})

describe('request bodies (zone Europe/Madrid, UTC+2 in October)', () => {
  const originalTZ = process.env.TZ
  beforeEach(() => {
    process.env.TZ = 'Europe/Madrid'
    expect(new Date(2026, 9, 14, 12).getTimezoneOffset()).toBe(-120)
  })
  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  const base = { name: '', description: '', day: '2026-10-14', start: '09:00', end: '17:00', showBreak: false, breakStart: '', breakEnd: '', freq: null, byweekday: [], untilDay: '2026-10-14' }

  it('addBody: start and end in UTC, until always (end of the until day), nothing else', () => {
    expect(addBody(base)).toEqual({
      start: '2026-10-14 07:00:00',
      end: '2026-10-14 15:00:00',
      until: '2026-10-14 21:59:59'
    })
  })

  it('addBody: rrule, both break times, name and description when they are there', () => {
    expect(addBody({
      ...base, name: 'Lunch', description: 'Downtown', showBreak: true, breakStart: '13:00', breakEnd: '13:30', freq: 'weekly', byweekday: [0, 2], untilDay: '2026-11-04'
    })).toEqual({
      start: '2026-10-14 07:00:00',
      end: '2026-10-14 15:00:00',
      rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
      until: '2026-11-04 22:59:59',
      break_start: '2026-10-14 11:00:00',
      break_end: '2026-10-14 11:30:00',
      name: 'Lunch',
      description: 'Downtown'
    })
  })

  it('addBody: no break fields when the break is off, even with times in the form', () => {
    const body = addBody({ ...base, breakStart: '13:00', breakEnd: '13:30' })
    expect(body).not.toHaveProperty('break_start')
    expect(body).not.toHaveProperty('break_end')
  })

  const plain = { id: 5, name: 'x', start: '2026-10-14 09:00:00', end: '2026-10-14 17:00:00', break_start: null, break_end: null, rrule: null, until: null }

  it('editBody: a block without rule sends until as main (the until day) and the propagation', () => {
    expect(editBody(base, plain, 'none')).toEqual({
      start: '2026-10-14 07:00:00',
      end: '2026-10-14 15:00:00',
      until: '2026-10-14 21:59:59',
      propagation: 'none'
    })
  })

  it('editBody (DT-01): sends the break complete', () => {
    const body = editBody({ ...base, showBreak: true, breakStart: '13:00', breakEnd: '13:30' }, plain, 'all')
    expect(body).toMatchObject({ break_start: '2026-10-14 11:00:00', break_end: '2026-10-14 11:30:00', propagation: 'all' })
  })

  it('editBody (DT-02): a block with rule sends its original until in UTC, not the day of the repetition', () => {
    const series = { ...plain, rrule: 'RRULE:FREQ=WEEKLY;BYDAY=WE', until: '2026-12-02 23:59:59' }
    const body = editBody({ ...base, freq: 'weekly', byweekday: [2], untilDay: '2026-10-21' }, series, 'from_event')
    expect(body.until).toBe('2026-12-02 22:59:59')
    expect(body.rrule).toBe('RRULE:FREQ=WEEKLY;BYDAY=WE')
    expect(body.propagation).toBe('from_event')
  })

  it('editBody (DT-02): a series without until sends none', () => {
    const series = { ...plain, rrule: 'RRULE:FREQ=DAILY', until: null }
    const body = editBody({ ...base, freq: 'daily', untilDay: '2026-10-21' }, series, 'all')
    expect(body).not.toHaveProperty('until')
  })
})

describe('describeRule (DT-03)', () => {
  const t = (_key, text) => text
  const dayName = (index) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]
  const options = { t, dayName, untilText: '14 Oct 2026' }

  it('is empty without frequency', () => {
    expect(describeRule({ freq: null, byweekday: [] }, options)).toBe('')
  })

  it('weekly with days', () => {
    expect(describeRule({ freq: 'weekly', byweekday: [2, 0] }, options)).toBe('Repeats every week on Mon and Wed until 14 Oct 2026')
    expect(describeRule({ freq: 'weekly', byweekday: [4] }, options)).toBe('Repeats every week on Fri until 14 Oct 2026')
  })

  it('weekly without days is the same day', () => {
    expect(describeRule({ freq: 'weekly', byweekday: [] }, options)).toBe('Repeats every week until 14 Oct 2026')
  })

  it('daily with and without days', () => {
    expect(describeRule({ freq: 'daily', byweekday: [] }, options)).toBe('Repeats every day until 14 Oct 2026')
    expect(describeRule({ freq: 'daily', byweekday: [0, 1, 2] }, options)).toBe('Repeats every day on Mon, Tue, and Wed until 14 Oct 2026')
  })

  it('asks for the translation with the keys of the spec', () => {
    const keys = []
    const spy = (key, text) => { keys.push(key); return text }
    describeRule({ freq: 'weekly', byweekday: [0] }, { ...options, t: spy })
    describeRule({ freq: 'weekly', byweekday: [] }, { ...options, t: spy })
    describeRule({ freq: 'daily', byweekday: [] }, { ...options, t: spy })
    describeRule({ freq: 'daily', byweekday: [0] }, { ...options, t: spy })
    expect(keys).toEqual(['DRIVER_BLOCKS_REPEATS_WEEKLY', 'DRIVER_BLOCKS_REPEATS_WEEKLY_SAME_DAY', 'DRIVER_BLOCKS_REPEATS_DAILY', 'DRIVER_BLOCKS_REPEATS_DAILY_ON'])
  })
})

// the calendar works in the zone of the chosen driver group (driver_groups.timezone), not the browser's. The browser is
// in Tokyo (+9) and the group in Bogotá (-5): at 16:30 UTC of the 27th it is 01:30 of the 28th in Tokyo and 11:30 of the 27th in Bogotá.
describe('the zone of the driver group', () => {
  const originalTZ = process.env.TZ
  const ZONE = 'America/Bogota'

  beforeEach(() => {
    process.env.TZ = 'Asia/Tokyo'
  })

  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('a shift made at 09:00 is sent as the UTC of 09:00 in the group\'s zone and drawn back at 09:00', () => {
    const body = addBody({ ...emptyForm({ day: '2026-10-27', startTime: '09:00', zone: ZONE }), end: '17:00' }, ZONE)
    expect(body).toMatchObject({ start: '2026-10-27 14:00:00', end: '2026-10-27 22:00:00', until: '2026-10-28 04:59:59' })
    const [block] = localBlocks([{ id: 1, start: body.start, end: body.end, until: body.until }], ZONE)
    expect(block).toMatchObject({ start: '2026-10-27 09:00:00', end: '2026-10-27 17:00:00', until: '2026-10-27 23:59:59' })
    expect(timeOf(block.start)).toBe('09:00')
  })

  it('editBody sends the hours and the until of the group\'s zone', () => {
    const block = { id: 1, start: '2026-10-27 09:00:00', end: '2026-10-27 17:00:00', rrule: 'RRULE:FREQ=DAILY', until: '2026-11-10 23:59:59' }
    const body = editBody({ ...formFromBlock(block, '2026-10-27'), start: '10:00' }, block, 'this', ZONE)
    expect(body).toMatchObject({ start: '2026-10-27 15:00:00', end: '2026-10-27 22:00:00', until: '2026-11-11 04:59:59', propagation: 'this' })
  })

  it('asks the API for the days of the group\'s zone', () => {
    expect(toRequestRange({ from: '2026-10-27', to: '2026-10-27' }, ZONE)).toEqual(['2026-10-27 05:00:00', '2026-10-28 04:59:59'])
  })

  it('today and the hours already gone are the group\'s, not the browser\'s', () => {
    const now = new Date('2026-10-27T16:30:00Z')
    expect(todayDay(ZONE, now)).toBe('2026-10-27')
    expect(timeOptions({ day: '2026-10-27', now, zone: ZONE })[0]).toBe('11:45')
    expect(timeOptions({ day: '2026-10-28', now, zone: ZONE })).toEqual(QUARTERS)
  })
})
