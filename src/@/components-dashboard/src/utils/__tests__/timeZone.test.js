import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  clockIn,
  nowWallDate,
  resolveTimeZone,
  timeZoneNote,
  todayIn,
  utcToZone,
  zoneToUtc,
  zoneWallDate
} from '../timeZone'

// the browser zone (TZ) and the clock are pinned, so the result never depends on the machine. NOW is 16:30 UTC of
// October 27th: already the 28th in Tokyo (01:30) and Auckland (05:30), still the 27th in Bogotá (11:30) and Chicago (11:30).
const NOW = '2026-10-27T16:30:00Z'
const BROWSERS = ['UTC', 'Asia/Tokyo', 'America/Bogota', 'Pacific/Auckland']
const ZONES = [
  { zone: 'America/Bogota', today: '2026-10-27', clock: { hour: 11, minute: 30 }, nine: '2026-10-27 14:00:00' }, // -5, no DST
  { zone: 'Asia/Tokyo', today: '2026-10-28', clock: { hour: 1, minute: 30 }, nine: '2026-10-27 00:00:00' }, // +9
  { zone: 'Asia/Kolkata', today: '2026-10-27', clock: { hour: 22, minute: 0 }, nine: '2026-10-27 03:30:00' }, // +5:30
  { zone: 'America/Chicago', today: '2026-10-27', clock: { hour: 11, minute: 30 }, nine: '2026-10-27 14:00:00' }, // CDT -5
  { zone: 'Pacific/Auckland', today: '2026-10-28', clock: { hour: 5, minute: 30 }, nine: '2026-10-26 20:00:00' } // NZDT +13
]

describe.each(BROWSERS)('timeZone utilities with the browser in %s', (browser) => {
  const originalTZ = process.env.TZ

  beforeEach(() => {
    process.env.TZ = browser
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it.each(ZONES)('today and the clock are the ones of $zone', ({ zone, today, clock }) => {
    expect(todayIn(zone)).toBe(today)
    expect(clockIn(zone)).toEqual(clock)
  })

  it.each(ZONES)('09:00 of $zone goes to the API as its UTC hour and comes back as 09:00', ({ zone, nine }) => {
    expect(zoneToUtc('2026-10-27 09:00:00', zone)).toBe(nine)
    expect(utcToZone(nine, zone)).toBe('2026-10-27 09:00:00')
  })

  it('a calendar Date carries the digits of the zone, not of the browser', () => {
    const date = zoneWallDate('2026-10-27 14:00:00', 'America/Bogota')
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2026, 9, 27, 9, 0])
    const now = nowWallDate('America/Bogota')
    expect([now.getDate(), now.getHours(), now.getMinutes()]).toEqual([27, 11, 30])
  })

  it('the browser zone stands in when the entity has none or an invalid one, and says so', () => {
    expect(resolveTimeZone('America/Bogota')).toEqual({ zone: 'America/Bogota', fallback: false })
    expect(resolveTimeZone(' UTC ')).toEqual({ zone: 'UTC', fallback: false })
    for (const missing of [null, undefined, '', 'Mars/Olympus', 5]) {
      expect(resolveTimeZone(missing)).toEqual({ zone: browser, fallback: true })
    }
  })
})

describe('timeZone utilities · edges', () => {
  it('a DST change keeps the hour of the day (Chicago, November 1st 2026)', () => {
    expect(zoneToUtc('2026-10-31 09:00:00', 'America/Chicago')).toBe('2026-10-31 14:00:00')
    expect(zoneToUtc('2026-11-02 09:00:00', 'America/Chicago')).toBe('2026-11-02 15:00:00')
  })

  it('adds days across months and years without a zone', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('null stays null', () => {
    expect(utcToZone(null, 'Asia/Tokyo')).toBeNull()
  })

  it('writes the zone, and the fallback in its own words', () => {
    const t = (key, fallback) => fallback
    expect(timeZoneNote({ zone: 'America/Bogota', fallback: false }, t)).toBe('Times in America/Bogota')
    expect(timeZoneNote({ zone: 'Asia/Tokyo', fallback: true }, t)).toBe('Times in Asia/Tokyo, your browser’s time zone (none is set here)')
  })
})
