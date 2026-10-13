export const DEFAULT_MAX_PRODUCT_AMOUNT = 100

/**
 * Max units of a product allowed in a cart, from the `max_product_amount` config.
 * Only a positive integer is accepted; anything else falls back to the default.
 */
export const getMaxProductAmount = (configs) => {
  const rawValue = configs?.max_product_amount?.value
  const value = typeof rawValue === 'string' && /^\s*\d+\s*$/.test(rawValue)
    ? Number(rawValue)
    : rawValue
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_MAX_PRODUCT_AMOUNT
}
