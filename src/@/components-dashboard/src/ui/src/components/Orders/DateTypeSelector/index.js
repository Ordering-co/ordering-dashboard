import React, { useEffect, useRef, useState } from 'react'
import { useConfig, useLanguage } from '../../../../../index'
import { useUtils } from '../../../../../contexts/UtilsContext'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'

import { DateRangePopover } from '../../Shared/Product/DateRangePopover'
import { describeDateFormat, formatDay, formatVisibleDay, dayOf } from '../../../../../utils/dateRange'

// redesign fix-qa: E1. The brand date range (popover, or a bottom sheet on phones) replaces the select
// that held two react-datepicker inputs. Same values and same handlers as before: a preset calls
// handleChangeDateType(preset); a range calls handleChangeDateType('term'), handleChangeFromDate(
// 'YYYY-MM-DD 00:00:00') and handleChangeEndDate('YYYY-MM-DD 23:59:59').

// The controller's handlers spread the filter values they were rendered with, so two of them in the
// same tick would overwrite each other. A range is therefore sent one handler per render.
const MAX_STEPS = 5

export const DateTypeSelector = (props) => {
  const {
    filterValues,
    handleChangeDateType,
    handleChangeFromDate,
    handleChangeEndDate,
    onApplyRange,
    renderTrigger,
    align
  } = props

  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate }] = useUtils()
  const [target, setTarget] = useState(null)
  const steps = useRef(0)

  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const dateType = filterValues?.dateType || 'default'
  const isTerm = dateType === 'term'

  // The fields and the calendar show what is being sent while the handlers catch up.
  const from = target ? target.from : (isTerm ? dayOf(filterValues?.deliveryFromDatetime) : null)
  const to = target ? target.to : (isTerm ? dayOf(filterValues?.deliveryEndDatetime) : null)

  useEffect(() => {
    if (!target) return
    steps.current += 1
    if (steps.current > MAX_STEPS) {
      setTarget(null)
      return
    }
    if (filterValues?.dateType !== 'term') {
      handleChangeDateType('term')
      return
    }
    if (dayOf(filterValues?.deliveryFromDatetime) !== target.from) {
      handleChangeFromDate(target.from ? `${target.from} 00:00:00` : null)
      return
    }
    if (dayOf(filterValues?.deliveryEndDatetime) !== target.to) {
      handleChangeEndDate(target.to ? `${target.to} 23:59:59` : null)
      return
    }
    setTarget(null)
  }, [target, filterValues])

  const presets = [
    { value: 'default', label: t('ANY', 'Any') },
    { value: 'today', label: t('TODAY', 'Today') },
    { value: 'yesterday', label: t('YESTERDAY', 'Yesterday') },
    { value: 'last7', label: t('LAST_7_DAYS', 'Last 7 days') },
    { value: 'last30', label: t('LAST_30_DAYS', 'Last 30 days') }
  ]

  // redesign tramo A r5 (W0-QA3-02): the pill shows the days like the list does (parseDate, dates_general_format or the visible
  // default), never ISO. `dateFormat` stays for the typed fields (the popover builds the mask from it) and the mask; the values sent stay 'YYYY-MM-DD'.
  // Without UtilsProviders (none in the app) it falls back to the format of the project in dayjs, as before.
  const spec = describeDateFormat(dateFormat)
  const shown = (day) => (parseDate ? formatVisibleDay(day, parseDate) : formatDay(day, spec))
  const rangeText = () => {
    if (from && to) return `${shown(from)} – ${shown(to)}`
    if (from) return `${t('FROM', 'From')} ${shown(from)}`
    if (to) return `${t('TO', 'To')} ${shown(to)}`
    return ''
  }

  const preset = presets.find(item => item.value === dateType && item.value !== 'default')
  const triggerText = isTerm ? rangeText() : preset?.label || ''
  const empty = !triggerText

  const labels = {
    title: t('SELECT_DATE', 'Select a date'),
    presets: t('DATE', 'Date'),
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

  const handlePreset = (value) => {
    steps.current = 0
    setTarget(null)
    handleChangeDateType(value)
  }

  // redesign F6c-1 (P3-05): with `onApplyRange` the popover keeps the range as a draft until «Done» and this sends it as
  // ONE set of filter values, instead of the three steps above (a list request for each). The Date pill of the bar
  // uses it; the Filters sheet keeps the handlers because its own «Apply» is what sends the values to the list.
  const handleApplyRange = ({ from: nextFrom, to: nextTo }) => {
    steps.current = 0
    setTarget(null)
    onApplyRange(!nextFrom && !nextTo
      ? { dateType: 'default', deliveryFromDatetime: null, deliveryEndDatetime: null }
      : {
          dateType: 'term',
          deliveryFromDatetime: nextFrom ? `${nextFrom} 00:00:00` : null,
          deliveryEndDatetime: nextTo ? `${nextTo} 23:59:59` : null
        })
  }

  const handleRange = (range) => {
    steps.current = 0
    setTarget({ from: range.from || null, to: range.to || null })
  }

  return (
    <DateRangePopover
      presets={presets}
      presetValue={dateType}
      from={from}
      to={to}
      dateFormat={dateFormat}
      triggerText={triggerText || t('SELECT_DATE', 'Select a date')}
      empty={empty}
      labels={labels}
      locale={languageState?.language?.code}
      onPreset={handlePreset}
      onRange={handleRange}
      onApplyRange={onApplyRange ? handleApplyRange : undefined}
      renderTrigger={renderTrigger}
      align={align}
    />
  )
}
