import React from 'react'
import { useLanguage, useUtils, useConfig } from '../../../../../index'
import { verifyDecimals } from '../../../utils'
import { TaxBillRows, FeeBillRows } from '../../Shared'

import {
  OpenCartBillContainer
} from './styles'

export const OpenCartBill = (props) => {
  const {
    cart
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice, parseNumber }] = useUtils()
  const [{ configs }] = useConfig()
  const extraValueAdjustment = cart?.metafields?.filter?.(meta => meta?.key?.includes('extra_value') && ![0, -0].includes(parseFloat(meta?.value)))
  const pulseCouponName = cart?.metafields?.find?.(meta => meta?.key === 'pulse_coupon_name')
  const walletName = {
    cash: {
      name: t('CASH_WALLET', 'Cash Wallet')
    },
    credit_point: {
      name: t('POINTS_WALLET', 'Points Wallet')
    }
  }

  const getIncludedTaxes = (isDeliveryFee) => {
    if (cart?.taxes === null) {
      return cart?.business.tax_type === 1 ? cart?.tax : 0
    } else {
      return cart?.taxes.reduce((taxIncluded, tax) => {
        return taxIncluded + (((!isDeliveryFee && tax.type === 1 && tax.target === 'product') || (isDeliveryFee && tax.type === 1 && tax.target === 'delivery_fee')) ? tax.summary?.tax : 0)
      }, 0)
    }
  }

  const getIncludedTaxesDiscounts = () => {
    return cart?.taxes?.filter(tax => (tax?.type === 1 && tax?.target === 'product'))?.reduce((carry, tax) => carry + (tax?.summary?.tax_after_discount ?? tax?.summary?.tax), 0)
  }

  return (
    <OpenCartBillContainer>
      <table>
        <tbody>
          <tr>
            <td>{t('SUBTOTAL', 'Subtotal')}</td>
            <td>
              {parsePrice(cart?.subtotal + getIncludedTaxes())}
            </td>
          </tr>
          {cart?.discount > 0 && cart?.total >= 0 && cart?.offers?.length === 0 && (
            <tr>
              {cart?.discount_type === 1
                ? (
                  <td>
                    {t('DISCOUNT', 'Discount')}{' '}
                    <span>{`(${verifyDecimals(cart?.discount_rate, parsePrice)}%)`}</span>
                  </td>
                  )
                : (
                  <td>{t('DISCOUNT', 'Discount')}</td>
                  )}
              <td>- {parsePrice(cart?.discount || 0)}</td>
            </tr>
          )}
          {
            cart?.offers?.length > 0 && cart?.offers?.filter(offer => offer?.target === 1)?.map(offer => (
              <tr key={offer.id}>
                <td>
                  {offer.name}
                  {offer.rate_type === 1 && (
                    <span>{`(${verifyDecimals(offer?.rate, parsePrice)}%)`}</span>
                  )}
                </td>
                <td>
                  - {parsePrice(offer?.summary?.discount)}
                </td>
              </tr>
            ))
          }
          {cart?.subtotal_with_discount > 0 && cart?.discount > 0 && cart?.total >= 0 && (
            <tr>
              <td>{t('SUBTOTAL_WITH_DISCOUNT', 'Subtotal with discount')}</td>
              {cart?.business?.tax_type === 1
                ? (
                  <td>{parsePrice(cart?.subtotal_with_discount + getIncludedTaxesDiscounts() ?? 0)}</td>
                  )
                : (
                  <td>{parsePrice(cart?.subtotal_with_discount ?? 0)}</td>
                  )}
            </tr>
          )}
          <TaxBillRows
            taxes={cart?.taxes}
            target='product'
            parsePrice={parsePrice}
            parseNumber={parseNumber}
            t={t}
          />
          <FeeBillRows
            fees={cart?.fees}
            parsePrice={parsePrice}
            t={t}
          />
          {
            cart?.offers?.length > 0 && cart?.offers?.filter(offer => offer?.target === 3)?.map(offer => (
              <tr key={offer.id}>
                <td>
                  {offer.name}
                  {offer?.rate_type === 1 && (
                    <span>{`(${verifyDecimals(offer?.rate, parsePrice)}%)`}</span>
                  )}
                </td>
                <td>
                  - {parsePrice(offer?.summary?.discount)}
                </td>
              </tr>
            ))
          }
          <TaxBillRows
            taxes={cart?.taxes}
            target='order'
            parsePrice={parsePrice}
            parseNumber={parseNumber}
            t={t}
          />
          {parseFloat((cart?.delivery_price ?? 0) + getIncludedTaxes(true)) !== 0 && (
            <tr>
              <td>{t('DELIVERY_FEE', 'Delivery Fee')}</td>
              <td>{parsePrice(cart?.delivery_price + getIncludedTaxes(true))}</td>
            </tr>
          )}
          <TaxBillRows
            taxes={cart?.taxes}
            target='delivery_fee'
            parsePrice={parsePrice}
            parseNumber={parseNumber}
            t={t}
          />
          {
            cart?.offers?.length > 0 && cart?.offers?.filter(offer => offer?.target === 2)?.map(offer => (
              <tr key={offer.id}>
                <td>
                  {offer.name}
                  {offer?.rate_type === 1 && (
                    <span>{`(${verifyDecimals(offer?.rate, parsePrice)}%)`}</span>
                  )}
                </td>
                <td>
                  - {parsePrice(offer?.summary?.discount)}
                </td>
              </tr>
            ))
          }
          {cart?.driver_tip > 0 && (
            <tr>
              <td>
                {t('DRIVER_TIP', 'Driver tip')}{' '}
                {cart?.driver_tip_rate > 0 &&
                  parseInt(configs?.driver_tip_type?.value, 10) === 2 &&
                  !parseInt(configs?.driver_tip_use_custom?.value, 10) &&
                  (
                    <span>{`(${verifyDecimals(cart?.driver_tip_rate, parseNumber)}%)`}</span>
                  )}
              </td>
              <td>{parsePrice(cart?.driver_tip)}</td>
            </tr>
          )}
          {extraValueAdjustment?.length > 0 && extraValueAdjustment?.map(extra => (
            <tr key={extra?.key}>
              <td>
                {pulseCouponName?.value ? pulseCouponName?.value : t(extra?.key?.toUpperCase(), extra?.key)}{' '}
              </td>
              <td>{parseFloat(extra?.value) > 0 ? parsePrice(parseFloat(extra?.value)) : `- ${parsePrice(parseFloat(extra?.value) * -1)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className='total'>
        <tbody>
          <tr>
            <td>{t('TOTAL', 'Total')}</td>
            <td>{parsePrice(cart?.total >= 0 ? cart?.total : 0)}</td>
          </tr>
        </tbody>
      </table>
      {cart?.payment_events?.length > 0 && (
        <table className='payments'>
          <thead>
            <tr>
              <th colSpan={2}>{t('PAYMENTS', 'Payments')}</th>
            </tr>
          </thead>
          <tbody>
            {cart?.payment_events?.map((event, i) => (
              <tr key={i}>
                <td>
                  {event?.wallet_event
                    ? walletName[event?.wallet_event?.wallet?.type]?.name
                    : event?.paymethod?.name}
                </td>
                <td>-{parsePrice(event?.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {cart?.comment && (
        <table className='comments'>
          <tbody>
            <tr>
              <td>{t('COMMENT', 'Comment')}</td>
              <td>{cart?.comment}</td>
            </tr>
          </tbody>
        </table>
      )}
    </OpenCartBillContainer>
  )
}
