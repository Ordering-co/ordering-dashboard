// redesign stores 3.B, P-2: the status of a store is the server's `open`; the times come from `today`, read in the
// store's own timezone. Every instant is fixed with Date.UTC so nothing depends on the zone of the machine running the test.
import { describe, expect, it } from 'vitest'

import { formatClock, storeOpenNow } from '../storeOpenNow'

const lapse = (open, close) => ({ open: { hour: open[0], minute: open[1] }, close: { hour: close[0], minute: close[1] } })
const today = (...lapses) => ({ enabled: true, lapses })

// 2026-01-15: New York is UTC-5 and Tokyo is UTC+9 (neither observes daylight saving in January).
const at = (hour, minute = 0) => new Date(Date.UTC(2026, 0, 15, hour, minute))

describe('storeOpenNow — no data', () => {
  it('is null without a boolean `open`, so the cell stays empty', () => {
    expect(storeOpenNow(null)).toBeNull()
    expect(storeOpenNow(undefined)).toBeNull()
    expect(storeOpenNow({})).toBeNull()
    expect(storeOpenNow({ today: today(lapse([0, 0], [23, 59])), timezone: 'America/New_York' })).toBeNull()
    expect(storeOpenNow({ open: 'true' })).toBeNull()
    expect(storeOpenNow({ open: 1 })).toBeNull()
  })
})

describe('storeOpenNow — open', () => {
  it('says when the lapse that contains now closes (9:00-23:59 at 15:00 in New York)', () => {
    const business = { open: true, today: today(lapse([9, 0], [23, 59])), timezone: 'America/New_York' }
    expect(storeOpenNow(business, at(20, 0))).toEqual({ open: true, closes: { hour: 23, minute: 59 } })
  })

  // redesign stores 3.B review r1 #2: 00:00-23:59 is the schedule's way of saying 24 hours, not a close at 23:59
  it('says all day for a lapse from 00:00 to 23:59', () => {
    const business = { open: true, today: today(lapse([0, 0], [23, 59])), timezone: 'America/New_York' }
    expect(storeOpenNow(business, at(20, 0))).toEqual({ open: true, allDay: true })
  })

  // redesign stores 3.B review r1 #1: the server's `open` reads the schedule only; a disabled store takes no orders
  it('says nothing for a disabled store', () => {
    const business = { open: true, enabled: false, today: today(lapse([9, 0], [23, 59])), timezone: 'America/New_York' }
    expect(storeOpenNow(business, at(20, 0))).toBeNull()
  })

  it('reads the clock in the timezone of the store: the same instant picks a different lapse', () => {
    const lapses = today(lapse([2, 0], [8, 0]), lapse([13, 0], [18, 0]))
    // 20:00 UTC is 15:00 in New York and 05:00 (next day) in Tokyo.
    expect(storeOpenNow({ open: true, today: lapses, timezone: 'America/New_York' }, at(20, 0))).toEqual({ open: true, closes: { hour: 18, minute: 0 } })
    expect(storeOpenNow({ open: true, today: lapses, timezone: 'Asia/Tokyo' }, at(20, 0))).toEqual({ open: true, closes: { hour: 8, minute: 0 } })
  })

  it('holds the close of a lapse that crosses midnight (18:00-02:00 at 01:00)', () => {
    const business = { open: true, today: today(lapse([18, 0], [2, 0])), timezone: 'America/New_York' }
    expect(storeOpenNow(business, at(6, 0))).toEqual({ open: true, closes: { hour: 2, minute: 0 } })
    // and in the evening of the same lapse (19:00 New York)
    expect(storeOpenNow(business, at(0, 0))).toEqual({ open: true, closes: { hour: 2, minute: 0 } })
  })

  it('takes the open edge as inside and the close edge as outside', () => {
    const business = { open: true, today: today(lapse([9, 0], [12, 0]), lapse([12, 0], [14, 0])), timezone: 'America/New_York' }
    expect(storeOpenNow(business, at(14, 0))).toEqual({ open: true, closes: { hour: 12, minute: 0 } }) // 09:00 NY
    expect(storeOpenNow(business, at(17, 0))).toEqual({ open: true, closes: { hour: 14, minute: 0 } }) // 12:00 NY
  })

  it('gives no close when the server says open but no lapse of today contains now', () => {
    const business = { open: true, today: today(lapse([9, 0], [12, 0])), timezone: 'America/New_York' }
    expect(storeOpenNow(business, at(20, 0))).toEqual({ open: true })
    expect(storeOpenNow({ open: true, today: null, timezone: 'America/New_York' }, at(20, 0))).toEqual({ open: true })
  })

  it('does not read lapses of a day that is disabled', () => {
    const business = { open: true, today: { enabled: false, lapses: [lapse([0, 0], [23, 59])] }, timezone: 'America/New_York' }
    expect(storeOpenNow(business, at(20, 0))).toEqual({ open: true })
  })

  it('ignores malformed lapses', () => {
    const business = {
      open: true,
      today: { enabled: true, lapses: [null, {}, { open: { hour: 9 } }, { open: { hour: 'x', minute: 0 }, close: { hour: 12, minute: 0 } }, lapse([1, 0], [23, 59])] },
      timezone: 'America/New_York'
    }
    expect(storeOpenNow(business, at(20, 0))).toEqual({ open: true, closes: { hour: 23, minute: 59 } })
  })
})

