import { describe, expect, it } from 'vitest'

import {
  buildMonth,
  dayOf,
  describeDateFormat,
  firstDayOfWeekFor,
  formatDay,
  maskDateText,
  parseDateText,
  pickDay
} from '../dateRange'

describe('describeDateFormat', () => {
  it.each([
    ['YYYY-MM-DD', true],
    ['MM/DD/YYYY', true],
    ['DD-MM-YYYY', true],
    ['D/M/YYYY', true],
    ['DD MMM YYYY', false],
    ['DD/MM/YY', false]
  ])('%s is masked: %s', (format, masked) => {
    expect(describeDateFormat(format).masked).toBe(masked)
  })

  it('falls back to the ISO day', () => {
    expect(describeDateFormat('').format).toBe('YYYY-MM-DD')
    expect(describeDateFormat(undefined).placeholder).toBe('yyyy-mm-dd')
  })
})

describe('maskDateText', () => {
  const dmy = describeDateFormat('DD-MM-YYYY')
  const mdy = describeDateFormat('MM/DD/YYYY')
  const iso = describeDateFormat('YYYY-MM-DD')

  it('never lets 10012026 become the year 100120', () => {
    expect(maskDateText('10012026', mdy)).toBe('10/01/2026')
    expect(maskDateText('10012026', dmy)).toBe('10-01-2026')
    expect(maskDateText('10012026', iso)).toBe('1001-20-26')
    expect(maskDateText('100120261234', mdy)).toBe('10/01/2026')
  })

  it('adds a separator only when a digit follows, so Backspace is never stuck', () => {
    expect(maskDateText('10', mdy)).toBe('10')
    expect(maskDateText('100', mdy)).toBe('10/0')
    expect(maskDateText('10/', mdy)).toBe('10')
  })

  it('drops everything that is not a digit and leaves free formats alone', () => {
    expect(maskDateText('1a0/0b1', mdy)).toBe('10/01')
    expect(maskDateText('10 Jan 2026', describeDateFormat('DD MMM YYYY'))).toBe('10 Jan 2026')
  })
})

describe('parseDateText', () => {
  const dmy = describeDateFormat('DD-MM-YYYY')

  it('reads a real date and refuses an impossible one', () => {
    expect(parseDateText('10-01-2026', dmy)).toBe('2026-01-10')
    expect(parseDateText('31-02-2026', dmy)).toBeNull()
    expect(parseDateText('10-13-2026', dmy)).toBeNull()
    expect(parseDateText('10-01-26', dmy)).toBeNull()
    expect(parseDateText('', dmy)).toBeNull()
  })

  it('refuses years outside 1900-2999', () => {
    expect(parseDateText('10-01-1850', dmy)).toBeNull()
  })

  it('reads a format with month names strictly', () => {
    expect(parseDateText('10 Jan 2026', describeDateFormat('DD MMM YYYY'))).toBe('2026-01-10')
  })
})

