import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Button, Dialog, StatusBadge } from '../../Shared/Product'
import { ArrowRight } from '../../Shared/Icon'
import { getOrderStatus } from '../../../utils'
import { getOrderStatusFamily } from '../../../utils/orderStatusFamily'
import './order-status-regression.css'

export const OrderStatusRegressionModal = (props) => {
  const {
    open,
    loading,
    onSubmit,
    onClose
  } = props

  const [, t] = useLanguage()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const fieldId = useId()
  const errorId = useId()
  const reasonRef = useRef(null)
  // The caller clears its request as soon as the dialog closes; the last one keeps the text
  // steady while the dialog fades out.
  const lastRequest = useRef(props)
  if (open) lastRequest.current = props
  const { orderId, ordersCount, currentStatus, newStatus } = lastRequest.current

  useEffect(() => {
    if (!open) {
      setReason('')
      setTouched(false)
    }
  }, [open])

  const getStatusName = (status) => {
    const orderStatus = getOrderStatus(parseInt(status))
    return orderStatus ? t(orderStatus.slug, orderStatus.value) : status
  }

  const renderStatus = (status) => (
    <StatusBadge family={getOrderStatusFamily(status)} label={getStatusName(status)} />
  )

  const trimmedReason = reason.trim()
  const isDisabled = !trimmedReason || loading
  const showError = touched && !trimmedReason

  const handleSubmit = () => {
    if (isDisabled) return
    onSubmit(trimmedReason)
  }

  return (
    <Dialog
      open={!!open}
      onOpenChange={(next) => { if (!next) onClose() }}
      size='md'
      title={t('ORDER_STATUS_REGRESSION_TITLE', 'Reason required to change the status')}
      closeLabel={t('CLOSE', 'Close')}
      initialFocus={reasonRef}
      description={(
        <>
          <p className='odc-regression-transition'>
            {ordersCount != null
              ? (
                <>
                  <span>{ordersCount} {t('ORDERS', 'Orders')}</span>
                  <ArrowRight className='odc-icon odc-icon-flip odc-regression-arrow' aria-hidden='true' />
                  <span className='odc-sr-only'>{t('TO', 'to')}</span>
                  {renderStatus(newStatus)}
                </>
                )
              : (
                <>
                  <span>{t('ORDER', 'Order')} <span className='odc-mono'>#{orderId}</span>:</span>
                  {renderStatus(currentStatus)}
                  <ArrowRight className='odc-icon odc-icon-flip odc-regression-arrow' aria-hidden='true' />
                  <span className='odc-sr-only'>{t('TO', 'to')}</span>
                  {renderStatus(newStatus)}
                </>
                )}
          </p>
          <p className='odc-regression-explain'>
            {t('ORDER_STATUS_REGRESSION_DESCRIPTION', 'Moving an order back to a previous status requires a reason. Write it to confirm the change or cancel to keep the current status.')}
          </p>
        </>
      )}
      footer={(
        <>
          <Button disabled={loading} onClick={onClose}>
            {t('CANCEL', 'Cancel')}
          </Button>
          <Button variant='primary' busy={!!loading} disabled={isDisabled} onClick={handleSubmit}>
            {t('CONFIRM', 'Confirm')}
          </Button>
        </>
      )}
    >
      <div className='odc-regression-field'>
        <label className='odc-regression-label' htmlFor={fieldId}>{t('REASON', 'Reason')}</label>
        <textarea
          id={fieldId}
          ref={reasonRef}
          className='odc-regression-reason'
          rows={3}
          value={reason}
          placeholder={t('WRITE_THE_REASON', 'Write the reason')}
          aria-invalid={showError ? 'true' : undefined}
          aria-describedby={showError ? errorId : undefined}
          onChange={e => {
            setReason(e.target.value)
            setTouched(true)
          }}
        />
        {showError && <p id={errorId} className='odc-regression-error'>{t('REASON_IS_REQUIRED', 'A reason is required.')}</p>}
      </div>
    </Dialog>
  )
}
