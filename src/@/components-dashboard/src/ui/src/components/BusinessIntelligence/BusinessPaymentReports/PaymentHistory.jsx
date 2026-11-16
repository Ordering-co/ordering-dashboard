import React, { useId } from 'react'

import { useConfig, useLanguage, useUtils } from '../../../../../index'
import { HISTORY_PRESETS } from '../../../../../utils/businessPayments'
import { describeDateFormat, formatDay, formatVisibleDay } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { Button, DateRangePopover, InlineNotice } from '../../Shared/Product'
import { FilterPill } from '../../Shared/Product/FilterBar'
import { readableApiMessage } from './readableApiMessage'
import { Calendar, Download } from '../../Shared/Icon'
import './store-reports.css'

// redesign business-payments FC1 (D6, BP-04, BP-08): the payment history of the store, in the bar next to the picker. A pill that
// opens the brand range popover (`P/DateRangePopover`) with no range by default, four presets and a range of its own that is
// written once, on «Done». «Download payment history» exists only with both dates, and the range is written in the project's
// date format, never as ISO. It holds no state: `history` is the controller's (`from`, `to`, `preset`, `setPreset`, `setRange`,
// `download`, `loading`, `error`) and the download is never started by choosing a range.
// `business` is not read: the controller already clears the range when another store is chosen.

const noop = () => {}

// the first text of an API error, which comes as a string, a list of them or `{ message }`
const firstMessage = (error) => (Array.isArray(error) ? error : [error]).map(item => (typeof item === 'string' ? item : item?.message)).find(Boolean)

export const PaymentHistory = ({ history }) => {
  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parseDate } = {}] = useUtils() || []
  const descriptionId = useId()
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const spec = describeDateFormat(dateFormat)
  // the project's date format; the plain formatter only stands in where the host gives no `parseDate`
  const shown = (day) => (parseDate ? formatVisibleDay(day, parseDate) : formatDay(day, spec))

  const { from, to } = history
  const first = from || to
  const last = to || from
  const rangeText = first ? (first === last ? shown(first) : `${shown(first)} – ${shown(last)}`) : ''
  const chooseDates = t('BUSINESS_PAYMENTS_CHOOSE_DATES', 'Choose dates')

  // the label of each preset is a literal `t()` call (the key scanner needs them)
  const presetLabels = {
    this_month: t('BUSINESS_PAYMENTS_PRESET_THIS_MONTH', 'This month'),
    last_month: t('BUSINESS_PAYMENTS_PRESET_LAST_MONTH', 'Last month'),
    last_3_months: t('BUSINESS_PAYMENTS_PRESET_LAST_3_MONTHS', 'Last 3 months'),
    this_year: t('BUSINESS_PAYMENTS_PRESET_THIS_YEAR', 'This year')
  }
  const presets = HISTORY_PRESETS.map(value => ({ value, label: presetLabels[value] ?? value }))

  const labels = {
    title: t('SELECT_DATE', 'Select a date'),
    presets: t('PERIOD', 'Period'),
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

  // a day alone is a range of one day, as the first click of `main` was (otherwise «Done» would leave a range with no download);
  // an emptied range clears the history
  const apply = ({ from: nextFrom, to: nextTo }) => {
    const day = nextFrom || nextTo
    history.setRange?.(day ? { from: day, to: nextTo || day } : { from: null, to: null })
  }

  const errorText = history.error ? readableApiMessage(t, firstMessage(history.error), t('BUSINESS_PAYMENTS_HISTORY_FAILED', "We couldn't download the payment history.")) : null

  return (
    <div className='odc-bp-history'>
      <div className='odc-bp-history-row'>
        <DateRangePopover
          presets={presets}
          presetValue={history.preset ?? undefined}
          from={from || null}
          to={to || null}
          dateFormat={dateFormat}
          triggerText={rangeText || chooseDates}
          empty={!rangeText}
          labels={labels}
          locale={languageState?.language?.code}
          align='start'
          onPreset={(value) => history.setPreset?.(value)}
          // a range of its own is a draft until «Done» (onApplyRange), so the popover never reports it piece by piece
          onRange={noop}
          onApplyRange={apply}
          renderTrigger={({ ref, expanded, toggle }) => (
            <span ref={ref} className='odc-bp-history-anchor'>
              <FilterPill
                icon={Calendar}
                label={t('PAYMENT_HISTORY', 'Payment history')}
                value={rangeText || chooseDates}
                // «Choose dates» is a prompt, not a filter that is on
                data-active={rangeText ? '' : undefined}
                aria-describedby={descriptionId}
                hasPopup='dialog'
                expanded={expanded}
                onClick={toggle}
              />
            </span>
          )}
        />
        <span id={descriptionId} className='odc-sr-only'>
          {t('PAYMENT_HISTORY_DESC', 'Download a consolidated PDF of payment invoices for the selected date range')}
        </span>
        {from && to && (
          <Button
            variant='secondary'
            icon={Download}
            busy={Boolean(history.loading)}
            onClick={() => history.download?.()}
          >
            {history.loading ? t('DOWNLOADING', 'Downloading...') : t('DOWNLOAD_PAYMENT_HISTORY', 'Download payment history')}
          </Button>
        )}
      </div>
      {errorText && <InlineNotice tone='danger'>{errorText}</InlineNotice>}
    </div>
  )
}
