import React, { useEffect, useRef, useState } from 'react'

import { useConfig, useLanguage, useUtils } from '~components'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, DatePicker, Field, InlineNotice, RadioGroup, TimeField } from '../../Shared/Product'
import { TriangleAlert } from '../../Shared/Icon'
import {
  DURATION_HOURS,
  addHoursToApi,
  defaultUntil,
  formatApiUtc,
  isFutureApi,
  isFutureUntil,
  isSameLocalDay,
  knownTimeZone,
  localDayOf,
  parseApiUtc,
  untilToApi,
  zonedDayOf,
  zonedStampOf
} from './utils'
import './snooze.css'

// redesign stores 2.F
// The body of a dialog the consumer owns (no Dialog and no heading of its own): the current snooze, the options, «Until…» and
// the buttons. With an entity that exists it saves ONLY `snooze_until` (`keepPendingChanges`) and waits for the answer; as a
// field of someone else's form (`hideButtons`, or an entity that does not exist yet) it writes the value through the form props
// and makes no request. Nothing is written to the form of the consumer before the person presses «Snooze».
// redesign bugs C: `timeZone` (optional, IANA) reads and writes every time on that zone's clock and names it. The store
// editor passes the store's, so the dialog and the Overview say the same hour; without it (or with a zone Intl does not know) the
// times are the browser's, as before.

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

const isValidChoice = (choice, until, at, zone) => (
  choice === 'off' ||
  DURATION_HOURS.includes(Number(choice)) ||
  (choice === 'until' && isFutureUntil(until.day, until.time, at, zone))
)

// «Off» clears it; a duration is counted from `at` (the moment the value is written); «Until…» is the person's local time, or the
// time on the clock of `zone`.
const snoozeValue = (choice, until, at, zone) => {
  if (choice === 'off') return null
  if (choice === 'until') return untilToApi(until.day, until.time, zone)
  return addHoursToApi(at, Number(choice))
}

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

// A text with one placeholder, the value of which is a figure (mono, tabular): «until _time_» -> until <span>14:20</span>
const withFigure = (template, token, value) => {
  const [before, ...rest] = template.split(token)
  return <>{before}<span className='odc-figure'>{value}</span>{rest.join(token)}</>
}

