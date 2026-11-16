import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { getDayOrdinal, getIntlDateNames } from '../contexts/UtilsContext'

dayjs.extend(customParseFormat)

// redesign fix-qa: date logic of the range picker (E1). A day is always the string 'YYYY-MM-DD'.
export const DAY = 'YYYY-MM-DD'
export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD'

const MIN_YEAR = 1900
const MAX_YEAR = 2999

/**
 * How the project writes a date, read from its date format (`YYYY-MM-DD`, `MM/DD/YYYY`,
 * `DD/MM/YYYY`, `DD MMM YYYY`…): `format` is the moment/dayjs pattern, `segments` the numeric
 * parts in order and `masked` tells whether typing can be masked (all parts numeric, one each of
 * year, month and day). Any other pattern (month names) is typed free and parsed strictly.
 */
export const describeDateFormat = (rawFormat, locale) => {
  const format = String(rawFormat || '').trim() || DEFAULT_DATE_FORMAT
  // redesign cierre W0 (W0-PA4-01): a format with a word month (MMM, MMMM) carries the Intl month names of the user's language
  // (the ones of the pill and the chip, getIntlDateNames); without them (no locale, unknown language) dayjs writes and reads it.
  // redesign cierre W0 (W0-QA4-05): so does a format with a weekday (dd, ddd, dddd) or the ordinal day (Do)
  const names = /MMM|d|Do/.test(format) ? getIntlDateNames(locale) : null
  const tokens = format.match(/YYYY|MM|DD|M|D|[^YMD]+/g) || []
  const normalized = tokens.map(token => (token === 'M' ? 'MM' : token === 'D' ? 'DD' : token))
  const parts = normalized.filter(token => /^(YYYY|MM|DD)$/.test(token))
  const separators = normalized.filter(token => !/^(YYYY|MM|DD)$/.test(token))
  const masked = parts.length === 3 &&
    new Set(parts).size === 3 &&
    separators.every(separator => /^[-/. ]+$/.test(separator))
  if (!masked) return { format, masked: false, segments: [], placeholder: format.toLowerCase(), names }
  const pattern = normalized.join('')
  const segments = []
  let separator = ''
  normalized.forEach(token => {
    if (/^(YYYY|MM|DD)$/.test(token)) {
      segments.push({ token, length: token.length, separatorBefore: segments.length ? separator : '' })
      separator = ''
    } else {
      separator = token
    }
  })
  return { format: pattern, masked: true, segments, placeholder: pattern.toLowerCase(), names: null }
}

/** Keeps only the digits that fit the format and puts the separators back (`10012026` → `10/01/2026`). */
export const maskDateText = (text, spec) => {
  const raw = String(text ?? '')
  if (!spec.masked) return raw
  const digits = raw.replace(/\D/g, '').slice(0, spec.segments.reduce((sum, segment) => sum + segment.length, 0))
  let out = ''
  let used = 0
  for (const segment of spec.segments) {
    const chunk = digits.slice(used, used + segment.length)
    if (!chunk) break
    out += segment.separatorBefore + chunk
    used += chunk.length
    if (chunk.length < segment.length) break
  }
  return out
}

