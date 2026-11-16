import { useMemo } from 'react'

import { useLanguage, useUtils } from '../../../../../index'

// redesign reports FC2 (D7, D13, auditor 1): the text of the periods of /intelligence/reports, in the dates of the project (decision 13).
// The API names each group of a table or a chart with a label (`Week 2026-39`); `parsePeriodLabel` and `clipPeriod` of `reportPeriods.js` turn it into
// dates, and this hook writes them. `parseDate` does the dates, so the order, the separators and the 12/24 hours are the project's; every date is
// read with `utc: false` (a day is a day, whatever the zone of the browser).

// One literal t() call per word: the i18n scanner only sees literals.
const GROUPING = {
  hour: t => t('ENTERPRISE_REPORT_GROUPING_HOUR', 'by hour'),
  day: t => t('ENTERPRISE_REPORT_GROUPING_DAY', 'by day'),
  week: t => t('ENTERPRISE_REPORT_GROUPING_WEEK', 'by week'),
  month: t => t('ENTERPRISE_REPORT_GROUPING_MONTH', 'by month'),
  year: t => t('ENTERPRISE_REPORT_GROUPING_YEAR', 'by year')
}

// «Aug 2026» in the language of the user. Intl, as /intelligence/business does: `parseDate` has no month-and-year pattern, and its month
// names come from the same source.
const monthText = (start, languageCode) => {
  const [year, month] = String(start).split('-').map(Number)
  const date = new Date(Date.UTC(year, (month || 1) - 1, 1))
  const options = { month: 'short', year: 'numeric', timeZone: 'UTC' }
  try {
    return new Intl.DateTimeFormat(languageCode || undefined, options).format(date)
  } catch (error) {
    return new Intl.DateTimeFormat(undefined, options).format(date)
  }
}

/**
 * `{ rangeText, periodText, groupingText }`, memoized by the language and the formats of the project.
 *
 * - `rangeText(from, to)`: the range of the report in the dates of the project («3 Oct 2026 – 10 Oct 2026»); one date when they are the same day.
 * - `periodText(period)`: a group of the API already cut to the range (`clipPeriod(parsePeriodLabel(label), from, to)`): «Week 39 · 3 Oct»,
 *   «Week 40 · 4 Oct – 10 Oct», «Aug 2026», «3 Oct», «2025», «09:00». Null when there is no period (or the unit is not one the API sends): the caller
 *   then paints the label as it came.
 * - `periodAxisText(period)`: the compact form of a week for the axis of a chart, two lines: `['Week 40', '4 Oct – 10 Oct']`. Null for any other unit
 *   (or no period): the chart then keeps the label as `periodText` wrote it.
 * - `groupingText(unit)`: how the API groups the range, from the `unit` of the labels: «by week». Empty for a unit it does not know.
 */
export const usePeriodText = () => {
  const [languageState, t] = useLanguage()
  const [utils] = useUtils() || []
  const parseDate = utils?.parseDate
  const languageCode = languageState?.language?.code

  return useMemo(() => {
    const dayText = (day, withYear) => (typeof parseDate === 'function'
      ? parseDate(day, { dateOnly: true, omitYear: !withYear, inputFormat: 'YYYY-MM-DD', utc: false })
      : String(day))

    const joinDates = (from, to, withYear) => {
      if (from === to) return dayText(from, withYear)
      return t('ENTERPRISE_REPORT_DATE_RANGE', '_from_ – _to_')
        .replace('_from_', () => dayText(from, withYear))
        .replace('_to_', () => dayText(to, withYear))
    }

    const rangeText = (from, to) => {
      if (!from) return ''
      return joinDates(from, to || from, true)
    }

    const periodText = (period) => {
      if (!period) return null
      switch (period.unit) {
        case 'hour':
          return typeof parseDate === 'function'
            ? parseDate(`${period.start} ${period.hour}`, { timeOnly: true, inputFormat: 'YYYY-MM-DD HH:mm', utc: false })
            : period.hour
        case 'day':
          return dayText(period.start, false)
        case 'week':
          return t('ENTERPRISE_REPORT_PERIOD_WEEK', 'Week _number_ · _dates_')
            .replace('_number_', () => String(period.number))
            .replace('_dates_', () => joinDates(period.start, period.end, false))
        case 'month':
          return monthText(period.start, languageCode)
        case 'year':
          return String(period.start).slice(0, 4)
        default:
          return null
      }
    }

    // the compact form of a week for the X axis of a chart that has no room for the whole label: the week above, its dates below.
    // The dates are the ones `periodText` writes; only a week has one (the other units are short and never need it).
    const periodAxisText = (period) => {
      if (!period || period.unit !== 'week') return null
      return [
        t('ENTERPRISE_REPORT_PERIOD_WEEK_NUMBER', 'Week _number_').replace('_number_', () => String(period.number)),
        joinDates(period.start, period.end, false)
      ]
    }

    const groupingText = unit => (Object.prototype.hasOwnProperty.call(GROUPING, unit) ? GROUPING[unit](t) : '')

    return { rangeText, periodText, periodAxisText, groupingText }
  }, [t, parseDate, languageCode])
}
