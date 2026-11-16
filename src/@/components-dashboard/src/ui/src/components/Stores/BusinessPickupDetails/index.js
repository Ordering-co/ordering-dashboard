import React, { useEffect, useRef, useState } from 'react'
import {
  useLanguage,
  BusinessPickupDetails as BusinessPickupDetailsController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { NumberField, SaveBar, TimeField, useLeaveGuard } from '../../Shared/Product'
import './pickup-details.css'

// redesign stores 5.7 · Pickup as ONE form (decision 4 of Tiendas): the pickup time and the minimum purchase are edited
// in a local `draft` and written on «Save», with the save bar naming what changed and the leave guard asking before the user goes.
//  - `pickup_time` is the string "H:M", UNPADDED ("0:20"), as the field emits it and as main saved it.
//  - `minimum` is a number, 0 or more; empty or negative is an error under the field and nothing is sent.
// Save sends only the keys that changed, in one call. A draft key whose value equals the saved one is not a change.

const SAVED_NOTICE_MS = 2500

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

// "02:05", "2:5" and "2:05" are the same time; anything else reads as 0:0 (as the field does)
const normalizeTime = (value) => {
  const [hour, minute] = String(value ?? '').split(':').map(part => parseInt(part, 10))
  const whole = number => (Number.isFinite(number) && number >= 0 ? number : 0)
  return `${whole(hour)}:${whole(minute)}`
}

// the saved minimum as a number, or null when the business has none
const savedMinimumOf = (business) => {
  const minimum = business?.minimum
  if (minimum == null || minimum === '') return null
  const number = Number(minimum)
  return Number.isFinite(number) ? number : null
}

// The keys whose draft differs from the saved value.
const collectChanges = (draft, business) => ({
  pickupChanged: 'pickup_time' in draft && normalizeTime(draft.pickup_time) !== normalizeTime(business?.pickup_time),
  minimumChanged: 'minimum' in draft && draft.minimum !== savedMinimumOf(business)
})

const BusinessPickupDetailsUI = (props) => {
  const {
    business,
    savePickup
  } = props

  const [, t] = useLanguage()
  const [draft, setDraft] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const savingRef = useRef(false)
  const mounted = useRef(true)
  const formRef = useRef(null)
  const latest = useRef({})
  latest.current = { business, savePickup, draft }

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

  const { pickupChanged, minimumChanged } = collectChanges(draft, business)
  const names = [
    ...(pickupChanged ? [t('ESTIMATED_PICKUP_TIME', 'Pickup Time')] : []),
    ...(minimumChanged ? [t('MINIMUN_PURCHASED', 'Minimum purchase')] : [])
  ]
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
    const { pickupChanged, minimumChanged } = collectChanges(current, currentBusiness)

    // Validate first: nothing is sent while a field is wrong
    const invalid = {}
    // empty is allowed, as in main (the input sent its raw text)
    if (minimumChanged && current.minimum != null && !(typeof current.minimum === 'number' && Number.isFinite(current.minimum) && current.minimum >= 0)) {
      invalid.minimum = t('STORE_FIELD_NUMBER_MIN_ZERO', 'Enter a number, 0 or more.')
    }
    setErrors(invalid)
    setErrorText(null)
    if (Object.keys(invalid).length > 0) {
      focusFirstInvalid(formRef)
      return { ok: false }
    }

    const changes = {}
    if (pickupChanged) changes.pickup_time = current.pickup_time
    // the format main sent: the raw text of the input, '' when empty (review 5.7 #2, #3)
    if (minimumChanged) changes.minimum = current.minimum == null ? '' : String(current.minimum)

    savingRef.current = true
    setSaving(true)
    setSaved(false)
    let outcome
    try {
      const result = await latest.current.savePickup(changes)
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

  const timeValue = 'pickup_time' in draft ? draft.pickup_time : (business?.pickup_time ?? '')
  const minimumValue = 'minimum' in draft ? draft.minimum : savedMinimumOf(business)

  return (
    <form ref={formRef} className='odc-store-pickup' tabIndex={-1} noValidate onSubmit={event => event.preventDefault()}>
      <section className='odc-store-pickup-section'>
        <h2 className='odc-store-pickup-title'>{t('PREORDER_STEP_2_TIME', 'Order time')}</h2>
        <TimeField
          mode='duration'
          label={t('ESTIMATED_PICKUP_TIME', 'Pickup Time')}
          hourLabel={t('HOURS', 'Hours')}
          minuteLabel={t('MINUTES', 'Minutes')}
          hoursUnit={t('UNIT_HOURS_SHORT', 'h')}
          minutesUnit={t('UNIT_MINUTES_SHORT', 'min')}
          disabled={saving}
          value={timeValue}
          onChange={value => handleDraft('pickup_time', value)}
        />
      </section>
      <section className='odc-store-pickup-section'>
        <h2 className='odc-store-pickup-title'>{t('PURCHASE', 'Purchase')}</h2>
        <div className='odc-store-pickup-field'>
          <NumberField
            label={t('MINIMUN_PURCHASED', 'Minimum purchase')}
            error={errors.minimum}
            value={minimumValue}
            min={0}
            format={{ maximumFractionDigits: 6, useGrouping: false }}
            disabled={saving}
            onChange={value => handleDraft('minimum', value)}
          />
        </div>
      </section>
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

export const BusinessPickupDetails = (props) => {
  const pickupDetailsProps = {
    ...props,
    UIComponent: BusinessPickupDetailsUI
  }
  return <BusinessPickupDetailsController {...pickupDetailsProps} />
}
