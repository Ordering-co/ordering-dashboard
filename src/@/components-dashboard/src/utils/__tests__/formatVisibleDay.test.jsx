// redesign cierre W0 (W0-PA4-04): formatVisibleDay asks parseDate for a DAY, not an instant. `utc: false` is what keeps the
// day from sliding in a browser west of Greenwich («30 Oct» for «01 Oct»); the chip tests mock parseDate and ignore `utc`,
// so the guard lives here: one test independent of the machine's time zone (it spies the options) and one that pins the zone.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const zone = vi.hoisted(() => {
  // Set before any Date is built; Node re-reads TZ when process.env.TZ changes.
  process.env.TZ = 'America/Chicago'
  return { configs: {} }
})

vi.mock('../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: zone.configs }] }))
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: true, language: { code: 'en' } }, (key, fallback) => fallback]
}))

import { UtilsProviders, useUtils } from '../../contexts/UtilsContext'
import { formatVisibleDay } from '../dateRange'

const realParseDate = () => {
  let parseDate
  const Consumer = () => {
    parseDate = useUtils()[0].parseDate
    return null
  }
  render(<UtilsProviders><Consumer /></UtilsProviders>)
  return parseDate
}

describe('formatVisibleDay', () => {
  it('asks parseDate for the day alone, in local time (independent of the time zone of the machine)', () => {
    const parseDate = vi.fn(() => '01 Oct 2026')
    expect(formatVisibleDay('2026-10-01', parseDate)).toBe('01 Oct 2026')
    expect(parseDate).toHaveBeenCalledExactlyOnceWith('2026-10-01 00:00:00', { dateOnly: true, utc: false })
    expect(formatVisibleDay(null, parseDate)).toBe('')
    expect(parseDate).toHaveBeenCalledTimes(1)
  })

  it('keeps the day of the calendar west of Greenwich (TZ America/Chicago pinned by this file)', () => {
    expect(new Date(2026, 9, 1).getTimezoneOffset()).toBeGreaterThan(0)
    const parseDate = realParseDate()
    expect(formatVisibleDay('2026-10-01', parseDate)).toBe('01 Oct 2026')
    expect(formatVisibleDay('2026-01-01', parseDate)).toBe('01 Jan 2026')
  })
})