// redesign cierre W0 (W0-PA4-01): the pieces of a format with a word month. Only YYYY, MM, M, DD, D, MMM and MMMM (and
// [literals]) can be written and read with the Intl names; any other token sends the format back to dayjs.
// redesign cierre W0 (W0-QA4-05): the weekday (dddd, ddd, dd) and the ordinal day (Do) are written with the same names as the pill (parseDate).
const FORMAT_PIECES = /\[[^\]]*\]|YYYY|MMMM|MMM|MM|M|dddd|ddd|dd|Do|DD|D|[^[\]A-Za-z]+|[A-Za-z]+/g
const KNOWN_TOKENS = new Set(['YYYY', 'MMMM', 'MMM', 'MM', 'M', 'dddd', 'ddd', 'dd', 'Do', 'DD', 'D'])
const WEEKDAY_TOKENS = new Set(['dddd', 'ddd', 'dd'])
const piecesOf = (format) => (format.match(FORMAT_PIECES) || [])
const usesIntlNames = (spec) => !!spec.names && piecesOf(spec.format).every(piece => KNOWN_TOKENS.has(piece) || !/[A-Za-z]/.test(piece.replace(/^\[[^\]]*\]$/, '')))
// moment's rule (and parseDate's): the declined month form goes only when the day is written BEFORE the month
const dayBeforeMonth = (spec) => {
  const pieces = piecesOf(spec.format)
  const day = pieces.findIndex(piece => piece === 'DD' || piece === 'D' || piece === 'Do')
  return day >= 0 && day < pieces.findIndex(piece => piece === 'MMMM')
}
const stripDot = (text) => text.replace(/\.$/, '')
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The month (1-12) a typed word means: short or long name, any case, with or without the final dot; 0 when it is none. */
const monthFromWord = (word, names) => {
  const wanted = stripDot(word.trim()).toLocaleLowerCase(names.code)
  for (const list of [names.monthsShort, names.months, names.monthsWithDay]) {
    const index = list.findIndex(name => stripDot(name).toLocaleLowerCase(names.code) === wanted)
    if (index >= 0) return index + 1
  }
  return 0
}

// The day ('YYYY-MM-DD') a text means in a format with a word month, or null.
// redesign cierre W0 (W0-QA4-05): a weekday in the format is optional when typing (with its separator): a date written without it is
// read too, and the weekday written is not checked (the date is the numbers and the month); «Do» reads the number with or without
// its English suffix.
const parseWithNames = (value, spec) => {
  const pieces = piecesOf(spec.format)
  const order = []
  const separator = (piece) => !KNOWN_TOKENS.has(piece) && !/^\[.*\]$/.test(piece)
  const literal = (piece) => piece.split('').map(char => /\s/.test(char) ? '\\s+' : escapeRegExp(char)).join('')
  const weekdayWord = '[^\\d\\s.,/-]+\\.?'
  const sources = []
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index]
    if (WEEKDAY_TOKENS.has(piece)) {
      const before = index > 0 && separator(pieces[index - 1]) ? sources.pop() : null
      if (before === null && index + 1 < pieces.length && separator(pieces[index + 1])) {
        sources.push(`(?:${weekdayWord}${literal(pieces[index + 1])})?`)
        index += 1
      } else {
        sources.push(`(?:${before || ''}${weekdayWord})?`)
      }
      continue
    }
    if (/^\[.*\]$/.test(piece)) sources.push(escapeRegExp(piece.slice(1, -1)))
    else if (!KNOWN_TOKENS.has(piece)) sources.push(literal(piece))
    else {
      order.push(piece)
      if (piece === 'YYYY') sources.push('(\\d{4})')
      else if (piece === 'MM' || piece === 'DD') sources.push('(\\d{2})')
      else if (piece === 'M' || piece === 'D') sources.push('(\\d{1,2})')
      else if (piece === 'Do') sources.push('(\\d{1,2})(?:st|nd|rd|th)?')
      else sources.push('([^\\d\\s.,/-]+\\.?)')
    }
  }
  const match = new RegExp(`^${sources.join('')}$`, 'u').exec(value)
  if (!match) return null
  const parts = {}
  order.forEach((token, index) => {
    const raw = match[index + 1]
    if (token === 'YYYY') parts.year = Number(raw)
    else if (token === 'DD' || token === 'D' || token === 'Do') parts.day = Number(raw)
    else if (token === 'MM' || token === 'M') parts.month = Number(raw)
    else parts.month = monthFromWord(raw, spec.names)
  })
  if (!parts.year || !parts.month || !parts.day) return null
  const candidate = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  return dayjs(candidate, DAY, true).isValid() ? candidate : null
}

const parseWithDayjs = (value, spec) => {
  const parsed = dayjs(value, spec.format, true)
  return parsed.isValid() ? parsed.format(DAY) : null
}

/** The day ('YYYY-MM-DD') a typed text means, or null when it is not a real date in the format. */
export const parseDateText = (text, spec) => {
  const value = String(text ?? '').trim()
  if (!value) return null
  const day = usesIntlNames(spec) ? parseWithNames(value, spec) : parseWithDayjs(value, spec)
  if (!day) return null
  const year = Number(day.slice(0, 4))
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  return day
}

