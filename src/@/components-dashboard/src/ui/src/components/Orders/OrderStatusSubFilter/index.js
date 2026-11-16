import React from 'react'
import { useLanguage } from '../../../../../index'
import { Checkbox } from '../../Shared/Product/Checkbox'
import { ListFilter } from '../../Shared/Icon'
import { FilterPopover, PopoverFoot } from '../../Shared/Product/FilterPopover' // redesign W0-2a (T0-4)
import { pillValue } from '../../Shared/Product/filterValueText'
// FilterPopover used to load this sheet: `.odc-orders-substatus` is still in it (redesign W0-2a, T0-4)
import '../OrdersFilterBar/orders-filter-bar.css'

// Same lists and keys the chips had. `key` is the order status the API filters by.
export const getSubOrderStatuses = (t) => ({
  pending: [
    { key: 0, value: t('PENDING', 'Pending') },
    { key: 13, value: t('PREORDER', 'Preorder') }
  ],
  inProgress: [
    { key: 7, value: t('ACCEPTED_BY_BUSINESS', 'Accepted by business') },
    { key: 4, value: t('PREPARATION_COMPLETED', 'Preparation completed') },
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
    { key: 10, value: t('PICK_UP_FAILED_BY_DRIVER', 'Pick up failed by driver') },
    { key: 12, value: t('DELIVERY_FAILED_BY_DRIVER', 'Delivery failed by driver') },
    { key: 16, value: t('ORDER_STATUS_CANCELLED_BY_CUSTOMER', 'Cancelled by customer') },
    { key: 17, value: t('ORDER_NOT_PICKEDUP_BY_CUSTOMER', 'Not picked by customer') }
  ]
})

// redesign deliveries-followups P2 (DV-11): the statuses of an order the customer picks up at the store. A page that
// only lists deliveries (/deliveries asks for delivery_type 1 and 7) never has them, so it hides them with `hiddenStatuses`.
export const CUSTOMER_PICKUP_STATUSES = [15, 17, 20, 21]

const sameKeys = (a, b) => {
  const left = [...a].sort().join(',')
  const right = [...b].sort().join(',')
  return left === right
}

/** «All» is every sub status of the tab selected; it is the neutral state, with no filter. */
export const isAllSubStatuses = (groupStatuses, selected) => sameKeys(groupStatuses.map(status => status.key), selected)

/**
 * The next `selectedSubOrderStatus` after pressing a sub status (or 'all'). It is
 * the rule of the chips this control replaces: from «all», a press selects only
 * that one; a press on a selected one removes it, and removing the last goes back
 * to «all»; a press on an unselected one adds it. Pure: it does not touch the input.
 */
export const nextSelectedSubOrderStatus = ({ statusKey, ordersStatusGroup, selectedSubOrderStatus, statuses }) => {
  const groupStatuses = statuses[ordersStatusGroup]
  const allKeys = groupStatuses.map(status => status.key)
  let next = [...selectedSubOrderStatus[ordersStatusGroup]]
  if (statusKey === 'all') {
    next = allKeys
  } else if (next.includes(statusKey)) {
    next = next.length === 1
      ? allKeys
      : isAllSubStatuses(groupStatuses, selectedSubOrderStatus[ordersStatusGroup])
        ? next.filter(status => status === statusKey)
        : next.filter(status => status !== statusKey)
  } else {
    next.push(statusKey)
  }
  return { ...selectedSubOrderStatus, [ordersStatusGroup]: next }
}

/**
 * Status pill (C7): the sub statuses of the current tab as checkboxes in a
 * popover. «All» is no box: with none checked the whole tab shows and the pill is
 * inactive; the value is how many are checked. The «All» action brings it back.
 * It replaces the row of chips on /orders (through OrdersFilterBar) and on
 * /deliveries and /all-in-one (through OrderStatusSubFilter): one pattern, so the
 * 2 to 15 sub statuses of a tab and any subset of them stay reachable.
 */
export const SubStatusPill = ({
  ordersStatusGroup,
  selectedSubOrderStatus,
  handleSelectedSubOrderStatus,
  priority,
  hiddenStatuses
}) => {
  const [, t] = useLanguage()
  const statuses = getSubOrderStatuses(t)
  const groupStatuses = statuses[ordersStatusGroup] || []
  // redesign deliveries-followups P2: `hiddenStatuses` only takes rows out of the list. «All» is still every status of
  // the tab, so the state and the request mean what they meant; checking every row shown is «all» again, as checking every row is.
  const shownStatuses = hiddenStatuses?.length ? groupStatuses.filter(status => !hiddenStatuses.includes(status.key)) : groupStatuses
  const selected = selectedSubOrderStatus?.[ordersStatusGroup] || []
  const isAll = isAllSubStatuses(groupStatuses, selected)

  const press = (statusKey) => {
    const next = nextSelectedSubOrderStatus({
      statusKey,
      ordersStatusGroup,
      selectedSubOrderStatus,
      statuses
    })
    const everyShown = shownStatuses !== groupStatuses && shownStatuses.every(status => next[ordersStatusGroup].includes(status.key))
    handleSelectedSubOrderStatus(everyShown ? { ...next, [ordersStatusGroup]: groupStatuses.map(status => status.key) } : next)
  }

  return (
    <FilterPopover
      icon={ListFilter}
      label={t('STATUS', 'Status')}
      // redesign F6c-2 (Q2-15): the name of the one selected, the count of several; nothing when it is «all».
      value={isAll ? undefined : pillValue(selected, key => groupStatuses.find(status => status.key === key)?.value)}
      priority={priority}
      popupClassName='odc-orders-checklist-popup'
    >
      <div className='odc-orders-checklist' role='group' aria-label={t('STATUS', 'Status')}>
        {shownStatuses.map(status => (
          <Checkbox
            key={status.key}
            checked={!isAll && selected.includes(status.key)}
            onCheckedChange={() => press(status.key)}
          >
            {status.value}
          </Checkbox>
        ))}
      </div>
      {!isAll && <PopoverFoot onClear={() => press('all')} clearLabel={t('CLEAR', 'Clear')} />}
    </FilterPopover>
  )
}

export const OrderStatusSubFilter = ({ ordersStatusGroup, selectedSubOrderStatus, handleSelectedSubOrderStatus, hiddenStatuses }) => (
  <div className='odc-orders-substatus'>
    <SubStatusPill
      ordersStatusGroup={ordersStatusGroup}
      selectedSubOrderStatus={selectedSubOrderStatus}
      handleSelectedSubOrderStatus={handleSelectedSubOrderStatus}
      hiddenStatuses={hiddenStatuses}
    />
  </div>
)
