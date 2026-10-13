export const ORDER_STATUS_QUERY_VALUES = ['pending', 'inProgress', 'completed', 'cancelled']

export const getOrdersUrlSearchState = (search = '') => {
  const query = new URLSearchParams(typeof search === 'string' ? search : '')
  const id = query.get('id')
  const status = query.get('status')
  const orderId = id || null

  return {
    orderId,
    isDetailOpen: orderId != null,
    statusGroup: ORDER_STATUS_QUERY_VALUES.includes(status) ? status : null
  }
}