/** A day written in the project format. */
export const formatDay = (day, spec) => {
  if (!day) return ''
  const parsed = dayjs(day, DAY)
  if (!usesIntlNames(spec)) return parsed.format(spec.format)
  const month = parsed.month()
  const { names } = spec
  const withDay = dayBeforeMonth(spec)
  // The word months go into the dayjs format as [literals]; the rest of the format is dayjs's.
  return parsed.format(piecesOf(spec.format).map(piece => {
    if (piece === 'dddd') return `[${names.weekdays[parsed.day()]}]`
    if (piece === 'ddd') return `[${names.weekdaysShort[parsed.day()]}]`
    if (piece === 'dd') return `[${names.weekdaysMin[parsed.day()]}]`
    if (piece === 'Do') return `[${getDayOrdinal(parsed.date(), names.code)}]`
    if (piece === 'MMM') return `[${names.monthsShort[month]}]`
    if (piece === 'MMMM') return `[${withDay ? names.monthsWithDay[month] : names.months[month]}]`
    return piece
  }).join(''))
}

// redesign tramo A r5 (W0-QA3-02): a day for the eye, in the date format of the project (dates_general_format) or the visible
// default, with the month names of the user: it is parseDate (UtilsContext) with the day only. The value that travels
// (API, URL) stays 'YYYY-MM-DD'; the typed fields keep the mask of `describeDateFormat`.
export const formatVisibleDay = (day, parseDate) => (day ? parseDate(`${day} 00:00:00`, { dateOnly: true, utc: false }) : '')

/** The day part of a filter datetime (`2026-10-05 00:00:00` → `2026-10-05`). */
export const dayOf = (datetime) => {
  if (!datetime) return null
  const day = String(datetime).slice(0, 10)
  return dayjs(day, DAY, true).isValid() ? day : null
}

export const todayDay = () => dayjs().format(DAY)

/** The range a click on `day` makes: the second click closes the range, any other starts one. */
export const pickDay = (range, day) => {
  if (range.from && !range.to && day >= range.from) return { from: range.from, to: day }
  return { from: day, to: null }
}

/** The weeks (arrays of 7 days, `null` outside the month) of the month of `monthDay`. */
export const buildMonth = (monthDay, firstDayOfWeek = 0) => {
  const first = dayjs(monthDay, DAY).startOf('month')
  const lead = (first.day() - firstDayOfWeek + 7) % 7
  const cells = Array.from({ length: lead }, () => null)
  for (let index = 0; index < first.daysInMonth(); index += 1) {
    cells.push(first.add(index, 'day').format(DAY))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7))
  return weeks
}

export const shiftDay = (day, amount, unit = 'day') => dayjs(day, DAY).add(amount, unit).format(DAY)
export const monthOf = (day) => dayjs(day, DAY).startOf('month').format(DAY)

/** First day of the week of the locale (0 = Sunday), Sunday when the engine cannot tell. */
export const firstDayOfWeekFor = (locale) => {
  try {
    const intlLocale = new Intl.Locale(locale)
    const info = typeof intlLocale.getWeekInfo === 'function' ? intlLocale.getWeekInfo() : intlLocale.weekInfo
    return info ? info.firstDay % 7 : 0
  } catch {
    return 0
  }
}

const safeFormatter = (locale, options) => {
  try {
    return new Intl.DateTimeFormat(locale, options)
  } catch {
    return new Intl.DateTimeFormat(undefined, options)
  }
}

export const makeDayLabelers = (locale) => {
  const month = safeFormatter(locale, { month: 'long', year: 'numeric' })
  const full = safeFormatter(locale, { dateStyle: 'full' })
  const weekday = safeFormatter(locale, { weekday: 'short' })
  const weekdayLong = safeFormatter(locale, { weekday: 'long' })
  const at = (day) => dayjs(day, DAY).toDate()
  return {
    month: (day) => month.format(at(day)),
    full: (day) => full.format(at(day)),
    // Any known Sunday + n; the 4th of January 2026 is a Sunday.
    weekday: (index) => weekday.format(new Date(2026, 0, 4 + index)),
    weekdayLong: (index) => weekdayLong.format(new Date(2026, 0, 4 + index))
  }
}
