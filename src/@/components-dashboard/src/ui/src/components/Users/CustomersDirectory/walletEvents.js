// redesign UC-B5 (decision 4, M-C4, M-C16): the pure side of the Wallet section. No React, no network.
// A wallet event becomes plain data for the history, and a balance becomes text. Nothing here returns HTML: main's
// `parseEvent` built `<strong>` strings and the list injected them with dangerouslySetInnerHTML, author name included.

const MINUS = '−'
const TAGS = /<[^>]*>/g

const hasText = (value) => value != null && String(value).trim() !== ''
// The text of a catalog string without its markup (REDEEMED_GIFT_CARD still carries `<strong>`)
const plain = (text) => String(text ?? '').replace(TAGS, '').replace(/\s{2,}/g, ' ').trim()
const isNumeric = (value) => value != null && value !== '' && Number.isFinite(Number(value))
// A balance may be text (the controller adds `content.result.amount` to it) or missing: anything else is zero
const toNumber = (value) => (isNumeric(value) ? Number(value) : 0)

/**
 * Cash as text. Zero (and anything that rounds to zero) is the plain zero amount, never «- $0.00» (M-C4); a negative
 * keeps a real minus sign before the currency. `parsePrice` only ever sees the absolute value: it mangles a negative
 * whose integer part has exactly 3, 6 or 9 digits.
 */
export const formatCash = (value, parsePrice) => {
  const number = toNumber(value)
  const absolute = parsePrice(Math.abs(number))
  // A negative that the project's decimals round to zero («-0.001» → «0.00») has no sign to show
  const isZero = !/[1-9]/.test(absolute)
  return number < 0 && !isZero ? `${MINUS}${absolute}` : absolute
}

/** Cash with a plus on a gain: the amount of a history row. */
export const formatSignedCash = (value, parsePrice) => {
  const number = toNumber(value)
  const text = formatCash(number, parsePrice)
  return number > 0 && /[1-9]/.test(text) ? `+${text}` : text
}

/** Points as a plain number with the project's decimals («20.37»), without trailing zeros and without a currency. */
export const formatPoints = (value, decimals = 2) => {
  const number = toNumber(value)
  const rounded = Number(Math.abs(number).toFixed(decimals))
  if (rounded === 0) return '0'
  return `${number < 0 ? MINUS : ''}${rounded}`
}

/** Points with a plus on a gain. */
export const formatSignedPoints = (value, decimals = 2) => {
  const number = toNumber(value)
  const text = formatPoints(number, decimals)
  return number > 0 && text !== '0' ? `+${text}` : text
}

/** The balance after adding or removing `amount`, without float noise («0.1 + 0.2»). */
export const resultingBalance = (balance, amount, isAdd) => {
  const next = toNumber(balance) + (isAdd ? 1 : -1) * toNumber(amount)
  return Math.round(next * 1e6) / 1e6
}

/** Who made the event: «Name Lastname» from the users the controller loaded, `#id` when it did not, null without an author. */
export const authorNameOf = (authorId, users) => {
  if (authorId == null || authorId === '') return null
  const author = (users || []).find(user => String(user?.id) === String(authorId))
  const name = [author?.name, author?.lastname].filter(hasText).map(part => String(part).trim()).join(' ')
  return name || `#${authorId}`
}

const labelOf = (event, amount, rawT) => {
  // Every catalog string is read as plain text: a translation may still carry the markup of main
  const t = (key, text) => plain(rawT(key, text))
  if (event.event_type === 'redeem_gift_card') return t('REDEEMED_GIFT_CARD', 'Redeemed from the <strong>Gift card</strong>')
  if (event.event_type === 'refund') return t('REFUND_MONEY', 'Refund money')
  if (event.event_type === 'payment') return t('PAID_MONEY', 'Paid money')
  // redesign UC-R1 (I-03): a movement is named by its sign whatever its type (manual, cashback, a type the code does not know):
  // the raw API word «movement» is never a label. The API `description` stays as the comment.
  if (event.event === 'movement') {
    return amount != null && Math.sign(amount) === -1
      ? t('CUSTOMERS_WALLET_EVENT_REDUCED', 'Balance reduced')
      : t('CUSTOMERS_WALLET_EVENT_ADDED', 'Balance added')
  }
  if (event.event_type === 'manual') {
    switch (event.event) {
      case 'locked':
        return t('CUSTOMERS_WALLET_EVENT_LOCKED', 'Wallet locked')
      case 'unlocked':
        return t('CUSTOMERS_WALLET_EVENT_UNLOCKED', 'Wallet unlocked')
      default:
        return plain(event.event)
    }
  }
  // A type the code does not know says its own name instead of nothing
  return plain(event.event ?? event.event_type)
}

const isLockEvent = (event) => event.event_type === 'manual' && (event.event === 'locked' || event.event === 'unlocked')

/**
 * One wallet event as plain data: `{ id, sign, amount, label, comment, authorName, at, orderId, code }`.
 * `sign` is -1, 0 or 1; `amount` the signed number (null for a lock event, which moves nothing); `label` is plain text
 * from the catalog (no `<strong>`, no author: the author is its own field); `at` goes through the project's `parseDate`.
 * `orderId` and `code` are the two data the old history also showed (the order of a payment or refund, the transaction code).
 * Context: `{ t, users, parseDate }`.
 */
export const walletEvent = (event, { t, users, parseDate }) => {
  const amount = !isLockEvent(event) && isNumeric(event.amount) ? Number(event.amount) : null
  return {
    id: event.id,
    sign: amount == null ? 0 : Math.sign(amount),
    amount,
    label: labelOf(event, amount, t),
    comment: hasText(event.description) ? String(event.description) : '',
    authorName: authorNameOf(event.author_id, users),
    at: event.created_at ? parseDate(event.created_at, { utc: false }) : '',
    orderId: event.wallet_event?.order_id ?? null,
    code: hasText(event.code) ? String(event.code) : null
  }
}

/** The events of the controller, in its order, as plain data. */
export const walletEvents = (events, context) => (Array.isArray(events) ? events : []).map(event => walletEvent(event, context))
