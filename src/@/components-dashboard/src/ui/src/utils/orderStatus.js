export const orderStatus = [
  { key: 0, value: 'Pending Order', slug: 'PENDING_ORDER', percentage: 10 },
  { key: 1, value: 'Completed by admin', slug: 'COMPLETED_BY_ADMIN', percentage: 100 },
  { key: 2, value: 'Reject by admin', slug: 'REJECT_BY_ADMIN', percentage: 0 },
  { key: 3, value: 'Driver arrived by business', slug: 'DRIVER_IN_BUSINESS', percentage: 60 },
  { key: 4, value: 'Preparation completed', slug: 'PREPARATION_COMPLETED', percentage: 20 },
  { key: 5, value: 'Reject by business', slug: 'REJECT_BY_BUSINESS', percentage: 0 },
  { key: 6, value: 'Reject by driver', slug: 'REJECT_BY_DRIVER', percentage: 0 },
  { key: 7, value: 'Accepted by business', slug: 'ACCEPTED_BY_BUSINESS', percentage: 15 },
  { key: 8, value: 'Accepted by driver', slug: 'ACCEPTED_BY_DRIVER', percentage: 40 },
  { key: 9, value: 'Pick up completed by driver', slug: 'PICK_UP_COMPLETED_BY_DRIVER', percentage: 70 },
  { key: 10, value: 'Pick up failed by driver', slug: 'PICK_UP_FAILED_BY_DRIVER', percentage: 0 },
  { key: 11, value: 'Delivery completed by driver', slug: 'DELIVERY_COMPLETED_BY_DRIVER', percentage: 100 },
  { key: 12, value: 'Delivery failed by driver', slug: 'DELIVERY_FAILED_BY_DRIVER', percentage: 0 },
  { key: 13, value: 'Preorder', slug: 'PREORDER', percentage: 0 },
  { key: 14, value: 'Order not ready', slug: 'ORDER_NOT_READY', percentage: 15 },
  { key: 15, value: 'Pickup completed by customer', slug: 'PICKUP_COMPLETED_BY_CUSTOMER', percentage: 100 },
  { key: 16, value: 'Canceled by customer', slug: 'CANCELED_BY_CUSTOMER', percentage: 0 },
  { key: 17, value: 'Not picked by customer', slug: 'NOT_PICKED_BY_CUSTOMER', percentage: 0 },
  { key: 18, value: 'Driver almost arrived to business', slug: 'DRIVER_ALMOST_ARRIVED_TO_BUSINESS', percentage: 50 },
  { key: 19, value: 'Driver almost arrived to customer', slug: 'DRIVER_ALMOST_ARRIVED_TO_CUSTOMER', percentage: 90 },
  { key: 20, value: 'Customer almost arrived to business', slug: 'CUSTOMER_ALMOST_ARRIVED_TO_BUSINESS', percentage: 90 },
  { key: 21, value: 'Customer arrived to business', slug: 'CUSTOMER_ARRIVED_TO_BUSINESS', percentage: 90 },
  { key: 22, value: 'Looking for driver', slug: 'ORDER_LOOKING_FOR_DRIVER', percentage: 30 },
  { key: 23, value: 'Driver on way', slug: 'ORDER_DRIVER_ON_WAY', percentage: 80 },
  { key: 24, value: 'Driver waiting for order', slug: 'ORDER_STATUS_DRIVER_WAITING_FOR_ORDER', percentage: 25 },
  { key: 25, value: 'Accepted by driver company', slug: 'ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY', percentage: 15 },
  { key: 26, value: 'Driver arrived to customer', slug: 'ORDER_DRIVER_ARRIVED_CUSTOMER', percentage: 80 }
]

export const getOrderStatus = (status) => {
  const objectStatus = orderStatus.find((o) => o.key === status)
  return objectStatus && objectStatus
}

