// Only admins and business managers can call the v2 refund flow (OrderController@refund_next).
const REFUND_V2_USER_LEVELS = [0, 2]

/**
 * Refund by items needs the v2 flow. Stripe stays out: v2 sends `source` refunds to the
 * gateway plugin hook, and Stripe is refunded natively only by the legacy flow.
 */
export const isItemsRefundAvailable = (option, userLevel) =>
  !!option && !option.isStripe && REFUND_V2_USER_LEVELS.includes(userLevel)

/**
 * Turns the picker state ({ [orderProductId]: { quantity, suboptions: { [subId]: qty } } })
 * into the API `items` array. Picked suboptions refund only those add-ons, not the product.
 */
export const buildRefundItems = (selectedItems = {}) => {
  const items = []
  Object.entries(selectedItems).forEach(([orderProductId, entry]) => {
    const opId = parseInt(orderProductId, 10)
    const suboptions = []
    Object.entries(entry?.suboptions || {}).forEach(([subId, subQty]) => {
      const q = parseInt(subQty, 10)
      if (q > 0) suboptions.push({ order_product_option_suboption_id: parseInt(subId, 10), quantity: q })
    })
    if (suboptions.length > 0) {
      items.push({ order_product_id: opId, suboptions })
    } else if (parseInt(entry?.quantity, 10) > 0) {
      items.push({ order_product_id: opId, quantity: parseInt(entry.quantity, 10) })
    }
  })
  return items
}

/**
 * Body for POST /orders/{id}/refund. Braintree and refunds by items use the v2 flow
 * (`version: 'v2'` + `mode`); total and amount refunds on other methods keep the legacy body.
 */
export const buildRefundRequest = ({ option, mode, amount, items, orderTotal, description }) => {
  const isCashWallet = option?.value === 'cash_wallet'
  const data = {}

  if (option?.isBraintree || mode === 'items') {
    data.version = 'v2'
    data.mode = mode
    data.transfer_to = isCashWallet ? 'cash_wallet' : 'source'
    if (!isCashWallet) data.order_payment_event_id = option?.value
    if (mode === 'amount') data.amount = amount
    if (mode === 'items') data.items = items
  } else {
    if (!isCashWallet) data.order_payment_event_id = option?.value
    data.amount = mode === 'total' ? orderTotal : amount
    data.transfer_to = isCashWallet ? 'cash_wallet' : 'source'
  }

  if (description) data.description = description
  return data
}
