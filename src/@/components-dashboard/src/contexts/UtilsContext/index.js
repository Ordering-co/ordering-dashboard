import React, { createContext, useContext, useEffect } from 'react'
import { useConfig } from '../ConfigContext'
import { useLanguage } from '../LanguageContext'
import moment from 'moment'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import relativeTime from 'dayjs/plugin/relativeTime'
import updateLocale from 'dayjs/plugin/updateLocale'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { getDateTimeFormats } from '../../utils/settingsCustomSections'

dayjs.extend(utc)
dayjs.extend(relativeTime)
dayjs.extend(updateLocale)
// redesign W1-6 (W1-QB1-01): extended here too, so reading a string with a format does not depend on who imported the plugin first
dayjs.extend(customParseFormat)

// redesign W1-6 (W1-QB1-01)
// dayjs.utc(value, [formatA, formatB]) with customParseFormat on tries each format through the LOCAL constructor, so a UTC string
// from the API was read as local time and every relative time moved by the offset of the browser («in 5 hours» for a message
// that had just arrived in America/Chicago). Without the plugin (origin/main) the formats are ignored and the string is read
// as UTC. Here each format goes in as a single string, strict, through the UTC (or local) constructor, so the plugin on or off
// gives the same instant. What no format matches is read the way main read it (the default dayjs parser).
const parseWithFormats = (value, formats, utc) => {
  const parse = utc ? dayjs.utc : dayjs
  const list = Array.isArray(formats) ? formats : [formats]
  for (const format of list) {
    const parsed = parse(value, format, true)
    if (parsed.isValid()) return parsed
  }
  return parse(value)
}
/**
 * Create ConfigContext
 * This context will manage the current configs internally and provide an easy interface
 */

export const UtilsContext = createContext()

// redesign W0-4a (T0-13, decision 13)
// Date part shown when the project has no dates_general_format. It cannot be ISO: 'DD MMM YYYY' is the preset
// of Settings (DATE_TIME_PRESETS) that reads the same for any reader, because the month is a word and
// «03/04/2026» is March 4th or April 3rd depending on who reads it. The time part comes from format_time (24h unless 12).
export const DEFAULT_VISIBLE_DATE_FORMAT = 'DD MMM YYYY'

// redesign tramo A r4 (W0-PA2-01, W0-PA2-02, W0-D-09)
// parseDate formats with moment, which is never localized (only dayjs is, in refreshLocalObject), so the word month of
// DEFAULT_VISIBLE_DATE_FORMAT came out in English for every reader. Round 2 took the names from the MONTH1..12 keys of the
// catalog, and those carry wrong machine translations that are live in the API («Puede» for May in es, «Marsch» for March in
// de). The names now come from Intl.DateTimeFormat(<language code of the user>), which ships with the runtime (CLDR):
//  - months (MMMM) from { month: 'long' }, short months (MMM) from { month: 'short' }. All twelve of each come from the same
//    source, never month by month. Standalone (alone, no day) is the month part of { month: 'long', year: 'numeric' } (nominative:
//    el «Μάιος 2026»; { month: 'long' } alone gives the genitive «Μαΐου»); with the day beside it (the default format) the
//    declined form of el («7 Οκτωβρίου») is the right one (monthsWithDay).
//    If a language has no word for the short month (bg gives «01»…«12»), MMM paints the long name for all twelve;
//  - weekdays (dddd, ddd, dd) from the same Intl, so a format with «dddd» does not mix an English day with a translated month;
//  - the AM/PM marker (A, a) from Intl too, only in what is painted;
//  - everything else (ordinals «2nd», week/day-of-year) is inherited from 'en': the locale is created with
//    moment.defineLocale({ parentLocale: 'en' }), which is what honours parentLocale (updateLocale does not). One locale per
//    language code, created the first time; it is applied to the formatting instance (.locale(...)) and the global moment
//    locale is put back, so no other use of moment changes.
// An unknown language code, or no Intl, paints the usual English names.
const MONTHS_LOCALE_PREFIX = 'ordering-dashboard-months-'
const definedMonthsLocales = new Set()

// redesign tramo A r5 (W0-PA3-05): Intl is read once per language code. Before, every parseDate built 4 formatters and
// formatted 38 names (0.13 ms) before looking at the locale it already had.
const intlNamesByCode = new Map()
const momentLocaleByCode = new Map()

