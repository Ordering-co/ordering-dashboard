import React from 'react'
import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import MdClose from '@meronex/icons/ios/MdClose'
import { DragScroll } from '../../Shared'
import {
  SubFilterContainer
} from './styles'

export const OrderStatusSubFilter = (props) => {
  const {
    selectedSubOrderStatus,
    ordersStatusGroup,
    handleSelectedSubOrderStatus
  } = props

  const [, t] = useLanguage()

  const statues = {
    pending: [
      { key: 0, value: t('PENDING', 'Pending') },
      { key: 13, value: t('PREORDER', 'Preorder') }
    ],
    inProgress: [
      { key: 7, value: t('ACCEPTED_BY_BUSINESS', 'Accepted by business') },
      { key: 4, value: t('PREPARATION_COMPLETED', 'Preparation Completed') },
      { key: 8, value: t('ACCEPTED_BY_DRIVER', 'Accepted by driver') },
      { key: 3, value: t('ORDER_STATUS_IN_BUSINESS', 'Driver arrived to business') },
      { key: 9, value: t('PICK_UP_COMPLETED_BY_DRIVER', 'Pick up completed by driver') },
      { key: 14, value: t('ORDER_NOT_READY', 'Order not ready') },
      { key: 18, value: t('ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS', 'Driver almost arrived to business') },
      { key: 19, value: t('ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER', 'Driver almost arrived to customer') },
      { key: 20, value: t('ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS', 'Customer almost arrived to business') },
      { key: 21, value: t('ORDER_CUSTOMER_ARRIVED_BUSINESS', 'Customer arrived to business') },
      { key: 22, value: t('ORDER_LOOKING_FOR_DRIVER', 'Looking for driver') },
      { key: 23, value: t('ORDER_DRIVER_ON_WAY', 'Driver on way') },
      { key: 24, value: t('ORDER_STATUS_DRIVER_WAITING_FOR_ORDER', 'Driver waiting for order') },
      { key: 25, value: t('ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY', 'Accepted by driver company') },
      { key: 26, value: t('ORDER_DRIVER_ARRIVED_CUSTOMER', 'Driver arrived to customer') }
    ],
    completed: [
      { key: 1, value: t('COMPLETED_BY_ADMIN', 'Completed by admin') },
      { key: 11, value: t('DELIVERY_COMPLETED_BY_DRIVER', 'Delivery completed by driver') },
      { key: 15, value: t('ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER', 'Pickup completed by customer') }
    ],
    cancelled: [
      { key: 2, value: t('REJECTED_BY_ADMIN', 'Rejected by admin') },
      { key: 5, value: t('REJECTED_BY_BUSINESS', 'Rejected by business') },
      { key: 6, value: t('REJECTED_BY_DRIVER', 'Rejected by driver') },
      { key: 10, value: t('PICK_UP_FAILED_BY_DRIVER', 'Pick up Failed by driver') },
      { key: 12, value: t('DELIVERY_FAILED_BY_DRIVER', 'Delivery Failed by driver') },
      { key: 16, value: t('ORDER_STATUS_CANCELLED_BY_CUSTOMER', 'Cancelled by customer') },
      { key: 17, value: t('ORDER_NOT_PICKEDUP_BY_CUSTOMER', 'Not picked by customer') }
    ]
  }

  const handleChange = (status) => {
    let statuses = [...selectedSubOrderStatus[ordersStatusGroup]]
    if (statuses.includes(status)) {
      statuses = statuses.length === 1
        ? statues[ordersStatusGroup].sort().map(s => s.key)
        : statues[ordersStatusGroup].map(s => s.key).sort().join('') === selectedSubOrderStatus[ordersStatusGroup].sort().join('')
          ? statuses.filter(_status => _status === status)
          : statuses.filter(_status => _status !== status)
    } else if (status !== 'all') {
      statuses.push(status)
    }
    handleSelectedSubOrderStatus({
      ...selectedSubOrderStatus,
      [ordersStatusGroup]: status === 'all' ? statues[ordersStatusGroup].sort().map(s => s.key) : statuses
    })
  }

  return (
    <SubFilterContainer>
      <DragScroll>
        <Button
          color={statues[ordersStatusGroup].map(s => s.key).sort().join('') === selectedSubOrderStatus[ordersStatusGroup].sort().join('')
            ? 'primary'
            : 'secundaryDark'}
          onClick={() => handleChange('all')}
        >
          {t('ALL', 'All')}
        </Button>
        {statues[ordersStatusGroup].map(status => (
          <Button
            key={status.key}
            color={(selectedSubOrderStatus?.pending.includes(status.key) ||
              selectedSubOrderStatus?.inProgress.includes(status.key) ||
              selectedSubOrderStatus?.completed.includes(status.key) ||
              selectedSubOrderStatus?.cancelled.includes(status.key)) &&
              !(statues[ordersStatusGroup].map(s => s.key).sort().join('') === selectedSubOrderStatus[ordersStatusGroup].sort().join(''))
              ? 'primary'
              : 'secundaryDark'}
            onClick={() => handleChange(status.key)}
          >
            {status.value}
            {(selectedSubOrderStatus?.pending.includes(status.key) ||
              selectedSubOrderStatus?.inProgress.includes(status.key) ||
              selectedSubOrderStatus?.completed.includes(status.key) ||
              selectedSubOrderStatus?.cancelled.includes(status.key)) &&
              !(statues[ordersStatusGroup].map(s => s.key).sort().join('') === selectedSubOrderStatus[ordersStatusGroup].sort().join('')) && <MdClose />}
          </Button>
        ))}
      </DragScroll>
    </SubFilterContainer>
  )
}
