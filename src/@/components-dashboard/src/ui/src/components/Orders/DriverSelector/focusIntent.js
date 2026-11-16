/**
 * "Assign" on a row of the orders list opens the order panel to hand it a driver: the panel should
 * leave the focus on the driver selector. The list and the panel never talk to each other, so the
 * list leaves a one-shot note here before it opens the order (`requestDriverFocus(order.id)`) and the
 * driver selector of that order picks it up when it is ready (`consumeDriverFocus(order.id)`).
 * A note nobody collects expires, so a later opening of the same order is not surprised by it.
 */
const EXPIRES_AFTER = 15000

let pending = null

export const requestDriverFocus = (orderId) => {
  pending = { orderId: String(orderId), at: Date.now() }
}

export const consumeDriverFocus = (orderId) => {
  if (!pending || pending.orderId !== String(orderId)) return false
  const fresh = Date.now() - pending.at <= EXPIRES_AFTER
  pending = null
  return fresh
}
