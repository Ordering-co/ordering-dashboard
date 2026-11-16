import React, { useState } from 'react'
import { useLanguage, useSession } from '../../../../../index'
import { getUserType } from '../../../utils'
import { getOrderStatusFamily } from '../../../utils/orderStatusFamily'
import { Button } from '../../Shared/Product/Button'
import { ConfirmDialog } from '../../Shared/Product/Dialog'
import { Check } from '../../Shared/Icon'
import { OrderStatusTypeSelector } from '../OrderStatusTypeSelector'
import { OrderStatusRegressionModal } from '../OrderStatusRegressionModal'
import './details-tab.css'

// The statuses the primary actions move an order to (same codes the status selector sends).
const STATUS_PENDING = 0
const STATUS_ACCEPTED_BY_BUSINESS = 7
const STATUS_PREPARATION_COMPLETED = 4
const STATUS_REJECTED_BY_ADMIN = 2
const STATUS_REJECTED_BY_BUSINESS = 5
const STATUS_ORDER_NOT_READY = 14

/**
 * Pinned foot of the order panel: one primary action by state (batch 5.3).
 *  pending (0)                     Accept order (status 7) · Reject… (confirmation; status 2 for an admin,
 *                                  level 0, and 5 for any other level: owner decision 2026-10-06)
 *  accepted (7) / not ready (14)   Mark as ready (status 4)
 *  any order, closed ones too      the status selector of always, as the secondary action
 *  closed (done / cancel family)   the selector is the only control (no primary action)
 *  read-only profiles              the selector disabled and no action (same as main, which showed
 *                                  it with `viewOnly` instead of hiding it)
 * Which statuses the selector offers, and whether a final status is locked for the user level or
 * project, stays inside `OrderStatusTypeSelector`, as in main. It opens upward when the foot is
 * near the bottom of the viewport (`placement='auto'`).
 * Every change goes through `handleUpdateOrderStatus` of the controller (same endpoint, same
 * headers, same regression flow); this component sends nothing by itself.
 * Rejecting asks for no reason: the API has no list of reasons and the customer sees none; the
 * confirmation names the status the order is going to.
 */
export const DetailsFooter = (props) => {
  const { handleUpdateOrderStatus } = props
  const { order } = props.order ?? {}

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const readOnlyBusinessOwner = !getUserType('viewOnlyBusinessOwner') && getUserType('readOnlyBusinessOwner')
  const readOnlyDeliveryManager = getUserType('readOnlyDeliveryManager')
  const readOnlyAdmin = getUserType('readOnlyAdmin')
  const [busy, setBusy] = useState(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [regression, setRegression] = useState(null)
  const [regressionLoading, setRegressionLoading] = useState(false)

  const viewOnly = readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner
  if (!order?.id) return null

  const status = parseInt(order.status)
  const family = getOrderStatusFamily(status)
  const isClosed = family === 'done' || family === 'cancel'
  // Closed orders and read-only profiles get the selector alone: no primary action.
  const hasActions = !viewOnly && !isClosed

  const change = async (action, newStatus) => {
    setBusy(action)
    try {
      const response = await handleUpdateOrderStatus({ id: order.id, newStatus })
      if (response?.regressionRequired) setRegression({ newStatus })
      return response
    } finally {
      setBusy(null)
    }
  }

  // redesign fix-qa E6 (owner decision): an admin rejects as admin (2), anyone else as the business (5).
  const rejectStatus = user?.level === 0 ? STATUS_REJECTED_BY_ADMIN : STATUS_REJECTED_BY_BUSINESS
  const rejectStatusLabel = rejectStatus === STATUS_REJECTED_BY_ADMIN
    ? t('REJECTED_BY_ADMIN', 'Rejected by Admin')
    : t('REJECTED_BY_BUSINESS', 'Rejected by business')

  const handleReject = async () => {
    await change('reject', rejectStatus)
    setConfirmReject(false)
  }

  const handleSubmitRegressionReason = async (reasons) => {
    setRegressionLoading(true)
    try {
      await handleUpdateOrderStatus({ id: order.id, newStatus: regression.newStatus, reasons })
    } finally {
      setRegressionLoading(false)
      setRegression(null)
    }
  }

  const isPending = hasActions && status === STATUS_PENDING
  const canMarkReady = hasActions && (status === STATUS_ACCEPTED_BY_BUSINESS || status === STATUS_ORDER_NOT_READY)
  const isBusy = !!busy

  return (
    <div className='odt-foot odc-root' role='group' aria-label={t('ORDER_ACTIONS', 'Order actions')}>
      <div className='odt-foot-selector'>
        <OrderStatusTypeSelector
          isFirstSelect
          noPadding
          orderId={order.id}
          deliveryType={order?.delivery_type}
          defaultValue={status}
          handleUpdateOrderStatus={handleUpdateOrderStatus}
          viewOnly={viewOnly}
          placement='auto'
          ariaLabel={t('ORDER_STATUS', 'Order status')}
          hideErrorAlert
        />
      </div>
      {isPending && (
        <>
          <Button size='lg' disabled={isBusy} onClick={() => setConfirmReject(true)}>
            {`${t('REJECT', 'Reject')}…`}
          </Button>
          <Button
            size='lg'
            variant='primary'
            icon={Check}
            busy={busy === 'accept'}
            disabled={isBusy && busy !== 'accept'}
            onClick={() => change('accept', STATUS_ACCEPTED_BY_BUSINESS)}
          >
            {t('ACCEPT_ORDER', 'Accept order')}
          </Button>
        </>
      )}
      {canMarkReady && (
        <Button
          size='lg'
          variant='primary'
          busy={busy === 'ready'}
          disabled={isBusy && busy !== 'ready'}
          onClick={() => change('ready', STATUS_PREPARATION_COMPLETED)}
        >
          {t('MARK_AS_READY', 'Mark as ready')}
        </Button>
      )}
      <ConfirmDialog
        open={confirmReject}
        title={t('REJECT_ORDER_TITLE', 'Reject order #_id_?').replace('_id_', order.id)}
        confirmLabel={t('REJECT_ORDER', 'Reject order')}
        cancelLabel={t('KEEP_ORDER', 'Keep order')}
        closeLabel={t('CLOSE', 'Close')}
        busy={busy === 'reject'}
        onConfirm={handleReject}
        onCancel={() => setConfirmReject(false)}
      >
        {t('REJECT_ORDER_CONSEQUENCE', 'The order moves to _status_.').replace('_status_', rejectStatusLabel)}
      </ConfirmDialog>
      <OrderStatusRegressionModal
        open={!!regression}
        orderId={order.id}
        currentStatus={status}
        newStatus={regression?.newStatus}
        loading={regressionLoading}
        onSubmit={handleSubmitRegressionReason}
        onClose={() => setRegression(null)}
      />
    </div>
  )
}
