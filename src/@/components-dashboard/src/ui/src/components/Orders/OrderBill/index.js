import React, { useState, useEffect, useId, useRef } from 'react'
import { useLanguage, useUtils, useConfig } from '../../../../../index'
import { RefundToWallet } from './RefundToWallet'
import { summarizeRefunds } from './refundSummary'
import { verifyDecimals, getCurrenySymbol } from '../../../utils'
import { TaxBillRows, FeeBillRows } from '../../Shared'
import { Button, Input, RadioButton } from '../../../styles'
import { StatusBadge } from '../../Shared/Product/Status'
import { Button as ProductButton } from '../../Shared/Product/Button'
import { ConfirmDialog, Dialog } from '../../Shared/Product/Dialog'
import { AlertDialog } from '../../Shared/Product/AlertDialog'
import { RefundErrorDialog } from './RefundErrorDialog'
import { Wallet } from '../../Shared/Icon'
import '../OrderDetails/details-tab.css'
import './refund-dialogs.css'

import {
  OrderBillContainer,
  RefundButtonWrapper,
  RadioItemContainer,
  RefundAmountWrapper
} from './styles'

const getTranslationKeyFromLabelName = (value) => {
  if (typeof value !== 'string') return undefined
  return value.toUpperCase().replace(/ /g, '_')
}

const getGatewayHumanLabel = (gateway) => {
  if (typeof gateway !== 'string') return undefined
  return gateway.replace(/_/g, ' ')
}

const movePluginRefundMode = (event, isRefundAll, setIsRefundAll) => {
  if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return
  event.preventDefault()
  const nextMode = isRefundAll ? 'amount' : 'total'
  setIsRefundAll(nextMode === 'total')
  const group = event.currentTarget.closest('[role="radiogroup"]')
  window.requestAnimationFrame(() => {
    Array.from(group?.querySelectorAll('[data-refund-mode]') ?? []).find(control => control.dataset.refundMode === nextMode)?.focus()
  })
}

