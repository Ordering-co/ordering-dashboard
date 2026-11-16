import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// redesign cierre W0 (W0-QA4-05): the typed fields of the range write what the pill paints (parseDate of the real UtilsProviders),
// also with a weekday (dddd, ddd, dd) or the ordinal day (Do) in the project format.
const mocks = vi.hoisted(() => ({ configs: {}, language: undefined }))

vi.mock('../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: true, language: mocks.language ? { code: mocks.language } : undefined }, (key, fallback) => fallback]
}))

import { UtilsProviders, useUtils } from '../../contexts/UtilsContext'
import { describeDateFormat, formatDay, formatVisibleDay, parseDateText } from '../dateRange'

const parseDateFor = (language, format) => {
  mocks.language = language
  mocks.configs = format ? { dates_general_format: { value: format } } : {}
  let parseDate
  const Consumer = () => {
    ;[{ parseDate }] = useUtils()
    return null
  }
  render(<UtilsProviders><Consumer /></UtilsProviders>)
  return parseDate
}

const DAYS = ['2026-10-01', '2026-10-05', '2026-10-07', '2026-03-22', '2026-05-03']

describe('typed date fields and pill share one text (real UtilsProviders)', () => {
  it.each([
    ['es', 'dddd, Do MMMM YYYY hh:mm A'],
    ['en', 'dddd, Do MMMM YYYY hh:mm A'],
    ['de', 'dd, Do MMMM YYYY'],
    ['es', 'dd DD MMM YYYY'],
    ['el', 'ddd Do MMMM YYYY HH:mm'],
    ['uk', 'dddd, D MMMM YYYY'],
    ['ar', 'dddd Do MMMM YYYY'],
    ['es', 'DD MMM YYYY HH:mm'],
    ['es', 'DD-MM-YYYY HH:mm'],
    ['en', 'Do MMM YYYY']
  ])('%s · «%s»: the field writes the text of the pill and reads it back', (language, format) => {
    const parseDate = parseDateFor(language, format)
    const datePart = format.replace(/\s+(hh|HH):mm.*$/, '')
    const spec = describeDateFormat(datePart, language)
    for (const day of DAYS) {
      const pill = formatVisibleDay(day, parseDate)
      expect(formatDay(day, spec)).toBe(pill)
      expect(parseDateText(pill, spec)).toBe(day)
    }
  })

  it('the ordinal is only English: «Do» in es is the bare number, in en the suffix', () => {
    const es = describeDateFormat('dddd, Do MMMM YYYY', 'es')
    expect(formatDay('2026-10-01', es)).toBe('jueves, 1 octubre 2026')
    expect(formatDay('2026-10-01', es)).not.toMatch(/1o/)
    const en = describeDateFormat('dddd, Do MMMM YYYY', 'en')
    expect(formatDay('2026-10-01', en)).toBe('Thursday, 1st October 2026')
    expect(formatDay('2026-10-02', en)).toBe('Friday, 2nd October 2026')
    expect(formatDay('2026-10-23', en)).toBe('Friday, 23rd October 2026')
  })

  it('a weekday format also reads the date written without the weekday, and a weekday written wrong', () => {
    const es = describeDateFormat('dddd, Do MMMM YYYY', 'es')
    expect(parseDateText('1 octubre 2026', es)).toBe('2026-10-01')
    expect(parseDateText('jueves, 1 octubre 2026', es)).toBe('2026-10-01')
    expect(parseDateText('Jueves, 1o Octubre 2026', es)).toBeNull()
    expect(parseDateText('31 septiembre 2026', es)).toBeNull()
    const tail = describeDateFormat('DD MMM YYYY dddd', 'es')
    expect(parseDateText('05 oct 2026', tail)).toBe('2026-10-05')
    expect(parseDateText('05 oct 2026 lunes', tail)).toBe('2026-10-05')
    const en = describeDateFormat('Do MMMM YYYY', 'en')
    expect(parseDateText('1st October 2026', en)).toBe('2026-10-01')
    expect(parseDateText('1 October 2026', en)).toBe('2026-10-01')
  })
})
