import React, { useState, useEffect, useMemo } from 'react'
import { useLanguage, useConfig, useSession } from '../../../../../index'
import { useForm, Controller } from 'react-hook-form'
import { isItemsRefundAvailable, buildRefundItems, buildRefundRequest } from './refundRequest'
import { Button, Input, TextArea } from '../../../styles'
import { Alert, Modal } from '../../Shared'
import { RecordCircleFill, Circle, ExclamationTriangleFill } from 'react-bootstrap-icons'
import { Select } from '../../../styles/Select/FirstSelect'

import {
  RefundWalletButtonWrapper,
  RefundContainer,
  RadioItemContainer,
  RefundAllDisabledNote,
  RefundAmountWrapper,
  RefundReasonContainer,
  Option,
  SelectWrapper,
  ErrorText
} from './styles'

const itemsPickerStyles = {
  wrapper: { border: '1px solid #e0e0e0', borderRadius: 8, padding: 12, marginTop: 8, maxHeight: 280, overflowY: 'auto' },
  productRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' },
  productLabel: { flex: 1, fontSize: 14 },
  qtyInput: { width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #ccc' }
}

export const RefundToWallet = (props) => {
  const {
    order,
    actionStatus,
    handleOrderRefund,
    stripePaymethods,
    braintreePaymethods = []
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const isAllowCashWalletRefund = configs?.refund_cash_wallet_allow_when_order_cancelled?.value === '1'
  const isAllowCreditPointRefund = configs?.refund_credit_point_allow_when_order_cancelled?.value === '1'
  const isAllowStripeRefund = configs?.refund_stripe_allow_when_order_cancelled?.value === '1'
  const isAllowOtherRefund = configs?.refund_other_allow_when_order_cancelled?.value === '1'

  const [{ user }] = useSession()
  const { handleSubmit, errors, control } = useForm()
  const [openModal, setOpenModal] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [refundDisabled, setRefundDisabled] = useState(false)
  const [refundAllDisabled, setRefundAllDisabled] = useState(false)
  const [selectedRefundOption, setSelectedRefundOption] = useState(null)
  const [refundOptions, setRefundOptions] = useState([])

  const [refundMode, setRefundMode] = useState('total')
  const [refundAmount, setRefundAmount] = useState('')
  const [selectedItems, setSelectedItems] = useState({})

  const selectedOption = useMemo(
    () => refundOptions.find(o => o.value === selectedRefundOption),
    [refundOptions, selectedRefundOption]
  )
  const isItemsRefundAllowed = isItemsRefundAvailable(selectedOption, user?.level)
  const defaultRefundMode = refundAllDisabled ? 'amount' : 'total'

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

    handleOrderRefund(buildRefundRequest({
      option: selectedOption,
      mode: refundMode,
      amount,
      items,
      orderTotal: order?.summary?.total ?? order?.total,
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
    setRefundDisabled(false)
    setRefundAllDisabled(false)
    setRefundMode('total')
    setRefundAmount('')
    setSelectedItems({})

    if (order?.refund_data && stripePaymethods.includes(order?.paymethod?.gateway)) {
      setRefundDisabled(true)
    }
    if (!order?.payment_events) return
    const totalRefundAmount = order?.payment_events?.filter(item => item.event === 'refund').reduce((total, event) => total + (event?.amount || 0), 0) || 0
    if (totalRefundAmount === (order?.summary?.total || order?.total)) {
      setRefundDisabled(true)
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
            content: <Option>{t('CASH_WALLET', 'Cash Wallet')}</Option>
          })
        }
      } else if (event?.wallet_event?.wallet?.type === 'credit_point') {
        if (isAllowCreditPointRefund) {
          _refundOptions.push({
            value: event.id,
            content: <Option>{t('POINTS_WALLET', 'Points Wallet')}</Option>
          })
        }
      } else if (event?.paymethod?.gateway === 'stripe' || event?.data?.gateway === 'stripe') {
        if (isAllowStripeRefund) {
          _refundOptions.push({
            value: event.id,
            content: <Option>{t('STRIPE', 'Stripe')}</Option>,
            isStripe: true
          })
        }
      } else if (braintreePaymethods.includes(event?.paymethod?.gateway) || braintreePaymethods.includes(event?.data?.gateway)) {
        const gw = event?.paymethod?.gateway || event?.data?.gateway || 'braintree'
        _refundOptions.push({
          value: event.id,
          content: <Option>{t(gw.toUpperCase(), event?.paymethod?.name || gw)}</Option>,
          isBraintree: true
        })
      } else {
        if (isAllowOtherRefund) {
          if (!_refundOptions.find(item => item.value === 'cash_wallet')) {
            _refundOptions.push({
              value: 'cash_wallet',
              content: <Option>{t('CASH_WALLET', 'Cash Wallet')}</Option>
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
  const refundLabel = isBraintreeOrder ? t('REFUND', 'Refund') : t('REFUND_TO_WALLET', 'Refund to Wallet')

  return (
    <>
      {showButton && (
        <RefundWalletButtonWrapper>
          <Button
            color='primary'
            borderRadius='8px'
            disabled={actionStatus?.loading || refundDisabled}
            onClick={() => setOpenModal(true)}
          >
            {refundLabel}
          </Button>
        </RefundWalletButtonWrapper>
      )}
      {openModal && (
        <Modal
          width='700px'
          open={openModal}
          onClose={() => setOpenModal(false)}
        >
          <RefundContainer onSubmit={handleSubmit(onSubmit)} autoComplete='off'>
            <h2>{refundLabel}</h2>
            {hasRefundOptions
              ? (
              <>
                <SelectWrapper>
                  <span>{t('REFUND_TYPES', 'Refund types')}</span>
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
                    <p>{t('QUESTION_REFUND_AMOUNT', 'How do you want to refund?')}</p>
                    <RadioItemContainer
                      active={refundMode === 'total'}
                      disabled={refundAllDisabled}
                      onClick={() => !refundAllDisabled && setRefundMode('total')}
                    >
                      {refundMode === 'total' ? <RecordCircleFill /> : <Circle />}
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
                      onClick={() => setRefundMode('amount')}
                    >
                      {refundMode === 'amount' ? <RecordCircleFill /> : <Circle />}
                      <span>{t('REFUND_ONLY_AN_AMOUNT', 'Refund only an amount')}</span>
                    </RadioItemContainer>
                    {refundMode === 'amount' && (
                      <RefundAmountWrapper>
                        <Input
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
                        onClick={() => setRefundMode('items')}
                      >
                        {refundMode === 'items' ? <RecordCircleFill /> : <Circle />}
                        <span>{t('REFUND_BY_ITEMS', 'Refund specific items')}</span>
                      </RadioItemContainer>
                    )}
                    {isItemsRefundAllowed && refundMode === 'items' && (
                      <div style={itemsPickerStyles.wrapper}>
                        {(order?.products || []).map(product => {
                          const productId = product?.id
                          const entry = selectedItems[productId]
                          const productSelected = !!entry
                          const maxQty = product?.quantity || 1
                          return (
                            <div key={productId} style={itemsPickerStyles.productRow}>
                              <input
                                type='checkbox'
                                checked={productSelected}
                                onChange={() => toggleProductSelection(productId, maxQty)}
                              />
                              <span style={itemsPickerStyles.productLabel}>
                                {product?.name} <small>({t('QTY', 'Qty')}: {maxQty})</small>
                              </span>
                              {productSelected && maxQty > 1 && (
                                <input
                                  type='number'
                                  min={0}
                                  max={maxQty}
                                  value={entry?.quantity ?? 0}
                                  onChange={(e) => setProductQty(productId, e.target.value, maxQty)}
                                  style={itemsPickerStyles.qtyInput}
                                />
                              )}
                            </div>
                          )
                        })}
                        {(!order?.products || order.products.length === 0) && (
                          <ErrorText>{t('NO_PRODUCTS', 'No products available')}</ErrorText>
                        )}
                      </div>
                    )}
                  </>
                )}

                <RefundReasonContainer>
                  <label>{t('COMMENTS', 'Comments')}</label>
                  <Controller
                    name='description'
                    control={control}
                    render={({ onChange, value }) => (
                      <TextArea
                        rows={3}
                        value={value}
                        onChange={e => {
                          onChange(e.target.value)
                        }}
                      />
                    )}
                  />
                </RefundReasonContainer>
                <Button
                  type='submit'
                  color='primary'
                  borderRadius='8px'
                >
                  {t('REFUND', 'Refund')}
                </Button>
              </>
                )
              : (
              <ErrorText>{t('REFUND_NOT_ALLOWED', 'The refund is not allowed.')}</ErrorText>
                )}
          </RefundContainer>
        </Modal>
      )}
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState?.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState?.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}
