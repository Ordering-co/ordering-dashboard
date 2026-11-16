import React, { useEffect, useId, useRef, useState } from 'react'

import { useApi, useConfig, useLanguage, useUtils } from '../../../../../index'
import { DAY } from '../../../../../utils/dateRange'
import { periodOf } from '../../../../../utils/businessReports'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { Button, DateRangePopover, Dialog, InlineNotice } from '../../Shared/Product'
import { ChevronDown, Download } from '../../Shared/Icon'
import { StorePicker } from '../AnalyticsKit/StorePicker'
import { DriverPicker } from './DriverPicker'
import { defaultCsvRange, reviewsCsvRequest } from './reviewsData'
import { useReviewsCsv } from './useReviewsCsv'
import './reviews-page.css'

// redesign reviews FD2 (D6, D7, D9; RV-03, RV-10): the CSV of /intelligence/reviews as a Product dialog, in place of the modal of main
// (a business or a driver, and the old calendar). The page keeps this mounted, so what was chosen (the business, the driver and the
// period) is kept between openings, as main kept it. It opens only in the Business and Drivers tabs and asks for the same two
// files, with the same requests (`reviewsCsvRequest`, `useReviewsCsv`). A failed download says why inside the dialog.

const PRESETS = ['today', 'yesterday', 'last_7_days', 'last_30_days']

// redesign reviews R1 (Q1-10): a field without `label` is a pill that already names itself («Business · All businesses»), so it has no
// label above it (it said the same thing twice); its accessible name keeps the word.
const Field = ({ label, children }) => {
  const id = useId()
  if (!label) {
    return (
      <div className='odc-rv-field'>
        <div className='odc-rv-field-control'>{children}</div>
      </div>
    )
  }
  return (
    <div className='odc-rv-field'>
      <span id={id} className='odc-rv-field-label'>{label}</span>
      <div role='group' aria-labelledby={id} className='odc-rv-field-control'>{children}</div>
    </div>
  )
}

// redesign (row 73): the trigger of the range popover. When the popover closes (Escape, a press outside, the close button, or
// an applied range) the draft goes back to the applied range, so a half range (one day picked) is not what the next opening shows.
const RangeTrigger = ({ expanded, onClosed, children }) => {
  useEffect(() => {
    if (!expanded) onClosed()
  }, [expanded])
  return children
}

