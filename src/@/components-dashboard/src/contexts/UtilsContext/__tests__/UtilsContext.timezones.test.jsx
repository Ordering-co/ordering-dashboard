import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

// redesign W1-6 (W1-QB1-01): the API writes dates in UTC without a zone («2026-10-07 23:40:28»). With customParseFormat on (the
// app extends it for the date pickers) dayjs.utc(value, [formats]) read that string as LOCAL time, and every relative time moved
// by the offset of the browser. These tests pin the zone (TZ) and the clock, so the result does not depend on the machine.
dayjs.extend(customParseFormat)

const mocks = vi.hoisted(() => ({ configs: {} }))

vi.mock('../../ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))

vi.mock('../../LanguageContext', () => ({
  useLanguage: () => [{ loading: true, language: undefined }, (key, fallback) => fallback]
}))

import { UtilsProviders, useUtils } from '../index'

// offsetMinutes is getTimezoneOffset() at NOW (October 8th 2026): the test fails loud if the zone was not applied.
const NOW = '2026-10-08T12:00:00Z'
const ZONES = [
  { tz: 'UTC', offsetMinutes: 0, time: '10:30', time12: '10:30 AM', stamp: '2026-10-07 23:40' },
  { tz: 'America/Chicago', offsetMinutes: 300, time: '05:30', time12: '05:30 AM', stamp: '2026-10-07 18:40' }, // negative offset (CDT -5)
  { tz: 'Asia/Kolkata', offsetMinutes: -330, time: '16:00', time12: '04:00 PM', stamp: '2026-10-08 05:10' }, // half hour (+5:30)
  { tz: 'America/St_Johns', offsetMinutes: 150, time: '08:00', time12: '08:00 AM', stamp: '2026-10-07 21:10' }, // negative half hour (NDT -2:30)
  { tz: 'Pacific/Auckland', offsetMinutes: -780, time: '23:30', time12: '11:30 PM', stamp: '2026-10-08 12:40' } // +13 (NZDT)
]

const utils = (configs = {}) => {
  mocks.configs = configs
  let value
  const Consumer = () => {
    ;[value] = useUtils()
    return null
  }
  render(<UtilsProviders><Consumer /></UtilsProviders>)
  return value
}

describe.each(ZONES)('UtilsContext reads API dates as UTC in $tz', ({ tz, offsetMinutes, time, time12, stamp }) => {
  const originalTZ = process.env.TZ

  beforeEach(() => {
    process.env.TZ = tz
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
    expect(new Date(NOW).getTimezoneOffset()).toBe(offsetMinutes)
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('getTimeAgo: a message that arrived just now is not «in N hours» (and is the same text as UTC)', () => {
    const { getTimeAgo } = utils()
    expect(getTimeAgo('2026-10-08 12:00:00')).toBe('a few seconds ago')
    expect(getTimeAgo('2026-10-08 11:55:00')).toBe('5 minutes ago')
    expect(getTimeAgo('2026-10-08 10:00:00')).toBe('2 hours ago')
    expect(getTimeAgo('2026-10-07 23:40:28')).toBe('12 hours ago')
    expect(getTimeAgo('2026-10-08 12:30:00')).toBe('in 30 minutes')
    expect(getTimeAgo('2026-10-08T11:55:00Z')).toBe('5 minutes ago')
  })

  it('getTimeAgo with utc: false reads the string as the local time of the browser', () => {
    const { getTimeAgo } = utils()
    const local = dayjs().subtract(5, 'minute').format('YYYY-MM-DD HH:mm:ss')
    expect(getTimeAgo(local, { utc: false })).toBe('5 minutes ago')
  })

  it('getTimeTo is the mirror of getTimeAgo, in UTC time', () => {
    const { getTimeTo } = utils()
    expect(getTimeTo('2026-10-08 12:30:00')).toBe('30 minutes ago')
    expect(getTimeTo('2026-10-08 11:30:00')).toBe('in 30 minutes')
  })

  it('getTimeAgo and getTimeTo keep answering the invalid format text and NN', () => {
    const { getTimeAgo, getTimeTo } = utils()
    expect(getTimeAgo('not a date')).toBe('invalid format')
    expect(getTimeTo('not a date')).toBe('invalid format')
    expect(getTimeAgo('')).toBe('NN')
    expect(getTimeTo(undefined)).toBe('NN')
  })

  it('parseTime converts a UTC time of day to the local one (24h and 12h)', () => {
    const { parseTime } = utils()
    expect(parseTime('10:30')).toBe(time)
    expect(parseTime('10:30 AM', { formatTime: '12' })).toBe(time12)
    expect(parseTime('10:30', { utc: false })).toBe('10:30')
    expect(parseTime('')).toBe('00:00')
    expect(parseTime('xx:yy')).toBe('invalid format')
  })

  it('parseDate (moment, not shared with the dayjs path) converts the same UTC stamp to the same local one', () => {
    const { parseDate } = utils()
    expect(parseDate('2026-10-07 23:40:28', { outputFormat: 'YYYY-MM-DD HH:mm' })).toBe(stamp)
    expect(parseDate('2026-10-07 23:40:28', { outputFormat: 'YYYY-MM-DD HH:mm', utc: false })).toBe('2026-10-07 23:40')
  })
})
