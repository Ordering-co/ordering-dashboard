import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import moment from 'moment'

const mocks = vi.hoisted(() => ({
  configs: {},
  dictionary: {}, // redesign tramo A r2 (W0-PA1-01)
  language: undefined // redesign tramo A r4 (W0-PA2-01): the language code of the user
}))

vi.mock('../../ConfigContext', () => ({
  useConfig: () => [{ configs: mocks.configs }]
}))

vi.mock('../../LanguageContext', () => ({
  useLanguage: () => [{ loading: true, language: mocks.language ? { code: mocks.language } : undefined }, (key, fallback) => mocks.dictionary[key] ?? fallback]
}))

import { UtilsProviders, useUtils } from '../index'

const baseConfigs = {
  format_number_decimal_length: { value: 2 },
  format_number_decimal_separator: { value: ',' },
  format_number_thousand_separator: { value: '.' },
  currency_position: { value: 'left' }
}

const PriceConsumer = ({ onReady }) => {
  const [{ parsePrice }] = useUtils()
  onReady(parsePrice)
  return null
}

describe('UtilsContext price formatting', () => {
  beforeEach(() => {
    mocks.configs = { ...baseConfigs }
  })

  it('prioritizes the configured display currency over an order currency symbol', () => {
    mocks.configs.format_number_currency = { value: 'SRD' }
    let parsePrice

    render(
      <UtilsProviders>
        <PriceConsumer onReady={value => { parsePrice = value }} />
      </UtilsProviders>
    )

    expect(parsePrice(1617, { currency: '$', currencyPosition: 'right' })).toBe('SRD 1.617,00')
  })

  it('uses the requested currency as a fallback when no display currency is configured', () => {
    delete mocks.configs.currency_position
    let parsePrice

    render(
      <UtilsProviders>
        <PriceConsumer onReady={value => { parsePrice = value }} />
      </UtilsProviders>
    )

    expect(parsePrice(1617, { currency: '€', currencyPosition: 'right' })).toBe('1.617,00 €')
  })
})

// redesign W0-4a (T0-13, decision 13): parseDate without outputFormat follows dates_general_format, and an ISO date is never
// what a project without that setting sees.
// (5): a negative whose integer part has 3, 6… digits got a thousands separator after its minus sign
// («$ -,177.76»). Only the negatives change; positives and the rest of the format stay as they were.
describe('UtilsContext number formatting of negatives', () => {
  const renderUtils = () => {
    let utils
    const Consumer = () => {
      [utils] = useUtils()
      return null
    }
    render(<UtilsProviders><Consumer /></UtilsProviders>)
    return utils
  }

  beforeEach(() => {
    mocks.configs = { ...baseConfigs }
  })

  it.each([
    [-177.76, '$ -177,76'],
    [-123456.5, '$ -123.456,50'],
    [-177617, '$ -177.617,00'],
    [-1617, '$ -1.617,00'],
    [-12.5, '$ -12,50'],
    [-0.5, '$ -0,50']
  ])('parsePrice(%s) is %s', (value, expected) => {
    expect(renderUtils().parsePrice(value)).toBe(expected)
  })

  it.each([
    [0, '$ 0,00'],
    [12.5, '$ 12,50'],
    [177.76, '$ 177,76'],
    [999, '$ 999,00'],
    [1617, '$ 1.617,00'],
    [123456.5, '$ 123.456,50'],
    [1234567.891, '$ 1.234.567,89'],
    ['177.76', '$ 177,76'],
    [null, '$ 0,00']
  ])('positives do not change: parsePrice(%s) is %s', (value, expected) => {
    expect(renderUtils().parsePrice(value)).toBe(expected)
  })

  it('keeps the configured separators, decimals and currency position', () => {
    mocks.configs = {
      format_number_decimal_length: { value: 3 },
      format_number_decimal_separator: { value: '.' },
      format_number_thousand_separator: { value: ',' },
      format_number_currency: { value: '€' },
      currency_position: { value: 'right' }
    }
    const utils = renderUtils()
    expect(utils.parsePrice(-177.76)).toBe('-177.760 €')
    expect(utils.parsePrice(177.76)).toBe('177.760 €')
    expect(utils.parsePrice(-1234567.5)).toBe('-1,234,567.500 €')
  })

  it('parseNumber: the same for negatives, a space separator included', () => {
    const utils = renderUtils()
    expect(utils.parseNumber(-177.76)).toBe('-177,76')
    expect(utils.parseNumber(177.76)).toBe('177,76')
    expect(utils.parseNumber(-177000, { thousand: 'space' })).toBe('-177 000,00')
    expect(utils.parseNumber(177000, { thousand: 'space' })).toBe('177 000,00')
  })
})

