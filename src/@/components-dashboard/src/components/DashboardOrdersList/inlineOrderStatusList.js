export const applyInlineOrderStatusToList = ({
  orders = [],
  orderId,
  newStatus,
  visibleStatuses,
  updatedOrder
}) => {
  const nextStatus = updatedOrder?.status ?? newStatus
  const staysVisible = Array.isArray(visibleStatuses) &&
    visibleStatuses.some(status => String(status) === String(nextStatus))

  if (!staysVisible) {
    return orders.filter(order => order?.id !== orderId)
  }

  return orders.map(order => {
    if (order?.id !== orderId) return order
    return {
      ...order,
      ...(updatedOrder || {}),
      status: nextStatus
    }
  })
}
