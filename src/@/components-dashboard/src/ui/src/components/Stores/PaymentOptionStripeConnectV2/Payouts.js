import React from 'react'
import { Link } from 'react-router-dom'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage, useUtils, PayoutsList as PayoutsListController } from '../../../../../index'
import { Pagination } from '../../Shared'
import {
  PayoutAmount,
  PayoutBadge,
  PayoutCard,
  PayoutDate,
  PayoutError,
  PayoutHeader,
  PayoutLine,
  PayoutLines,
  PayoutOrder,
  PayoutReason,
  PayoutsEmpty,
  PayoutsHelp,
  PayoutsStack,
  PayoutsPagination
} from './styles'

const formatAmount = (amount, currency) => {
  if (amount === null || amount === undefined) return '—'
  return `${Number(amount).toFixed(2)} ${String(currency || '').toUpperCase()}`.trim()
}

const PayoutsUI = (props) => {
  const {
    payoutsState,
    paginationProps,
    handleChangePage,
    handleChangePageSize
  } = props

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()

  const statusCopy = {
    paid: t('PAYOUT_STATUS_PAID', 'Paid'),
    pending: t('PAYOUT_STATUS_PENDING', 'Pending'),
    needs_review: t('PAYOUT_STATUS_NEEDS_REVIEW', 'Distribution needs review')
  }
  const reasonCopy = {
    no_charge: t('PAYOUT_REASON_NO_CHARGE', 'Stripe has no paid charge for this order.'),
    charge_mismatch: t('PAYOUT_REASON_CHARGE_MISMATCH', 'The charge does not match the order total.'),
    charge_refunded: t('PAYOUT_REASON_CHARGE_REFUNDED', 'The charge was refunded before the order was completed.'),
    currency_converted: t('PAYOUT_REASON_CURRENCY_CONVERTED', 'Stripe settled the charge in another currency.'),
    no_driver: t('PAYOUT_REASON_NO_DRIVER', 'The delivery was completed with no driver assigned.'),
    no_platform_rule: t('PAYOUT_REASON_NO_PLATFORM_RULE', 'No platform fee rule was saved when the order was placed.'),
    no_driver_rule: t('PAYOUT_REASON_NO_DRIVER_RULE', 'No driver payment rule was saved when the order was placed.'),
    negative_restaurant: t('PAYOUT_REASON_NEGATIVE_RESTAURANT', 'The platform fee and the driver payment are more than what is left for the store.'),
    no_restaurant_account: t('PAYOUT_REASON_NO_RESTAURANT_ACCOUNT', 'Waiting for the store to connect a Stripe account.'),
    no_driver_account: t('PAYOUT_REASON_NO_DRIVER_ACCOUNT', 'Waiting for the driver to connect a Stripe account.'),
    transfer_failed: t('PAYOUT_REASON_TRANSFER_FAILED', 'Stripe refused a transfer.')
  }

  // A part that is not paid yet says so next to its name
  const withStatus = (label, status) => status && status !== 'paid' ? `${label} (${statusCopy[status] || status})` : label

  return (
    <PayoutsStack>
      <PayoutsHelp>
        {t('PAYOUTS_HELP', 'A part is paid once it is transferred to its Stripe account. When it reaches the bank depends on Stripe.')}
      </PayoutsHelp>

      {payoutsState.loading && <Skeleton height={72} count={3} />}

      {!payoutsState.loading && payoutsState.error && (
        <PayoutError role='alert'>{payoutsState.error.join(' ')}</PayoutError>
      )}

      {!payoutsState.loading && !payoutsState.error && payoutsState.payouts.length === 0 && (
        <PayoutsEmpty>
          {t('PAYOUTS_EMPTY', 'No payouts yet. They appear here once an order paid with Stripe Connect v2 is completed.')}
        </PayoutsEmpty>
      )}

      {!payoutsState.loading && !payoutsState.error && payoutsState.payouts.map(payout => {
        // An administrator gets the whole split of the order; a store owner, the part of the store
        const isWholeSplit = payout.status !== undefined
        const status = isWholeSplit ? payout.status : payout.restaurant_status
        const driverName = [payout.driver?.name, payout.driver?.lastname].filter(Boolean).join(' ')
        return (
          <PayoutCard key={payout.id} data-testid={`payout-${payout.id}`}>
            <PayoutHeader>
              <div>
                <PayoutOrder>
                  <Link to={`/orders?id=${payout.order_id}`}>
                    {t('ORDER_NO', 'Order No.')} {payout.order_id}
                  </Link>
                </PayoutOrder>
                <PayoutDate>{parseDate(payout.created_at)}</PayoutDate>
              </div>
              {status && <PayoutBadge $status={status}>{statusCopy[status] || status}</PayoutBadge>}
            </PayoutHeader>
            <PayoutLines>
              {isWholeSplit && (
                <>
                  <PayoutLine>
                    <span>{t('PAYOUT_PART_TOTAL', 'Customer paid')}</span>
                    <PayoutAmount>{formatAmount(payout.total, payout.currency)}</PayoutAmount>
                  </PayoutLine>
                  <PayoutLine>
                    <span>{t('PAYOUT_PART_STRIPE_FEE', 'Stripe fee')}</span>
                    <PayoutAmount>{formatAmount(payout.stripe_fee, payout.currency)}</PayoutAmount>
                  </PayoutLine>
                  <PayoutLine>
                    <span>{t('PAYOUT_PART_PLATFORM', 'Platform')}</span>
                    <PayoutAmount>{formatAmount(payout.platform_amount, payout.currency)}</PayoutAmount>
                  </PayoutLine>
                  {payout.driver_id && (
                    <PayoutLine>
                      <span>
                        {withStatus(t('PAYOUT_PART_DRIVER', 'Driver'), payout.driver_status)}
                        {driverName && `: ${driverName}`}
                      </span>
                      <PayoutAmount>{formatAmount(payout.driver_amount, payout.currency)}</PayoutAmount>
                    </PayoutLine>
                  )}
                </>
              )}
              <PayoutLine $strong>
                <span>{withStatus(t('PAYOUT_PART_STORE', 'Store'), isWholeSplit ? payout.restaurant_status : null)}</span>
                <PayoutAmount>{formatAmount(payout.restaurant_amount, payout.currency)}</PayoutAmount>
              </PayoutLine>
            </PayoutLines>
            {payout.review_reason && (
              <PayoutReason>{reasonCopy[payout.review_reason] || payout.review_reason}</PayoutReason>
            )}
          </PayoutCard>
        )
      })}

      {!payoutsState.loading && !payoutsState.error && paginationProps.totalPages > 1 && (
        <PayoutsPagination>
          <Pagination
            currentPage={paginationProps.currentPage}
            totalPages={paginationProps.totalPages}
            handleChangePage={handleChangePage}
            defaultPageSize={paginationProps.pageSize}
            handleChangePageSize={handleChangePageSize}
          />
        </PayoutsPagination>
      )}
    </PayoutsStack>
  )
}

export const Payouts = (props) => (
  <PayoutsListController
    {...props}
    UIComponent={PayoutsUI}
  />
)
