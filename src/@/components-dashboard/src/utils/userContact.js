// redesign BO-B2 (promoted from Users/CustomersDirectory/customerData): how a list reads the contact data of a user.
// No React, no network: plain functions over the user object the list controller already gives.

const hasText = (value) => value != null && String(value).trim() !== ''

// «Name Lastname»; with both empty, '' (each list decides what to paint instead)
export const userFullName = (user) => [user?.name, user?.lastname].filter(hasText).map(part => String(part).trim()).join(' ')

// «+<country code> <cellphone>», the cellphone alone without a code, null without a cellphone.
// a cellphone saved with a «+» already has its code: «+<code>…» reads «+<code> …», any other «+…» stays as saved.
export const phoneOf = (user) => {
  if (!hasText(user?.cellphone)) return null
  const cellphone = String(user.cellphone).trim()
  if (!hasText(user?.country_phone_code)) return cellphone
  const code = String(user.country_phone_code).trim().replace(/^\+/, '')
  if (!cellphone.startsWith('+')) return `+${code} ${cellphone}`
  return cellphone.startsWith(`+${code}`) ? `+${code} ${cellphone.slice(code.length + 1).trim()}` : cellphone
}