describe('UtilsContext parseDate follows dates_general_format', () => {
  const STAMP = '2026-10-07 15:30:45'
  const ISO_LOOK = /\d{4}-\d{2}-\d{2}/
  const parseDateFor = (configs) => {
    mocks.configs = { ...baseConfigs, ...configs }
    let parseDate
    const Consumer = () => {
      ;[{ parseDate }] = useUtils()
      return null
    }
    render(<UtilsProviders><Consumer /></UtilsProviders>)
    return parseDate
  }

  it('paints DD/MM/YYYY hh:mm a as the project wrote it, without seconds', () => {
    const parseDate = parseDateFor({ dates_general_format: { value: 'DD/MM/YYYY hh:mm a' } })
    expect(parseDate(STAMP, { utc: false })).toBe('07/10/2026 03:30 pm')
  })

  it('paints YYYY-MM-DD HH:mm:ss when the project itself chose that format (the setting, not a default)', () => {
    const parseDate = parseDateFor({ dates_general_format: { value: 'YYYY-MM-DD HH:mm:ss' } })
    expect(parseDate(STAMP, { utc: false })).toBe('2026-10-07 15:30')
  })

  it('without a configured format paints DD MMM YYYY, 24h, and never an ISO date', () => {
    const parseDate = parseDateFor({})
    expect(parseDate(STAMP, { utc: false })).toBe('07 Oct 2026 15:30')
    expect(parseDate(STAMP, { utc: false })).not.toMatch(ISO_LOOK)
  })

  it('treats an empty or blank format as not configured', () => {
    for (const value of ['', '   ', null]) {
      expect(parseDateFor({ dates_general_format: { value } })(STAMP, { utc: false })).toBe('07 Oct 2026 15:30')
    }
  })

  it('respects format_time as before: 12 gives hh:mm A, with or without a configured format', () => {
    expect(parseDateFor({ format_time: { value: '12' } })(STAMP, { utc: false })).toBe('07 Oct 2026 03:30 PM')
    expect(parseDateFor({ dates_general_format: { value: 'DD/MM/YYYY HH:mm' }, format_time: { value: '12' } })(STAMP, { utc: false })).toBe('07/10/2026 03:30 PM')
    expect(parseDateFor({ dates_general_format: { value: 'DD/MM/YYYY hh:mm A' }, format_time: { value: '24' } })(STAMP, { utc: false })).toBe('07/10/2026 15:30')
  })

  it('paints a part when asked: dateOnly, timeOnly, and omitYear for the short date beside a time', () => {
    const parseDate = parseDateFor({ dates_general_format: { value: 'MM/DD/YYYY hh:mm A' } })
    expect(parseDate(STAMP, { utc: false, dateOnly: true })).toBe('10/07/2026')
    expect(parseDate(STAMP, { utc: false, dateOnly: true, omitYear: true })).toBe('10/07')
    expect(parseDate(STAMP, { utc: false, timeOnly: true })).toBe('03:30 PM')
  })

  it('keeps an explicit outputFormat (machine data) and converts from UTC by default', () => {
    const parseDate = parseDateFor({ dates_general_format: { value: 'DD/MM/YYYY hh:mm a' } })
    expect(parseDate(STAMP, { utc: false, outputFormat: 'YYYY-MM-DD HH:mm:ss' })).toBe(STAMP)
    const local = moment.utc(STAMP, 'YYYY-MM-DD HH:mm:ss').local()
    expect(parseDate(STAMP)).toBe(local.format('DD/MM/YYYY hh:mm a'))
  })

  it('answers the invalid format text for something that is not a date', () => {
    expect(parseDateFor({})('not a date')).toBe('invalid format')
  })
})

