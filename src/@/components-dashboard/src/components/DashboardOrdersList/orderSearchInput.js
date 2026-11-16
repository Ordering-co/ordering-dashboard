/** Largest order id the API accepts. */
export const MAX_ORDER_ID = 2147483647

/** Longest name, email or external id worth typing in the orders search. */
export const ORDER_SEARCH_TEXT_MAX = 50

/**
 * Digits that can be searched as an order id.
 * `null` when the text is not a number, or the number is above the API maximum.
 */
export const numericSearchText = (value) => {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) return null
  let asInteger
  try {
    asInteger = BigInt(text)
  } catch {
    return null
  }
  if (asInteger > BigInt(MAX_ORDER_ID)) return null
  const parsed = Number(text)
  if (!Number.isSafeInteger(parsed) || BigInt(parsed) !== asInteger) return null
  return text
}

/**
 * Cap the orders search as it is typed.
 * Digits stay only while the number is at most 2147483647.
 * Any other text stops at 50 characters.
 */
export const limitOrderSearchInput = (value) => {
  const text = String(value ?? '')
  if (/^\d*$/.test(text)) {
    let next = text
    while (next.length > 0 && BigInt(next) > BigInt(MAX_ORDER_ID)) {
      next = next.slice(0, -1)
    }
    return next
  }
  return text.slice(0, ORDER_SEARCH_TEXT_MAX)
}
