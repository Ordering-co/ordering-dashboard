import React from 'react'
import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { Button, DateRangePopover } from '../../Shared/Product'
import { Calendar } from '../../Shared/Icon'
import dayjs from 'dayjs'
import { DAY, describeDateFormat, formatDay, formatVisibleDay, todayDay } from '../../../../../utils/dateRange'
import { zonedNow } from '../../../../../utils/businessReports'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import './report-filters.css'

// redesign bi FB1 (D4, auditor 4): the period of a report page. The four presets of `main` stay on view, one click each, as a
// group of buttons that say whether they are on; «Custom range» opens the brand range popover with no presets in it and writes
// the range once, on «Done» (BI-04). The line under them says the real dates of the period (BI-05, BI-06). It holds no state:
// `lapse` is the one of the controller (`today`, `yesterday`, `last_7_days`, `last_30_days` or `YYYY-MM-DD,YYYY-MM-DD`), and
// the only thing it does is call `onChange(lapse)`. `period` is `{ from, to, includesToday }` (`periodOf`) and only labels.

const CUSTOM_LAPSE = /^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/

const noop = () => {}

/**
 * Period filter. `lapse` is the controller's `filterList.lapse`; `onChange(lapse)` reports a preset or `from,to`; `period` is
 * `{ from, to, includesToday }` for the line of dates (it paints nothing without it). `timeZone` (optional) is the zone of the
 * report (`filterList.timeZone`): «today» of the calendar and of the «until now» fallback is that zone's day, not the browser's.
 */
export const ReportPeriod = ({ lapse, onChange, period, timeZone }) => {
  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat

  // redesign bi FB1 (BI-05): the project's date format; the plain formatter only stands in where the host gives no `parseDate`
  const spec = describeDateFormat(dateFormat)
  const shown = (day) => (parseDate ? formatVisibleDay(day, parseDate) : formatDay(day, spec))
  const shownPeriodDay = (day) => (parseDate ? parseDate(day, { dateOnly: true, inputFormat: 'YYYY-MM-DD', utc: false }) : formatDay(day, spec))

  // redesign bi FB1 (own keys, P3): the shared LAST_7_DAYS carries a typo in the API's runtime catalog («Last 7 dyas»), and a
  // runtime catalog wins over the default text
  const presets = [
    { value: 'today', label: t('TODAY', 'Today') },
    { value: 'yesterday', label: t('YESTERDAY', 'Yesterday') },
    { value: 'last_7_days', label: t('BUSINESS_REPORTS_LAST_7_DAYS', 'Last 7 days') },
    { value: 'last_30_days', label: t('BUSINESS_REPORTS_LAST_30_DAYS', 'Last 30 days') }
  ]

  const custom = CUSTOM_LAPSE.exec(lapse || '')
  const from = custom ? custom[1] : null
  const to = custom ? custom[2] : null
  const customLabel = t('BUSINESS_REPORTS_CUSTOM_RANGE', 'Custom range')
  const customText = custom ? (from === to ? shown(from) : `${shown(from)} – ${shown(to)}`) : ''

  const labels = {
    title: t('SELECT_DATE', 'Select a date'),
    presets: customLabel,
    close: t('CLOSE', 'Close'),
    done: t('DONE', 'Done'),
    from: t('FROM', 'From'),
    to: t('TO', 'To'),
    today: t('TODAY', 'Today'),
    goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
    previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
    nextMonth: t('NEXT_MONTH', 'Next month'),
    rangeOrder: t('DATE_RANGE_ORDER', 'The start date must not be after the end date.'),
    invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', format)
  }

  // redesign bi R1 (P-b, parity with main): the preset that is on reports itself again. In main the active preset was the one
  // «refresh» of the page (AnalyticsStatusFilterBar asked the ten reports again), and the controller reloads because the
  // page hands it a new filter object. The channel keeps the opposite rule (ReportChannels).
  const choose = (value) => { onChange?.(value) }

  // a range of one day picked and «Done» is that day as a range of one, as the first click of `main` was
  const apply = ({ from: nextFrom, to: nextTo }) => {
    const first = nextFrom || nextTo
    if (!first) return
    onChange?.(`${first},${nextTo || first}`)
  }

  const hasPeriod = Boolean(period?.from && period?.to)
  const severalDays = hasPeriod && period.from !== period.to
  // redesign (row 71, Q-09): the day of the zone of the report (`zonedNow` has the zone's wall clock in its local
  // fields; an empty or unknown zone is the browser's day), also for the calendar of «Custom range»
  const zoneToday = timeZone ? dayjs(zonedNow(timeZone)).format(DAY) : todayDay()
  const untilNow = severalDays && (period.includesToday ?? period.to >= zoneToday)

  return (
    <div className='odc-bi-period'>
      <div className='odc-bi-period-group' role='group' aria-label={t('BUSINESS_REPORTS_PERIOD', 'Period')}>
        {presets.map(({ value, label }) => (
          <Button
            key={value}
            variant='secondary'
            className='odc-bi-chip'
            aria-pressed={lapse === value}
            onClick={() => choose(value)}
          >
            {label}
          </Button>
        ))}
        <DateRangePopover
          presets={[]}
          from={from}
          to={to}
          dateFormat={dateFormat}
          triggerText={customText || customLabel}
          empty={!custom}
          labels={labels}
          locale={languageState?.language?.code}
          align='start'
          today={zoneToday}
          onPreset={noop}
          // a range is a draft until «Done» (onApplyRange), so the popover never reports it piece by piece
          onRange={noop}
          onApplyRange={apply}
          renderTrigger={({ ref, expanded, toggle }) => (
            <Button
              ref={ref}
              variant='secondary'
              icon={Calendar}
              className='odc-bi-chip odc-bi-period-custom'
              aria-pressed={Boolean(custom)}
              aria-haspopup='dialog'
              aria-expanded={expanded}
              // the name keeps the object and contains the text that is seen
              aria-label={custom ? `${customLabel}: ${customText}` : undefined}
              onClick={toggle}
            >
              {custom ? <bdi>{customText}</bdi> : customLabel}
            </Button>
          )}
        />
        {/* redesign bi AC (B1): the real dates are the last item of the group, not a line under it: from 768 it takes its own line
            (report-filters.css), on a phone it sits beside «Custom range» when they fit, which saves a row of 44 px */}
        {hasPeriod && (
          <p className='odc-bi-period-dates'>
            <bdi>{severalDays ? `${shownPeriodDay(period.from)} – ${shownPeriodDay(period.to)}` : shownPeriodDay(period.from)}</bdi>
            {untilNow && ` · ${t('BUSINESS_REPORTS_UNTIL_NOW', 'today until now')}`}
          </p>
        )}
      </div>
    </div>
  )
}