const buildIntlDateNames = (code) => {
  try {
    if (typeof code !== 'string' || code.trim() === '' || typeof Intl === 'undefined') return null
    const tag = code.trim().replace(/_/g, '-')
    const supported = Intl.DateTimeFormat.supportedLocalesOf([tag])
    if (!supported.length) return null
    const names = (options, count, dateOf) => {
      const formatter = new Intl.DateTimeFormat(supported[0], { ...options, timeZone: 'UTC' })
      return Array.from({ length: count }, (_, index) => formatter.format(dateOf(index)))
    }
    // redesign tramo A r5 (W0-QA3-03, W0-PA3-06): the month as it is written beside a day («7 жовтня», genitive in uk, el, ru…)
    const monthWithDay = (month, count) => {
      const formatter = new Intl.DateTimeFormat(supported[0], { day: 'numeric', month, timeZone: 'UTC' })
      return Array.from({ length: count }, (_, index) => {
        const part = formatter.formatToParts(monthOf(index)).find(item => item.type === 'month')
        return part ? part.value : ''
      })
    }
    const monthOf = index => new Date(Date.UTC(2026, index, 15, 12))
    const dayOf = index => new Date(Date.UTC(2026, 9, 4 + index, 12)) // 2026-10-04 is a Sunday
    // redesign cierre W0 (W0-PA4-03): the standalone month (no day beside it) is the one Intl writes in «month year»: { month: 'long' }
    // alone gives the genitive in el («Μαΐου»), «month year» the nominative («Μάιος 2026»). Any language where that part is
    // missing or numeric keeps { month: 'long' }.
    const monthLong = names({ month: 'long' }, 12, monthOf)
    const monthWithYear = (() => {
      const formatter = new Intl.DateTimeFormat(supported[0], { month: 'long', year: 'numeric', timeZone: 'UTC' })
      return Array.from({ length: 12 }, (_, index) => {
        const part = formatter.formatToParts(monthOf(index)).find(item => item.type === 'month')
        return part ? part.value : ''
      })
    })()
    const months = monthWithYear.some(text => !text || /^\d+$/.test(text)) ? monthLong : monthWithYear
    let monthsShort = names({ month: 'short' }, 12, monthOf)
    const shortIsNumeric = monthsShort.some(text => /^\d+$/.test(text))
    if (shortIsNumeric) monthsShort = months
    let monthsWithDay = monthWithDay('long', 12)
    if (monthsWithDay.some(text => !text || /^\d+$/.test(text))) monthsWithDay = months
    const weekdays = names({ weekday: 'long' }, 7, dayOf)
    const weekdaysShort = names({ weekday: 'short' }, 7, dayOf)
    if ([...months, ...monthsShort, ...weekdays, ...weekdaysShort].some(text => !text)) return null
    // redesign tramo A r5 (W0-QA3-03, «dd»): Intl has no two-letter weekday ('narrow' is one letter and repeats: T/T, S/S).
    // The shortest coherent form is the short name without its dot cut to two characters (Su, lu, Mo, нд, Δε), as moment's
    // own «dd». If that makes two days equal (ar: «ال» seven times) the short name stays whole.
    const trimmed = weekdaysShort.map(text => Array.from(text.replace(/\.$/, '')).slice(0, 2).join(''))
    const weekdaysMin = new Set(trimmed).size === 7 ? trimmed : weekdaysShort.map(text => text.replace(/\.$/, ''))
    // redesign the AM/PM marker as Intl writes it for a 12h clock («ص/م» ar, «π.μ./μ.μ.» el, «a. m./p. m.» es, «AM/PM» de).
    // `hour12: true` forces the 12h form even where the language's own clock is 24h. No usable pair (missing, empty or the same
    // text for both) leaves the marker to the English parent.
    const meridiemFormatter = new Intl.DateTimeFormat(supported[0], { hour: 'numeric', hour12: true, timeZone: 'UTC' })
    const dayPeriodAt = hour => {
      const part = meridiemFormatter.formatToParts(new Date(Date.UTC(2026, 9, 7, hour))).find(item => item.type === 'dayPeriod')
      return part ? part.value.trim() : ''
    }
    const am = dayPeriodAt(9)
    const pm = dayPeriodAt(20)
    const meridiem = am && pm && am.toLocaleLowerCase() !== pm.toLocaleLowerCase() ? { am, pm } : null
    return { code: supported[0], months, monthsShort, monthsWithDay, weekdays, weekdaysShort, weekdaysMin, meridiem }
  } catch (e) {
    return null
  }
}

