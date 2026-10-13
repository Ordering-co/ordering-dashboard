export const getOrdersAnalyticsModule = ({ isMessagesView, isDelivery }) => (
  isMessagesView ? 'messages' : (isDelivery ? 'delivery' : 'orders')
)
