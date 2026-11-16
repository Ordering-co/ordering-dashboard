import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useUtils, BusinessEta as BusinessEtaController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { NumberField, SaveBar, SegmentedControl, useLeaveGuard } from '../../Shared/Product'
import './eta.css'

// redesign stores 5.7 · Estimated times by order status as ONE form (decision 4 of Tiendas): the 24 statuses of the two
// lists ('status' and 'status_penalty') are edited in a local `draft` and written on «Save». Keys are `<list>:<status index>`.
//  - Switching the list keeps the draft of both.
//  - A key whose value equals the saved one (a missing saved key counts as 0) is not a change.
//  - Save sends the WHOLE object (the saved times merged with the changed ones): main resends every key.
//  - A value that is not a whole number, 0 or more, is an error under its field and nothing is sent.

const SAVED_NOTICE_MS = 2500
const STATUS_COUNT = 24
const INDEXES = Array.from({ length: STATUS_COUNT }, (_, index) => index)
const LISTS = ['status', 'status_penalty']

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

const failed = (result) => result === false || (result != null && typeof result === 'object' && result.ok === false)

// After the errors are drawn (next frame), the first control marked invalid takes the focus and scrolls into view.
const focusFirstInvalid = (rootRef) => {
  requestAnimationFrame(() => {
    // centred, not just reached: at the bottom edge the sticky SaveBar covers it
    const field = rootRef.current?.querySelector('[aria-invalid="true"]')
    field?.focus({ preventScroll: true })
    field?.scrollIntoView?.({ block: 'center' })
  })
}

// the saved times as an object (the API may send it as a JSON string)
const savedTimesOf = (business) => {
  let times = business?.eta_status_times
  if (typeof times === 'string') {
    try { times = JSON.parse(times) } catch (error) { times = null }
  }
  return times != null && typeof times === 'object' && !Array.isArray(times) ? times : {}
}

const savedValueOf = (saved, key) => {
  const number = Number(saved[key] ?? 0)
  return Number.isFinite(number) ? number : 0
}

// The keys whose draft differs from the saved value, in paint order (the first list, then the second).
const changedKeys = (draft, saved) => LISTS.flatMap(list => INDEXES.map(index => `${list}:${index}`))
  .filter(key => key in draft && draft[key] !== savedValueOf(saved, key))

const BusinessEtaUI = (props) => {
  const {
    business,
    saveEta
  } = props

  const [, t] = useLanguage()
  const [{ getOrderState }] = useUtils()
  const [option, setOption] = useState('status')
  const [draft, setDraft] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const savingRef = useRef(false)
  const mounted = useRef(true)
  const formRef = useRef(null)
  const latest = useRef({})
  latest.current = { business, saveEta, draft }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // «Saved» goes away by itself
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const listLabel = (list) => (list === 'status'
    ? t('ESTIMATED_TIMES_BY_STATUS', 'Estimated times by status')
    : t('ESTIMATED_PENALTY_TIMES_BY_STATUS', 'Estimated penalty times by status'))

  const savedTimes = savedTimesOf(business)
  const changed = changedKeys(draft, savedTimes)
  const names = changed.map(key => {
    const [list, index] = key.split(':')
    return `${getOrderState(Number(index))} · ${listLabel(list)}`
  })
  const count = names.length

  const handleDraft = (key, value) => {
    setDraft(current => ({ ...current, [key]: value }))
    setErrors(current => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const discard = () => {
    setDraft({})
    setErrors({})
    setErrorText(null)
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    const { draft: current, business: currentBusiness } = latest.current
    const currentSaved = savedTimesOf(currentBusiness)
    const keys = changedKeys(current, currentSaved)

    // Validate first: nothing is sent while a field is wrong
    const invalid = {}
    keys.forEach(key => {
      if (!(Number.isInteger(current[key]) && current[key] >= 0)) invalid[key] = t('STORE_FIELD_WHOLE_NUMBER', 'Enter a whole number, 0 or more.')
    })
    setErrors(invalid)
    setErrorText(null)
    const firstInvalid = Object.keys(invalid)[0]
    if (firstInvalid) {
      // the field may be in the list that is not on screen: the list changes first so the focus has a field to go to
      setOption(firstInvalid.split(':')[0])
      focusFirstInvalid(formRef)
      return { ok: false }
    }

    const values = { ...currentSaved }
    keys.forEach(key => { values[key] = current[key] })

    savingRef.current = true
    setSaving(true)
    setSaved(false)
    let outcome
    try {
      const result = await latest.current.saveEta(values)
      outcome = failed(result) ? { ok: false, error: result?.error } : { ok: true }
    } catch (error) {
      outcome = { ok: false, error: error?.message }
    }
    savingRef.current = false
    if (mounted.current) {
      setSaving(false)
      if (outcome.ok) {
        setDraft({})
        setSaved(true)
      } else {
        setErrorText(translateApiMessage(t, firstMessage(outcome.error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
      }
    }
    return outcome
  }

  useLeaveGuard({ dirty: count > 0, count, save, discard })

  const options = LISTS.map(list => ({ value: list, label: listLabel(list) }))

  return (
    <form ref={formRef} className='odc-store-eta' tabIndex={-1} noValidate onSubmit={event => event.preventDefault()}>
      <section className='odc-store-eta-section'>
        <h2 className='odc-store-eta-title'>{t('STATUS_TIME', 'Status time')}</h2>
        <SegmentedControl
          label={t('STATUS_TIME', 'Status time')}
          value={option}
          options={options}
          onValueChange={setOption}
        />
      </section>
      <div className='odc-store-eta-grid'>
        {INDEXES.map(index => {
          const key = `${option}:${index}`
          return (
            <NumberField
              key={key}
              label={getOrderState(index)}
              hint={t('MINUTES', 'Minutes')}
              error={errors[key]}
              value={key in draft ? draft[key] : savedValueOf(savedTimes, key)}
              min={0}
              step={1}
              format={{ useGrouping: false }}
              disabled={saving}
              onChange={value => handleDraft(key, value)}
            />
          )
        })}
      </div>
      <SaveBar
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={(count === 1 ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change') : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)}
        names={names}
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
    </form>
  )
}

export const BusinessEta = (props) => {
  const businessEtaProps = {
    ...props,
    UIComponent: BusinessEtaUI
  }
  return <BusinessEtaController {...businessEtaProps} />
}