export const getIntlDateNames = (code) => {
  const key = typeof code === 'string' ? code : ''
  if (!intlNamesByCode.has(key)) intlNamesByCode.set(key, buildIntlDateNames(code))
  return intlNamesByCode.get(key)
}

// redesign tramo A r5 (W0-QA3-03, W0-PA3-06): the ordinal («Do») is English only; the English suffix beside a translated month
// («jueves, 7th mayo») mixes two languages. Intl has no ordinal suffix (PluralRules gives a category, not a text, and
// formatToParts of a day gives the number), so every other language gets the bare number.
const isEnglish = (code) => /^en(?:[-_]|$)/i.test(String(code || '').trim())

// redesign cierre W0 (W0-QA4-05): the day with the ordinal parseDate paints for «Do» (the suffix in English, the bare number in every
// other language, English too when the language has no Intl names), so the typed date fields of the range write the same text as the pill.
export const getDayOrdinal = (number, code) => {
  const intlNames = getIntlDateNames(code)
  return !intlNames || isEnglish(intlNames.code) ? moment.localeData('en').ordinal(number) : String(number)
}

// tanda P: «hace …» was built from loose catalog keys («Vor %s» + «eine Stunde»), which only reads right in languages
// without cases: German needs the dative after «vor» («vor 6 Tagen», not «Vor 6 Tage»), and el, bg, tr… decline too. A language
// other than English takes the phrase from Intl.RelativeTimeFormat (CLDR, as the month names above); dayjs still picks the unit and
// the number (its thresholds). The seconds too, so a list does not mix «Vor ein paar Sekunden» with «vor 2 Stunden» (or es «unos
// segundos hace» with «hace 2 horas»). The forms without suffix stay on the catalog, and so do English and a language without Intl,
// so English reads as before.
const RELATIVE_UNITS = { s: 'second', m: 'minute', mm: 'minute', h: 'hour', hh: 'hour', d: 'day', dd: 'day', M: 'month', MM: 'month', y: 'year', yy: 'year' }
const relativeFormatByCode = new Map()

const getRelativeTimeFormat = (code) => {
  const key = typeof code === 'string' ? code : ''
  if (!relativeFormatByCode.has(key)) {
    let format = null
    try {
      const tag = key.trim().replace(/_/g, '-')
      if (tag && !isEnglish(tag) && typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
        const supported = Intl.RelativeTimeFormat.supportedLocalesOf([tag])
        // `nu-latn`: Latin digits, as the catalog «%d» and the rest of the dashboard in every language (ar would draw ٦)
        if (supported.length) {
          const tag = `${supported[0]}-u-nu-latn`
          // the seconds read «now» at zero («jetzt», «ahora») instead of «0 seconds ago»
          format = { always: new Intl.RelativeTimeFormat(tag, { numeric: 'always' }), auto: new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }) }
        }
      }
    } catch (e) {
      format = null
    }
    relativeFormatByCode.set(key, format)
  }
  return relativeFormatByCode.get(key)
}

export const buildRelativeTime = (catalog, code) => {
  const format = getRelativeTimeFormat(code)
  if (!format) return catalog
  const relativeTime = { future: '%s', past: '%s' }
  Object.keys(catalog).forEach(unitKey => {
    if (unitKey === 'future' || unitKey === 'past') return
    const text = catalog[unitKey]
    relativeTime[unitKey] = (number, withoutSuffix, _key, isFuture) => {
      const bare = String(text).replace('%d', number)
      if (withoutSuffix) return bare
      const unit = RELATIVE_UNITS[unitKey]
      if (!unit) return (isFuture ? catalog.future : catalog.past).replace('%s', bare)
      if (unit === 'second') return format.auto.format(isFuture ? Number(number) : -Number(number), unit)
      // a one-letter key (m, h, d, M, y) is always one unit: dayjs hands it the count of the smaller unit (60 for «an hour»)
      const count = unitKey.length === 1 ? 1 : Number(number)
      return format.always.format(isFuture ? count : -count, unit)
    }
  })
  return relativeTime
}

