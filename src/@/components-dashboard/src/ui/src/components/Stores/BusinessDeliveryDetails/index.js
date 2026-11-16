import React, { useEffect, useRef, useState } from 'react'
import {
  useLanguage,
  BusinessDeliveryDetails as BusinessDeliveryDetailsController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { BusinessDeliveryZoneList } from '../BusinessDeliveryZoneList'
import { DeliveryZonesSplit } from '../BusinessDeliveryZoneList/DeliveryZonesSplit'
import { Field, NumberField, SaveBar, TimeField, useLeaveGuard } from '../../Shared/Product'
import './delivery-details.css'

// redesign stores 5.7 · Delivery of «Delivery, pickup & more» as ONE form (decision 4 of Tiendas): the delivery time,
// the expiry minutes and the default priority are edited in a local `draft`, and the zones' enables in the controller's pending
// map; «Save» writes both (the controller saves every pending zone, then the changed fields), not every click.
// The draft keys are the business fields: `delivery_time` ("H:M", unpadded, as TimeField emits it and as main saved it),
// `cancel_order_after_minutes` (a number or null) and `order_default_priority` (the option's text, '2' '1' '0' '-1').
// A key whose value equals the saved one is not a change.

const SAVED_NOTICE_MS = 2500

const PRIORITIES = [
  { value: '2', key: 'URGENT', label: 'Urgent' },
  { value: '1', key: 'HIGH', label: 'High' },
  { value: '0', key: 'NORMAL', label: 'Normal' },
  { value: '-1', key: 'LOW', label: 'Low' }
]

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

// "02:00", "2:0" and "2:00:30" read as hours and minutes; garbage reads as 0:0 (as TimeField does)
const readHM = (value) => {
  const [hour, minute] = String(value ?? '').split(':').map(part => parseInt(part, 10))
  return { hour: Number.isFinite(hour) && hour >= 0 ? hour : 0, minute: Number.isFinite(minute) && minute >= 0 ? minute : 0 }
}

const savedExpireOf = (business) => {
  const value = business?.cancel_order_after_minutes
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const savedPriorityOf = (business) => (business?.order_default_priority == null ? '' : String(business.order_default_priority))

// What the API gets, in the format main sent: «Expire order after minutes» was the raw text of an input (an empty field
// clears it), so the number goes as a string and empty as '' (review 5.7 #2, #3)
const toPayload = (changes) => {
  const payload = { ...changes }
  if ('cancel_order_after_minutes' in payload) {
    const value = payload.cancel_order_after_minutes
    payload.cancel_order_after_minutes = value == null ? '' : String(value)
  }
  return payload
}

const SAVED = {
  delivery_time: business => business?.delivery_time,
  cancel_order_after_minutes: savedExpireOf,
  order_default_priority: savedPriorityOf
}

const isChanged = (key, value, business) => {
  if (key === 'delivery_time') {
    const draft = readHM(value)
    const saved = readHM(business?.delivery_time)
    return draft.hour !== saved.hour || draft.minute !== saved.minute
  }
  return value !== SAVED[key](business)
}

// The fields whose draft differs from the saved value, as the object to send
const collectChanges = (draft, business) => {
  const changes = {}
  Object.keys(draft).forEach(key => {
    if (key in SAVED && isChanged(key, draft[key], business)) changes[key] = draft[key]
  })
  return changes
}

const BusinessDeliveryDetailsUI = (props) => {
  const {
    business,
    setIsExtendExtraOpen,
    handleUpdateBusinessState,
    actionState,
    zoneListState,
    pendingZones,
    saveDelivery,
    discardZones,
    handleChangeZoneState,
    handleChangeAllZoneState
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
  latest.current = { business, draft, saveDelivery, discardZones }

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

  const labels = {
    delivery_time: t('DELIVERY_TIME', 'Delivery time'),
    cancel_order_after_minutes: t('EXPIRE_ORDER_AFTER_MINUTES', 'Expire order after minutes'),
    order_default_priority: t('ORDER_DEFAULT_PRIORITY', 'Order default priority')
  }
  const changes = collectChanges(draft, business)
  const zoneNames = pendingZones.map(zone => zone.name || String(zone.id))
  const names = [...Object.keys(changes).map(key => labels[key]), ...zoneNames]
  const count = names.length

  const handleDraft = (key, value) => {
    setDraft(current => ({ ...current, [key]: value }))
    setErrors(current => (key in current ? without(current, [key]) : current))
  }

  const discard = () => {
    setDraft({})
    setErrors({})
    setErrorText(null)
    latest.current.discardZones()
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    const { draft: current, business: currentBusiness } = latest.current
    const toSend = collectChanges(current, currentBusiness)

    // Validate first: nothing is sent while a field is wrong
    const invalid = {}
    if ('cancel_order_after_minutes' in toSend) {
      const value = toSend.cancel_order_after_minutes
      // empty is allowed, as in main (it clears the setting)
      if (value != null && !(Number.isInteger(value) && value >= 0)) invalid.cancel_order_after_minutes = t('STORE_FIELD_WHOLE_NUMBER', 'Enter a whole number, 0 or more.')
    }
    setErrors(invalid)
    setErrorText(null)
    if (Object.keys(invalid).length > 0) {
      // the field may be off screen (Save is in the sticky bar): the focus goes to the first one that is wrong
      focusFirstInvalid(formRef)
      return { ok: false }
    }

    savingRef.current = true
    setSaving(true)
    setSaved(false)
    let outcome
    try {
      const result = await latest.current.saveDelivery(toPayload(toSend))
      outcome = failed(result) ? result : { ok: true }
    } catch (error) {
      outcome = { ok: false, error: error?.message ?? '', failedZones: [] }
    }
    savingRef.current = false
    if (mounted.current) {
      setSaving(false)
      const fieldsFailed = typeof outcome.error === 'string'
      // review 5.7 #1: the fields that were stored leave the draft, unless they changed again while saving; the failed ones
      // and the failed zones stay
      if (!fieldsFailed) {
        setDraft(now => {
          const next = { ...now }
          Object.keys(toSend).forEach(key => { if (next[key] === toSend[key]) delete next[key] })
          return next
        })
      }
      if (outcome.ok) {
        setSaved(true)
      } else {
        const failedZones = outcome.failedZones || []
        const parts = []
        if (failedZones.length) {
          parts.push(t('STORE_ZONES_SAVE_FAILED', "These zones weren't saved: _names_.").replace('_names_', failedZones.map(zone => zone.name || String(zone.id)).join(', ')))
        }
        if (fieldsFailed) {
          // review 5.7 #4: say which changes did not go, not only the API text
          parts.push(t('STORE_FIELDS_SAVE_FAILED', "These changes weren't saved: _names_.").replace('_names_', Object.keys(toSend).map(key => labels[key]).join(', ')))
        }
        if (fieldsFailed || !failedZones.length) {
          parts.push(translateApiMessage(t, outcome.error || null, t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
        }
        setErrorText(parts.join(' '))
      }
    }
    return outcome
  }

  useLeaveGuard({ dirty: count > 0, count, save, discard })

  const timeValue = 'delivery_time' in draft ? draft.delivery_time : business?.delivery_time
  const expireValue = 'cancel_order_after_minutes' in draft ? draft.cancel_order_after_minutes : savedExpireOf(business)
  const priorityValue = 'order_default_priority' in draft ? draft.order_default_priority : savedPriorityOf(business)
  const knownPriority = PRIORITIES.some(priority => priority.value === priorityValue)
  const zonesLoadFailed = Array.isArray(actionState?.error) && actionState.error.length > 0

  // redesign stores 5.8: the tab is the list of a P/SectionSplit and the open zone its detail (no nested form)
  return (
    <DeliveryZonesSplit business={business} setIsExtendExtraOpen={setIsExtendExtraOpen} handleSuccessUpdate={handleUpdateBusinessState}>
      <form ref={formRef} className='odc-store-delivery' tabIndex={-1} noValidate onSubmit={event => event.preventDefault()}>
        <section className='odc-store-delivery-block'>
          <h2 className='odc-store-delivery-section'>{t('PREORDER_STEP_2_TIME', 'Order time')}</h2>
          <TimeField
            mode='duration'
            label={labels.delivery_time}
            hourLabel={t('HOURS', 'Hours')}
            minuteLabel={t('MINUTES', 'Minutes')}
            hoursUnit={t('UNIT_HOURS_SHORT', 'h')}
            minutesUnit={t('UNIT_MINUTES_SHORT', 'min')}
            disabled={saving}
            value={timeValue}
            onChange={next => handleDraft('delivery_time', next)}
          />
        </section>
        {zonesLoadFailed && (
          <p className='odc-store-delivery-notice' role='alert'>
            {translateApiMessage(t, actionState.error[0], t('STORE_ZONES_LOAD_FAILED', "We couldn't load the delivery zones."))}
          </p>
        )}
        <BusinessDeliveryZoneList
          business={business}
          setIsExtendExtraOpen={setIsExtendExtraOpen}
          onClose={() => setIsExtendExtraOpen(false)}
          handleSuccessUpdate={handleUpdateBusinessState}
          zoneListState={zoneListState}
          handleChangeZoneState={handleChangeZoneState}
          handleChangeAllZoneState={handleChangeAllZoneState}
        />
        <section className='odc-store-delivery-block'>
          <h2 className='odc-store-delivery-section'>{t('LOGISTIC', 'Logistic')}</h2>
          <div className='odc-store-delivery-logistic'>
            <NumberField
              label={labels.cancel_order_after_minutes}
              error={errors.cancel_order_after_minutes}
              value={expireValue}
              min={0}
              step={1}
              // minutes read as main showed them: 1440, not 1,440 (review 5.7 #5)
              format={{ useGrouping: false }}
              disabled={saving}
              onChange={next => handleDraft('cancel_order_after_minutes', next)}
            />
            <Field label={labels.order_default_priority} disabled={saving}>
              <select
                name='order_default_priority'
                className='odc-field-input'
                // Field does not disable a native select: a change made while saving would be dropped (review 5.7 #1)
                disabled={saving}
                value={priorityValue}
                onChange={event => handleDraft('order_default_priority', event.target.value)}
              >
                {!knownPriority && <option value=''>{t('SELECT_PRIORITY', 'Select priority')}</option>}
                {PRIORITIES.map(priority => <option key={priority.value} value={priority.value}>{t(priority.key, priority.label)}</option>)}
              </select>
            </Field>
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
    </DeliveryZonesSplit>
  )
}

export const BusinessDeliveryDetails = (props) => {
  const businessDeliveryProps = {
    ...props,
    UIComponent: BusinessDeliveryDetailsUI
  }
  return <BusinessDeliveryDetailsController {...businessDeliveryProps} />
}
