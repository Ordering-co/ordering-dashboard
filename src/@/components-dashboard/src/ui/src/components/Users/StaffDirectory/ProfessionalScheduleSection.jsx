import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import { ProfessionalSchedule as ProfessionalScheduleController, useLanguage } from '../../../../../index'
import { getScheduleLabels } from '../../../utils/scheduleLabels'
import { AlertDialog, Button, NumberField, RadioGroup, ScheduleEditor } from '../../Shared/Product'
import './professional-schedule.css'

// redesign (B1a, decisions 6 and 10): the Schedule section of a professional's record, in place of main's
// Users/ProfessionalSchedule. It is the UIComponent of K/ProfessionalSchedule (untouched: it keeps the draft in `formState.changes` and
// saves it with `handleUpdateClick`). Two blocks: how far ahead customers can book (a radio group, with the number of days beside
// its option) and the weekly hours (the Product ScheduleEditor, as the driver panel's Schedule).

const DAYS = 'days'
const INDEFINITELY = 'indefinitely'

const hasKey = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key)

// review r1 #1: a schedule is a list of days, but it can arrive as its JSON text: the SDK stringifies the draft IN PLACE while it saves
// (Ordering.js:355-358) and an API answer may carry the text. K/Schedule would split a text into one row per character, so the section
// only ever hands it a list (or nothing: the default week). Anything that is not a week reads as none.
const scheduleOf = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return undefined
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch (error) {
    return undefined
  }
}

// The week K/Schedule fills in when there is none: seven open days, 00:00–23:59
const isDefaultWeek = (schedule) => Array.isArray(schedule) && schedule.length === 7 && schedule.every(day =>
  day?.enabled && day.lapses?.length === 1 &&
  day.lapses[0].open?.hour === 0 && day.lapses[0].open?.minute === 0 &&
  day.lapses[0].close?.hour === 23 && day.lapses[0].close?.minute === 59)

// The API answers a list of messages, one text, or nothing; a request that threw leaves `{ error: true, result: <message> }`.
// A good save leaves the saved user (an object without `error`), and nothing has been saved yet while `error` is false.
const errorLines = (result) => {
  const raw = result?.error ? result.result : result
  const list = (Array.isArray(raw) ? raw.flat() : [raw]).filter(message => typeof message === 'string' && message.trim())
  return [...new Set(list)]
}
const failed = (result) => Boolean(result?.error) || Array.isArray(result) || (typeof result === 'string' && result.trim() !== '')

/**
 * The UI of the section. Props from the controller: `formState` (`loading`, `changes`, `result`), `handleChangeItem(changes)`,
 * `handleRemoveKey(key)` and `handleUpdateClick()`; from the host: `user` and `onDirtyChange(boolean)`.
 */
