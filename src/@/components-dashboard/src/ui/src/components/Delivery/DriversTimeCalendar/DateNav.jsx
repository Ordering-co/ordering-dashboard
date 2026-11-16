import React from 'react'

import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { describeDateFormat, formatDay, formatVisibleDay } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { Calendar, ChevronLeft, ChevronRight } from '../../Shared/Icon'
import { Button, DateRangePopover, IconButton, InlineNotice, SegmentedControl } from '../../Shared/Product'
import { exceedsRangeLimit, rangeOf, shiftRange, todayDay } from './blockData'
import './toolbar.css'

// redesign DT-B4 (DT-16, DT-17, DT-20, decision 13 | auditor 5): the dates of the drivers' time calendar, in the `tools` of the bar.
// The page holds the range (`{ from, to }`, local days `YYYY-MM-DD`); this only asks to change it:
//  · View: Day · Week (a custom range marks neither). Day → the first day of the range; Week → the week that holds it, from the first
//    day of the week of the locale.
//  · ‹ › move the range by its own length (a day, a week or N days: `shiftRange`).
//  · The range button (the brand `DateRangePopover` without presets, as ReportPeriod) says the day, or «from – to», in the date
//    format of the project, and writes the range once, on «Done» (a draft until then). More than 31 days apart (main's limit) does
//    not change the range: it asks the page for the notice (`onRangeError(true)`).
//  · Today: the range of the same kind that holds today (a custom range → today).
//  · `rangeError`: a warning under the controls, with the key of main (DATE_RANGE_ERROR); the page clears it when the range changes
//    (also cleared here on each change, so the nav works alone).
//
// @param {object}   props
// @param {object}   props.range          `{ from, to }`.
// @param {Function} props.onRangeChange  `({ from, to }) => void`.
// @param {string}   props.locale         Language code (the month names and the first day of the week of the popover).
// @param {number}   props.firstDayOfWeek 0 Sunday … 6 Saturday (`firstDayOfWeekFor(locale)`).
// @param {string}   props.zone           the time zone whose today «Today» goes to (the browser's by default).
// @param {boolean}  props.rangeError     The last custom range was too long.
// @param {Function} props.onRangeError   `(boolean) => void`.

const noop = () => {}

const kindOf = (range, firstDayOfWeek) => {
  if (range.from === range.to) return 'day'
  const week = rangeOf('week', range.from, firstDayOfWeek)
  return week.from === range.from && week.to === range.to ? 'week' : 'custom'
}

export const DateNav = ({ range, onRangeChange, locale, firstDayOfWeek, zone, rangeError = false, onRangeError }) => {
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat

  // the project's date format; the plain formatter only stands in where the host gives no `parseDate`
  const spec = describeDateFormat(dateFormat, locale)
  const shown = (day) => (parseDate ? formatVisibleDay(day, parseDate) : formatDay(day, spec))

  const kind = kindOf(range, firstDayOfWeek)
  const rangeText = range.from === range.to ? shown(range.from) : `${shown(range.from)} – ${shown(range.to)}`

  const change = (next) => {
    if (rangeError) onRangeError?.(false)
    onRangeChange?.(next)
  }

  const chooseView = (view) => {
    if (view === 'week') change(rangeOf('week', range.from, firstDayOfWeek))
    else {
      // the week that holds today goes back to Day on today, not on its first day (a past one). Any other week, and a
      // custom range (R-05), keep the first day of the range.
      const today = todayDay(zone)
      const holdsToday = kind === 'week' && range.from <= today && today <= range.to
      change(rangeOf('day', holdsToday ? today : range.from))
    }
  }

  const goToday = () => {
    const today = todayDay(zone)
    change(kind === 'week' ? rangeOf('week', today, firstDayOfWeek) : rangeOf('day', today))
  }

  // a range of one day picked and «Done» is that day as a range of one; two ends more than 31 days apart are not applied
  const apply = ({ from: nextFrom, to: nextTo }) => {
    const first = nextFrom || nextTo
    if (!first) return
    const next = { from: first, to: nextTo || first }
    if (exceedsRangeLimit(next)) {
      onRangeError?.(true)
      return
    }
    change(next)
  }

  const labels = {
    title: t('SELECT_DATE', 'Select a date'),
    // the group of presets is empty here (the view buttons are Day · Week) and hidden by toolbar.css; its name is never read
    presets: t('SELECT_DATE', 'Select a date'),
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

  return (
    <div className='odc-dt-nav'>
      {/* the control is a block of the width its options need (it falls to a select only if the bar cannot hold it) */}
      <div className='odc-dt-nav-view'>
        <SegmentedControl
          label={t('DRIVER_BLOCKS_VIEW', 'View')}
          // a custom range has no option to mark: a value that is none of them leaves every option unpressed
          value={kind === 'custom' ? '' : kind}
          onValueChange={chooseView}
          options={[
            { value: 'day', label: t('DAY', 'Day') },
            { value: 'week', label: t('WEEK', 'Week') }
          ]}
        />
      </div>
      {/* redesign DT-B5 (live check at 390): ‹ dates › stay together on one line */}
      <div className='odc-dt-nav-step'>
      <IconButton icon={ChevronLeft} flipInRtl label={t('PREVIOUS', 'Previous')} onClick={() => change(shiftRange(range, -1))} />
      <DateRangePopover
        presets={[]}
        from={range.from}
        to={range.to}
        dateFormat={dateFormat}
        triggerText={rangeText}
        labels={labels}
        locale={locale}
        align='start'
        onPreset={noop}
        // a range is a draft until «Done» (onApplyRange), so the popover never reports it piece by piece
        onRange={noop}
        onApplyRange={apply}
        renderTrigger={({ ref, expanded, toggle }) => (
          <Button
            ref={ref}
            variant='secondary'
            icon={Calendar}
            className='odc-dt-nav-range'
            aria-haspopup='dialog'
            aria-expanded={expanded}
            onClick={toggle}
          >
            <bdi>{rangeText}</bdi>
          </Button>
        )}
      />
      <IconButton icon={ChevronRight} flipInRtl label={t('NEXT', 'Next')} onClick={() => change(shiftRange(range, 1))} />
      </div>
      <Button variant='secondary' className='odc-dt-nav-today' onClick={goToday}>{t('TODAY', 'Today')}</Button>
      {rangeError && (
        <InlineNotice tone='warning' className='odc-dt-nav-notice'>
          {t('DATE_RANGE_ERROR', 'The difference between dates should not be greater than 31')}
        </InlineNotice>
      )}
    </div>
  )
}