const ensureMonthsLocale = (code) => {
  const cacheKey = typeof code === 'string' ? code : ''
  if (momentLocaleByCode.has(cacheKey)) return momentLocaleByCode.get(cacheKey)
  const name = defineMonthsLocale(code)
  momentLocaleByCode.set(cacheKey, name)
  return name
}

const defineMonthsLocale = (code) => {
  const intlNames = getIntlDateNames(code)
  if (!intlNames) return 'en'
  const name = `${MONTHS_LOCALE_PREFIX}${intlNames.code}`
  if (!definedMonthsLocales.has(name)) {
    const globalLocale = moment.locale()
    try {
      // Only the long month has a form with a day (Intl's short month beside a day adds a dot in de, «Jan.»: the numeric
      // formats of the project must not change). The `format` forms are used when the format puts a day beside the month (moment's own rule), the `standalone` ones otherwise.
      const config = {
        parentLocale: 'en',
        months: { format: intlNames.monthsWithDay, standalone: intlNames.months },
        monthsShort: intlNames.monthsShort,
        weekdays: intlNames.weekdays,
        weekdaysShort: intlNames.weekdaysShort,
        weekdaysMin: intlNames.weekdaysMin
      }
      if (!isEnglish(intlNames.code)) {
        config.ordinal = number => String(number)
        config.dayOfMonthOrdinalParse = /\d{1,2}/
        // redesign the AM/PM marker (tokens A and a) in the language of the user, only what is painted. English and a language
        // without a usable pair keep the parent's «AM/PM». `meridiemParse` and `isPM` read the same two texts back, so this locale also
        // parses what it paints; the 12h/24h choice is not here, it is the project's (decision 13) and stays in parseDate.
        if (intlNames.meridiem) {
          const { am, pm } = intlNames.meridiem
          const lowerCode = intlNames.code
          const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          config.meridiem = (hours, minutes, isLower) => {
            const text = hours < 12 ? am : pm
            return isLower ? text.toLocaleLowerCase(lowerCode) : text
          }
          config.meridiemParse = new RegExp(`${escapeRegExp(am)}|${escapeRegExp(pm)}`, 'i')
          config.isPM = input => String(input).trim().toLocaleLowerCase(lowerCode) === pm.toLocaleLowerCase(lowerCode)
        }
      }
      moment.defineLocale(name, config)
      definedMonthsLocales.add(name)
    } catch (e) {
      return 'en'
    } finally {
      moment.locale(globalLocale)
    }
  }
  return name
}

/**
 * Custom provider to utils manager
 * This provider has a reducer for manage utils functions
 * @param {props} props
 */
