import React from 'react'

import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { DateRangePopover, Field } from '../../Shared/Product'
import { Calendar } from '../../Shared/Icon'
import { DAY, describeDateFormat, formatDay, monthOf, shiftDay, todayDay } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { FieldTrigger } from './FieldTrigger'
import './invoice-form.css'

// redesign invoice FC1 (D7; auditor 3, 8; D10): the period of the invoice. «All dates» means `from = to = ''`, as `main` with no
// dates; the form starts on «Last month» (D-23: the controller's default). The presets are worked out with the LOCAL day of
// the browser and travel as `YYYY-MM-DD`; a custom range is a draft of the popover and is written once, on «Done». What is read is
// the project's date format through `parseDate` with `{ utc: false, dateOnly: true }`, so a negative time zone does not move the
// period a day (auditor 8). It holds no state: `from` and `to` are the controller's and `setPeriod(from, to)` is its only output.

const noop = () => {}

/** The presets, as `{ value, from, to }`, for the local day `today` (`YYYY-MM-DD`). */
export const periodPresets = (today) => {
  const monthStart = monthOf(today)
  const lastMonthEnd = shiftDay(monthStart, -1)
  return [
    { value: 'all', from: '', to: '' },
    { value: 'this_month', from: monthStart, to: today },
    { value: 'last_month', from: monthOf(lastMonthEnd), to: lastMonthEnd },
    { value: 'last_7_days', from: shiftDay(today, -6), to: today },
    { value: 'last_30_days', from: shiftDay(today, -29), to: today }
  ]
}

export const InvoicePeriod = ({ from = '', to = '', setPeriod }) => {
  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const spec = describeDateFormat(dateFormat)
  // the plain formatter only stands in where the host gives no `parseDate`
  const shown = (day) => (parseDate ? parseDate(day, { utc: false, dateOnly: true, inputFormat: DAY }) : formatDay(day, spec))

  const presets = periodPresets(todayDay())
  const labels = {
    all: t('INVOICE_MANAGER_ALL_DATES', 'All dates'),
    this_month: t('INVOICE_MANAGER_THIS_MONTH', 'This month'),
    last_month: t('INVOICE_MANAGER_LAST_MONTH', 'Last month'),
    // the shared LAST_7_DAYS carries a typo in the API's runtime catalog; the reports have their own keys (same texts)
    last_7_days: t('BUSINESS_REPORTS_LAST_7_DAYS', 'Last 7 days'),
    last_30_days: t('BUSINESS_REPORTS_LAST_30_DAYS', 'Last 30 days')
  }
  const current = presets.find(preset => preset.from === (from || '') && preset.to === (to || ''))

  const everything = !from && !to
  const first = from || to
  const last = to || from
  const text = everything ? labels.all : (first === last ? shown(first) : `${shown(first)} – ${shown(last)}`)

  const popoverLabels = {
    title: t('SELECT_DATE', 'Select a date'),
    presets: t('INVOICE_MANAGER_PERIOD', 'Period'),
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

  const choose = (value) => {
    const preset = presets.find(item => item.value === value)
    if (preset) setPeriod?.(preset.from, preset.to)
  }

  // a day alone is a range of one day, as the first click of `main` was; an emptied range is «All dates»
  const apply = ({ from: nextFrom, to: nextTo }) => {
    const day = nextFrom || nextTo
    if (!day) {
      setPeriod?.('', '')
      return
    }
    setPeriod?.(day, nextTo || day)
  }

  return (
    <Field label={t('INVOICE_MANAGER_PERIOD', 'Period')}>
      <DateRangePopover
        presets={presets.map(preset => ({ value: preset.value, label: labels[preset.value] }))}
        presetValue={current?.value}
        from={from || null}
        to={to || null}
        dateFormat={dateFormat}
        triggerText={text}
        empty={everything}
        labels={popoverLabels}
        locale={languageState?.language?.code}
        align='start'
        onPreset={choose}
        // a custom range is a draft until «Done» (onApplyRange), so the popover never reports it piece by piece
        onRange={noop}
        onApplyRange={apply}
        renderTrigger={({ ref, expanded, toggle }) => (
          <FieldTrigger ref={ref} icon={Calendar} text={text} empty={false} expanded={expanded} onClick={toggle} />
        )}
      />
    </Field>
  )
}