describe('storeOpenNow — closed', () => {
  const business = { open: false, today: today(lapse([9, 0], [12, 0]), lapse([14, 0], [20, 0])), timezone: 'America/New_York' }

  it('says when the earliest lapse after now opens (07:00 with 9-12 and 14-20)', () => {
    expect(storeOpenNow(business, at(12, 0))).toEqual({ open: false, opens: { hour: 9, minute: 0 } })
  })

  it('takes the next lapse when now is between two (13:00)', () => {
    expect(storeOpenNow(business, at(18, 0))).toEqual({ open: false, opens: { hour: 14, minute: 0 } })
  })

  it('takes the earliest even when the lapses come out of order', () => {
    const unordered = { ...business, today: today(lapse([14, 0], [20, 0]), lapse([9, 0], [12, 0])) }
    expect(storeOpenNow(unordered, at(12, 0))).toEqual({ open: false, opens: { hour: 9, minute: 0 } })
  })

  it('gives no opening when nothing opens later the same day (21:00)', () => {
    expect(storeOpenNow(business, at(2, 0))).toEqual({ open: false }) // 21:00 NY the day before
  })

  it('gives no opening when today is disabled', () => {
    const disabled = { ...business, today: { enabled: false, lapses: business.today.lapses } }
    expect(storeOpenNow(disabled, at(12, 0))).toEqual({ open: false })
  })

  it('gives no opening without today', () => {
    expect(storeOpenNow({ open: false, timezone: 'America/New_York' }, at(12, 0))).toEqual({ open: false })
  })
})

describe('storeOpenNow — timezone', () => {
  const lapses = today(lapse([0, 0], [23, 59]))

  it('returns only the status when the timezone is invalid', () => {
    expect(storeOpenNow({ open: true, today: lapses, timezone: 'Not/AZone' }, at(20, 0))).toEqual({ open: true })
    expect(storeOpenNow({ open: false, today: lapses, timezone: 'Not/AZone' }, at(20, 0))).toEqual({ open: false })
  })

  it('returns only the status when the timezone is missing', () => {
    expect(storeOpenNow({ open: true, today: lapses }, at(20, 0))).toEqual({ open: true })
    expect(storeOpenNow({ open: true, today: lapses, timezone: '' }, at(20, 0))).toEqual({ open: true })
    expect(storeOpenNow({ open: true, today: lapses, timezone: null }, at(20, 0))).toEqual({ open: true })
  })
})

describe('formatClock', () => {
  it('writes HH:mm in 24 hours, zero-padded', () => {
    expect(formatClock({ hour: 9, minute: 5 }, false)).toBe('09:05')
    expect(formatClock({ hour: 0, minute: 0 }, false)).toBe('00:00')
    expect(formatClock({ hour: 23, minute: 59 }, false)).toBe('23:59')
    expect(formatClock({ hour: 14, minute: 30 })).toBe('14:30')
  })

  it('writes h:mm AM/PM in 12 hours, with the 12 AM and 12 PM edges', () => {
    expect(formatClock({ hour: 9, minute: 5 }, true)).toBe('9:05 AM')
    expect(formatClock({ hour: 12, minute: 0 }, true)).toBe('12:00 PM')
    expect(formatClock({ hour: 0, minute: 30 }, true)).toBe('12:30 AM')
    expect(formatClock({ hour: 12, minute: 30 }, true)).toBe('12:30 PM')
    expect(formatClock({ hour: 13, minute: 0 }, true)).toBe('1:00 PM')
    expect(formatClock({ hour: 23, minute: 59 }, true)).toBe('11:59 PM')
  })
})

// redesign stores 3.B review r1 #4: in 12 hours, the mark of the dashboard's language, with Latin digits
describe('formatClock — language', () => {
  it('writes the 12-hour mark of the language, and Latin digits in Arabic', () => {
    expect(formatClock({ hour: 23, minute: 59 }, true, 'en')).toBe('11:59 PM')
    expect(formatClock({ hour: 23, minute: 59 }, true, 'es')).toMatch(/^11:59\sp\.\s?m\.$/)
    expect(formatClock({ hour: 9, minute: 5 }, true, 'ar')).toMatch(/^9:05/)
  })

  it('keeps 24 hours whatever the language, and falls back without one or with a bad one', () => {
    expect(formatClock({ hour: 9, minute: 5 }, false, 'es')).toBe('09:05')
    expect(formatClock({ hour: 9, minute: 5 }, true)).toBe('9:05 AM')
    expect(formatClock({ hour: 9, minute: 5 }, true, '!!')).toBe('9:05 AM')
  })
})
