/**
 * Order status → visual family (C5). The family only picks the color of the
 * indicator; the label is always the exact status name.
 *
 *  pending   0 Pending, 13 Preorder
 *  progress  every in-progress status of OrdersManage's `inProgress` group except 14
 *  review    14 Order not ready (a step back from preparation completed)
 *  done      1 Completed by admin, 11 Delivery completed by driver, 15 Pickup completed by customer
 *  cancel    2, 5, 6 rejected; 10, 12 failed; 16 cancelled by customer; 17 not picked by customer
 */
export const ORDER_STATUS_FAMILIES = {
  pending: [0, 13],
  progress: [3, 4, 7, 8, 9, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  review: [14],
  done: [1, 11, 15],
  cancel: [2, 5, 6, 10, 12, 16, 17]
}

const FAMILY_BY_STATUS = new Map(
  Object.entries(ORDER_STATUS_FAMILIES).flatMap(([family, codes]) => codes.map(code => [code, family]))
)

/** Family of an order status code. Unknown codes read as in progress, never as done. */
export const getOrderStatusFamily = status => FAMILY_BY_STATUS.get(Number(status)) ?? 'progress'

export const isOrderClosed = status => ['done', 'cancel'].includes(getOrderStatusFamily(status))