// redesign tramo A r4 (W0-PA2-01, W0-PA2-02, W0-D-09): month and day names come from Intl in the language of the user, never from the
// catalog (MONTH1..12 has live wrong translations: «Puede», «Marsch»), all twelve from the same source.
describe('UtilsContext parseDate months in the user language (Intl)', () => {
  const parseDateFor = (language, configs = {}, dictionary = {}) => {
    mocks.configs = { ...baseConfigs, ...configs }
    mocks.dictionary = dictionary
    mocks.language = language
    let parseDate
    const Consumer = () => {
      ;[{ parseDate }] = useUtils()
      return null
    }
    render(<UtilsProviders><Consumer /></UtilsProviders>)
    return parseDate
  }
  const WRONG_CATALOG = { MONTH3: 'Marsch', MONTH5: 'Puede', MONTH10: 'Oktober' }
  afterEach(() => { mocks.dictionary = {}; mocks.language = undefined })

  it('paints May in es as «may» (short) and «mayo» (long), not the catalog «Puede»', () => {
    const parseDate = parseDateFor('es', {}, WRONG_CATALOG)
    expect(parseDate('2026-05-02 12:34:00', { utc: false })).toBe('02 may 2026 12:34')
    expect(parseDate('2026-05-02 12:34:00', { utc: false, outputFormat: 'D MMMM YYYY' })).toBe('2 mayo 2026')
  })

  it('paints March in de as «Mär» / «März», not the catalog «Marsch»', () => {
    const parseDate = parseDateFor('de', {}, WRONG_CATALOG)
    expect(parseDate('2026-03-02 12:34:00', { utc: false })).toBe('02 Mär 2026 12:34')
    expect(parseDate('2026-03-02 12:34:00', { utc: false, outputFormat: 'MMMM' })).toBe('März')
  })

  it('takes every month from the same origin: nl October and September are both short (or both long), never mixed', () => {
    const parseDate = parseDateFor('nl')
    expect(parseDate('2026-10-07 10:30:00', { utc: false, dateOnly: true })).toBe('07 okt 2026')
    expect(parseDate('2026-09-29 10:30:00', { utc: false, dateOnly: true })).toBe('29 sep 2026')
    expect(parseDate('2026-10-07 10:30:00', { utc: false, outputFormat: 'MMMM' })).toBe('oktober')
    expect(parseDate('2026-09-29 10:30:00', { utc: false, outputFormat: 'MMMM' })).toBe('september')
  })

  it('gives the right May and March for the 11 supported languages (long and short)', () => {
    const expected = [
      ['es', 'mayo', 'may', 'marzo', 'mar'],
      ['fr', 'mai', 'mai', 'mars', 'mars'],
      ['de', 'Mai', 'Mai', 'März', 'Mär'],
      ['nl', 'mei', 'mei', 'maart', 'mrt'],
      ['pt', 'maio', 'mai.', 'março', 'mar.'],
      ['it', 'maggio', 'mag', 'marzo', 'mar'],
      ['da', 'maj', 'maj', 'marts', 'mar.'],
      ['ar', 'مايو', 'مايو', 'مارس', 'مارس'],
      ['el', 'Μάιος', 'Μαΐ', 'Μάρτιος', 'Μαρ'],
      ['bg', 'май', 'май', 'март', 'март'],
      ['tr', 'Mayıs', 'May', 'Mart', 'Mar']
    ]
    for (const [language, mayLong, mayShort, marLong, marShort] of expected) {
      const parseDate = parseDateFor(language, {}, WRONG_CATALOG)
      expect([language, parseDate('2026-05-02 12:34:00', { utc: false, outputFormat: 'MMMM' })]).toEqual([language, mayLong])
      expect([language, parseDate('2026-05-02 12:34:00', { utc: false, outputFormat: 'MMM' })]).toEqual([language, mayShort])
      expect([language, parseDate('2026-03-02 12:34:00', { utc: false, outputFormat: 'MMMM' })]).toEqual([language, marLong])
      expect([language, parseDate('2026-03-02 12:34:00', { utc: false, outputFormat: 'MMM' })]).toEqual([language, marShort])
    }
  })

  it('bg has no short month word in Intl: MMM paints the long name for every month', () => {
    const parseDate = parseDateFor('bg')
    expect(parseDate('2026-10-07 10:30:00', { utc: false, outputFormat: 'MMM' })).toBe('октомври')
    expect(parseDate('2026-05-07 10:30:00', { utc: false, outputFormat: 'MMM' })).toBe('май')
  })

  // redesign tramo A r5 (W0-QA3-03, W0-PA3-06)
  it('the ordinal «Do» is English only: every other language gets the bare number, never «2nd» beside a translated month', () => {
    const at = (language, format) => parseDateFor(language)('2026-01-02 12:34:00', { utc: false, outputFormat: format })
    expect(at('en', 'dddd, MMMM Do')).toBe('Friday, January 2nd')
    expect(at('en-GB', 'Do')).toBe('2nd')
    expect(at('es', 'Do')).toBe('2')
    expect(at('es', 'dddd, Do MMMM YYYY')).toBe('viernes, 2 enero 2026')
    expect(at('fr', 'Do MMMM')).toBe('2 janvier')
    expect(at('de', 'Do')).toBe('2')
    expect(at('el', 'Do')).toBe('2')
    expect(at('uk', 'Do')).toBe('2')
    expect(at('es', 'D MMMM')).toBe('2 enero')
  })

  it('MMMM beside a day uses the declined form (uk, el, ru) and the nominative when there is no day', () => {
    const at = (language, format, day = '2026-05-07') => parseDateFor(language)(`${day} 12:34:00`, { utc: false, outputFormat: format })
    expect(at('uk', 'D MMMM YYYY')).toBe('7 травня 2026')
    expect(at('uk', 'MMMM YYYY')).toBe('травень 2026')
    expect(at('uk', 'MMMM')).toBe('травень')
    expect(at('ru', 'DD MMMM')).toBe('07 мая')
    expect(at('ru', 'MMMM')).toBe('май')
    expect(at('el', 'D MMMM')).toBe('7 Μαΐου')
    // redesign cierre W0 (W0-PA4-03): el without a day is the nominative of «month year», not the genitive of { month: 'long' }
    expect(at('el', 'MMMM YYYY')).toBe('Μάιος 2026')
    expect(at('el', 'MMMM')).toBe('Μάιος')
    expect(at('el', 'MMMM', '2026-10-07')).toBe('Οκτώβριος')
    // moment's own rule: the declined form only when the day comes BEFORE the month
    expect(at('el', 'MMMM D, YYYY')).toBe('Μάιος 7, 2026')
    expect(at('es', 'D MMMM')).toBe('7 mayo')
    expect(at('de', 'D MMMM')).toBe('7 Mai')
    expect(at('uk', 'DD MMM YYYY', '2026-10-07')).toBe('07 жовт. 2026')
  })

  it('dd is the shortest coherent weekday: two letters, or the whole short name when two letters would repeat', () => {
    const week = (language) => [4, 5, 6, 7, 8, 9, 10].map(day => parseDateFor(language)(`2026-10-${String(day).padStart(2, '0')} 12:00:00`, { utc: false, outputFormat: 'dd' })).join(' ')
    expect(week('en')).toBe('Su Mo Tu We Th Fr Sa')
    expect(week('es')).toBe('do lu ma mi ju vi sá')
    expect(week('de')).toBe('So Mo Di Mi Do Fr Sa')
    expect(week('uk')).toBe('нд пн вт ср чт пт сб')
    expect(week('el')).toBe('Κυ Δε Τρ Τε Πέ Πα Σά')
    const arabic = week('ar').split(' ')
    expect(new Set(arabic).size).toBe(7)
  })

  it('an unknown language code, a malformed one or none paints the usual English names', () => {
    for (const language of ['xx-unknown', 'not a code!!', '', undefined]) {
      const parseDate = parseDateFor(language, {}, WRONG_CATALOG)
      expect(parseDate('2026-05-02 12:34:00', { utc: false })).toBe('02 May 2026 12:34')
      expect(parseDate('2026-03-02 12:34:00', { utc: false, outputFormat: 'MMMM' })).toBe('March')
    }
  })

  it('does not change a project with a numeric dates_general_format, nor the global moment locale', () => {
    const before = moment.locale()
    expect(parseDateFor('es', { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }, WRONG_CATALOG)('2026-01-02 12:34:00', { utc: false })).toBe('02-01-2026 12:34')
    expect(parseDateFor('de')('2026-01-02 12:34:00', { utc: false })).toBe('02 Jan 2026 12:34')
    expect(parseDateFor('fr')('2026-01-02 12:34:00', { utc: false })).toBe('02 janv. 2026 12:34')
    expect(moment.locale()).toBe(before)
    expect(moment('2026-01-02').format('MMMM Do dddd')).toBe('January 2nd Friday')
  })
})

