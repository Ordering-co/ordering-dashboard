import React, { useState, useEffect, useId, useMemo, useRef } from 'react'
import { useLanguage, useConfig, useSession, useUtils } from '../../../../../index'
import { useForm, Controller } from 'react-hook-form'
import { isItemsRefundAvailable, buildRefundItems, buildRefundRequest } from './refundRequest'
import { Checkbox, Input, RadioButton, TextArea } from '../../../styles'
import { Button as ProductButton, ConfirmDialog, Dialog } from '../../Shared/Product'
import { AlertDialog } from '../../Shared/Product/AlertDialog'
import { getCurrenySymbol } from '../../../utils'
import { summarizeRefunds } from './refundSummary'
import { ExclamationTriangleFill } from 'react-bootstrap-icons'
import { Select } from '../../../styles/Select/FirstSelect'
import './refund-dialogs.css'

import {
  RadioItemContainer,
  RefundAllDisabledNote,
  RefundAmountWrapper,
  Option,
  SelectWrapper,
  ErrorText,
  RefundItemsPicker,
  RefundProductRow,
  RefundProductLabel,
  RefundQuantityInput
} from './styles'

const moveRefundMode = (event, modes, currentMode, onChange, disabledModes = []) => {
  if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return
  event.preventDefault()
  const availableModes = modes.filter(mode => !disabledModes.includes(mode))
  const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1
  const currentIndex = availableModes.indexOf(currentMode)
  const nextMode = availableModes[(Math.max(currentIndex, 0) + direction + availableModes.length) % availableModes.length]
  onChange(nextMode)
  const group = event.currentTarget.closest('[role="radiogroup"]')
  window.requestAnimationFrame(() => {
    Array.from(group?.querySelectorAll('[data-refund-mode]') ?? []).find(control => control.dataset.refundMode === nextMode)?.focus()
  })
}

const getOrderTotal = (order) => order?.summary?.total ?? order?.total

const getTotalRefundedAmount = (order) => (
  order?.payment_events?.filter(item => item.event === 'refund').reduce((total, event) => total + (event?.amount || 0), 0) || 0
)

