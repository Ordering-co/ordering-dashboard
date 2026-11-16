import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '~components'
import { parseJsonObject } from '../../../../../utils/safeJsonParse'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { AsyncSwitch, NumberField, SaveBar, Switch, useLeaveGuard } from '../../Shared/Product'
import './reservations.css'

// redesign stores 5.4 (decisions S4 and S5)
// The master switch («Do you offer table reservation?») saves at once and is controlled by the stored value (P/AsyncSwitch). The
// rest is a form: the five whole numbers and the pre-order switch go to a local `draft` and are saved together by the P/SaveBar.
// `reservation_setting` also holds keys this screen does not show (`max_reservation_sites`): they are kept when it is saved.

const SAVED_MS = 2500
const NUMBER_KEYS = [
  'min_guests_reservation',
  'max_guests_reservation',
  'min_time_reserve_minutes',
  'max_time_reserve_days',
  'late_arrival_hold_minutes'
]
const PREORDER_KEY = 'allow_preorder_reservation'
const VISIBLE_KEYS = [...NUMBER_KEYS, PREORDER_KEY]
const MINUTES_PER_DAY = 1440

// a stored number (the API may keep it as text) or null when it is not one
const toWhole = (value) => {
  const number = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isFinite(number) ? Math.trunc(number) : null
}

const toBool = (value) => value === true || value === 1 || value === '1' || value === 'true'

const isWhole = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0

// the first message of what the controller answers (a string, `{ message }`, or a list of either), or null
const firstMessage = (error) => {
  const item = Array.isArray(error) ? error[0] : error
  const message = typeof item === 'string' ? item : item?.message
  return typeof message === 'string' && message.trim() ? message : null
}

// a question in any of the dashboard's languages ends in «?», Arabic «؟» or Greek «;» (U+003B or U+037E)
const withQuestionMark = (text) => /[?؟;;]\s*$/.test(String(text)) ? text : `${text}?`

