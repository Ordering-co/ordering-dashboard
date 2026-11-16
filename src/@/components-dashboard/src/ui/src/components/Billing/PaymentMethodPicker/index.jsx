import React, { useEffect, useId, useRef, useState } from 'react'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { BillingPaymentOptionStripe as PaymentOptionStripeController } from '../../../../../components/BillingPaymentOptionStripe'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, ConfirmDialog, InlineNotice, Skeleton } from '../../Shared/Product'
import { AddCardForm } from './AddCardForm'
import { CardRow, cardName } from './CardRow'

import './payment-method-picker.css'

// The API answers a text, a list of texts or nothing useful: one entry per message, and an empty answer still says «Error».
const toList = (error) => {
  if (!error) return []
  return Array.isArray(error) && error.length ? error : [Array.isArray(error) ? undefined : error]
}

// redesign BM-B (D3, D4, M-BM6, M-BM10, M-BM11, M-BM12, M-BM16): the saved cards and the Stripe field of the Billing modal on
// the same controller as main (`BillingPaymentOptionStripe`). redesign (n.º 53, P-6): /purchase/addons mounts it too.
const PaymentMethodPickerUI = (props) => {
  const {
    publicKey,
    requirements,
    cardsList,
    cardDefaultState,
    cardSelected,
    deleteCard,
    handleCardClick,
    handleNewCard,
    requirementsState,
    loadRequirements,
    onBusyChange,
    // redesign (row 51 main-1): the dialog is charging; nothing here changes the cards until it is done
    disabled = false
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const titleId = useId()
  const addTitleId = useId()
  const rowRefs = useRef(new Map())
  const menuRefs = useRef(new Map())
  const confirmedRef = useRef(false)
  const [removal, setRemoval] = useState({ card: null, open: false })
  // redesign (n.º 5, review L2 #2): «Add card» leaves when pressed, so the focus goes to what replaces it: the section title
  // (the Stripe field takes it when ready) or, without a key, «Try again»
  const addHeadingRef = useRef(null)
  const retryRef = useRef(null)
  const pressedRef = useRef(false)
  const askForCard = () => {
    pressedRef.current = true
    loadRequirements?.()
  }
  useEffect(() => {
    if (!pressedRef.current || !requirementsState?.requested || requirementsState?.loading) return
    pressedRef.current = false
    ;(publicKey ? addHeadingRef.current : retryRef.current)?.focus()
  }, [requirementsState?.requested, requirementsState?.loading, publicKey])

  const cards = cardsList?.cards ?? []
  const loading = !!cardsList?.loading
  const writing = !!cardDefaultState?.loading
  const fallbackName = t('CARD', 'Card')

  // The success toast of choosing a card stays as in main; the errors are inline now.
  useEffect(() => {
    if (!cardDefaultState?.error && cardDefaultState?.result) {
      showToast(ToastType.Success, t('CARD_SELECTED_SUCCESSFULLY', 'Card Selected Successfully'))
    }
  }, [cardDefaultState])

  // redesign BM-B (M-BM16): the dialog disables «Pay» while the default is being written (main let it pay a card that was not yet the default).
  const notifiedRef = useRef(false)
  const onBusyChangeRef = useRef(onBusyChange)
  onBusyChangeRef.current = onBusyChange
  useEffect(() => {
    if (notifiedRef.current === writing) return
    notifiedRef.current = writing
    onBusyChangeRef.current?.(writing)
  }, [writing])
  useEffect(() => () => {
    if (notifiedRef.current) {
      notifiedRef.current = false
      onBusyChangeRef.current?.(false)
    }
  }, [])

  // redesign BM-B (M-BM6): the chosen card does nothing when pressed (main un-chose it with no effect on the server), and no
  // card answers while the default is being written (PaymentCard.js:41-45).
  const choose = (card) => {
    if (writing || disabled || card?.id === cardSelected?.id) return
    handleCardClick(card)
  }

  // redesign BM-B (M-BM11): deleting still asks first, but now naming the card; main's confirmation was a generic «Are you sure you want to delete?».
  const askDelete = (card) => {
    confirmedRef.current = false
    setRemoval({ card, open: true })
  }
  const closeDelete = () => setRemoval(current => ({ ...current, open: false }))
  const confirmDelete = () => {
    const { card } = removal
    confirmedRef.current = true
    closeDelete()
    deleteCard(card)
  }

  // Confirmed: the card and its ⋮ are gone (or about to be), so the focus goes to the chosen row. redesign (row 51 R1-3):
  // cancelled (button, X or Escape): nothing changed, so it goes back to the ⋮ that opened the confirmation, and only when that
  // ⋮ no longer exists, to the chosen row.
  const focusAfterConfirm = () => {
    const chosen = rowRefs.current.get(cardSelected?.id)
    if (confirmedRef.current) return chosen ?? true
    return menuRefs.current.get(removal.card?.id) ?? chosen ?? true
  }

  const errors = [...toList(cardsList?.error), ...toList(cardDefaultState?.error)]

  return (
    <div className='odc-pmp-picker'>
      <section className='odc-pmp-section' aria-labelledby={titleId}>
        <h3 id={titleId} className='odc-pmp-title'>{t('PAYMENT_METHOD', 'Payment method')}</h3>

        {/* Owner decision 17 B (2026-10-21): a default that could not change went back to the card the person had. */}
        {cardDefaultState?.reverted && !cardDefaultState?.loading && (
          <InlineNotice tone='danger' role='alert'>
            {t('BILLING_DEFAULT_CARD_NOT_CHANGED', 'The default card could not be changed.')}
            {cardSelected && <> {t('BILLING_PREVIOUS_CARD_KEPT', 'The card you had stays selected.')}</>}
            {errors.length > 0 && errors.map((message, index) => (
              <React.Fragment key={index}> {translateApiMessage(t, message, t('ERROR', 'Error'))}</React.Fragment>
            ))}
          </InlineNotice>
        )}

        {!cardDefaultState?.reverted && errors.map((message, index) => (
          <InlineNotice key={index} tone='danger' role='alert'>
            {translateApiMessage(t, message, t('ERROR', 'Error'))}
          </InlineNotice>
        ))}

        {loading && (
          <div className='odc-pmp-list' aria-busy='true'>
            {[0, 1].map(index => <Skeleton key={index} shape='box' block='var(--od-x-control-height-lg)' />)}
          </div>
        )}

        {!loading && cards.length === 0 && (
          <p className='odc-pmp-empty'>{t('BILLING_NO_SAVED_CARDS', 'No saved cards yet. Add one below to pay.')}</p>
        )}

        {!loading && cards.length > 0 && (
          <>
            <ul className='odc-pmp-list'>
              {cards.map(card => (
                <CardRow
                  key={card.id}
                  card={card}
                  selected={card.id === cardSelected?.id}
                  busy={writing && card.id === cardSelected?.id}
                  locked={writing}
                  disabled={disabled}
                  canDelete={!card.default && !writing}
                  rowRef={(node) => {
                    if (node) rowRefs.current.set(card.id, node)
                    else rowRefs.current.delete(card.id)
                  }}
                  menuRef={(node) => {
                    if (node) menuRefs.current.set(card.id, node)
                    else menuRefs.current.delete(card.id)
                  }}
                  onChoose={choose}
                  onDelete={askDelete}
                />
              ))}
            </ul>
            {/* redesign BM-B (M-BM6): main's button said «Select/Add card» when no card was chosen; the action keeps its name and the reason is here */}
            {!cardSelected && !writing && (
              <p className='odc-pmp-empty'>{t('BILLING_CHOOSE_CARD', 'Choose the card to pay with.')}</p>
            )}
            <InlineNotice tone='info'>
              {t('IF_YOU_CHANGE_PAYMENT_IT_WILL_CHANGE_FOR_SUBSCRIPTION_ALSO', 'If you change your payment method it will also change for your subscription.')}
            </InlineNotice>
          </>
        )}
      </section>

      {/* redesign BM-B (D4 A): once asked for, the add form is there as in main; without a key it says so instead of «Public key error».
          redesign (n.º 5, P-2): the field appears when «Add card» is pressed, and only then are the Stripe requirements fetched. */}
      {!loading && (
        <section className='odc-pmp-section' aria-labelledby={addTitleId}>
          <h3 id={addTitleId} ref={addHeadingRef} tabIndex={-1} className='odc-pmp-title'>{t('ADD_NEW_CARD', 'Add new card')}</h3>
          {!requirementsState?.requested
            ? (
              <div className='odc-pmp-actions'>
                <Button type='button' busy={!!requirementsState?.loading} disabled={disabled} onClick={askForCard}>
                  {t('ADD_CARD', 'Add card')}
                </Button>
              </div>
              )
            : publicKey
              ? <AddCardForm publicKey={publicKey} requirements={requirements} onNewCard={handleNewCard} disabled={disabled} />
              : (
                <InlineNotice
                  tone='warning'
                  action={(
                    <Button ref={retryRef} type='button' size='sm' busy={!!requirementsState?.loading} disabled={disabled} onClick={askForCard}>
                      {t('TRY_AGAIN', 'Try again')}
                    </Button>
                  )}
                >
                  {t('BILLING_CARD_ENTRY_UNAVAILABLE', "Adding a card isn't available right now. You can still pay with a saved card.")}
                </InlineNotice>
                )}
        </section>
      )}

      <ConfirmDialog
        open={removal.open}
        tone='danger'
        title={t('DELETE_CARD_TITLE', 'Delete _card_?').split('_card_').join(cardName(removal.card, fallbackName))}
        confirmLabel={t('DELETE_CARD', 'Delete card')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={confirmDelete}
        onCancel={closeDelete}
        finalFocus={focusAfterConfirm}
      />
    </div>
  )
}

export const PaymentMethodPicker = (props) => (
  <PaymentOptionStripeController {...props} requirementsOnDemand UIComponent={PaymentMethodPickerUI} />
)