// redesign tramo A r5 (W0-PA3-05): Intl is read once per language, not on every parseDate
describe('UtilsContext parseDate does not rebuild Intl on each call', () => {
  it('constructs no Intl.DateTimeFormat after the first call of a language, over 100 calls', () => {
    mocks.configs = { ...baseConfigs }
    mocks.dictionary = {}
    mocks.language = 'sv'
    let parseDate
    const Consumer = () => {
      ;[{ parseDate }] = useUtils()
      return null
    }
    render(<UtilsProviders><Consumer /></UtilsProviders>)
    const Original = Intl.DateTimeFormat
    let built = 0
    Intl.DateTimeFormat = new Proxy(Original, { construct (target, args, newTarget) { built += 1; return Reflect.construct(target, args, newTarget) } })
    try {
      parseDate('2026-10-07 15:30:45', { utc: false })
      const afterFirst = built
      expect(afterFirst).toBeGreaterThan(0)
      for (let i = 0; i < 100; i += 1) parseDate('2026-10-07 15:30:45', { utc: false })
      expect(built).toBe(afterFirst)
    } finally {
      Intl.DateTimeFormat = Original
      mocks.language = undefined
    }
  })
})

// redesign the AM/PM marker of the hours axis (timeOnly, 12h project) is written in the language of the user, like the
// month names. The 12h/24h choice stays the project's (decision 13); only the marker changes, and English keeps «AM/PM».
describe('UtilsContext parseDate meridiem in the user language', () => {
  const parseDateFor = (language, configs = {}) => {
    mocks.configs = { ...baseConfigs, ...configs }
    mocks.dictionary = {}
    mocks.language = language
    let parseDate
    const Consumer = () => {
      ;[{ parseDate }] = useUtils()
      return null
    }
    render(<UtilsProviders><Consumer /></UtilsProviders>)
    return parseDate
  }
  afterEach(() => { mocks.dictionary = {}; mocks.language = undefined })
  const MORNING = '2026-10-07 00:00:00'
  const EVENING = '2026-10-07 20:00:00'
  const hours = (parseDate, options = {}) => [MORNING, EVENING].map(stamp => parseDate(stamp, { utc: false, timeOnly: true, ...options }))

  it('paints the hours axis of a 12h project with the marker of each language', () => {
    const twelve = { format_time: { value: '12' } }
    expect(hours(parseDateFor('en', twelve))).toEqual(['12:00 AM', '08:00 PM'])
    expect(hours(parseDateFor('de', twelve))).toEqual(['12:00 AM', '08:00 PM'])
    expect(hours(parseDateFor('ar', twelve))).toEqual(['12:00 ص', '08:00 م'])
    expect(hours(parseDateFor('es', twelve))).toEqual(['12:00 a.\u202fm.', '08:00 p.\u202fm.']) // CLDR writes a narrow no-break space inside «a. m.»
    expect(hours(parseDateFor('el', twelve))).toEqual(['12:00 π.μ.', '08:00 μ.μ.'])
  })

  it('a lowercase «a» in the project format stays lowercase', () => {
    const lower = { dates_general_format: { value: 'DD/MM/YYYY hh:mm a' } }
    expect(hours(parseDateFor('en', lower))).toEqual(['12:00 am', '08:00 pm'])
    expect(hours(parseDateFor('de', lower))).toEqual(['12:00 am', '08:00 pm'])
    expect(hours(parseDateFor('ar', lower))).toEqual(['12:00 ص', '08:00 م'])
  })

  it('a 24h project paints the same hours as before in every language', () => {
    for (const language of ['en', 'de', 'ar', 'es', 'el', undefined]) {
      expect([language, hours(parseDateFor(language, { format_time: { value: '24' } }))]).toEqual([language, ['00:00', '20:00']])
      expect([language, hours(parseDateFor(language, {}))]).toEqual([language, ['00:00', '20:00']])
    }
  })

  it('a full date with time and the explicit machine outputFormat keep working in a 12h project', () => {
    const parseDate = parseDateFor('ar', { format_time: { value: '12' } })
    expect(parseDate('2026-10-07 15:30:45', { utc: false })).toBe('07 أكتوبر 2026 03:30 م')
    expect(parseDate('2026-10-07 15:30:45', { utc: false, outputFormat: 'YYYY-MM-DD HH:mm:ss' })).toBe('2026-10-07 15:30:45')
  })

  it('does not change the global moment locale, nor what an «hh:mm A» reader gets from the global moment', () => {
    moment.defineLocale('sample-630-global', { parentLocale: 'en' }) // makes it the global locale, as an app that changed it would
    try {
      expect(moment.locale()).toBe('sample-630-global')
      // a language that no earlier test of this file has asked for, so its moment locale is defined here
      expect(hours(parseDateFor('ja', { format_time: { value: '12' } }))).toEqual(['12:00 午前', '08:00 午後'])
      expect(moment.locale()).toBe('sample-630-global')
      expect(moment('2026-10-07 08:00 PM', 'YYYY-MM-DD hh:mm A').hour()).toBe(20)
      expect(moment('2026-10-07 12:00 AM', 'YYYY-MM-DD hh:mm A').hour()).toBe(0)
      expect(moment.utc('2026-10-07 20:00:00').format('hh:mm A')).toBe('08:00 PM')
    } finally {
      moment.locale('en')
      moment.updateLocale('sample-630-global', null)
    }
    expect(moment.locale()).toBe('en')
  })

  it('the localized locale itself reads its own marker back (isPM and parse are coherent)', () => {
    const parseDate = parseDateFor('ar', { format_time: { value: '12' } })
    parseDate(EVENING, { utc: false, timeOnly: true })
    const name = moment.locales().find(item => item === 'ordering-dashboard-months-ar')
    expect(name).toBeTruthy()
    expect(moment('08:00 م', 'hh:mm A', name, true).hour()).toBe(20)
    expect(moment('12:00 ص', 'hh:mm A', name, true).hour()).toBe(0)
    expect(moment.localeData(name).isPM('م')).toBe(true)
    expect(moment.localeData(name).isPM('ص')).toBe(false)
  })
})