export const UtilsProviders = ({ children }) => {
  const [languageState, t] = useLanguage()
  const [configState] = useConfig()

  // const [localObject, setLocalObject] = useState({})

  const refreshLocalObject = () => {
    const weekdays = [
      t('DAY7', 'Sunday'),
      t('DAY1', 'Monday'),
      t('DAY2', 'Tuesday'),
      t('DAY3', 'Wednesday'),
      t('DAY4', 'Thursday'),
      t('DAY5', 'Friday'),
      t('DAY6', 'Saturday')
    ]
    const months = [
      t('MONTH1', 'January'),
      t('MONTH2', 'February'),
      t('MONTH3', 'March'),
      t('MONTH4', 'April'),
      t('MONTH5', 'May'),
      t('MONTH6', 'June'),
      t('MONTH7', 'July'),
      t('MONTH8', 'August'),
      t('MONTH9', 'September'),
      t('MONTH10', 'October'),
      t('MONTH11', 'November'),
      t('MONTH12', 'December')
    ]
    const localeObject = {
      name: 'auto', // name String
      weekdays, // weekdays Array
      months, // months Array
      ordinal: n => `${n}º`, // ordinal Function (number) => return number + output
      relativeTime: buildRelativeTime({
        // relative time format strings, keep %s %d as the same
        future: t('RELATIVE_TIME_IN', 'in %s'), // e.g. in 2 hours, %s been replaced with 2hours
        past: t('RELATIVE_TIME_AGO', '%s ago'),
        s: t('RELATIVE_TIME_FEW_SECONDS', 'a few seconds'),
        m: t('RELATIVE_TIME_MINUTE', 'a minute'),
        mm: t('RELATIVE_TIME_MINUTES', '%d minutes'),
        h: t('RELATIVE_TIME_HOUR', 'an hour'),
        hh: t('RELATIVE_TIME_HOURS', '%d hours'), // e.g. 2 hours, %d been replaced with 2
        d: t('RELATIVE_TIME_DAY', 'a day'),
        dd: t('RELATIVE_TIME_DAYS', '%d days'),
        M: t('RELATIVE_TIME_MONTH', 'a month'),
        MM: t('RELATIVE_TIME_MONTHS', '%d months'),
        y: t('RELATIVE_TIME_YEAR', 'a year'),
        yy: t('RELATIVE_TIME_YEARS', '%d years')
      }, languageState?.language?.code),
      meridiem: (hour, minute, isLowercase) => {
        // OPTIONAL, AM/PM
        return hour > 12 ? t('PM', 'PM') : t('AM', 'AM')
      }
    }
    dayjs.locale('auto', localeObject)
    dayjs.updateLocale('auto', localeObject)
  }
  const parsePrice = (value, options = {}) => {
    const formatNumber = {
      decimal: options?.decimal || configState.configs.format_number_decimal_length?.value || 2,
      separator: options?.separator || configState.configs.format_number_decimal_separator?.value || ',',
      thousand: options?.thousand || configState.configs.format_number_thousand_separator?.value || '.',
      currency: configState.configs.format_number_currency?.value || options?.currency || '$',
      currencyPosition: configState.configs.currency_position?.value || options?.currencyPosition || 'left'
    }
    let number = parseNumber(value, formatNumber)
    if (formatNumber.currencyPosition === 'left') {
      number = formatNumber.currency + ' ' + number
    } else {
      number = number + ' ' + formatNumber.currency
    }
    return number
  }

  const parseNumber = (value, options = {}) => {
    value = parseFloat(value) || 0
    const formatNumber = {
      decimal: options?.decimal || configState.configs.format_number_decimal_length?.value || 2,
      separator: options?.separator || configState.configs.format_number_decimal_separator?.value || ',',
      thousand: options?.thousand || configState.configs.format_number_thousand_separator?.value || '.'
    }
    let number = value.toFixed(formatNumber.decimal)
    number = number.toString()
    if (number.indexOf('.')) {
      number = number.replace('.', formatNumber.separator)
    } else if (number.indexOf(',')) {
      number = number.replace(',', formatNumber.separator)
    }
    const numberParts = number.split(formatNumber.separator)
    if (formatNumber.thousand === 'space') formatNumber.thousand = ' '
    // (5): `\d`, not `.`: the minus sign of a negative is not a digit to group («-,177.76» before)
    numberParts[0] = numberParts[0].replace(/(\d)(?=(\d{3})+$)/g, '$1' + formatNumber.thousand)
    number = numberParts.join(formatNumber.separator)
    return number
  }

  // redesign W0-4a (T0-13, decision 13)
  // parseDate without outputFormat follows dates_general_format (the one date format of the project):
  //  - date part: its date tokens (getDateTimeFormats), or DEFAULT_VISIBLE_DATE_FORMAT when none is configured;
  //  - time part: 12h/24h from options.formatTime, else format_time, else the 12h/24h of the configured format,
  //    always without seconds. When the configured format already has the same clock, its own time tokens
  //    are used (so 'hh:mm a' keeps the lowercase meridiem the project asked for).
  // Options: dateOnly / timeOnly paint a part; omitYear drops the year (preorderDateFormat) for the short date
  // beside a time; outputFormat wins over all of them (machine data: a caller that computes with the date asks for 'YYYY-MM-DD HH:mm:ss').
  const parseDate = (date, options = {}) => {
    const generalFormat = configState.configs.dates_general_format?.value
    const hasProjectFormat = typeof generalFormat === 'string' && generalFormat.trim() !== ''
    const projectFormats = getDateTimeFormats(hasProjectFormat ? generalFormat : `${DEFAULT_VISIBLE_DATE_FORMAT} HH:mm`)
    const formatTime = options?.formatTime || configState.configs.format_time?.value || (hasProjectFormat && projectFormats.is12Hours ? '12' : '24')
    const is12Hours = String(formatTime) === '12'
    const timePattern = hasProjectFormat && projectFormats.is12Hours === is12Hours
      ? projectFormats.timeFormat.replace(/[:.]s{1,2}/g, '')
      : (is12Hours ? 'hh:mm A' : 'HH:mm')
    const datePattern = options?.omitYear ? projectFormats.preorderDateFormat : projectFormats.dateFormat
    let visibleFormat = `${datePattern} ${timePattern}`
    if (options?.dateOnly) visibleFormat = datePattern
    else if (options?.timeOnly) visibleFormat = timePattern
    const formatDate = {
      inputFormat: options?.inputFormat || ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD hh:mm:ss A', 'YYYY-MM-DD hh:mm:ss'],
      outputFormat: options?.outputFormat || visibleFormat,
      utc: typeof options?.utc === 'boolean' ? options?.utc : true
    }
    if (!moment(date, formatDate.inputFormat).isValid()) {
      return t('INVALID_FORMAT', 'invalid format')
    }
    const _date = formatDate.utc ? moment.utc(date, formatDate.inputFormat).local() : moment(date, formatDate.inputFormat)
    // redesign tramo A r4 (W0-PA2-01): month and day names in the user's language (Intl), only on this instance
    return _date.locale(ensureMonthsLocale(languageState?.language?.code)).format(formatDate.outputFormat)
  }

  const parseTime = (time, options = {}) => {
    if (!time) return '00:00'
    const _formatTime = options?.formatTime || configState.configs.format_time?.value || '24'
    const formatTime = {
      inputFormat: options?.inputFormat || ['HH:mm', 'hh:mm A', 'hh:mm'],
      outputFormat: options?.outputFormat || (_formatTime === '24' ? 'HH:mm' : 'hh:mm A'),
      utc: typeof options?.utc === 'boolean' ? options?.utc : true
    }
    if (!dayjs(time, formatTime.inputFormat).isValid()) {
      return t('INVALID_FORMAT', 'invalid format')
    }
    const _date = formatTime.utc ? parseWithFormats(time, formatTime.inputFormat, true).local() : parseWithFormats(time, formatTime.inputFormat, false)
    return _date.format(formatTime.outputFormat)
  }

  const parseShortenDistance = (distance, options = {}) => {
    if (distance >= 1000000000) {
      return `${(distance / 1000000000).toFixed(1).replace(/\.0$/, '')}${t('G', 'G')}`
    }
    if (distance >= 1000000) {
      return `${(distance / 1000000).toFixed(1).replace(/\.0$/, '')}${t('M', 'M')}`
    }
    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(1).replace(/\.0$/, '')}${t('K', 'K')}`
    }
  }

  const parseDistance = (distance, options = {}) => {
    distance = parseFloat(distance) || 0
    let unit = options?.unit || 'KM'
    if (configState.configs.distance_unit_km?.value === '1') {
      unit = 'KM'
    }
    if (configState.configs.distance_unit?.value) {
      unit = configState.configs.distance_unit?.value
    }
    if (unit.toUpperCase() === 'MI') {
      const dist = distance * 0.621371 / 1000
      return `${parseNumber(dist, options)} ${t('MI', 'mi')}`
    } else {
      return `${parseNumber(distance / 1000, options)} ${t('KM', 'km')}`
    }
  }

  const getTimeAgo = (dateTime, options) => {
    if (!dateTime) return 'NN'
    const dateOptions = {
      inputFormat: options?.inputFormat || ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD hh:mm:ss A', 'YYYY-MM-DD hh:mm:ss'],
      utc: typeof options?.utc === 'boolean' ? options?.utc : true
    }
    if (!dayjs(dateTime, dateOptions.inputFormat).isValid()) {
      return t('INVALID_FORMAT', 'invalid format')
    }
    const _date = dateOptions.utc ? parseWithFormats(dateTime, dateOptions.inputFormat, true).local() : parseWithFormats(dateTime, dateOptions.inputFormat, false)
    return _date.fromNow()
  }

  const getTimeTo = (dateTime, options) => {
    if (!dateTime) return 'NN'
    const dateOptions = {
      inputFormat: options?.inputFormat || ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD hh:mm:ss A', 'YYYY-MM-DD hh:mm:ss'],
      utc: typeof options?.utc === 'boolean' ? options?.utc : true
    }
    if (!dayjs(dateTime, dateOptions.inputFormat).isValid()) {
      return t('INVALID_FORMAT', 'invalid format')
    }
    const _date = dateOptions.utc ? parseWithFormats(dateTime, dateOptions.inputFormat, true).local() : parseWithFormats(dateTime, dateOptions.inputFormat, false)
    return _date.toNow()
  }

  const optimizeImage = (url, params, fallback) => {
    if (!url && fallback) return fallback
    params = params && params.length > 0 ? `,${params}` : ''
    if (url != null && url.indexOf('res.cloudinary.com') !== -1) {
      const parts = url.split('upload')
      url = `${parts[0]}upload/f_auto,q_auto${params}${parts[1]}`
    }
    return url
  }

  const getOrderState = (num) => {
    switch (num) {
      case 0:
        return t('PENDING', 'Pending')
      case 1:
        return t('COMPLETED_BY_ADMIN', 'Completed by admin')
      case 2:
        return t('REJECTED_BY_ADMIN', 'Rejected by admin')
      case 3:
        return t('ORDER_STATUS_IN_BUSINESS', 'Driver arrived to business')
      case 4:
        return t('PREPARATION_COMPLETED', 'Preparation completed')
      case 5:
        return t('REJECTED_BY_BUSINESS', 'Rejected by business')
      case 6:
        return t('REJECTED_BY_DRIVER', 'Rejected by driver')
      case 7:
        return t('ACCEPTED_BY_BUSINESS', 'Accepted by business')
      case 8:
        return t('ACCEPTED_BY_DRIVER', 'Accepted by driver')
      case 9:
        return t('PICK_UP_COMPLETED_BY_DRIVER', 'Pick up completed by driver')
      case 10:
        return t('PICK_UP_FAILED_BY_DRIVER', 'Pick up Failed by driver')
      case 11:
        return t('DELIVERY_COMPLETED_BY_DRIVER', 'Delivery completed by driver')
      case 12:
        return t('DELIVERY_FAILED_BY_DRIVER', 'Delivery Failed by driver')
      case 13:
        return t('PREORDER', 'Preorder')
      case 14:
        return t('ORDER_NOT_READY', 'Order not ready')
      case 15:
        return t('ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER', 'Pickup completed by customer')
      case 16:
        return t('ORDER_STATUS_CANCELLED_BY_CUSTOMER', 'Cancelled by customer')
      case 17:
        return t('ORDER_NOT_PICKEDUP_BY_CUSTOMER', 'Not picked by customer')
      case 18:
        return t('ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS', 'Driver almost arrived to business')
      case 19:
        return t('ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER', 'Driver almost arrived to customer')
      case 20:
        return t('ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS', 'Customer almost arrived to business')
      case 21:
        return t('ORDER_CUSTOMER_ARRIVED_BUSINESS', 'Customer arrived to business')
      case 22:
        return t('ORDER_LOOKING_FOR_DRIVER', 'Looking for driver')
      case 23:
        return t('ORDER_DRIVER_ON_WAY', 'Driver on way')
      case 24:
        return t('ORDER_STATUS_DRIVER_WAITING_FOR_ORDER', 'Driver waiting for order')
      case 25:
        return t('ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY', 'Accepted by driver company')
      case 26:
        return t('ORDER_DRIVER_ARRIVED_CUSTOMER', 'Driver arrived to customer')
      default:
        return 'N/A'
    }
  }

  const functions = {
    parsePrice,
    parseNumber,
    parseDate,
    parseTime,
    parseDistance,
    parseShortenDistance,
    getTimeAgo,
    getTimeTo,
    optimizeImage,
    getOrderState
  }

  useEffect(() => {
    if (!languageState.loading) {
      refreshLocalObject()
    }
  }, [languageState])
  return (
    <UtilsContext.Provider value={[functions]}>
      {children}
    </UtilsContext.Provider>
  )
}

/**
 * Hook to get utils functions
 */
export const useUtils = () => {
  const utilsManager = useContext(UtilsContext)
  return utilsManager || [{}, () => { }]
}
