/** Largest order id the API accepts. A bigger value fails the whole request. */
export const MAX_ORDER_ID = 2147483647

/**
 * Digits only. Letters and punctuation are dropped.
 * A number above the API maximum is refused so the field keeps its previous value.
 * Returns `null` when the number is too big.
 */
export const sanitizeOrderId = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits === '') return ''
  if (BigInt(digits) > BigInt(MAX_ORDER_ID)) return null
  return digits
}

const ORDER_ID_EDIT_KEYS = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter']

/** Block letter and symbol keys. Shortcuts and paste still reach the sanitizer. */
export const handleOrderIdKeyDown = (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (ORDER_ID_EDIT_KEYS.includes(event.key)) return
  if (!/^\d$/.test(event.key)) event.preventDefault()
}