export const BusinessReservations = (props) => {
  const { handleUpdateBusinessConfigs, business } = props
  const [, t] = useLanguage()

  const [draft, setDraft] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  const [errorText, setErrorText] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const mounted = useRef(true)
  const savingRef = useRef(false)
  const savedTimer = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  const enabledConfig = business?.configs?.find(config => config.key === 'reservation_enabled')
  const settingConfig = business?.configs?.find(config => config.key === 'reservation_setting')
  const enabled = enabledConfig?.value === '1'
  const stored = parseJsonObject(settingConfig?.value)

  const labels = {
    min_guests_reservation: t('MINIMUM_GUESTS', 'Minimum guests'),
    max_guests_reservation: t('MAXIMUM_GUESTS', 'Maximum guests'),
    min_time_reserve_minutes: `${t('MINIMUM_TIME_IN_ADVANCE', 'Minimum time in advance')} (${t('MINUTES', 'Minutes')})`,
    max_time_reserve_days: `${t('MAXIMUM_TIME_IN_ADVANCE', 'Maximum time in advance')} (${t('DAYS', 'Days')})`,
    late_arrival_hold_minutes: `${t('WHEN_GUEST_LATE_HOLD_TABLE', 'When guest are late, hold table for')} (${t('MINUTES', 'Minutes')})`,
    [PREORDER_KEY]: t('ALLOW_GUEST_PREORDER_BOOKING_TABLE', 'Allow guests to pre-order their food when booking a table')
  }
  const placeholders = {
    min_guests_reservation: t('0_PERSON', '0 PERSON'),
    max_guests_reservation: t('0_PERSON', '0 PERSON'),
    min_time_reserve_minutes: t('0_MIN', '0 min'),
    max_time_reserve_days: t('0_DAYS', '0 days'),
    late_arrival_hold_minutes: t('0_MIN', '0 min')
  }

  // what the field shows: the draft, else the stored value (null: empty)
  const storedValue = (key) => (key === PREORDER_KEY ? toBool(stored[key]) : toWhole(stored[key]))
  const valueOf = (key) => (draft[key] !== undefined ? draft[key] : storedValue(key))

  // Changes that are hidden with the fields (reservations off) are not offered to save.
  const changedKeys = enabled ? VISIBLE_KEYS.filter(key => draft[key] !== undefined && draft[key] !== storedValue(key)) : []
  const count = changedKeys.length

  const setField = (key, value) => {
    setDraft(current => ({ ...current, [key]: value }))
    setFieldErrors(current => {
      if (!current[key]) return current
      const { [key]: _gone, ...rest } = current // eslint-disable-line no-unused-vars
      return rest
    })
    setSaved(false)
  }

  // The same texts and rules as before, under the field that causes each one.
  const validate = () => {
    const errors = {}
    const wholeNumberText = t('STORE_FIELD_WHOLE_NUMBER', 'Enter a whole number, 0 or more.')
    // a figure that was never stored counts as 0, as it does when it is saved
    const effective = {}
    NUMBER_KEYS.forEach(key => {
      const value = valueOf(key)
      if (draft[key] !== undefined && !isWhole(value)) errors[key] = wholeNumberText
      effective[key] = value === null ? 0 : value
    })
    if (!errors.min_guests_reservation) {
      if (effective.min_guests_reservation === 0) {
        errors.min_guests_reservation = t('GUESTS_ZERO_ERROR', 'Minimum guests cannot be zero')
      } else if (!errors.max_guests_reservation && effective.min_guests_reservation > effective.max_guests_reservation) {
        errors.min_guests_reservation = t('MINIMUM_GUESTS_ERROR', 'Minimum guests cannot be higher than maximum guests')
      }
    }
    if (!errors.max_time_reserve_days) {
      if (effective.max_time_reserve_days === 0) {
        errors.max_time_reserve_days = t('MAX_RESERVE_DAYS_ZERO', 'Max reserve days cannot be zero')
      } else if (!errors.min_time_reserve_minutes && effective.max_time_reserve_days * MINUTES_PER_DAY < effective.min_time_reserve_minutes) {
        errors.max_time_reserve_days = t('MAX_RESERVE_DAYS_ERROR', 'Max reserve days cannot be lower than min time reserve')
      }
    }
    return errors
  }

  const buildValue = () => {
    const value = { ...stored }
    const fill = Object.keys(stored).length === 0
    NUMBER_KEYS.forEach(key => {
      if (draft[key] !== undefined) value[key] = draft[key]
      else if (key in stored) value[key] = toWhole(stored[key]) ?? 0
      else if (fill) value[key] = 0
    })
    if (draft[PREORDER_KEY] !== undefined) value[PREORDER_KEY] = draft[PREORDER_KEY]
    else if (PREORDER_KEY in stored) value[PREORDER_KEY] = toBool(stored[PREORDER_KEY])
    else if (fill) value[PREORDER_KEY] = false
    return value
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorText(null)
      // review 5.4: the field may be off screen (Save is in the sticky bar): the focus goes to the first one that is wrong
      requestAnimationFrame(() => {
        // centred, not just reached: at the bottom edge the sticky SaveBar covers it
        const field = rootRef.current?.querySelector('[aria-invalid="true"]')
        field?.focus({ preventScroll: true })
        field?.scrollIntoView?.({ block: 'center' })
      })
      return { ok: false }
    }
    setFieldErrors({})
    savingRef.current = true
    setSaving(true)
    setErrorText(null)
    setSaved(false)
    let result
    try {
      result = await handleUpdateBusinessConfigs(JSON.stringify(buildValue()), settingConfig?.id, { inlineError: true })
    } catch (error) {
      result = { ok: false, error }
    }
    savingRef.current = false
    const failed = result === false || result?.ok === false
    if (!mounted.current) return failed ? { ok: false, error: result?.error } : { ok: true }
    setSaving(false)
    if (failed) {
      setErrorText(translateApiMessage(t, firstMessage(result?.error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
      return { ok: false, error: result?.error }
    }
    setDraft({})
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => {
      if (mounted.current) setSaved(false)
    }, SAVED_MS)
    return { ok: true }
  }

  const discard = () => {
    setDraft({})
    setFieldErrors({})
    setErrorText(null)
  }

  // review 5.4: reservations turned off hide the form; what was typed there and not saved goes too, instead of coming back as
  // pending when they are turned on again
  useEffect(() => {
    if (!enabled) discard()
  }, [enabled])

  useLeaveGuard({ dirty: count > 0, count, save, discard })

  const numberField = (key) => (
    <NumberField
      key={key}
      name={key}
      label={labels[key]}
      placeholder={placeholders[key]}
      min={0}
      step={1}
      value={valueOf(key)}
      error={fieldErrors[key]}
      onChange={value => setField(key, value)}
    />
  )

  return (
    <div ref={rootRef} className='odc-store-reservations'>
      <h1 className='odc-store-reservations-title'>{t('RESERVATIONS', 'Reservations')}</h1>
      <div className={enabled ? 'odc-store-reservations-master' : undefined}>
        <AsyncSwitch
          checked={enabled}
          onToggle={next => handleUpdateBusinessConfigs(next ? '1' : '0', enabledConfig?.id, { inlineError: true })}
          failureText={t('STORE_RESERVATIONS_TOGGLE_FAILED', "We couldn't change table reservations.")}
        >
          {/* tanda P: es, de, it, nl and tr already ended in «?» («…an??»); the catalog now has it everywhere, but a
              live dictionary may not until it is synced, so it is added only when the text has no question mark of its own */}
          {withQuestionMark(t('DO_YOU_OFFER_TABLE_RESERVATION', 'Do you offer table reservation?'))}
        </AsyncSwitch>
      </div>
      {enabled && (
        <div className='odc-store-reservations-form'>
          {NUMBER_KEYS.map(numberField)}
          <div className='odc-store-reservations-preorder'>
            <Switch
              checked={valueOf(PREORDER_KEY)}
              onCheckedChange={checked => setField(PREORDER_KEY, checked)}
            >
              {labels[PREORDER_KEY]}
            </Switch>
          </div>
        </div>
      )}
      {/* The bar is named after the section (as the removed «Reservations» alert was): the catalog keeps the plural of this key,
          which the order-type filter also uses in the singular. */}
      <SaveBar
        label={t('RESERVATIONS', 'Reservations')}
        count={count}
        countText={(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)}
        names={changedKeys.map(key => labels[key])}
        moreText={n => t('SETTINGS_UNSAVED_MORE', '+_count_').replace('_count_', n)}
        saving={saving}
        errorText={errorText}
        onRetry={save}
        retryLabel={t('RETRY', 'Retry')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE', 'Save')}
        onDiscard={discard}
        onSave={save}
      />
    </div>
  )
}
