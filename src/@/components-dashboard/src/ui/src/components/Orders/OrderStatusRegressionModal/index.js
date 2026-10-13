import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Modal } from '../../Shared'
import { Button, TextArea } from '../../../styles'
import { getOrderStatus } from '../../../utils'
import {
  RegressionContainer,
  StatusTransition,
  ReasonContainer,
  ActionsContainer
} from './styles'

export const OrderStatusRegressionModal = (props) => {
  const {
    open,
    orderId,
    ordersCount,
    currentStatus,
    newStatus,
    loading,
    onSubmit,
    onClose
  } = props

  const [, t] = useLanguage()
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) setReason('')
  }, [open])

  const getStatusName = (status) => {
    const orderStatus = getOrderStatus(parseInt(status))
    return orderStatus ? t(orderStatus.slug, orderStatus.value) : status
  }

  const trimmedReason = reason.trim()
  const isDisabled = !trimmedReason || loading

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isDisabled) return
    onSubmit(trimmedReason)
  }

  if (!open) return null

  return (
    <Modal
      width='600px'
      open={open}
      onClose={onClose}
    >
      <RegressionContainer onSubmit={handleSubmit} autoComplete='off'>
        <h2>{t('ORDER_STATUS_REGRESSION_TITLE', 'Reason required to change the status')}</h2>
        <StatusTransition>
          {ordersCount != null
            ? <>{ordersCount} {t('ORDERS', 'Orders')} → <span>{getStatusName(newStatus)}</span></>
            : <>{t('ORDER', 'Order')} #{orderId}: <span>{getStatusName(currentStatus)}</span> → <span>{getStatusName(newStatus)}</span></>}
        </StatusTransition>
        <p>{t('ORDER_STATUS_REGRESSION_DESCRIPTION', 'Moving an order back to a previous status requires a reason. Write it to confirm the change or cancel to keep the current status.')}</p>
        <ReasonContainer>
          <label htmlFor='order-status-regression-reason'>{t('REASON', 'Reason')}</label>
          <TextArea
            id='order-status-regression-reason'
            rows={3}
            autoFocus
            value={reason}
            placeholder={t('WRITE_THE_REASON', 'Write the reason')}
            onChange={e => setReason(e.target.value)}
          />
        </ReasonContainer>
        <ActionsContainer>
          <Button
            type='button'
            color='secundary'
            borderRadius='8px'
            disabled={loading}
            onClick={onClose}
          >
            {t('CANCEL', 'Cancel')}
          </Button>
          <Button
            type='submit'
            color='primary'
            borderRadius='8px'
            disabled={isDisabled}
          >
            {t('CONFIRM', 'Confirm')}
          </Button>
        </ActionsContainer>
      </RegressionContainer>
    </Modal>
  )
}
