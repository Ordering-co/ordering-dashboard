import React, { useEffect, useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js/pure'
import { CardElement, Elements } from '@stripe/react-stripe-js'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { BillingCardForm as CardFormController } from '../../../../../components/BillingCardForm'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, InlineNotice } from '../../Shared/Product'
import { getCardElementOptions } from './stripeCardOptions'

// redesign BM-B (D4): the Stripe field on the controller of main. The frame is ours (the iframe only takes values); the
// validation error of Stripe is an alert under it, the error of saving the card is an inline notice, not a toast.
// redesign (row 51 main-1): `disabled` is the dialog charging. The Stripe field is turned off with its own `disabled` option
// (the iframe takes values, not our CSS), the button is off, and the submit is guarded too (Enter inside the field).
const AddCardFormUI = ({ cardState, addCardState, handleSubmit, handleChange, disabled = false }) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const baseOptions = useMemo(() => getCardElementOptions(), [])
  const options = useMemo(() => (disabled ? { ...baseOptions, disabled: true } : baseOptions), [baseOptions, disabled])

  const busy = !!(cardState?.loading || addCardState?.loading)
  const saveError = addCardState?.error ? translateApiMessage(t, addCardState.error, t('ERROR', 'Error')) : null

  // The success toast stays as in main («Card Created Successfully»).
  useEffect(() => {
    if (!addCardState?.error && addCardState?.result) {
      showToast(ToastType.Success, t('CARD_CREATED_SUCCESSFULLY', 'Card Created Successfully'))
    }
  }, [addCardState])

  // P/Button cancels the submit while busy; this guard stays for `disabled` and as a second lock.
  const onSubmit = (event) => {
    if (busy || disabled) {
      event.preventDefault()
      return
    }
    handleSubmit(event)
  }

  return (
    <form className='odc-pmp-form' onSubmit={onSubmit}>
      <div className='odc-pmp-stripe' data-invalid={cardState?.error ? '' : undefined}>
        {/* redesign (n.º 5, P-2): the field appears after pressing «Add card», so the focus goes into it */}
        <CardElement options={options} onChange={handleChange} onReady={(element) => element?.focus?.()} />
      </div>
      {cardState?.error && <p className='odc-pmp-error' role='alert'>{cardState.error}</p>}
      {saveError && <InlineNotice tone='danger' role='alert'>{saveError}</InlineNotice>}
      <p className='odc-pmp-attribution'>{t('POWERED_BY_STRIPE', 'Powered by Stripe')}</p>
      <div className='odc-pmp-actions'>
        <Button type='submit' busy={busy} disabled={disabled}>{t('ADD_CARD', 'Add card')}</Button>
      </div>
    </form>
  )
}

export const AddCardForm = ({ publicKey, requirements, onNewCard, disabled }) => {
  // The same as main: Stripe loads once per mount, with the key the controller gave.
  const [stripePromise] = useState(() => loadStripe(publicKey))
  return (
    <Elements stripe={stripePromise}>
      <CardFormController
        requirements={requirements}
        onNewCard={onNewCard}
        toSave
        disabled={disabled}
        UIComponent={AddCardFormUI}
      />
    </Elements>
  )
}
