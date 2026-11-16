import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { SaveBar, TimeField, useLeaveGuard } from '../../Shared/Product'
import {
  BusinessCateringDelivery,
  CATERING_FIELDS,
  CATERING_TYPES,
  cateringDraftKey,
  findCateringConfig,
  readCateringSegment,
  withCateringSegments
} from '../BusinessCateringDelivery'
import './preorder.css'

// redesign stores 5.4 · Preorders and lead times as ONE form (decision 4 of Tiendas): the pre order time and the
// catering segments of two order types are edited in a local `draft` and written on «Save», not on every keystroke.
//  - `preorder_time` (minutes) is a field of the business: one POST with only that change.
//  - The five configs hold every order type in one string; Save writes ONE call per config that has a changed segment, built
//    from the saved string of that config, so the segments of the other order types stay exactly as they are.
// The draft keys are `preorder_time` and `<type>:<config key>`; a key whose value equals the saved one is not a change.

const SAVED_NOTICE_MS = 2500

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

const failed = (result) => result === false || (result != null && typeof result === 'object' && result.ok === false)

const without = (draft, keys) => {
  const next = { ...draft }
  keys.forEach(key => { delete next[key] })
  return next
}

// After the errors are drawn (next frame), the first control marked invalid takes the focus and scrolls into view.
const focusFirstInvalid = (rootRef) => {
  requestAnimationFrame(() => {
    // centred, not just reached: at the bottom edge the sticky SaveBar covers it
    const field = rootRef.current?.querySelector('[aria-invalid="true"]')
    field?.focus({ preventScroll: true })
    field?.scrollIntoView?.({ block: 'center' })
  })
}

const savedTimeOf = (business) => (Number(business?.preorder_time) > 0 ? Math.floor(Number(business.preorder_time)) : 0)

// The fields whose draft differs from the saved value; a config that does not exist cannot change.
const collectChanges = (draft, business) => {
  const catering = []
  CATERING_TYPES.forEach(type => {
    CATERING_FIELDS.forEach(field => {
      const draftKey = cateringDraftKey(type, field.key)
      const config = findCateringConfig(business?.configs, field.key)
      if (config && draftKey in draft && draft[draftKey] !== readCateringSegment(config, type)) {
        catering.push({ draftKey, type, field, value: draft[draftKey] })
      }
    })
  })
  return { timeChanged: 'preorder_time' in draft && draft.preorder_time !== savedTimeOf(business), catering }
}

export const BusinessPreorderDetails = (props) => {
  const {
    business,
    handleUpdateBusinessClick,
    handleUpdatePreorderConfigs
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
  latest.current = { business, handleUpdateBusinessClick, handleUpdatePreorderConfigs, draft }

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

  const savedTime = savedTimeOf(business)
  const { timeChanged, catering } = collectChanges(draft, business)
  const fieldName = (field, type) => {
    const typeLabel = type === 'catering_delivery' ? t('CATERING_DELIVERY', 'Catering delivery') : t('CATERING_PICKUP', 'Catering pickup')
    return `${t(field.labelKey, field.label)} · ${typeLabel}`
  }
  const names = [
    ...(timeChanged ? [t('PREORDER_TIME', 'Pre order time')] : []),
    ...catering.map(item => fieldName(item.field, item.type))
  ]
  const count = names.length

  const handleDraft = (draftKey, value) => {
    setDraft(current => ({ ...current, [draftKey]: value }))
    setErrors(current => (draftKey in current ? without(current, [draftKey]) : current))
  }

  const discard = () => {
    setDraft({})
    setErrors({})
    setErrorText(null)
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    const { draft: current, business: currentBusiness } = latest.current

    const { timeChanged, catering } = collectChanges(current, currentBusiness)

    // Validate first: nothing is sent while a field is wrong
    const invalid = {}
    catering.forEach(({ draftKey, value }) => {
      if (!(Number.isInteger(value) && value >= 0)) invalid[draftKey] = t('STORE_FIELD_WHOLE_NUMBER', 'Enter a whole number, 0 or more.')
    })
    setErrors(invalid)
    setErrorText(null)
    if (Object.keys(invalid).length > 0) {
      // review 5.4: the field may be off screen (Save is in the sticky bar): the focus goes to the first one that is wrong
      focusFirstInvalid(formRef)
      return { ok: false }
    }

    savingRef.current = true
    setSaving(true)
    setSaved(false)
    let outcome = { ok: true }
    try {
      if (timeChanged) {
        const result = await latest.current.handleUpdateBusinessClick({ preorder_time: current.preorder_time }, { keepPendingChanges: true })
        if (failed(result)) {
          outcome = { ok: false, error: result?.error }
        } else if (mounted.current) {
          setDraft(now => without(now, ['preorder_time']))
        }
      }

      // One call per config, in series; the first to fail stops the rest and what is left stays in the draft
      const configKeys = CATERING_FIELDS.map(field => field.key).filter(key => catering.some(item => item.field.key === key))
      for (const key of configKeys) {
        if (!outcome.ok) break
        const items = catering.filter(item => item.field.key === key)
        const config = findCateringConfig(latest.current.business?.configs, key)
        const segments = {}
        items.forEach(item => { segments[item.type] = item.value })
        const result = await latest.current.handleUpdatePreorderConfigs(withCateringSegments(config, segments), config.id, { inlineError: true })
        if (failed(result)) {
          outcome = { ok: false, error: result?.error }
        } else if (mounted.current) {
          setDraft(now => without(now, items.map(item => item.draftKey)))
        }
      }
    } catch (error) {
      outcome = { ok: false, error }
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

  const timeValue = 'preorder_time' in draft ? draft.preorder_time : savedTime

  return (
    <form ref={formRef} className='odc-store-preorder' tabIndex={-1} noValidate onSubmit={event => event.preventDefault()}>
      <h1 className='odc-store-preorder-title'>{t('PREORDERS_SETTING', 'Preorders and lead times')}</h1>
      <TimeField
        mode='duration'
        valueFormat='minutes'
        label={t('PREORDER_TIME', 'Pre order time')}
        hint={t('PREORDER_TIME_DESC', 'The anticipation time before activating the pre order')}
        hourLabel={t('HOURS', 'Hours')}
        minuteLabel={t('MINUTES', 'Minutes')}
        hoursUnit={t('UNIT_HOURS_SHORT', 'h')}
        minutesUnit={t('UNIT_MINUTES_SHORT', 'min')}
        disabled={saving}
        value={timeValue}
        onChange={minutes => handleDraft('preorder_time', minutes)}
      />
      {CATERING_TYPES.map(type => (
        <BusinessCateringDelivery
          key={type}
          type={type}
          business={business}
          draft={draft}
          errors={errors}
          disabled={saving}
          onChange={handleDraft}
          onUseDefault={handleDraft}
        />
      ))}
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