export const getOrderStatusPrefix = (s, dictionary, prefixForVariable = '') => {
  if (!dictionary) return s

  const orderStatus = {
    0: dictionary?.[`${prefixForVariable}_PENDING` ?? 'PENDING'] ?? 'Pending',
    1: dictionary?.[`${prefixForVariable}_COMPLETED_BY_ADMIN` ?? 'COMPLETED_BY_ADMIN'] ?? 'Completed by admin',
    2: dictionary?.[`${prefixForVariable}_REJECTED` ?? 'REJECTED'] ?? 'Rejected',
    3: dictionary?.[`${prefixForVariable}_ORDER_STATUS_IN_BUSINESS` ?? 'ORDER_STATUS_IN_BUSINESS'] ?? 'Driver arrived to business',
    4: dictionary?.[`${prefixForVariable}_PREPARATION_COMPLETED` ?? 'PREPARATION_COMPLETED'] ?? 'Preparation completed',
    5: dictionary?.[`${prefixForVariable}_REJECTED_BY_BUSINESS` ?? 'REJECTED_BY_BUSINESS'] ?? 'Rejected by business',
    6: dictionary?.[`${prefixForVariable}_REJECTED_BY_DRIVER` ?? 'REJECTED_BY_DRIVER'] ?? 'Rejected by driver',
    7: dictionary?.[`${prefixForVariable}_ACCEPTED_BY_BUSINESS` ?? 'ACCEPTED_BY_BUSINESS'] ?? 'Accepted by business',
    8: dictionary?.[`${prefixForVariable}_ACCEPTED_BY_DRIVER` ?? 'ACCEPTED_BY_DRIVER'] ?? 'Accepted by driver',
    9: dictionary?.[`${prefixForVariable}_PICK_UP_COMPLETED_BY_DRIVER` ?? 'PICK_UP_COMPLETED_BY_DRIVER'] ?? 'Pick up completed by driver',
    10: dictionary?.[`${prefixForVariable}_PICK_UP_FAILED_BY_DRIVER` ?? 'PICK_UP_FAILED_BY_DRIVER'] ?? 'Pick up failed by driver',
    11: dictionary?.[`${prefixForVariable}_DELIVERY_COMPLETED_BY_DRIVER` ?? 'DELIVERY_COMPLETED_BY_DRIVER'] ?? 'Delivery completed by driver',
    12: dictionary?.[`${prefixForVariable}_DELIVERY_FAILED_BY_DRIVER` ?? 'DELIVERY_FAILED_BY_DRIVER'] ?? 'Delivery failed by driver',
    13: dictionary?.[`${prefixForVariable}_PREORDER` ?? 'PREORDER'] ?? 'Preorder',
    14: dictionary?.[`${prefixForVariable}_ORDER_NOT_READY` ?? 'ORDER_NOT_READY'] ?? 'Order not ready',
    15: dictionary?.[`${prefixForVariable}_ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER` ?? 'ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER'] ?? 'Order picked up completed by customer',
    16: dictionary?.[`${prefixForVariable}_ORDER_STATUS_CANCELLED_BY_CUSTOMER` ?? 'ORDER_STATUS_CANCELLED_BY_CUSTOMER'] ?? 'Order cancelled by customer',
    17: dictionary?.[`${prefixForVariable}_ORDER_NOT_PICKEDUP_BY_CUSTOMER` ?? 'ORDER_NOT_PICKEDUP_BY_CUSTOMER'] ?? 'Order not picked up by customer',
    18: dictionary?.[`${prefixForVariable}_ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS` ?? 'ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS'] ?? 'Driver almost arrived to business',
    19: dictionary?.[`${prefixForVariable}_ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER` ?? 'ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER'] ?? 'Driver almost arrived to customer',
    20: dictionary?.[`${prefixForVariable}_ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS` ?? 'ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS'] ?? 'Customer almost arrived to business',
    21: dictionary?.[`${prefixForVariable}_ORDER_CUSTOMER_ARRIVED_BUSINESS` ?? 'ORDER_CUSTOMER_ARRIVED_BUSINESS'] ?? 'Customer arrived to business',
    22: dictionary?.[`${prefixForVariable}_ORDER_LOOKING_FOR_DRIVER` ?? 'ORDER_LOOKING_FOR_DRIVER'] ?? 'Looking for driver',
    23: dictionary?.[`${prefixForVariable}_ORDER_DRIVER_ON_WAY` ?? 'ORDER_DRIVER_ON_WAY'] ?? 'Driver on way',
    24: dictionary?.[`${prefixForVariable}_ORDER_STATUS_DRIVER_WAITING_FOR_ORDER` ?? 'ORDER_STATUS_DRIVER_WAITING_FOR_ORDER'] ?? 'Driver waiting for order',
    25: dictionary?.[`${prefixForVariable}_ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY` ?? 'ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY'] ?? 'Accepted by driver company',
    26: dictionary?.[`${prefixForVariable}_ORDER_DRIVER_ARRIVED_CUSTOMER` ?? 'ORDER_DRIVER_ARRIVED_CUSTOMER'] ?? 'Driver arrived to customer',
    50: dictionary?.[`${prefixForVariable}_DRIVER_ASSIGNED` ?? 'DRIVER_ASSIGNED'] ?? 'Driver assigned',
    51: dictionary?.[`${prefixForVariable}_DRIVER_CLOSE` ?? 'DRIVER_CLOSE'] ?? 'Driver is close',
    53: dictionary?.[`${prefixForVariable}_NEW_BUSINESS_OWNER_SIGNUP` ?? 'NEW_BUSINESS_OWNER_SIGNUP'] ?? 'New Business owner Signup',
    54: dictionary?.[`${prefixForVariable}_NEW_DRIVER_SIGNUP` ?? 'NEW_DRIVER_SIGNUP'] ?? 'New Driver owner Signup'
  }

  return orderStatus?.[Number(s)] ?? s
}
