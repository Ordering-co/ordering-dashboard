// redesign W1-7 (T1-7-4, W0-F-01): the words of the calendar (months, weekdays, range label, gutter hours) are written by
// parseDate, whose moment instance already speaks the user's language with the Intl names of UtilsContext (getIntlDateNames).
// rbc's own formats call moment(value).locale(culture): without a culture they are English, and setting the global locale is not an option.
// The tokens are the ones of rbc's moment localizer, so the English text does not change; only the words do.
//
// redesign C1a (W1-QC1-07, W1-QC1-12, W1-PC1-05, W1-PC1-06): ONE clock rule for the gutter and for the events (24 h unless the
// project says `format_time === '12'`, as main showed the events), the AM/PM of a 12 h clock comes from Intl in the user's language
// (never the English «AM»), and the week range is written by Intl in the natural order of the language («4–10 de octubre»).

const isEnglish = (code) => /^en(?:[-_]|$)/i.test(String(code || '').trim())

// The single rule: 12 h only when the project's `format_time` is exactly '12'; absent or anything else is 24 h.
export const uses24Hours = (configs) => configs?.format_time?.value !== '12'

const localeTag = (languageCode) => String(languageCode || '').trim().replace(/_/g, '-') || 'en'

const formatters = new Map()
const intl = (languageCode, options) => {
  const key = `${localeTag(languageCode)}|${JSON.stringify(options)}`
  if (!formatters.has(key)) {
    let formatter
    try {
      // `nu-latn`: the digits stay Latin, as the rest of the calendar (headers, day numbers) in every language
      formatter = new Intl.DateTimeFormat(`${localeTag(languageCode)}-u-nu-latn`, options)
    } catch (error) {
      formatter = null // an invalid tag: the caller falls back to the English tokens
    }
    formatters.set(key, formatter)
  }
  return formatters.get(key)
}

// A clock `(Date) => text`: HH:mm in 24 h; in 12 h the hour and minutes with the meridiem of the language, written by Intl
// («08:00 AM» in English, «08:00 a. m.» in Spanish, «08:00 ص» in Arabic). A language that does not use AM/PM gives what Intl gives.
export const buildClock = ({ parseDate, languageCode, is24Hours }) => {
  const twelve = is24Hours ? null : intl(languageCode, { hour: '2-digit', minute: '2-digit', hour12: true })
  return (date) => {
    if (twelve) return twelve.format(date)
    return parseDate(date, { outputFormat: is24Hours ? 'HH:mm' : 'hh:mm A', utc: false })
  }
}

// redesign (decisions 4 and 6): the time range of an appointment, `(start: Date, end: Date) => { start, end }`, two texts so each
// end goes in its own `<bdi dir='ltr'>` (C1a). Each end is written by `buildClock` (the single clock rule; Intl.formatRange is not used:
// it would break that rule and bring thin spaces U+2009/U+202F). In 12 h, when both ends close with the same meridiem (the non-numeric
// text after the last digit, «AM», «a. m.», «ص»), the start drops it: «04:00 – 04:30 AM». A meridiem written BEFORE the digits (Intl
// does it in some languages) leaves no suffix, so nothing is removed.
const meridiemSuffix = (text) => /\D*$/.exec(String(text))[0]

export const buildTimeRange = ({ parseDate, languageCode, is24Hours }) => {
  const clock = buildClock({ parseDate, languageCode, is24Hours })
  return (startDate, endDate) => {
    const start = clock(startDate)
    const end = clock(endDate)
    if (is24Hours) return { start, end }
    const suffix = meridiemSuffix(start)
    if (suffix.trim() && suffix === meridiemSuffix(end)) {
      return { start: start.slice(0, start.length - suffix.length).trimEnd(), end }
    }
    return { start, end }
  }
}

// redesign bugs H (W1-QC2-04): in a right-to-left language the 12 h clock «03:00 ص» cannot go whole inside one `<bdi dir='ltr'>`: that
// forces the meridiem to the right of the digits, where the eye of an Arabic reader meets it first. The digits are isolated in LTR and the
// meridiem stays outside, in the direction of the language. `splitClock` cuts the text of a clock at the digits: `{ before, time, after }`,
// `before` / `after` being the meridiem (Intl writes it on either side) and `time` the «hh:mm». A text with no clock in it gives `null`.
const RTL_LANGUAGES = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'iw', 'ps', 'sd', 'ug', 'ur', 'yi'])

export const isRtlLanguage = (languageCode, rtlFlag) => {
  if (typeof rtlFlag === 'boolean') return rtlFlag
  const tag = localeTag(languageCode)
  try {
    const locale = new Intl.Locale(tag)
    const info = typeof locale.getTextInfo === 'function' ? locale.getTextInfo() : locale.textInfo
    if (info?.direction) return info.direction === 'rtl'
  } catch (error) {
    // an invalid tag or an engine with no text info: the primary language decides
  }
  return RTL_LANGUAGES.has(tag.split('-')[0].toLowerCase())
}

export const splitClock = (text) => {
  const match = /^(\D*?)(\d{1,2}[:.]\d{2})(\D*)$/.exec(String(text ?? ''))
  return match ? { before: match[1], time: match[2], after: match[3] } : null
}

// «start – end» with a spaced en dash, for accessible names and titles
export const joinTimeRange = ({ start, end }) => `${start} – ${end}`

export const buildCalendarFormats = ({ parseDate, languageCode, is24Hours }) => {
  const write = (date, outputFormat) => parseDate(date, { outputFormat, utc: false })
  const clock = buildClock({ parseDate, languageCode, is24Hours })
  // With a day beside the month moment uses the form with a day (the genitive in uk, el, ru): the day goes first outside English.
  const rangeToken = isEnglish(languageCode) || !languageCode ? ['MMMM DD', 'DD'] : ['DD MMMM', 'DD']
  const rangeIntl = intl(languageCode, { day: 'numeric', month: 'long' })
  return {
    dateFormat: date => write(date, 'DD'),
    dayFormat: date => write(date, 'DD ddd'),
    weekdayFormat: date => write(date, 'ddd'),
    monthHeaderFormat: date => write(date, 'MMMM YYYY'),
    dayHeaderFormat: date => write(date, 'dddd MMM DD'),
    // redesign C1a (W1-PC1-06): Intl writes the range in the order of the language («4–10 de octubre», «October 4 – 10»)
    dayRangeHeaderFormat: ({ start, end }) => {
      if (rangeIntl && typeof rangeIntl.formatRange === 'function') return rangeIntl.formatRange(start, end)
      const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
      const endFormat = sameMonth ? rangeToken[1] : rangeToken[0]
      return `${write(start, rangeToken[0])} – ${write(end, endFormat)}`
    },
    timeGutterFormat: clock
  }
}
