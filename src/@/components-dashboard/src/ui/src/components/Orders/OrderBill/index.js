import React, { useState, useEffect } from 'react'
import { useLanguage, useUtils, useConfig } from '../../../../../index'
import { RefundToWallet } from './RefundToWallet'
import { verifyDecimals, getCurrenySymbol } from '../../../utils'
import { Alert, Confirm, Modal, TaxBillRows, FeeBillRows } from '../../Shared'
import { Button, Input } from '../../../styles'
import { RecordCircleFill, Circle } from 'react-bootstrap-icons'

import {
  OrderBillContainer,
  RefundButtonWrapper,
  RefundContainer,
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

export const OrderBill = (props) => {
  const {
    order,
    actionStatus,
    handleRefundPaymentsStripe,
    handleRefundPaymentsPlugin,
    getPluginRefundProvider = () => null,
    handleOrderRefund,
    viewOnly
  } = props

  const isGiftCardOrder = order?.products?.[0]?.type === 'gift_card'
  const [, t] = useLanguage()
  const [{ parsePrice, parseNumber }] = useUtils()
  const [{ configs }] = useConfig()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
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
      name: t('CASH_WALLET', 'Cash Wallet')
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
        content: t('QUESTION_REFUND_ORDER', 'Do you want to refund this order? This action is irreversible.'),
        handleOnAccept: () => {
          setConfirm({ ...confirm, open: false })
          handleRefundPaymentsPlugin()
        }
      })
    } else {
      setConfirm({
        open: true,
        content: t('QUESTION_REFUND_ORDER', 'Do you want to refund this order? This action is irreversible.'),
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

  return (
    <OrderBillContainer>
      {!hideOrderPrices && (<>
      <table>
        <tbody>
          {!isCustomOrder && (
            <tr>
              <td>{t('SUBTOTAL', 'Subtotal')}</td>
              <td>
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
              <td>- {parsePrice(order?.summary?.discount ?? order?.discount, { currency: getCurrenySymbol(order?.currency) })}</td>
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
                <td>
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
                <td>{parsePrice((order?.summary?.subtotal_with_discount + getIncludedTaxesDiscounts() ?? 0), { currency: getCurrenySymbol(order?.currency) })}</td>
                  )
                : (
                <td>{parsePrice(order?.summary?.subtotal_with_discount ?? 0, { currency: getCurrenySymbol(order?.currency) })}</td>
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
                <td>{parsePrice(order?.summary?.tax ?? 0, { currency: getCurrenySymbol(order?.currency) })}</td>
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
                <td>{parsePrice(order?.summary?.service_fee ?? 0, { currency: getCurrenySymbol(order?.currency) })}</td>
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
                <td>
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
              <td>{formatPrice(order?.summary?.delivery_price + getIncludedTaxes(true))}</td>
            </tr>
          )}
          {isCustomOrder && declaredValue > 0 && (
            <tr>
              <td>{t('DECLARED_VALUE', 'Declared value')}</td>
              <td>{parsePrice(declaredValue, { currency: getCurrenySymbol(order?.currency) })}</td>
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
                <td>
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
              <td>{parsePrice(order?.summary?.driver_tip ?? order?.totalDriverTip, { currency: getCurrenySymbol(order?.currency) })}</td>
            </tr>
          )}
          {extraValueAdjustment?.length > 0 && extraValueAdjustment?.map(extra => (
            <tr key={extra?.key}>
              <td>
                {pulseCouponName?.value ? pulseCouponName?.value : t(extra?.key?.toUpperCase(), extra?.key)}{' '}
              </td>
              <td>{parseFloat(extra?.value) > 0
                ? parsePrice(parseFloat(extra?.value), { currency: getCurrenySymbol(order?.currency) })
                : `- ${parsePrice(parseFloat(extra?.value) * -1, { currency: getCurrenySymbol(order?.currency) })}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className='total'>
        <tbody>
          <tr>
            <td>
              {isCustomOrder
                ? t('ESTIMATED_TOTAL', 'Estimated Total')
                : t('TOTAL', 'Total')
              }
            </td>
            <td>
              {isCustomOrder
                ? `~ ${parsePrice((order?.summary?.total ?? order?.total ?? 0) + (declaredValue || 0), { currency: getCurrenySymbol(order?.currency) })}`
                : parsePrice(order?.summary?.total ?? order?.total, { currency: getCurrenySymbol(order?.currency) })
              }
            </td>
          </tr>
        </tbody>
      </table>
      </>)}
      {order?.payment_events?.length > 0 && (
        <table className='payments'>
          <thead>
            <tr>
              <th colSpan='2'>{t('PAYMENTS', 'Payments')}</th>
            </tr>
          </thead>
          <tbody>
            {order?.payment_events?.filter(item => item.event === 'payment').map((event, i) => (
              <tr key={i}>
                <td>
                  {`${['cash', 'card_delivery'].includes(event?.paymethod?.gateway) ? `${t('NOT_PREPAID', 'NOT PREPAID')}: ` : ''}`}
                  {event?.wallet_event
                    ? walletName[event?.wallet_event?.wallet?.type]?.name
                    : event?.paymethod
                      ? t(event?.paymethod?.gateway?.toUpperCase(), event?.paymethod?.name)
                      : event?.data?.gateway
                        ? t(event?.data?.gateway?.toUpperCase(), getGatewayHumanLabel(event?.data?.gateway))
                        : walletName[event?.data?.wallet_currency]?.name}
                </td>
                {!isCustomOrder && (
                  <td>
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
      {!isGiftCardOrder && !viewOnly && (
        <RefundToWallet
          order={order}
          actionStatus={actionStatus}
          handleOrderRefund={handleOrderRefund}
          stripePaymethods={stripePaymethods}
          braintreePaymethods={braintreePaymethods}
        />
      )}
      {order?.payment_events?.filter(item => item.event === 'refund').length > 0 && (
        <table className='payments'>
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
                <td>{parsePrice(event?.amount, { currency: getCurrenySymbol(order?.currency) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {parseInt(order?.delivery_type, 10) !== 9 && (
        <table className='delivery_option'>
          <thead>
            <tr>
              <th colSpan='2'>{t('DELIVERY_PREFERENCE', 'Delivery Preference')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{order?.delivery_option ? t(getTranslationKeyFromLabelName(order?.delivery_option?.name), order?.delivery_option?.name) : t('EITHER_WAY', 'Either way')}</td>
            </tr>
          </tbody>
        </table>
      )}
      {order?.comment && (
        <table className='comments'>
          <tbody>
            <tr>
              <td style={{ color: '#000', fontWeight: 600 }}>{t('COMMENT', 'Comment')}</td>
              <td>{order?.comment}</td>
            </tr>
          </tbody>
        </table>
      )}
      {order?.spot_number && (
        <table className='spot_number'>
          <tbody>
            <tr>
              <td>{SPOT_DICTIONARY[order?.delivery_type]}</td>
              <td>{order?.spot_number}</td>
            </tr>
          </tbody>
        </table>
      )}
      {order?.vehicle && (
        <table className='vehicle'>
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

      {!isGiftCardOrder && (!order?.refund_data || (refundProvider?.partial && order?.refund_data === 'partially_refunded')) && (stripePaymethods.includes(order?.paymethod?.gateway) || !!refundProvider) && !viewOnly && (
        <RefundButtonWrapper>
          <Button
            color='primary'
            borderRadius='8px'
            disabled={actionStatus?.loading || order?.payment_events?.find(item => item.event === 'refund' && (stripePaymethods.includes(item?.paymethod?.gateway) || !!getPluginRefundProvider(item?.paymethod?.gateway)))}
            onClick={onClickRefund}
          >
            {t('REFUND', 'Refund')}
          </Button>
        </RefundButtonWrapper>
      )}

      <Alert
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
      <Confirm
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
      {openPluginRefund && (
        <Modal
          width='500px'
          open={openPluginRefund}
          onClose={() => setOpenPluginRefund(false)}
        >
          <RefundContainer autoComplete='off' onSubmit={(e) => e.preventDefault()}>
            <h2>{t('REFUND', 'Refund')}</h2>
            <p>{t('QUESTION_REFUND_AMOUNT', 'How do you want to refund?')}</p>
            <RadioItemContainer
              active={isRefundAll}
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
            <Button
              color='primary'
              borderRadius='8px'
              disabled={actionStatus?.loading}
              onClick={handlePluginRefundSubmit}
              style={{ marginTop: '20px' }}
            >
              {t('REFUND', 'Refund')}
            </Button>
          </RefundContainer>
        </Modal>
      )}
    </OrderBillContainer>
  )
}