export const ReviewsExport = ({ open = false, onOpenChange, tab }) => {
  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const [ordering] = useApi()
  const csv = useReviewsCsv()

  const [business, setBusiness] = useState(null) // { id, name } | null (all)
  const [driver, setDriver] = useState(null) // { id, name } | null (all)
  // `range` is the period the file will ask for (always whole); `draft` is what the calendar shows, which holds the first day of a
  // range between its two clicks. The range is applied when the second day is chosen, as the calendar of main did.
  const [range, setRange] = useState(() => defaultCsvRange())
  const [draft, setDraft] = useState(range)
  // redesign reviews R1 (Q1-4): the popover gives its `toggle` to the trigger it renders; the range closes it from here as soon as it is whole
  const calendar = useRef({ expanded: false, toggle: null })

  // a dialog opened again starts without the error of the last try
  useEffect(() => {
    if (open) csv.reset()
  }, [open])

  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const shown = (day) => (parseDate ? parseDate(day, { utc: false, dateOnly: true, inputFormat: DAY }) : day)

  const presets = PRESETS.map(value => ({ value, ...periodOf(value) }))
  const labels = {
    today: t('TODAY', 'Today'),
    yesterday: t('YESTERDAY', 'Yesterday'),
    last_7_days: t('BUSINESS_REPORTS_LAST_7_DAYS', 'Last 7 days'),
    last_30_days: t('BUSINESS_REPORTS_LAST_30_DAYS', 'Last 30 days')
  }
  const current = presets.find(preset => preset.from === draft.from && preset.to === draft.to)
  const triggerText = range.from === range.to ? shown(range.from) : `${shown(range.from)} – ${shown(range.to)}`

  const popoverLabels = {
    title: t('SELECT_DATE', 'Select a date'),
    presets: t('REVIEWS_PERIOD', 'Period'),
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

  const changed = (apply) => (...args) => {
    csv.reset()
    apply(...args)
  }

  const choosePreset = changed((value) => {
    const preset = presets.find(item => item.value === value)
    if (!preset) return
    setRange({ from: preset.from, to: preset.to })
    setDraft({ from: preset.from, to: preset.to })
  })

  // A range with one day only stays in the calendar (it is neither applied nor closed). When both days are there and the range is not the
  // one the calendar already held, it is applied and the popover closes (the focus goes back to its trigger), so «Download» is not under it.
  const changeRange = changed(({ from, to }) => {
    const whole = Boolean(from && to)
    const changedRange = from !== draft.from || to !== draft.to
    setDraft({ from, to })
    if (!whole) return
    setRange({ from, to })
    if (changedRange && calendar.current.expanded) calendar.current.toggle?.()
  })

  const chooseBusiness = changed((choice) => setBusiness(choice == null ? null : { id: choice.id, name: choice.name }))
  const chooseDriver = changed((choice) => setDriver(choice == null ? null : { id: choice.id, name: choice.name }))

  const submit = async () => {
    const request = reviewsCsvRequest({
      tab,
      root: ordering.root,
      businessId: business?.id,
      driverId: driver?.id,
      from: range.from,
      to: range.to
    })
    const result = await csv.download(request)
    if (result?.ok) onOpenChange?.(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('DOWNLOAD_REVIEWS_CSV', 'Download reviews CSV')}
      closeLabel={t('CLOSE', 'Close')}
      size='sm'
      footer={(
        <>
          <Button onClick={() => onOpenChange?.(false)}>{t('CANCEL', 'Cancel')}</Button>
          <Button variant='primary' icon={Download} busy={csv.loading} onClick={submit}>{t('DOWNLOAD', 'Download')}</Button>
        </>
      )}
    >
      <div className='odc-rv-export'>
        {tab === 'business'
          ? (
            <Field>
              <StorePicker
                business={{ selected: business, select: chooseBusiness, restoring: false }}
                includeInactive
                allLabel={t('REVIEWS_ALL_BUSINESSES', 'All businesses')}
              />
            </Field>
            )
          : (
            <Field>
              <DriverPicker driver={{ selected: driver, select: chooseDriver }} />
            </Field>
            )}
        <Field label={t('REVIEWS_PERIOD', 'Period')}>
          <DateRangePopover
            presets={presets.map(preset => ({ value: preset.value, label: labels[preset.value] }))}
            presetValue={current?.value}
            from={draft.from}
            to={draft.to}
            dateFormat={dateFormat}
            triggerText={triggerText}
            labels={popoverLabels}
            locale={languageState?.language?.code}
            align='start'
            onPreset={choosePreset}
            onRange={changeRange}
            renderTrigger={({ ref, expanded, toggle }) => {
              calendar.current = { expanded, toggle }
              // the same trigger DateRangePopover draws when it is given none
              return (
                <RangeTrigger expanded={expanded} onClosed={() => setDraft(current => (current.from === range.from && current.to === range.to ? current : range))}>
                  <button
                    ref={ref}
                    type='button'
                    className='odc-dr-trigger'
                    aria-haspopup='dialog'
                    aria-expanded={expanded}
                    onClick={toggle}
                  >
                    <span className='odc-dr-trigger-text' title={triggerText}>{triggerText}</span>
                    <ChevronDown className='odc-icon odc-dr-trigger-chevron' aria-hidden='true' />
                  </button>
                </RangeTrigger>
              )
            }}
          />
        </Field>
        {csv.error && <InlineNotice tone='danger'>{csv.error}</InlineNotice>}
      </div>
    </Dialog>
  )
}
