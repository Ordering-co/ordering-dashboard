export const ticketSectionList = [
  { key: 'orderNumber', labelKey: 'ORDER_NO', label: 'Order No.' },
  { key: 'customer', labelKey: 'CUSTOMER_DETAILS', label: 'Customer details' },
  { key: 'business', labelKey: 'BUSINESS_DETAILS', label: 'Business details' },
  { key: 'orderDetails', labelKey: 'ORDER_DETAILS', label: 'Order details' }
]

export const defaultTicketSections = {
  orderNumber: true,
  customer: true,
  business: true,
  orderDetails: true
}

export const showTicketSection = (sections, key) => sections?.[key] !== false