describe('days', () => {
  it('formats a day in the project format and reads the day of a filter datetime', () => {
    expect(formatDay('2026-01-10', describeDateFormat('MM/DD/YYYY'))).toBe('01/10/2026')
    expect(formatDay(null, describeDateFormat('MM/DD/YYYY'))).toBe('')
    expect(dayOf('2026-01-10 23:59:59')).toBe('2026-01-10')
    expect(dayOf(null)).toBeNull()
    expect(dayOf('garbage')).toBeNull()
  })

  it('closes the range on the second click and starts again after it', () => {
    expect(pickDay({ from: null, to: null }, '2026-01-10')).toEqual({ from: '2026-01-10', to: null })
    expect(pickDay({ from: '2026-01-10', to: null }, '2026-01-20')).toEqual({ from: '2026-01-10', to: '2026-01-20' })
    expect(pickDay({ from: '2026-01-10', to: null }, '2026-01-10')).toEqual({ from: '2026-01-10', to: '2026-01-10' })
    expect(pickDay({ from: '2026-01-10', to: null }, '2026-01-05')).toEqual({ from: '2026-01-05', to: null })
    expect(pickDay({ from: '2026-01-10', to: '2026-01-20' }, '2026-01-15')).toEqual({ from: '2026-01-15', to: null })
  })

  it('lays a month in weeks of seven, starting on the first weekday of the locale', () => {
    // January 2026 starts on a Thursday.
    const sunday = buildMonth('2026-01-15', 0)
    expect(sunday[0]).toEqual([null, null, null, null, '2026-01-01', '2026-01-02', '2026-01-03'])
    expect(sunday.every(week => week.length === 7)).toBe(true)
    expect(sunday.flat().filter(Boolean)).toHaveLength(31)
    const monday = buildMonth('2026-01-15', 1)
    expect(monday[0]).toEqual([null, null, null, '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
  })

  it('knows that the week starts on Sunday in en and on Monday in es', () => {
    expect(firstDayOfWeekFor('en')).toBe(0)
    expect(firstDayOfWeekFor('es')).toBe(1)
    expect(firstDayOfWeekFor(undefined)).toBe(0)
  })
})

// redesign cierre W0 (W0-PA4-01): the typed fields write and read the word month with the Intl names of the user's
// language (the same ones as the pill and the chip), never with the dayjs locale built from the catalog.
describe('word months with the Intl names of the language', () => {
  const spec = (format, locale) => describeDateFormat(format, locale)

  it.each([
    ['es', '2026-05-01', '01 may 2026'],
    ['es', '2026-10-05', '05 oct 2026'],
    ['fr', '2026-05-01', '01 mai 2026'],
    ['fr', '2026-10-05', '05 oct. 2026'],
    ['nl', '2026-03-05', '05 mrt 2026'],
    ['de', '2026-03-05', '05 Mär 2026'],
    ['pt', '2026-05-01', '01 mai. 2026'],
    ['da', '2026-03-05', '05 mar. 2026'],
    ['el', '2026-05-01', '01 Μαΐ 2026'],
    ['en', '2026-05-01', '01 May 2026'],
    ['en', '2026-03-05', '05 Mar 2026']
  ])('%s writes %s as «%s» and reads it back', (locale, day, text) => {
    expect(formatDay(day, spec('DD MMM YYYY', locale))).toBe(text)
    expect(parseDateText(text, spec('DD MMM YYYY', locale))).toBe(day)
  })

  it('reads without case, without the final dot and with the long name', () => {
    expect(parseDateText('01 MAY 2026', spec('DD MMM YYYY', 'es'))).toBe('2026-05-01')
    expect(parseDateText('01 mai 2026', spec('DD MMM YYYY', 'pt'))).toBe('2026-05-01')
    expect(parseDateText('01 mai. 2026', spec('DD MMM YYYY', 'pt'))).toBe('2026-05-01')
    expect(parseDateText('05 mar 2026', spec('DD MMM YYYY', 'da'))).toBe('2026-03-05')
    expect(parseDateText('01 mayo 2026', spec('DD MMM YYYY', 'es'))).toBe('2026-05-01')
    expect(parseDateText('05 octubre 2026', spec('DD MMM YYYY', 'es'))).toBe('2026-10-05')
    expect(parseDateText('01 Pue 2026', spec('DD MMM YYYY', 'es'))).toBeNull()
    expect(parseDateText('31 feb 2026', spec('DD MMM YYYY', 'es'))).toBeNull()
  })

  it('writes MMMM with the form that goes beside a day', () => {
    expect(formatDay('2026-05-01', spec('DD MMMM YYYY', 'el'))).toBe('01 Μαΐου 2026')
    expect(parseDateText('01 Μαΐου 2026', spec('DD MMMM YYYY', 'el'))).toBe('2026-05-01')
    expect(formatDay('2026-10-05', spec('DD MMMM YYYY', 'es'))).toBe('05 octubre 2026')
    expect(formatDay('2026-05-01', spec('MMMM DD YYYY', 'el'))).toBe('Μάιος 01 2026')
  })

  it('numeric formats and a spec without locale do not change', () => {
    expect(formatDay('2026-05-01', spec('DD/MM/YYYY', 'es'))).toBe('01/05/2026')
    expect(parseDateText('01/05/2026', spec('DD/MM/YYYY', 'es'))).toBe('2026-05-01')
    expect(formatDay('2026-05-01', spec('MM/DD/YYYY', undefined))).toBe('05/01/2026')
    expect(parseDateText('10 Jan 2026', describeDateFormat('DD MMM YYYY'))).toBe('2026-01-10')
    expect(formatDay('2026-01-10', describeDateFormat('DD MMM YYYY'))).toBe('10 Jan 2026')
  })
})
