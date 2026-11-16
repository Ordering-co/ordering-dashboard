import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { TriangleAlert } from '../../Shared/Icon'
import { Button, Dialog, InlineNotice, NumberField, RadioGroup, TextField } from '../../Shared/Product'
import './business-fees.css'

// redesign stores 5.13 (; S-4, decision 6): a manual charge or credit on the balance of the store, in two steps.
// 1. What it is: Charge | Credit, a name, an amount and the hint of the type; «Continue» checks them and sends nothing.
// 2. The confirmation, with the amount in the question («Charge $10.00 to Fast Bite?») and what it means («It can't be edited; to
//    undo it, add a credit for the same amount»); «Add charge» / «Add credit» sends it. «Back» returns to step 1 with what was written.
// A failure is said in the dialog (the write goes through the controller with `{ inlineError: true }`: no toast, no Alert) and the
// dialog stays open with what was written; a success closes it. The credit goes out negative, as in `main`.

const CHARGE = 'manual_charge'
const CREDIT = 'manual_credit'

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

/**
 * @param {object}   props
 * @param {boolean}  props.open
 * @param {Function} props.onClose
 * @param {Function} props.onSubmit        `({ event_type, name, total_amount }) => Promise<{ error, result }>`.
 * @param {string}   [props.storeName]     Named in the confirmation; without it the text says «this store».
 * @param {string}   [props.currencySymbol='$']
 */
export const ManualEventDialog = ({ open, onClose, onSubmit, storeName, currencySymbol = '$' }) => {
  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const mounted = useRef(true)
  const formId = useId()
  const backRef = useRef(null)
  const continueRef = useRef(null)
  const stepRef = useRef(1)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const [step, setStep] = useState(1)
  const [eventType, setEventType] = useState(CHARGE)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(null)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // it opens empty, on a charge, on step 1
  useEffect(() => {
    if (!open) return
    setStep(1)
    setEventType(CHARGE)
    setName('')
    setAmount(null)
    setAttempted(false)
    setSaving(false)
    setError(null)
  }, [open])

  // The footer buttons of the two steps are different elements (see the `key`s below) and the focus is moved on purpose: on step 2
  // it lands on «Back», the safe option, so a second Enter after «Continue» cannot add the charge without reading the confirmation;
  // returning to step 1 it lands on «Continue». The first render (step 1) keeps the Dialog's own initial focus.
  useEffect(() => {
    if (!open || stepRef.current === step) return
    stepRef.current = step
    const target = step === 2 ? backRef.current : continueRef.current
    target?.focus()
  }, [open, step])
  useEffect(() => {
    if (!open) stepRef.current = 1
  }, [open])

  const isCredit = eventType === CREDIT
  const nameError = attempted && !name.trim() ? t('NAME_IS_REQUIRED', 'Name is required') : undefined
  const amountError = attempted && !(amount > 0) ? t('INVALID_AMOUNT', 'Invalid amount') : undefined

  const close = () => {
    if (!saving) onClose?.()
  }

  const goOn = () => {
    setAttempted(true)
    if (!name.trim() || !(amount > 0)) return
    setError(null)
    setStep(2)
  }

  const confirm = async () => {
    if (saving) return
    setError(null)
    setSaving(true)
    const payload = {
      event_type: eventType,
      name: name.trim(),
      // a credit lowers what the store owes: it goes out negative
      total_amount: isCredit ? -Math.abs(amount) : Math.abs(amount)
    }
    let result
    try {
      result = await onSubmit?.(payload)
    } catch (thrown) {
      result = { error: true, result: [thrown?.message] }
    }
    if (!mounted.current) return
    setSaving(false)
    if (!result || result.error) {
      setError(translateApiMessage(t, firstMessage(result?.result), t('FEE_EVENT_SAVE_FAILED', 'The charge or credit could not be added.')))
      return
    }
    onClose?.()
  }

  const amountText = step === 2 ? parsePrice(Math.abs(amount)) : ''
  const store = storeName || t('THIS_STORE', 'this store')
  const confirmTitle = (isCredit
    ? t('MANUAL_CREDIT_CONFIRM_TITLE', 'Credit _amount_ to _store_?')
    : t('MANUAL_CHARGE_CONFIRM_TITLE', 'Charge _amount_ to _store_?'))
    .replace('_amount_', () => amountText)
    .replace('_store_', () => store)

  const typeOptions = [
    { value: CHARGE, label: t('CHARGE', 'Charge'), description: t('ADD_CHARGE_DESC', 'Add a charge to business') },
    { value: CREDIT, label: t('CREDIT', 'Credit'), description: t('ADD_CREDIT_DESC', 'Add a credit to business') }
  ]

  const stepOne = (
    <form
      id={formId}
      className='odc-bf-dialog-form'
      noValidate
      onSubmit={(event) => { event.preventDefault(); goOn() }}
    >
      <RadioGroup
        label={t('TYPE', 'Type')}
        options={typeOptions}
        value={eventType}
        onValueChange={setEventType}
      />
      <TextField
        label={t('NAME', 'Name')}
        required
        requiredLabel={t('REQUIRED', 'Required')}
        value={name}
        onChange={setName}
        error={nameError}
        placeholder={t('ENTER_EVENT_NAME', 'e.g., Setup fee, Adjustment, Refund...')}
        autoComplete='off'
      />
      <NumberField
        label={`${t('AMOUNT', 'Amount')} (${currencySymbol})`}
        required
        requiredLabel={t('REQUIRED', 'Required')}
        value={amount}
        onChange={(value) => setAmount(value === undefined || Number.isNaN(value) ? null : value)}
        min={0}
        placeholder='0.00'
        error={amountError}
        hint={isCredit
          ? t('CREDIT_HINT', 'This amount will be credited to the business balance')
          : t('CHARGE_HINT', 'This amount will be charged to the business')}
      />
    </form>
  )

  const stepTwo = (
    <div className='odc-bf-dialog-form'>
      <p className='odc-bf-recap' dir='auto'>{name.trim()}</p>
      {error && (
        <InlineNotice tone='danger' icon={TriangleAlert} role='alert' className='odc-bf-dialog-notice'>{error}</InlineNotice>
      )}
    </div>
  )

  const footer = step === 1
    ? (
      <>
        <Button key='cancel' onClick={close}>{t('CANCEL', 'Cancel')}</Button>
        <Button key='continue' ref={continueRef} variant='primary' onClick={goOn}>{t('CONTINUE', 'Continue')}</Button>
      </>
      )
    : (
      <>
        <Button key='back' ref={backRef} disabled={saving} onClick={() => { setError(null); setStep(1) }}>{t('BACK', 'Back')}</Button>
        <Button key='confirm' variant={isCredit ? 'primary' : 'danger'} busy={saving} onClick={confirm}>
          {isCredit ? t('ADD_CREDIT', 'Add credit') : t('ADD_CHARGE', 'Add charge')}
        </Button>
      </>
      )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) close() }}
      title={step === 1 ? t('ADD_CHARGE_OR_CREDIT', 'Add charge or credit') : confirmTitle}
      description={step === 2
        ? (isCredit
            ? t('MANUAL_CREDIT_CONFIRM_BODY', "It's added to the store's balance now. It can't be edited; to undo it, add a charge for the same amount.")
            : t('MANUAL_CHARGE_CONFIRM_BODY', "It's added to the store's balance now. It can't be edited; to undo it, add a credit for the same amount."))
        : undefined}
      closeLabel={t('CLOSE', 'Close')}
      dismissible={!saving}
      footer={footer}
    >
      {step === 1 ? stepOne : stepTwo}
    </Dialog>
  )
}