export const RefundToWallet = (props) => {
  const {
    order,
    actionStatus,
    handleOrderRefund,
    stripePaymethods,
    braintreePaymethods = []
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const refundTypeLabelId = useId()
  const refundModeLabelId = useId()
  const refundDescriptionId = useId()
  const refundTypeWrapperRef = useRef(null)
  const refundFormId = useId()
  const refundFormRef = useRef(null)
  // The confirmation keeps its text while it fades out, after `pendingRefund` is cleared.
  const lastPendingRefund = useRef(null)
  const [{ configs }] = useConfig()
  const isAllowCashWalletRefund = configs?.refund_cash_wallet_allow_when_order_cancelled?.value === '1'
  const isAllowCreditPointRefund = configs?.refund_credit_point_allow_when_order_cancelled?.value === '1'
  const isAllowStripeRefund = configs?.refund_stripe_allow_when_order_cancelled?.value === '1'
  const isAllowOtherRefund = configs?.refund_other_allow_when_order_cancelled?.value === '1'

  const [{ user }] = useSession()
  const { handleSubmit, errors, control } = useForm()
  const [openModal, setOpenModal] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  // redesign F6c (Q2-28): why the button is disabled ('provider' | 'full'), so it can say so
  const [refundDisabledReason, setRefundDisabledReason] = useState(null)
  const refundDisabled = !!refundDisabledReason
  const refundHintId = useId()
  const [refundAllDisabled, setRefundAllDisabled] = useState(false)
  const [selectedRefundOption, setSelectedRefundOption] = useState(null)
  const [refundOptions, setRefundOptions] = useState([])
  const [pendingRefund, setPendingRefund] = useState(null)
  if (pendingRefund) lastPendingRefund.current = pendingRefund
  const shownRefund = pendingRefund ?? lastPendingRefund.current

  const [refundMode, setRefundMode] = useState('total')
  const [refundAmount, setRefundAmount] = useState('')
  const [selectedItems, setSelectedItems] = useState({})

  const selectedOption = useMemo(
    () => refundOptions.find(o => o.value === selectedRefundOption),
    [refundOptions, selectedRefundOption]
  )

  const formatRefundPrice = (amount) => parsePrice(Number(amount) || 0, { currency: getCurrenySymbol(order?.currency) })
  const orderTotal = getOrderTotal(order)
  const totalRefundedAmount = useMemo(() => getTotalRefundedAmount(order), [order?.payment_events])
  // redesign fix-qa E9: an order is «charged» only once a payment event exists (cash not yet collected has none)
  const hasPaidPayment = useMemo(
    () => order?.payment_events?.some(item => item.event === 'payment') ?? false,
    [order?.payment_events]
  )
  const isItemsRefundAllowed = isItemsRefundAvailable(selectedOption, user?.level)
  const defaultRefundMode = refundAllDisabled ? 'amount' : 'total'
  const refundModes = isItemsRefundAllowed ? ['total', 'amount', 'items'] : ['total', 'amount']

  // What the pending refund will move, in words: "{n} items" or a formatted amount.
  const getPendingRefundSubject = (data) => {
    if (data?.mode === 'items') {
      const count = data?.items?.length ?? 0
      return count === 1
        ? t('REFUND_ITEM_COUNT_ONE', '1 item')
        : t('REFUND_ITEMS_COUNT', '_count_ items').replace('_count_', () => String(count))
    }
    return formatRefundPrice(data?.mode === 'total' ? orderTotal : data?.amount)
  }

  const handleConfirmRefund = () => {
    const data = pendingRefund
    setPendingRefund(null)
    if (data) handleOrderRefund(data)
  }

  const onSubmit = (formData) => {
    if (!selectedOption) {
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_FILLED', 'The _attribute_ field is required.').replace('_attribute_', t('TYPE', 'Type'))
      })
      return
    }

    const amount = parseFloat(refundAmount)
    if (refundMode === 'amount' && !(amount > 0)) {
      setAlertState({
        open: true,
        content: [t('VALIDATION_ERROR_FILLED', 'The _attribute_ field is required.').replace('_attribute_', t('AMOUNT', 'Amount'))]
      })
      return
    }

    const items = refundMode === 'items' ? buildRefundItems(selectedItems) : []
    if (refundMode === 'items' && items.length === 0) {
      setAlertState({
        open: true,
        content: [t('REFUND_SELECT_AT_LEAST_ONE_ITEM', 'Select at least one item to refund.')]
      })
      return
    }

    // Money moves only after the confirmation below is accepted.
    setPendingRefund(buildRefundRequest({
      option: selectedOption,
      mode: refundMode,
      amount,
      items,
      orderTotal,
      description: formData.description
    }))
  }

  useEffect(() => {
    if (Object?.keys(errors)?.length > 0) {
      setAlertState({
        open: true,
        content: Object?.values(errors)?.map((error) => error?.message)
      })
    }
  }, [errors])

  useEffect(() => {
    setSelectedRefundOption(null)
    setRefundDisabledReason(null)
    setRefundAllDisabled(false)
    setRefundMode('total')
    setRefundAmount('')
    setSelectedItems({})
    setPendingRefund(null)

    if (order?.refund_data && stripePaymethods.includes(order?.paymethod?.gateway)) {
      setRefundDisabledReason('provider')
    }
    if (!order?.payment_events) return
    const totalRefundAmount = getTotalRefundedAmount(order)
    if (totalRefundAmount === (order?.summary?.total || order?.total)) {
      setRefundDisabledReason('full')
    }
    if (totalRefundAmount) {
      setRefundAllDisabled(true)
      setRefundMode('amount')
    }
    const _refundOptions = []
    const paymentEvents = order?.payment_events?.filter(item => item.event === 'payment') || []
    paymentEvents.forEach(event => {
      if (event?.wallet_event?.wallet?.type === 'cash') {
        if (isAllowCashWalletRefund) {
          _refundOptions.push({
            value: 'cash_wallet',
            label: t('CASH_WALLET_NAME', 'Cash wallet'),
            content: <Option>{t('CASH_WALLET_NAME', 'Cash wallet')}</Option>
          })
        }
      } else if (event?.wallet_event?.wallet?.type === 'credit_point') {
        if (isAllowCreditPointRefund) {
          _refundOptions.push({
            value: event.id,
            label: t('POINTS_WALLET', 'Points Wallet'),
            content: <Option>{t('POINTS_WALLET', 'Points Wallet')}</Option>
          })
        }
      } else if (event?.paymethod?.gateway === 'stripe' || event?.data?.gateway === 'stripe') {
        if (isAllowStripeRefund) {
          _refundOptions.push({
            value: event.id,
            label: t('STRIPE', 'Stripe'),
            content: <Option>{t('STRIPE', 'Stripe')}</Option>,
            isStripe: true
          })
        }
      } else if (braintreePaymethods.includes(event?.paymethod?.gateway) || braintreePaymethods.includes(event?.data?.gateway)) {
        const gw = event?.paymethod?.gateway || event?.data?.gateway || 'braintree'
        _refundOptions.push({
          value: event.id,
          label: t(gw.toUpperCase(), event?.paymethod?.name || gw),
          content: <Option>{t(gw.toUpperCase(), event?.paymethod?.name || gw)}</Option>,
          isBraintree: true
        })
      } else {
        if (isAllowOtherRefund) {
          if (!_refundOptions.find(item => item.value === 'cash_wallet')) {
            _refundOptions.push({
              value: 'cash_wallet',
              label: t('CASH_WALLET_NAME', 'Cash wallet'),
              content: <Option>{t('CASH_WALLET_NAME', 'Cash wallet')}</Option>
            })
          }
        }
      }
    })
    setRefundOptions(_refundOptions)
    if (_refundOptions.length === 1) {
      setSelectedRefundOption(_refundOptions[0].value)
    }
  }, [JSON.stringify(order?.payment_events), order?.id])

  useEffect(() => {
    if (!actionStatus?.loading) {
      setOpenModal(false)
    }
  }, [actionStatus?.loading])

  // The legacy select draws its own trigger: it is named by the visible label, as soon as the
  // dialog mounts it (the dialog's content appears after the open state changes) and when its options change.
  const labelRefundType = (node) => {
    node?.querySelector('[role="button"]')?.setAttribute('aria-labelledby', refundTypeLabelId)
  }
  const setRefundTypeWrapper = (node) => {
    refundTypeWrapperRef.current = node
    labelRefundType(node)
  }
  useEffect(() => {
    if (!openModal) return
    labelRefundType(refundTypeWrapperRef.current)
  }, [openModal, refundOptions, refundTypeLabelId])

  const toggleProductSelection = (productId, maxQty) => {
    setSelectedItems(prev => {
      const next = { ...prev }
      if (next[productId]) {
        delete next[productId]
      } else {
        next[productId] = { quantity: maxQty || 1, suboptions: {} }
      }
      return next
    })
  }

  const setProductQty = (productId, qty, maxQty) => {
    setSelectedItems(prev => {
      const current = prev[productId] || { quantity: 0, suboptions: {} }
      const parsed = Math.max(0, Math.min(parseInt(qty, 10) || 0, maxQty || 9999))
      return { ...prev, [productId]: { ...current, quantity: parsed } }
    })
  }

  const hasRefundOptions = refundOptions.length > 0
  const showButton = isAllowCashWalletRefund || isAllowCreditPointRefund || isAllowStripeRefund || isAllowOtherRefund || refundOptions.some(o => o.isBraintree)
  const isBraintreeOrder = braintreePaymethods.includes(order?.paymethod?.gateway)
  const refundLabel = isBraintreeOrder ? t('REFUND', 'Refund') : t('REFUND_TO_WALLET', 'Refund to wallet')
  // redesign F6d (Q3-08): the hint of a fully refunded order says what happened, «Refunded to Cash Wallet: € 217,05», from the
  // refund events (method and amount); the old sentence stays only when no event says it.
  const refundedSummary = summarizeRefunds(order, t)
    .map(({ label, amount }) => (label
      ? t('REFUND_DISABLED_REFUNDED_TO', 'Refunded to _method_: _amount_').replace('_method_', () => label).replace('_amount_', () => formatRefundPrice(amount))
      : t('REFUND_DISABLED_REFUNDED_AMOUNT', 'Refunded: _amount_').replace('_amount_', () => formatRefundPrice(amount))))
    .join(' · ')

  return (
    <>
      {showButton && (
        <ProductButton
          variant='secondary'
          disabled={actionStatus?.loading || refundDisabled}
          aria-describedby={refundDisabled ? refundHintId : undefined}
          onClick={() => setOpenModal(true)}
        >
          {refundLabel}
        </ProductButton>
      )}
      {showButton && refundDisabled && (
        <span id={refundHintId} className='odc-refund-hint'>
          {refundDisabledReason === 'full'
            ? (refundedSummary.length > 0 ? refundedSummary : t('REFUND_DISABLED_FULLY_REFUNDED', 'This order is already fully refunded.'))
            : t('REFUND_DISABLED_BY_PROVIDER', 'This order was refunded through its payment provider.')}
        </span>
      )}
      <Dialog
        open={openModal}
        onOpenChange={(next) => { if (!next) setOpenModal(false) }}
        size='lg'
        // The legacy select is not a ref target: the focus starts on the first control of the form.
        initialFocus={() => refundFormRef.current?.querySelector('[role="button"], input:not([disabled]), textarea') ?? true}
        title={refundLabel}
        closeLabel={t('CLOSE', 'Close')}
        footer={hasRefundOptions
          ? (
            <>
              <ProductButton onClick={() => setOpenModal(false)}>{t('CANCEL', 'Cancel')}</ProductButton>
              <ProductButton
                variant='primary'
                type='submit'
                form={refundFormId}
                busy={!!actionStatus?.loading}
                disabled={actionStatus?.loading}
              >
                {t('CONTINUE', 'Continue')}
              </ProductButton>
            </>
            )
          : undefined}
      >
        <form
          id={refundFormId}
          ref={refundFormRef}
          className='odc-refund'
          onSubmit={handleSubmit(onSubmit)}
          autoComplete='off'
          noValidate
        >
          <p className='odc-refund-summary odc-num'>
            {(hasPaidPayment
              ? t('REFUND_SUMMARY_CHARGED', 'Charged: _amount_')
              : t('REFUND_SUMMARY_ORDER_TOTAL', 'Order total: _amount_'))
              .replace('_amount_', () => formatRefundPrice(orderTotal))}
            {' · '}
            {t('REFUND_SUMMARY_REFUNDED', 'Already refunded: _amount_')
              .replace('_amount_', () => formatRefundPrice(totalRefundedAmount))}
          </p>
            {hasRefundOptions
              ? (
              <>
                <SelectWrapper ref={setRefundTypeWrapper}>
                  <span id={refundTypeLabelId}>{t('REFUND_TYPES', 'Refund types')}</span>
                  <Select
                    defaultValue={selectedRefundOption}
                    options={refundOptions}
                    placeholder={<Option>{t('SELECT_TYPE', 'Select type')}</Option>}
                    onChange={val => {
                      setSelectedRefundOption(val)
                      setRefundMode(defaultRefundMode)
                      setRefundAmount('')
                      setSelectedItems({})
                    }}
                  />
                </SelectWrapper>

                {selectedOption && (
                  <>
                    <p id={refundModeLabelId}>{t('QUESTION_REFUND_AMOUNT', 'How do you want to refund?')}</p>
                    <div role='radiogroup' aria-labelledby={refundModeLabelId}>
                    <RadioItemContainer
                      active={refundMode === 'total'}
                      disabled={refundAllDisabled}
                    >
                      <RadioButton
                        name='refund-mode'
                        role='radio'
                        data-refund-mode='total'
                        aria-checked={refundMode === 'total'}
                        checked={refundMode === 'total'}
                        disabled={refundAllDisabled}
                        onChange={() => setRefundMode('total')}
                        tabIndex={refundMode === 'total' && !refundAllDisabled ? 0 : -1}
                        onKeyDown={event => moveRefundMode(event, refundModes, refundMode, setRefundMode, refundAllDisabled ? ['total'] : [])}
                      />
                      <span>{t('REFUND_ALL', 'Refund all')}</span>
                    </RadioItemContainer>
                    {refundAllDisabled && (
                      <RefundAllDisabledNote>
                        <ExclamationTriangleFill />
                        {t('REFUND_ALL_DISABLED_PREVIOUS_REFUND', 'This order already has a refund, so it can no longer be refunded in full.')}
                      </RefundAllDisabledNote>
                    )}
                    <RadioItemContainer
                      active={refundMode === 'amount'}
                    >
                      <RadioButton
                        name='refund-mode'
                        role='radio'
                        data-refund-mode='amount'
                        aria-checked={refundMode === 'amount'}
                        checked={refundMode === 'amount'}
                        onChange={() => setRefundMode('amount')}
                        tabIndex={refundMode === 'amount' || (refundMode === 'total' && refundAllDisabled) ? 0 : -1}
                        onKeyDown={event => moveRefundMode(event, refundModes, refundMode, setRefundMode, refundAllDisabled ? ['total'] : [])}
                      />
                      <span>{t('REFUND_ONLY_AN_AMOUNT', 'Refund only an amount')}</span>
                    </RadioItemContainer>
                    {refundMode === 'amount' && (
                      <RefundAmountWrapper className='odc-refund-amount'>
                        <Input
                          aria-label={t('AMOUNT', 'Amount')}
                          inputMode='decimal'
                          placeholder={t('AMOUNT', 'Amount')}
                          value={refundAmount}
                          onKeyPress={(e) => {
                            if (!/^[0-9.]$/.test(e.key)) {
                              e.preventDefault()
                            }
                          }}
                          onChange={(e) => setRefundAmount(e.target.value)}
                        />
                      </RefundAmountWrapper>
                    )}
                    {isItemsRefundAllowed && (
                      <RadioItemContainer
                        active={refundMode === 'items'}
                      >
                        <RadioButton
                          name='refund-mode'
                          role='radio'
                          data-refund-mode='items'
                          aria-checked={refundMode === 'items'}
                          checked={refundMode === 'items'}
                          onChange={() => setRefundMode('items')}
                          tabIndex={refundMode === 'items' ? 0 : -1}
                          onKeyDown={event => moveRefundMode(event, refundModes, refundMode, setRefundMode, refundAllDisabled ? ['total'] : [])}
                        />
                        <span>{t('REFUND_BY_ITEMS', 'Refund specific items')}</span>
                      </RadioItemContainer>
                    )}
                    </div>
                    {isItemsRefundAllowed && refundMode === 'items' && (
                      <RefundItemsPicker>
                        {(order?.products || []).map(product => {
                          const productId = product?.id
                          const entry = selectedItems[productId]
                          const productSelected = !!entry
                          const maxQty = product?.quantity || 1
                          return (
                            <RefundProductRow key={productId}>
                              <Checkbox
                                aria-label={`${t('REFUND', 'Refund')} ${product?.name ?? ''}`.trim()}
                                checked={productSelected}
                                onChange={() => toggleProductSelection(productId, maxQty)}
                              />
                              <RefundProductLabel>
                                {product?.name} <small>({t('QTY', 'Qty')}: {maxQty})</small>
                              </RefundProductLabel>
                              {productSelected && maxQty > 1 && (
                                <RefundQuantityInput
                                  aria-label={`${t('QTY', 'Qty')} ${product?.name ?? ''}`.trim()}
                                  type='number'
                                  min={0}
                                  max={maxQty}
                                  value={entry?.quantity ?? 0}
                                  onChange={(e) => setProductQty(productId, e.target.value, maxQty)}
                                />
                              )}
                            </RefundProductRow>
                          )
                        })}
                        {(!order?.products || order.products.length === 0) && (
                          <ErrorText>{t('NO_PRODUCTS', 'No products available')}</ErrorText>
                        )}
                      </RefundItemsPicker>
                    )}
                  </>
                )}

                <div className='odc-refund-field'>
                  <label className='odc-refund-label' htmlFor={refundDescriptionId}>{t('COMMENTS', 'Comments')}</label>
                  <Controller
                    name='description'
                    control={control}
                    defaultValue=''
                    render={({ onChange, value }) => (
                      <TextArea
                        id={refundDescriptionId}
                        rows={3}
                        value={value}
                        onChange={e => {
                          onChange(e.target.value)
                        }}
                      />
                    )}
                  />
                </div>
              </>
                )
              : (
              <ErrorText role='status'>{t('REFUND_NOT_ALLOWED', 'The refund is not allowed.')}</ErrorText>
                )}
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!pendingRefund}
        tone='primary'
        busy={!!actionStatus?.loading}
        title={t('REFUND_CONFIRM_TITLE', 'Refund _subject_?').replace('_subject_', () => shownRefund ? getPendingRefundSubject(shownRefund) : '')}
        confirmLabel={t('REFUND_CONFIRM_ACTION', 'Refund _subject_').replace('_subject_', () => shownRefund ? getPendingRefundSubject(shownRefund) : '')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleConfirmRefund}
        onCancel={() => setPendingRefund(null)}
      >
        {shownRefund && (
          <p>
            {t('REFUND_CONFIRM_MESSAGE', 'Refund _subject_ to _destination_.')
              .replace('_subject_', () => getPendingRefundSubject(shownRefund))
              .replace('_destination_', () => selectedOption?.label ?? '')}
          </p>
        )}
      </ConfirmDialog>
      <AlertDialog
        title={t('REFUND_NOT_SENT', 'Refund not sent')}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        content={alertState?.content}
        open={alertState?.open}
        onClose={() => setAlertState({ open: false, content: [] })}
      />
    </>
  )
}