export const OrderBill = (props) => {
  const {
    order,
    actionStatus,
    handleRefundPaymentsStripe,
    handleRefundPaymentsPlugin,
    getPluginRefundProvider = () => null,
    handleOrderRefund,
    viewOnly,
    // 'panel' is the bill of the order detail panel (same rows and calculations, the payment as a
    // row with a badge, the rest of the order facts live in DetailsTab). The default is the bill
    // the print sheet and every other consumer render.
    variant = 'default'
  } = props
  const isPanel = variant === 'panel'

  const isGiftCardOrder = order?.products?.[0]?.type === 'gift_card'
  const [, t] = useLanguage()
  const pluginRefundModeLabelId = useId()
  const pluginRefundFormId = useId()
  const pluginRefundFormRef = useRef(null)
  const [{ parsePrice, parseNumber }] = useUtils()
  const [{ configs }] = useConfig()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  // redesign F6i-3 (A3-03): the status whose refund error the operator already read.
  const [dismissedRefundStatus, setDismissedRefundStatus] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, handleOnAccept: null })
  const SPOT_DICTIONARY = {
    3: t('SPOT_NUMBER_EAT_IN', 'Table number'),
    4: t('SPOT_NUMBER_CURBSIDE', 'Spot number'),
    5: t('SPOT_NUMBER_DRIVE_THRU', 'Drive thru lane')
  }
  const isPickupOrder = order?.delivery_type === 2
  const extraValueAdjustment = order?.metafields?.filter?.(meta => meta?.key?.includes('extra_value') && ![0, -0].includes(parseFloat(meta?.value)))
  const pulseCouponName = order?.metafields?.find?.(meta => meta?.key === 'pulse_coupon_name')
  const declaredValueMeta = order?.metafields?.find?.(meta => meta?.key === 'declared_value')
  const declaredValue = declaredValueMeta ? parseFloat(declaredValueMeta.value) : (order?.declared_value != null ? parseFloat(order.declared_value) : null)
  const isCustomOrder = declaredValue != null && declaredValue > 0

  const walletName = {
    cash: {
      name: t('CASH_WALLET_NAME', 'Cash wallet')
    },
    credit_point: {
      name: t('POINTS_WALLET', 'Points Wallet')
    }
  }
  const stripePaymethods = ['stripe', 'stripe_connect']
  const braintreePaymethods = ['braintree']
  const [openPluginRefund, setOpenPluginRefund] = useState(false)
  const [isRefundAll, setIsRefundAll] = useState(true)
  const [refundAmount, setRefundAmount] = useState('')
  const refundProvider = getPluginRefundProvider(order?.paymethod?.gateway)
  const formatPrice = (amount) => parsePrice(amount, { currency: getCurrenySymbol(order?.currency) })
  // What the refund of the whole payment moves: the total of the order, as the bill shows it.
  const refundTotal = order?.summary?.total ?? order?.total

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const onClickRefund = () => {
    if (refundProvider?.partial) {
      setIsRefundAll(true)
      setRefundAmount('')
      setOpenPluginRefund(true)
    } else if (refundProvider) {
      setConfirm({
        open: true,
        handleOnAccept: () => {
          setConfirm({ ...confirm, open: false })
          handleRefundPaymentsPlugin()
        }
      })
    } else {
      setConfirm({
        open: true,
        handleOnAccept: () => {
          setConfirm({ ...confirm, open: false })
          handleRefundPaymentsStripe()
        }
      })
    }
  }

  const handlePluginRefundSubmit = () => {
    if (!isRefundAll && (!refundAmount || parseFloat(refundAmount) <= 0)) {
      setAlertState({
        open: true,
        content: [t('VALIDATION_ERROR_FILLED', 'The _attribute_ field is required.').replace('_attribute_', t('AMOUNT', 'Amount'))]
      })
      return
    }
    const orderTotal = order?.summary?.total ?? order?.total
    if (!isRefundAll && parseFloat(refundAmount) > orderTotal) {
      setAlertState({
        open: true,
        content: [t('REFUND_AMOUNT_EXCEEDS_TOTAL', 'The refund amount cannot exceed the order total.')]
      })
      return
    }
    setOpenPluginRefund(false)
    const amount = isRefundAll ? null : parseFloat(refundAmount)
    handleRefundPaymentsPlugin(amount)
  }

  const getIncludedTaxes = (isDeliveryFee) => {
    if (!order?.taxes) return 0
    if (order?.taxes?.length === 0) {
      return order.tax_type === 1 ? order?.summary?.tax ?? 0 : 0
    } else {
      return order?.taxes.reduce((taxIncluded, tax) => {
        return taxIncluded + (((!isDeliveryFee && tax.type === 1 && tax.target === 'product') || (isDeliveryFee && tax.type === 1 && tax.target === 'delivery_fee')) ? tax.summary?.tax : 0)
      }, 0)
    }
  }

  const getIncludedTaxesDiscounts = () => {
    return order?.taxes?.filter(tax => (tax?.type === 1 && tax?.target === 'product'))?.reduce((carry, tax) => carry + (tax?.summary?.tax_after_discount ?? tax?.summary?.tax), 0)
  }

  useEffect(() => {
    if (!actionStatus?.error) return
    if (actionStatus?.errorSource === 'refund' || actionStatus?.errorSource === 'orderStatus') return
    if (Object.keys(actionStatus.error).length > 0) {
      setAlertState({
        open: true,
        content: actionStatus.error
      })
    }
  }, [actionStatus?.error])

  const orderDisplayTotal = (order?.summary?.total ?? order?.total ?? 0) + (isCustomOrder ? (declaredValue || 0) : 0)
  const hideOrderPrices = Number(orderDisplayTotal) === 0

  const paymentEvents = order?.payment_events?.filter(item => item.event === 'payment') ?? []
  const refundEvents = order?.payment_events?.filter(item => item.event === 'refund') ?? []
  // redesign F6d (Q3-08): what was already refunded («Cash Wallet € 217,05»), told in the confirmations of «Refund»
  const previousRefunds = summarizeRefunds(order, t)
    .map(({ label, amount }) => (label ? `${label} ${formatPrice(amount)}` : formatPrice(amount)))
    .join(', ')
  const previousRefundNotice = previousRefunds
    ? t('REFUND_PREVIOUS_NOTICE', 'This order was already refunded: _refunds_. Check it before you refund again.').replace('_refunds_', () => previousRefunds)
    : null
  const refundedAmount = refundEvents.reduce((total, event) => total + (event?.amount || 0), 0)
  const isFullyRefunded = refundEvents.length > 0 && (
    order?.refund_data === 'refunded' || (Number(orderDisplayTotal) > 0 && refundedAmount >= Number(orderDisplayTotal))
  )
  const getPaymentEventLabel = (event) => (
    event?.wallet_event
      ? walletName[event?.wallet_event?.wallet?.type]?.name
      : event?.paymethod
        ? t(event?.paymethod?.gateway?.toUpperCase(), event?.paymethod?.name)
        : event?.data?.gateway
          ? t(event?.data?.gateway?.toUpperCase(), getGatewayHumanLabel(event?.data?.gateway))
          : walletName[event?.data?.wallet_currency]?.name
  )
  const canRefundToWallet = !isGiftCardOrder && !viewOnly
  const canRefundPayment = !isGiftCardOrder && (!order?.refund_data || (refundProvider?.partial && order?.refund_data === 'partially_refunded')) && (stripePaymethods.includes(order?.paymethod?.gateway) || !!refundProvider) && !viewOnly
  const refundButtonDisabled = actionStatus?.loading || order?.payment_events?.find(item => item.event === 'refund' && (stripePaymethods.includes(item?.paymethod?.gateway) || !!getPluginRefundProvider(item?.paymethod?.gateway)))

  // redesign F6i-3 (A3-03): a failed refund is told here and only here, once, not while a new attempt runs; «Try again» asks the
  // confirmation of the refund again (the wallet refund is retried in its own form, and an answer that cannot be read is checked first).
  const showRefundError = actionStatus?.errorSource === 'refund' && actionStatus?.error != null && !actionStatus?.loading && dismissedRefundStatus !== actionStatus
  const canRetryRefund = canRefundPayment && !refundButtonDisabled && actionStatus?.refundTarget !== 'wallet'

  const refundActions = (
    <>
      {canRefundToWallet && (
        <RefundToWallet
          order={order}
          actionStatus={actionStatus}
          handleOrderRefund={handleOrderRefund}
          stripePaymethods={stripePaymethods}
          braintreePaymethods={braintreePaymethods}
        />
      )}
      {canRefundPayment && (
        <ProductButton
          variant='secondary'
          disabled={refundButtonDisabled}
          onClick={onClickRefund}
        >
          {t('REFUND', 'Refund')}
        </ProductButton>
      )}
    </>
  )

  const Container = isPanel ? 'div' : OrderBillContainer

  return (
    <Container className={isPanel ? 'odt-bill' : undefined}>
      {!hideOrderPrices && (<>
      <table aria-label={t('ORDER_BILL', 'Order bill')}>
        <tbody>
          {!isCustomOrder && (
            <tr>
              <td>{t('SUBTOTAL', 'Subtotal')}</td>
              <td className='odc-figure'>
                {parsePrice(((order?.summary?.subtotal ?? order?.subtotal) + getIncludedTaxes()), { currency: getCurrenySymbol(order?.currency) })}
              </td>
            </tr>
          )}
          {(order?.summary?.discount > 0 ?? order?.discount > 0) && order?.offers?.length === 0 && (
            <tr>
              {order?.offer_type === 1
                ? (
                <td>
                  {t('DISCOUNT', 'Discount')}{' '}
                  <span>{`(${verifyDecimals(order?.offer_rate, parsePrice)}%)`}</span>
                </td>
                  )
                : (
                <td>{t('DISCOUNT', 'Discount')}</td>
                  )}
              <td className='odc-figure'>- {parsePrice(order?.summary?.discount ?? order?.discount, { currency: getCurrenySymbol(order?.currency) })}</td>
            </tr>
          )}
          {
            order?.offers?.length > 0 && order?.offers?.filter(offer => offer?.target === 1 && parseFloat(offer?.summary?.discount ?? 0) !== 0)?.map(offer => (
              <tr key={offer.id}>
                <td>
                  {t(getTranslationKeyFromLabelName(offer?.name), offer.name)}
                  {offer.rate_type === 1 && (
                    <span>{`(${verifyDecimals(offer?.rate, parsePrice)}%)`}</span>
                  )}
                </td>
                <td className='odc-figure'>
                  - {parsePrice(offer?.summary?.discount, { currency: getCurrenySymbol(order?.currency) })}
                </td>
              </tr>
            ))
          }
          {order?.summary?.subtotal_with_discount > 0 && order?.summary?.discount > 0 && order?.summary?.total >= 0 && (
            <tr>
              <td>{t('SUBTOTAL_WITH_DISCOUNT', 'Subtotal with discount')}</td>
              {order?.tax_type === 1
                ? (
                <td className='odc-figure'>{parsePrice((order?.summary?.subtotal_with_discount + getIncludedTaxesDiscounts() ?? 0), { currency: getCurrenySymbol(order?.currency) })}</td>
                  )
                : (
                <td className='odc-figure'>{parsePrice(order?.summary?.subtotal_with_discount ?? 0, { currency: getCurrenySymbol(order?.currency) })}</td>
                  )}
            </tr>
          )}
          {
            order?.taxes?.length === 0 && order?.tax_type === 2 && parseFloat(order?.summary?.tax ?? 0) !== 0 && (
              <tr>
                <td>
                  {t('TAX', 'Tax')}
                  <span>{`(${verifyDecimals(order?.tax, parseNumber)}%)`}</span>
                </td>
                <td className='odc-figure'>{parsePrice(order?.summary?.tax ?? 0, { currency: getCurrenySymbol(order?.currency) })}</td>
              </tr>
            )
          }
          {
            order?.fees?.length === 0 && parseFloat(order?.summary?.service_fee ?? 0) !== 0 && (
              <tr>
                <td>
                  {t('SERVICE_FEE', 'Service fee')}
                  <span>{`(${verifyDecimals(order?.service_fee, parseNumber)}%)`}</span>
                </td>
                <td className='odc-figure'>{parsePrice(order?.summary?.service_fee ?? 0, { currency: getCurrenySymbol(order?.currency) })}</td>
              </tr>
            )
          }
          <TaxBillRows
            taxes={order?.taxes}
            target='product'
            parsePrice={formatPrice}
            parseNumber={parseNumber}
            t={t}
          />
          <FeeBillRows
            fees={order?.fees}
            parsePrice={formatPrice}
            t={t}
          />
          {
            order?.offers?.length > 0 && order?.offers?.filter(offer => offer?.target === 3 && parseFloat(offer?.summary?.discount ?? 0) !== 0)?.map(offer => (
              <tr key={offer.id}>
                <td>
                  {t(getTranslationKeyFromLabelName(offer?.name), offer.name)}
                  {offer.rate_type === 1 && (
                    <span>{`(${verifyDecimals(offer?.rate, parsePrice)}%)`}</span>
                  )}
                </td>
                <td className='odc-figure'>
                  - {parsePrice(offer?.summary?.discount, { currency: getCurrenySymbol(order?.currency) })}
                </td>
              </tr>
            ))
          }
          <TaxBillRows
            taxes={order?.taxes}
            target='order'
            parsePrice={formatPrice}
            parseNumber={parseNumber}
            t={t}
          />
          {typeof order?.summary?.delivery_price === 'number' && !isPickupOrder && parseFloat((order?.summary?.delivery_price ?? 0) + getIncludedTaxes(true)) !== 0 && (
            <tr>
              <td>{t('DELIVERY_FEE', 'Delivery Fee')}</td>
              <td className='odc-figure'>{formatPrice(order?.summary?.delivery_price + getIncludedTaxes(true))}</td>
            </tr>
          )}
          {isCustomOrder && declaredValue > 0 && (
            <tr>
              <td>{t('DECLARED_VALUE', 'Declared value')}</td>
              <td className='odc-figure'>{parsePrice(declaredValue, { currency: getCurrenySymbol(order?.currency) })}</td>
            </tr>
          )}
          <TaxBillRows
            taxes={order?.taxes}
            target='delivery_fee'
            parsePrice={formatPrice}
            parseNumber={parseNumber}
            t={t}
          />
          {
            order?.offers?.length > 0 && order?.offers?.filter(offer => offer?.target === 2 && parseFloat(offer?.summary?.discount ?? 0) !== 0)?.map(offer => (
              <tr key={offer.id}>
                <td>
                  {t(getTranslationKeyFromLabelName(offer?.name), offer.name)}
                  {offer.rate_type === 1 && (
                    <span>{`(${verifyDecimals(offer?.rate, parsePrice)}%)`}</span>
                  )}
                </td>
                <td className='odc-figure'>
                  - {parsePrice(offer?.summary?.discount, { currency: getCurrenySymbol(order?.currency) })}
                </td>
              </tr>
            ))
          }
          {(order?.summary?.driver_tip > 0 || order?.driver_tip > 0) && (
            <tr>
              <td>
                {t('DRIVER_TIP', 'Driver tip')}{' '}
                {(order?.summary?.driver_tip > 0 || order?.driver_tip > 0) &&
                  parseInt(configs?.driver_tip_type?.value, 10) === 2 &&
                  !parseInt(configs?.driver_tip_use_custom?.value, 10) &&
                  (
                    <span>{`(${verifyDecimals(order?.driver_tip, parseNumber)}%)`}</span>
                  )}
              </td>
              <td className='odc-figure'>{parsePrice(order?.summary?.driver_tip ?? order?.totalDriverTip, { currency: getCurrenySymbol(order?.currency) })}</td>
            </tr>
          )}
          {extraValueAdjustment?.length > 0 && extraValueAdjustment?.map(extra => (
            <tr key={extra?.key}>
              <td>
                {pulseCouponName?.value ? pulseCouponName?.value : t(extra?.key?.toUpperCase(), extra?.key)}{' '}
              </td>
              <td className='odc-figure'>{parseFloat(extra?.value) > 0
                ? parsePrice(parseFloat(extra?.value), { currency: getCurrenySymbol(order?.currency) })
                : `- ${parsePrice(parseFloat(extra?.value) * -1, { currency: getCurrenySymbol(order?.currency) })}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className='total' aria-label={t('ORDER_TOTAL', 'Order total')}>
        <tbody>
          <tr>
            <td>
              {isCustomOrder
                ? t('ESTIMATED_TOTAL', 'Estimated Total')
                : t('TOTAL', 'Total')
              }
            </td>
            <td className='odc-figure'>
              {isCustomOrder
                ? `~ ${parsePrice((order?.summary?.total ?? order?.total ?? 0) + (declaredValue || 0), { currency: getCurrenySymbol(order?.currency) })}`
                : parsePrice(order?.summary?.total ?? order?.total, { currency: getCurrenySymbol(order?.currency) })
              }
            </td>
          </tr>
        </tbody>
      </table>
      </>)}
      {/* (owner decision 9, 2026-10-27): the block, and its Transaction ID, show with any payment event, as main did (a refund or
          a wallet event alone kept it in main); the rows are still the «payment» events only */}
      {isPanel && (order?.payment_events?.length > 0 || canRefundPayment) && (
        <div className='odt-pay' role='group' aria-label={t('PAYMENTS', 'Payments')}>
          {paymentEvents.map((event, i) => {
            const isNotPrepaid = ['cash', 'card_delivery'].includes(event?.paymethod?.gateway)
            return (
              <div className='odt-pay-row' key={i}>
                <Wallet className='odc-icon' />
                <span className='odt-pay-name'>{getPaymentEventLabel(event)}</span>
                {isNotPrepaid
                  ? <StatusBadge family='pending' label={t('PAYMENT_NOT_PREPAID', 'Not prepaid')} />
                  : <StatusBadge family='done' label={isFullyRefunded ? t('REFUNDED', 'Refunded') : t('PAID', 'Paid')} />}
                {!isCustomOrder && (
                  <span className='odt-pay-amount odc-figure'>
                    {event?.paymethod?.gateway === 'cash' && order?.cash
                      ? parsePrice(order?.cash, { currency: getCurrenySymbol(order?.currency) })
                      : parsePrice(event?.amount, { currency: getCurrenySymbol(order?.currency) })}
                  </span>
                )}
              </div>
            )
          })}
          {order?.pay_data && (
            <div className='odt-pay-ref'>
              <span>{order?.paymethod?.gateway === 'braintree' ? t('BRAINTREE_ID', 'BrainTree ID') : t('TRANSACTION_ID', 'Transaction ID')}</span>
              <span className='odc-mono'>{order?.pay_data}</span>
            </div>
          )}
          <div className='odt-pay-actions'>{refundActions}</div>
        </div>
      )}
      {isPanel && paymentEvents.length === 0 && !canRefundPayment && canRefundToWallet && (
        <div className='odt-pay-actions'>{refundActions}</div>
      )}
      {!isPanel && order?.payment_events?.length > 0 && (
        <table className='payments' aria-label={t('PAYMENTS', 'Payments')}>
          <thead>
            <tr>
              <th colSpan='2'>{t('PAYMENTS', 'Payments')}</th>
            </tr>
          </thead>
          <tbody>
            {order?.payment_events?.filter(item => item.event === 'payment').map((event, i) => (
              <tr key={i}>
                <td>
                  {`${['cash', 'card_delivery'].includes(event?.paymethod?.gateway) ? `${t('NOT_PREPAID', 'Not prepaid')}: ` : ''}`}
                  {event?.wallet_event
                    ? walletName[event?.wallet_event?.wallet?.type]?.name
                    : event?.paymethod
                      ? t(event?.paymethod?.gateway?.toUpperCase(), event?.paymethod?.name)
                      : event?.data?.gateway
                        ? t(event?.data?.gateway?.toUpperCase(), getGatewayHumanLabel(event?.data?.gateway))
                        : walletName[event?.data?.wallet_currency]?.name}
                </td>
                {!isCustomOrder && (
                  <td className='odc-figure'>
                    {event?.paymethod?.gateway === 'cash' && order?.cash
                      ? parsePrice(order?.cash, { currency: getCurrenySymbol(order?.currency) })
                      : `${parsePrice(event?.amount, { currency: getCurrenySymbol(order?.currency) })}`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {order?.pay_data && (
            <tfoot>
              <tr>
                <td style={{ paddingTop: 10 }}><b>{order?.paymethod?.gateway === 'braintree' ? t('BRAINTREE_ID', 'BrainTree ID') : t('TRANSACTION_ID', 'Transaction ID')}</b></td>
                <td style={{ paddingTop: 10 }}>{order?.pay_data}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
      {!isPanel && canRefundToWallet && (
        <RefundToWallet
          order={order}
          actionStatus={actionStatus}
          handleOrderRefund={handleOrderRefund}
          stripePaymethods={stripePaymethods}
          braintreePaymethods={braintreePaymethods}
        />
      )}
      {order?.payment_events?.filter(item => item.event === 'refund').length > 0 && (
        <table className='payments' aria-label={t('REFUND', 'Refund')}>
          <thead>
            <tr>
              <th colSpan='2'>{t('REFUND', 'Refund')}</th>
            </tr>
          </thead>
          <tbody>
            {order?.payment_events?.filter(item => item.event === 'refund').map((event, i) => (
              <tr key={i}>
                <td>
                  {event?.wallet_event
                    ? walletName[event?.wallet_event?.wallet?.type]?.name
                    : event?.paymethod
                      ? t(event?.paymethod?.gateway?.toUpperCase(), event?.paymethod?.name)
                      : event?.data?.gateway
                        ? t(event?.data?.gateway?.toUpperCase(), getGatewayHumanLabel(event?.data?.gateway))
                        : walletName[event?.data?.wallet_currency]?.name}
                </td>
                <td className='odc-figure'>{parsePrice(event?.amount, { currency: getCurrenySymbol(order?.currency) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!isPanel && parseInt(order?.delivery_type, 10) !== 9 && (
        <table className='delivery_option' aria-label={t('DELIVERY_PREFERENCE', 'Delivery preference')}>
          <thead>
            <tr>
              <th colSpan='2'>{t('DELIVERY_PREFERENCE', 'Delivery preference')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{order?.delivery_option ? t(getTranslationKeyFromLabelName(order?.delivery_option?.name), order?.delivery_option?.name) : t('EITHER_WAY', 'Either way')}</td>
            </tr>
          </tbody>
        </table>
      )}
      {!isPanel && order?.comment && (
        <table className='comments' aria-label={t('COMMENT', 'Comment')}>
          <tbody>
            <tr>
              <td className='comment-heading'>{t('COMMENT', 'Comment')}</td>
              <td>{order?.comment}</td>
            </tr>
          </tbody>
        </table>
      )}
      {!isPanel && order?.spot_number && (
        <table className='spot_number' aria-label={SPOT_DICTIONARY[order?.delivery_type]}>
          <tbody>
            <tr>
              <td>{SPOT_DICTIONARY[order?.delivery_type]}</td>
              <td>{order?.spot_number}</td>
            </tr>
          </tbody>
        </table>
      )}
      {!isPanel && order?.vehicle && (
        <table className='vehicle' aria-label={t('ORDER_VEHICLE', 'Vehicle')}>
          <thead>
            <tr>
              <th colSpan='2'>{t('ORDER_VEHICLE', 'Vehicle')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('ORDER_VEHICLE_TYPE', 'Type')}</td>
              <td>{t(order?.vehicle?.type?.toUpperCase(), order?.vehicle?.type)}</td>
            </tr>
            <tr>
              <td>{t('ORDER_VEHICLE_MODEL', 'Model')}</td>
              <td>{order?.vehicle?.model}</td>
            </tr>
            <tr>
              <td>{t('ORDER_VEHICLE_CAR_REGISTRATION', 'Car registration')}</td>
              <td>{order?.vehicle?.car_registration}</td>
            </tr>
            <tr>
              <td>{t('ORDER_VEHICLE_COLOR', 'Color')}</td>
              <td>{order?.vehicle?.color}</td>
            </tr>
          </tbody>
        </table>
      )}

      {!isPanel && canRefundPayment && (
        <RefundButtonWrapper>
          <Button
            type='button'
            color='primary'
            borderRadius='8px'
            disabled={refundButtonDisabled}
            onClick={onClickRefund}
          >
            {t('REFUND', 'Refund')}
          </Button>
        </RefundButtonWrapper>
      )}

      <RefundErrorDialog
        open={showRefundError}
        kind={actionStatus?.errorKind}
        error={actionStatus?.error}
        canRetry={canRetryRefund}
        onClose={() => setDismissedRefundStatus(actionStatus)}
        onRetry={() => {
          setDismissedRefundStatus(actionStatus)
          onClickRefund()
        }}
      />
      <AlertDialog
        title={t('ORDER_BILL', 'Order bill')}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        content={alertState.content}
        open={alertState.open}
        onClose={() => closeAlert()}
      />
      <ConfirmDialog
        open={confirm.open}
        tone='primary'
        busy={!!actionStatus?.loading}
        title={t('REFUND_ORDER_QUESTION', 'Refund order #_id_?').replace('_id_', () => order?.id ?? '')}
        confirmLabel={refundTotal > 0
          ? t('REFUND_CONFIRM_ACTION', 'Refund _subject_').replace('_subject_', () => formatPrice(refundTotal))
          : t('REFUND', 'Refund')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => confirm.handleOnAccept?.()}
        onCancel={() => setConfirm({ ...confirm, open: false })}
      >
        {t('REFUND_PAYMENT_CONSEQUENCE', 'The payment is refunded to the customer’s card. This can’t be undone.')}
        {previousRefundNotice && <p className='odc-refund-previous'>{previousRefundNotice}</p>}
      </ConfirmDialog>
      <Dialog
        open={openPluginRefund}
        onOpenChange={(next) => { if (!next) setOpenPluginRefund(false) }}
        size='sm'
        // The focus starts on the chosen way to refund.
        initialFocus={() => pluginRefundFormRef.current?.querySelector('[role="radio"][tabindex="0"]') ?? true}
        title={t('REFUND_ORDER_TITLE', 'Refund order #_id_').replace('_id_', () => order?.id ?? '')}
        closeLabel={t('CLOSE', 'Close')}
        footer={(
          <>
            <ProductButton onClick={() => setOpenPluginRefund(false)}>{t('CANCEL', 'Cancel')}</ProductButton>
            <ProductButton
              variant='primary'
              type='submit'
              form={pluginRefundFormId}
              busy={!!actionStatus?.loading}
              disabled={actionStatus?.loading}
            >
              {t('REFUND', 'Refund')}
            </ProductButton>
          </>
        )}
      >
        <form
          id={pluginRefundFormId}
          ref={pluginRefundFormRef}
          className='odc-refund'
          autoComplete='off'
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            handlePluginRefundSubmit()
          }}
        >
          {previousRefundNotice && <p className='odc-refund-previous'>{previousRefundNotice}</p>}
          <p id={pluginRefundModeLabelId}>{t('QUESTION_REFUND_AMOUNT', 'How do you want to refund?')}</p>
          <div role='radiogroup' aria-labelledby={pluginRefundModeLabelId}>
            <RadioItemContainer
              active={isRefundAll}
            >
              <RadioButton
                name='plugin-refund-mode'
                role='radio'
                data-refund-mode='total'
                aria-checked={isRefundAll}
                checked={isRefundAll}
                onChange={() => setIsRefundAll(true)}
                tabIndex={isRefundAll ? 0 : -1}
                onKeyDown={event => movePluginRefundMode(event, isRefundAll, setIsRefundAll)}
              />
              <span>{t('REFUND_ALL', 'Refund all')}</span>
            </RadioItemContainer>
            <RadioItemContainer
              active={!isRefundAll}
            >
              <RadioButton
                name='plugin-refund-mode'
                role='radio'
                data-refund-mode='amount'
                aria-checked={!isRefundAll}
                checked={!isRefundAll}
                onChange={() => setIsRefundAll(false)}
                tabIndex={!isRefundAll ? 0 : -1}
                onKeyDown={event => movePluginRefundMode(event, isRefundAll, setIsRefundAll)}
              />
              <span>{t('REFUND_ONLY_AN_AMOUNT', 'Refund only an amount')}</span>
            </RadioItemContainer>
          </div>
          {!isRefundAll && (
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
        </form>
      </Dialog>
    </Container>
  )
}