export const SnoozeComponent = (props) => {
  const { dataState, handleUpdate, setFormState, handleChangeFormState, onClose, hideButtons, timeZone } = props
  const [languageState, t] = useLanguage()
  const [{ configs } = {}] = useConfig() || []
  const [{ parseDate } = {}] = useUtils()
  const zone = knownTimeZone(timeZone)
  const [now, setNow] = useState(() => Date.now())
  const [choice, setChoice] = useState(null)
  const [until, setUntil] = useState(() => defaultUntil(Date.now(), zone))
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const mounted = useRef(true)
  const saving = useRef(false)

  // The consumer's X can close the dialog in the middle of a request: nothing is set after that.
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // The ends of the durations move with the clock.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [])

  // Saved on its own request, or written to the form of the consumer
  const asField = !!hideButtons || !dataState?.id

  const writeToForm = (value) => {
    handleChangeFormState && handleChangeFormState({ snooze_until: value })
    setFormState && setFormState(prev => ({ ...prev, changes: { ...prev?.changes, snooze_until: value } }))
  }

  const handleChoice = (next) => {
    setChoice(next)
    setFailure(null)
    const at = Date.now()
    if (hideButtons && isValidChoice(next, until, at, zone)) writeToForm(snoozeValue(next, until, at, zone))
  }

  // Changing the day or the time chooses «Until…»
  const handleUntil = (patch) => {
    const next = { ...until, ...patch }
    setUntil(next)
    setChoice('until')
    setFailure(null)
    const at = Date.now()
    if (hideButtons && isValidChoice('until', next, at, zone)) writeToForm(snoozeValue('until', next, at, zone))
  }

  const handleSave = async () => {
    if (saving.current) return
    const at = Date.now()
    if (!isValidChoice(choice, until, at, zone)) return
    const value = snoozeValue(choice, until, at, zone)
    if (asField) {
      writeToForm(value)
      onClose && onClose()
      return
    }
    saving.current = true
    setBusy(true)
    setFailure(null)
    let result
    try {
      result = await (handleUpdate && handleUpdate({ snooze_until: value }, { keepPendingChanges: true }))
    } catch (error) {
      result = undefined
    }
    saving.current = false
    if (!mounted.current) return
    setBusy(false)
    if (result?.ok === true) onClose && onClose()
    else setFailure({ error: result?.error })
  }

  // An instant in the project's format: on the browser's clock (the API value read as UTC), or on the zone's clock (written as it is)
  const formatInstant = (time, options) => (zone
    ? parseDate(zonedStampOf(time, zone), { ...options, utc: false })
    : parseDate(formatApiUtc(new Date(time)), { ...options, utc: true }))

  const formatEnd = (hours) => {
    const end = now + hours * HOUR_MS
    const text = isSameLocalDay(now, end, zone)
      ? formatInstant(end, { timeOnly: true })
      : formatInstant(end, { omitYear: true })
    return withFigure(t('SNOOZE_UNTIL_TIME', 'until _time_'), '_time_', text)
  }

  const durationLabels = {
    1: t('SNOOZE_ONE_HOUR_LONG', '1 hour'),
    2: t('SNOOZE_TWO_HOUR_LONG', '2 hours'),
    4: t('SNOOZE_FOUR_HOUR_LONG', '4 hours'),
    6: t('SNOOZE_SIX_HOUR_LONG', '6 hours'),
    12: t('SNOOZE_TWELVE_HOUR_LONG', '12 hours')
  }
  // J2 row 14 (stores-2-f-snooze D2): «Off» only when there is something to end. A saved entity that is not snoozed has nothing to
  // turn off; as a field of a form (or an entity not created yet) it stays, to take back a value chosen before saving.
  const offerOff = asField || isFutureApi(dataState?.snooze_until, now)
  const options = [
    ...(offerOff ? [{ value: 'off', label: t('SNOOZE_OFF', 'Off') }] : []),
    ...DURATION_HOURS.map(hours => ({ value: String(hours), label: durationLabels[hours], description: formatEnd(hours) })),
    { value: 'until', label: t('SNOOZE_UNTIL_OPTION', 'Until…') }
  ]

  const renderedAt = Date.now()
  const valid = isValidChoice(choice, until, renderedAt, zone)
  const pastUntil = choice === 'until' && !isFutureUntil(until.day, until.time, renderedAt, zone)
  const snoozedUntil = isFutureApi(dataState?.snooze_until, now)
    ? (zone ? formatInstant(parseApiUtc(dataState.snooze_until)) : parseDate(dataState.snooze_until, { utc: true }))
    : null
  const detail = failure ? translateApiMessage(t, firstMessage(failure.error), '') : ''
  const failureText = failure ? `${t('SNOOZE_SAVE_FAILED', 'The snooze was not saved.')} ${detail}`.trim() : null

  return (
    <div className='odc-root odc-snooze'>
      {snoozedUntil && (
        <InlineNotice tone='warning'>
          {withFigure(t('SNOOZE_STATUS_UNTIL', 'Snoozed until _date_'), '_date_', snoozedUntil)}
        </InlineNotice>
      )}
      <RadioGroup
        label={t('SNOOZE_FOR', 'Snooze for')}
        options={options}
        value={choice}
        onValueChange={handleChoice}
      />
      <div className='odc-snooze-until'>
        <Field label={t('DATE', 'Date')}>
          <DatePicker
            label={t('DATE', 'Date')}
            labels={pickerLabels(t)}
            dateFormat={getDateTimeFormats(configs?.dates_general_format?.value).dateFormat}
            locale={languageState?.language?.code}
            value={until.day}
            min={zone ? zonedDayOf(now, zone) : localDayOf(new Date(now))}
            onChange={(day) => handleUntil({ day })}
          />
        </Field>
        <TimeField
          mode='time'
          label={t('TIME', 'Time')}
          hourLabel={t('HOURS', 'Hours')}
          minuteLabel={t('MINUTES', 'Minutes')}
          amLabel={t('AM', 'AM')}
          pmLabel={t('PM', 'PM')}
          // row 12: the selector follows `format_time`, the setting the hours of the options above are written with
          is12Hours={String(configs?.format_time?.value) === '12'}
          value={until.time}
          error={pastUntil ? t('SNOOZE_PAST_TIME', 'Choose a time in the future.') : undefined}
          onChange={(time) => handleUntil({ time })}
        />
      </div>
      {zone && (
        <p className='odc-snooze-zone'>
          {t('SNOOZE_STORE_TIME_ZONE', "Times are in the store's time zone (_zone_).").replace('_zone_', zone)}
        </p>
      )}
      {failureText && (
        <InlineNotice tone='danger' icon={TriangleAlert} role='alert'>{failureText}</InlineNotice>
      )}
      {!hideButtons && (
        <div className='odc-snooze-foot'>
          <Button onClick={() => onClose && onClose()}>{t('CANCEL', 'Cancel')}</Button>
          <Button variant='primary' busy={busy} disabled={!valid} onClick={handleSave}>
            {choice === 'off' ? t('SNOOZE_END', 'End snooze') : t('SNOOZE_SAVE', 'Snooze')}
          </Button>
        </div>
      )}
    </div>
  )
}

// The words of P/DatePicker (the same keys CampaignDelivery uses)
const pickerLabels = (t) => ({
  title: t('SELECT_DATE', 'Select a date'),
  close: t('CLOSE', 'Close'),
  today: t('TODAY', 'Today'),
  goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
  previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
  nextMonth: t('NEXT_MONTH', 'Next month'),
  invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
  outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.')
})
