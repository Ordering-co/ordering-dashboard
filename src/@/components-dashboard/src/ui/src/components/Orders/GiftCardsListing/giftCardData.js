// redesign GC-B: the pure reading of a gift card row of GET /gift_cards. No React, no text of its own: the table, the
// cards and the page ask these helpers what a row says and decide how to draw it. A row comes as the API sends it:
//   { id, amount, status ('pending' | 'sent' | 'activated'), user_name, user_email (the recipient), created_at, activated_at,
//     author, activater ({ name, lastname, cellphone, email, photo } or null), order_product ({ order_id } or null), … }
// The code of the card and its PIN (`password`) are never read here. The table draws the code masked (row 42, P-1); the PIN is never shown.

const text = (value) => (value === null || value === undefined ? '' : String(value).trim())

// «Ana Pérez»: name and last name, whichever of them exist
export const personName = (person) => [text(person?.name), text(person?.lastname)].filter(Boolean).join(' ')

// (T10): the API leaves a deleted user's phone (and email) as «7443172700_deleted_SzbeHbPZkk». The marker and what follows it
// are never shown; `isDeletedPerson` lets the table say it in words instead.
const DELETED_MARKER = '_deleted_'
const withoutMarker = (value) => {
  const at = value.indexOf(DELETED_MARKER)
  return at === -1 ? value : value.slice(0, at).trim()
}
export const isDeletedPerson = (person) => [text(person?.cellphone), text(person?.email)].some(value => value.includes(DELETED_MARKER))

// The one line of contact under a person: the phone as main shows it (audit F4), the email when there is no phone, nothing otherwise.
// A deleted user's value comes without the «_deleted_…» suffix; if nothing is left of the phone the email is the fallback.
export const personContact = (person) => withoutMarker(text(person?.cellphone)) || withoutMarker(text(person?.email))

// The photo only when there is one: with none the Avatar draws the initials (GC-04)
export const personPhoto = (person) => text(person?.photo) || undefined

// The recipient of the gift: the name and the email the buyer typed. Either may be missing.
export const recipientOf = (card) => ({ name: text(card?.user_name), email: text(card?.user_email) })

// The three statuses of the API and the family of the Product Status that draws each. Any other value is drawn as `pending` with its
// own text (`kind: 'other'`, `raw` = that text), so the page never throws on a status the API adds later (decision D9, audit F5).
export const STATUS_KINDS = {
  pending: { family: 'pending', kind: 'pending' },
  sent: { family: 'progress', kind: 'sent' },
  activated: { family: 'done', kind: 'activated' }
}
export const statusOf = (card) => {
  const raw = text(card?.status)
  const known = Object.prototype.hasOwnProperty.call(STATUS_KINDS, raw) ? STATUS_KINDS[raw] : null
  return known ? { ...known, raw } : { family: 'pending', kind: 'other', raw }
}

// The order the card was bought in. `order_product` comes as null for cards without one; only a positive whole number counts.
export const orderIdOf = (card) => {
  const value = Number(card?.order_product?.order_id)
  return Number.isInteger(value) && value > 0 ? value : null
}

// Where «Order #n» goes: the orders page with that order open
export const orderPath = (orderId) => `/orders?id=${orderId}`

// D3 (audit F3): «Redeemed by» and «Redeemed date» are always there in Redeemed; in Pending only when some row of the page has the
// data («no data» is a sample, not a contract).
export const hasRedeemData = (cards = []) => cards.some(card => Boolean(card?.activater) || text(card?.activated_at) !== '')

// The page a request for a page beyond the end should ask for instead (audit F7): the last one
export const lastPageOf = (totalItems, pageSize) => {
  const total = Number(totalItems)
  const size = Number(pageSize)
  if (!Number.isFinite(total) || !Number.isFinite(size) || total <= 0 || size <= 0) return 1
  return Math.max(1, Math.ceil(total / size))
}

// The sizes the pager offers, with the one in the URL when it is not among them
export const PAGE_SIZES = [10, 25, 50]
export const pageSizeOptions = (current) => {
  const size = Number(current)
  return Number.isInteger(size) && size > 0 && !PAGE_SIZES.includes(size)
    ? [...PAGE_SIZES, size].sort((a, b) => a - b)
    : PAGE_SIZES
}

// The error of the controller (a list of messages, a string or nothing) as the first message with text
export const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))
export const firstErrorMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)
