import React, { useState, useEffect, useMemo } from 'react'
import { useLanguage, useConfig } from '../../../../../index'
import { useForm, Controller } from 'react-hook-form'
import { Button, Input, TextArea } from '../../../styles'
import { Alert, Modal } from '../../Shared'
import { RecordCircleFill, Circle, ChevronDown, ChevronUp } from 'react-bootstrap-icons'
import { Select } from '../../../styles/Select/FirstSelect'

import {
  RefundWalletButtonWrapper,
  RefundContainer,
  RadioItemContainer,
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
  qtyInput: { width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid #ccc' },
  subWrapper: { paddingLeft: 24, borderLeft: '2px solid #eee', marginLeft: 8 },
  subRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' },
  subLabel: { flex: 1, fontSize: 13, color: '#555' }
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

  const { handleSubmit, register, errors, control } = useForm()
  const [openModal, setOpenModal] = useState(false)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isRefundAll, setIsRefundAll] = useState(true)
  const [refundDisabled, setRefundDisabled] = useState(false)
  const [refundAllDisabled, setRefundAllDisabled] = useState(false)
  const [selectedRefundOption, setSelectedRefundOption] = useState(null)
  const [refundOptions, setRefundOptions] = useState([])

  // v2 state (Braintree)
  const [refundMode, setRefundMode] = useState('total')
  const [v2Amount, setV2Amount] = useState('')
  const [selectedItems, setSelectedItems] = useState({})
  const [expandedProducts, setExpandedProducts] = useState({})

  const toggleProductExpand = (productId) => {
    setExpandedProducts(prev => ({ ...prev, [productId]: !prev[productId] }))
  }

  const selectedOption = useMemo(
    () => refundOptions.find(o => o.value === selectedRefundOption),
    [refundOptions, selectedRefundOption]
  )
  const isBraintreeOption = !!selectedOption?.isBraintree

  const buildItemsPayload = () => {
    const items = []
    Object.entries(selectedItems).forEach(([orderProductId, entry]) => {
      const opId = parseInt(orderProductId, 10)
      const suboptions = []
      Object.entries(entry?.suboptions || {}).forEach(([subId, subQty]) => {
        const q = parseInt(subQty, 10)
        if (q > 0) suboptions.push({ order_product_option_suboption_id: parseInt(subId, 10), quantity: q })
      })
      if (suboptions.length > 0) {
        items.push({ order_product_id: opId, suboptions })
      } else if (parseInt(entry?.quantity, 10) > 0) {
        items.push({ order_product_id: opId, quantity: parseInt(entry.quantity, 10) })
      }
    })
    return items
  }

  const onSubmit = (formData) => {
    if (!selectedRefundOption) {
      setAlertState({
        open: true,
        content: t('VALIDATION_ERROR_FILLED', 'The _attribute_ field is required.').replace('_attribute_', t('TYPE', 'Type'))
      })
      return
    }

    const data = {}

    if (isBraintreeOption) {
      data.version = 'v2'
      data.transfer_to = 'source'
      data.order_payment_event_id = selectedRefundOption
      data.mode = refundMode

      if (refundMode === 'amount') {
        const amt = parseFloat(v2Amount)
        if (!amt || amt <= 0) {
          setAlertState({
            open: true,
            content: [t('VALIDATION_ERROR_FILLED', 'The _attribute_ field is required.').replace('_attribute_', t('AMOUNT', 'Amount'))]
          })
          return
        }
        data.amount = amt
      }

      if (refundMode === 'items') {
        const items = buildItemsPayload()
        if (items.length === 0) {
          setAlertState({
            open: true,
            content: [t('REFUND_SELECT_AT_LEAST_ONE_ITEM', 'Select at least one item to refund.')]
          })
          return
        }
        data.items = items
      }
    } else {
      if (selectedRefundOption !== 'cash_wallet') {
        data.order_payment_event_id = selectedRefundOption
      }
      data.amount = isRefundAll ? (order?.summary?.total ?? order?.total) : formData.amount
      data.transfer_to = selectedRefundOption !== 'cash_wallet' ? 'source' : 'cash_wallet'
    }

    if (formData.description) data.description = formData.description
    handleOrderRefund(data)
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
    setIsRefundAll(true)
    setRefundMode('total')
    setV2Amount('')
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
      setIsRefundAll(false)
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
            content: <Option>{t('STRIPE', 'Stripe')}</Option>
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
  }, [JSON.stringify(order?.payment_events)], order?.id)

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

  const toggleSuboptionSelection = (productId, suboptionId) => {
    setSelectedItems(prev => {
      const current = prev[productId] || { quantity: 0, suboptions: {} }
      const subs = { ...current.suboptions }
      if (subs[suboptionId]) {
        delete subs[suboptionId]
      } else {
        subs[suboptionId] = 1
      }
      const next = { ...prev }
      if (Object.keys(subs).length === 0 && !(current.quantity > 0)) {
        delete next[productId]
      } else {
        next[productId] = { ...current, suboptions: subs }
      }
      return next
    })
  }

  const setSuboptionQty = (productId, suboptionId, qty) => {
    setSelectedItems(prev => {
      const current = prev[productId] || { quantity: 0, suboptions: {} }
      const subs = { ...current.suboptions }
      const parsed = Math.max(0, parseInt(qty, 10) || 0)
      if (parsed === 0) {
        delete subs[suboptionId]
      } else {
        subs[suboptionId] = parsed
      }
      const next = { ...prev }
      if (Object.keys(subs).length === 0 && !(current.quantity > 0)) {
        delete next[productId]
      } else {
        next[productId] = { ...current, suboptions: subs }
      }
      return next
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
                      setRefundMode('total')
                      setV2Amount('')
                      setSelectedItems({})
                    }}
                  />
                </SelectWrapper>

                {isBraintreeOption
                  ? (
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
                          value={v2Amount}
                          onKeyPress={(e) => {
                            if (!/^[0-9.]$/.test(e.key)) {
                              e.preventDefault()
                            }
                          }}
                          onChange={(e) => setV2Amount(e.target.value)}
                        />
                      </RefundAmountWrapper>
                    )}
                    <RadioItemContainer
                      active={refundMode === 'items'}
                      onClick={() => setRefundMode('items')}
                    >
                      {refundMode === 'items' ? <RecordCircleFill /> : <Circle />}
                      <span>{t('REFUND_BY_ITEMS', 'Refund specific items')}</span>
                    </RadioItemContainer>
                    {refundMode === 'items' && (
                      <div style={itemsPickerStyles.wrapper}>
                        {(order?.products || []).map(product => {
                          const productId = product?.id
                          const entry = selectedItems[productId]
                          const hasSubsSelected = Object.keys(entry?.suboptions || {}).length > 0
                          const productSelected = !!entry && !hasSubsSelected
                          const maxQty = product?.quantity || 1
                          const hasOptions = (product?.options || []).some(opt => (opt?.suboptions || []).length > 0)
                          const isExpanded = !!expandedProducts[productId]
                          return (
                            <div key={productId}>
                              <div style={itemsPickerStyles.productRow}>
                                <input
                                  type='checkbox'
                                  checked={productSelected}
                                  disabled={hasSubsSelected}
                                  onChange={() => toggleProductSelection(productId, maxQty)}
                                />
                                <span
                                  style={{ ...itemsPickerStyles.productLabel, cursor: hasOptions ? 'pointer' : 'default' }}
                                  onClick={() => hasOptions && toggleProductExpand(productId)}
                                >
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
                                {hasOptions && (
                                  <span
                                    onClick={() => toggleProductExpand(productId)}
                                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                                  >
                                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                                  </span>
                                )}
                              </div>
                              {hasOptions && isExpanded && (product?.options || []).map(option => (
                                <div key={option?.id} style={itemsPickerStyles.subWrapper}>
                                  <small><b>{option?.name}</b></small>
                                  {(option?.suboptions || []).map(sub => {
                                    const subId = sub?.order_product_option_suboption_id ?? sub?.id
                                    const subSelected = !!entry?.suboptions?.[subId]
                                    const maxSubQty = sub?.quantity || 1
                                    return (
                                      <div key={subId} style={itemsPickerStyles.subRow}>
                                        <input
                                          type='checkbox'
                                          checked={subSelected}
                                          disabled={productSelected}
                                          onChange={() => toggleSuboptionSelection(productId, subId)}
                                        />
                                        <span style={itemsPickerStyles.subLabel}>
                                          {sub?.name}{maxSubQty > 1 && <small> ({t('QTY', 'Qty')}: {maxSubQty})</small>}
                                        </span>
                                        {subSelected && maxSubQty > 1 && (
                                          <input
                                            type='number'
                                            min={1}
                                            max={maxSubQty}
                                            value={entry?.suboptions?.[subId] ?? 1}
                                            onChange={(e) => setSuboptionQty(productId, subId, e.target.value)}
                                            style={itemsPickerStyles.qtyInput}
                                          />
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                          )
                        })}
                        {(!order?.products || order.products.length === 0) && (
                          <ErrorText>{t('NO_PRODUCTS', 'No products available')}</ErrorText>
                        )}
                      </div>
                    )}
                  </>
                    )
                  : (
                  <>
                    <p>{t('QUESTION_REFUND_AMOUNT', 'How do you want to refund?')}</p>
                    <RadioItemContainer
                      active={isRefundAll}
                      disabled={refundAllDisabled}
                      onClick={() => setIsRefundAll(true)}
                    >
                      {isRefundAll ? <RecordCircleFill /> : <Circle />}
                      <span>{t('REFUND_ALL', 'Refund all')}</span>
                    </RadioItemContainer>
                    <RadioItemContainer
                      active={!isRefundAll}
                      onClick={() => setIsRefundAll(false)}
                    >
                      {!isRefundAll ? <RecordCircleFill /> : <Circle />}
                      <span>{t('REFUND_ONLY_AN_AMOUNT', 'Refund only an amount')}</span>
                    </RadioItemContainer>
                    {!isRefundAll && (
                      <RefundAmountWrapper>
                        <Input
                          name='amount'
                          onKeyPress={(e) => {
                            if (!/^[0-9.]$/.test(e.key)) {
                              e.preventDefault()
                            }
                          }}
                          ref={register({
                            required: t('VALIDATION_ERROR_FILLED', 'The _attribute_ field is required.').replace('_attribute_', t('AMOUNT', 'Amount'))
                          })}
                        />
                      </RefundAmountWrapper>
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
