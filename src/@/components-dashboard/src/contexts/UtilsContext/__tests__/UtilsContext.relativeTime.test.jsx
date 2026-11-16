import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

// tanda P: «hace …» was built from loose catalog keys, «Vor %s» + «eine Stunde», which only works for languages without
// cases: German needs the dative after «vor» («vor einer Stunde», «vor 6 Tagen»). A language other than English now takes the phrase
// from Intl.RelativeTimeFormat (CLDR, as the month names already do); English and a language without Intl keep the catalog keys.
dayjs.extend(utc)

const mocks = vi.hoisted(() => ({ language: undefined, dictionary: {} }))

vi.mock('../../ConfigContext', () => ({ useConfig: () => [{ configs: {} }] }))
vi.mock('../../LanguageContext', () => ({
  useLanguage: () => [{ loading: false, language: mocks.language ? { code: mocks.language } : undefined }, (key, fallback) => mocks.dictionary[key] ?? fallback]
}))

import { UtilsProviders, useUtils } from '../index'

const NOW = new Date('2026-10-20T12:00:00Z')
const utcAgo = (amount, unit) => dayjs.utc(NOW).subtract(amount, unit).format('YYYY-MM-DD HH:mm:ss')
const utcIn = (amount, unit) => dayjs.utc(NOW).add(amount, unit).format('YYYY-MM-DD HH:mm:ss')

const renderUtils = () => {
  let utils
  const Consumer = () => { utils = useUtils()[0]; return null }
  render(<UtilsProviders><Consumer /></UtilsProviders>)
  return utils
}

describe('UtilsContext getTimeAgo in the user language', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
    mocks.language = undefined
    mocks.dictionary = {}
  })

  it('German declines the unit after «vor» (dative), even with the old catalog strings', () => {
    mocks.language = 'de'
    mocks.dictionary = { RELATIVE_TIME_AGO: 'Vor %s', RELATIVE_TIME_HOUR: 'eine Stunde', RELATIVE_TIME_DAYS: '%d Tage', RELATIVE_TIME_MONTH: 'einen Monat' }
    const { getTimeAgo } = renderUtils()
    expect(getTimeAgo(utcAgo(1, 'hour'))).toBe('vor 1 Stunde')
    expect(getTimeAgo(utcAgo(6, 'day'))).toBe('vor 6 Tagen')
    expect(getTimeAgo(utcAgo(1, 'month'))).toBe('vor 1 Monat')
  })

  // review: «a few seconds» from the catalog mixed forms in one list (de «Vor ein paar Sekunden» beside «vor 2 Stunden», es «unos
  // segundos hace» beside «hace 2 horas»); the seconds come from Intl too
  it('the first 45 seconds also come from Intl, in the same form as the rest', () => {
    mocks.language = 'de'
    mocks.dictionary = { RELATIVE_TIME_AGO: 'Vor %s', RELATIVE_TIME_IN: 'in %s', RELATIVE_TIME_FEW_SECONDS: 'ein paar Sekunden' }
    const { getTimeAgo } = renderUtils()
    expect(getTimeAgo(utcAgo(10, 'second'))).toBe('vor 10 Sekunden')
    expect(getTimeAgo(utcIn(10, 'second'))).toBe('in 10 Sekunden')
  })

  it('Spanish reads «hace …» for the seconds as for the hours', () => {
    mocks.language = 'es'
    mocks.dictionary = { RELATIVE_TIME_AGO: '%s hace', RELATIVE_TIME_FEW_SECONDS: 'unos segundos' }
    const { getTimeAgo } = renderUtils()
    expect(getTimeAgo(utcAgo(10, 'second'))).toBe('hace 10 segundos')
    expect(getTimeAgo(utcAgo(2, 'hour'))).toBe('hace 2 horas')
  })

  it('a future date reads «in …» in the language', () => {
    mocks.language = 'de'
    const { getTimeAgo } = renderUtils()
    expect(getTimeAgo(utcIn(2, 'day'))).toBe('in 2 Tagen')
  })

  it('Arabic keeps Latin digits, as the catalog «%d» did', () => {
    mocks.language = 'ar'
    const { getTimeAgo } = renderUtils()
    expect(getTimeAgo(utcAgo(6, 'day'))).toMatch(/6/)
    expect(getTimeAgo(utcAgo(6, 'day'))).not.toMatch(/[٠-٩]/)
  })

  it('English is unchanged: the catalog keys, «an hour ago»', () => {
    mocks.language = 'en'
    const { getTimeAgo } = renderUtils()
    expect(getTimeAgo(utcAgo(1, 'hour'))).toBe('an hour ago')
    expect(getTimeAgo(utcAgo(6, 'day'))).toBe('6 days ago')
  })

  it('with no language code it also keeps the catalog keys', () => {
    mocks.dictionary = { RELATIVE_TIME_AGO: 'hace %s', RELATIVE_TIME_HOUR: 'una hora' }
    const { getTimeAgo } = renderUtils()
    expect(getTimeAgo(utcAgo(1, 'hour'))).toBe('hace una hora')
  })
})