export const ProfessionalScheduleSectionUI = ({
  user,
  formState,
  handleChangeItem,
  handleRemoveKey,
  handleUpdateClick,
  onDirtyChange
}) => {
  const [, t] = useLanguage()
  const ids = { range: useId(), hint: useId(), schedule: useId() }

  const stored = typeof user?.max_days_in_future === 'number' ? user.max_days_in_future : null
  // As main (ProfessionalSchedule:43-45): a number means «days», anything else «indefinitely»
  const [mode, setMode] = useState(stored !== null ? DAYS : INDEFINITELY)
  // What the number field shows while «days» is chosen. It keeps its value when the person goes to «Indefinitely» and back.
  const [daysValue, setDaysValue] = useState(stored)

  const changes = formState?.changes ?? {}

  const chooseMode = (next) => {
    if (next === mode) return
    setMode(next)
    if (next === INDEFINITELY) handleChangeItem({ max_days_in_future: null })
    // Back to «days» with a number on the field: the draft follows what the field shows. With no number there is nothing to say yet.
    else if (daysValue !== null) handleChangeItem({ max_days_in_future: daysValue })
  }

  const changeDays = (next) => {
    if (next === null || next === undefined || !Number.isFinite(next)) {
      // An empty field has no whole number to send: the draft goes back to what is stored
      setDaysValue(null)
      handleRemoveKey?.('max_days_in_future')
      return
    }
    const whole = Math.max(0, Math.trunc(next))
    setDaysValue(whole)
    handleChangeItem({ max_days_in_future: whole })
  }

  // Digits only, as main did (`onKeyPress`): any other printable key is dropped before it reaches the field
  const digitsOnly = (event) => {
    if (event.key.length === 1 && !/^[0-9]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault()
  }

  // The editor can hand the schedule over on its own (the first render, a project without one), so «there are changes» is a real
  // difference, not the presence of the key: the days differ from the stored ones, or the schedule's JSON does.
  const daysChanged = hasKey(changes, 'max_days_in_future') && (changes.max_days_in_future ?? null) !== (user?.max_days_in_future ?? null)
  // live check: with no stored schedule (`null`) the editor fills in main's default week on mount (K/Schedule). That fill is no draft
  // (closing the record must not ask to discard it), but Save stays available to store the week on screen, as main's Save was.
  // memoized: a text parsed on every render would hand the editor a new list each time
  const storedSchedule = useMemo(() => scheduleOf(user?.schedule), [user?.schedule])
  const rawDraft = hasKey(changes, 'schedule') ? changes.schedule : undefined
  const draftSchedule = useMemo(() => scheduleOf(rawDraft), [rawDraft])
  const autoFilled = storedSchedule === undefined && isDefaultWeek(draftSchedule)
  const scheduleChanged = hasKey(changes, 'schedule') && !autoFilled && JSON.stringify(draftSchedule) !== JSON.stringify(storedSchedule)
  const dirty = daysChanged || scheduleChanged
  const canSave = dirty || autoFilled

  const lastDirty = useRef(false)
  const latestReport = useRef(onDirtyChange)
  latestReport.current = onDirtyChange
  useEffect(() => {
    if (dirty === lastDirty.current) return
    lastDirty.current = dirty
    latestReport.current?.(dirty)
  }, [dirty])
  useEffect(() => () => {
    if (lastDirty.current) latestReport.current?.(false)
  }, [])

  // ---- a save that failed -----------------------------------------------------------------------------------------------------
  // The dialog is about one answer: closing it remembers THAT answer, a new failed save opens it again.
  const result = formState?.result
  const [closedResult, setClosedResult] = useState(null)
  const errorOpen = failed(result) && result !== closedResult
  const fallback = t('PROFESSIONALS_SCHEDULE_SAVE_ERROR', "We couldn't save the schedule. Try again.")
  const lines = errorLines(result)

  return (
    <div className='psc-root'>
      <section className='psc-block' aria-labelledby={ids.range}>
        <h3 id={ids.range} className='psc-title'>{t('DATE_RANGE', 'Date range')}</h3>
        <p id={ids.hint} className='psc-hint'>{t('CUSTOMERS_CAN_SCHEDULE', 'Customers can schedule...')}</p>
        <RadioGroup
          hideLabel
          label={t('DATE_RANGE', 'Date range')}
          aria-describedby={ids.hint}
          value={mode}
          onValueChange={chooseMode}
          options={[
            { value: INDEFINITELY, label: t('INDEFINITELY_INTO_THE_FUTURE', 'Indefinitely into the future') },
            { value: DAYS, label: t('DAYS_INTO_THE_FUTURE', 'days into the future') }
          ]}
        />
        {/* A radio is a button and cannot hold a field, so the number sits right under the «days» option, which is the last one */}
        <div className='psc-days'>
          <NumberField
            fieldClassName='psc-days-field'
            aria-label={t('DAYS_INTO_THE_FUTURE', 'days into the future')}
            min={0}
            step={1}
            format={{ maximumFractionDigits: 0, useGrouping: false }}
            inputMode='numeric'
            placeholder='00'
            disabled={mode !== DAYS}
            value={mode === DAYS ? daysValue : null}
            onChange={changeDays}
            onKeyDown={digitsOnly}
          />
        </div>
      </section>

      <section className='psc-block' aria-labelledby={ids.schedule}>
        <h3 id={ids.schedule} className='psc-title'>{t('SCHEDULE', 'Schedule')}</h3>
        <ScheduleEditor
          key={user?.id}
          // The editor only hands the schedule over when it differs from the list it was given: with the draft as the list, going back
          // to the stored week is handed over too, so the draft clears itself
          scheduleList={draftSchedule ?? storedSchedule}
          handleChangeScheduleState={(schedule) => handleChangeItem({ schedule })}
          labels={getScheduleLabels(t)}
        />
      </section>

      <div className='psc-actions'>
        <Button variant='primary' busy={!!formState?.loading} disabled={!canSave} onClick={() => handleUpdateClick()}>
          {t('SAVE', 'Save')}
        </Button>
      </div>

      <AlertDialog
        open={errorOpen}
        title={t('PROFESSIONALS_SCHEDULE_SAVE_ERROR_TITLE', "The schedule wasn't saved")}
        content={lines.length ? lines : [fallback]}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        onClose={() => setClosedResult(result)}
      />
    </div>
  )
}

/**
 * The Schedule section of a professional: mounts K/ProfessionalSchedule with `ProfessionalScheduleSectionUI`. `user` is the record
 * (its `schedule` and `max_days_in_future`), `handleSuccessUpdate(result)` is called by the controller after a good save, and
 * `onDirtyChange(boolean)` tells the host whether there are unsaved changes. One controller per professional (`key`).
 */
export const ProfessionalScheduleSection = ({ user, handleSuccessUpdate, onDirtyChange }) => (
  <ProfessionalScheduleController
    key={user?.id}
    user={user}
    handleSuccessUpdate={handleSuccessUpdate}
    onDirtyChange={onDirtyChange}
    UIComponent={ProfessionalScheduleSectionUI}
  />
)
