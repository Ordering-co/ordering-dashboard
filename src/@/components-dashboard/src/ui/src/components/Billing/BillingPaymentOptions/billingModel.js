// redesign BM-A (D5, M-BM2, M-BM17, M-BM18, M-BM20): the pure rules of the billing dialog (pay an overdue subscription or
// upgrade to Pro). No React, no fetch, no browser globals unless they are passed in: the dialog, the controller and the
// shell read the same answers from here.
const isNumeric = (value) => value != null && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value))

// Which subscription the dialog acts on (same rule as main's UI, index.js:79-84: upgrade → status 'active' or a plan
// id in upgradePlanIds; otherwise status 'past_due'; first match).
export const pickSubscription = ({ subscriptions, isUpgrade, upgradePlanIds } = {}) => {
  if (!Array.isArray(subscriptions)) return null
  const status = isUpgrade ? 'active' : 'past_due'
  const planIds = Array.isArray(upgradePlanIds) ? upgradePlanIds : []
  return subscriptions.find(sub => sub?.status === status || (isUpgrade && planIds.includes(sub?.plan?.plan?.id))) ?? null
}

// The plan line of the summary, from subscription.plan.plan.name and subscription.plan.price (live API shape:
// { type: 'recurring', interval: 'month', amount: 599 }). Recurring with an amount → { name, amount, interval }
// (interval from price.interval, else subscription.interval); tiered/usage or no price → { name, amount: null }.
// Never invents an amount.
export const subscriptionSummary = (subscription) => {
  const name = subscription?.plan?.plan?.name ?? null
  const price = subscription?.plan?.price
  if (price?.type !== 'recurring' || !isNumeric(price?.amount)) return { name, amount: null }
  return { name, amount: Number(price.amount), interval: price.interval ?? subscription?.interval ?? null }
}

// Upgrade prices: { monthly: { amount }, annual: { amount, perMonth } } from plan.prices; missing ones are null.
// perMonth is the yearly amount over 12, not rounded: the formatter rounds, as formatYearlyPrice does in main.
export const upgradePrices = (plan) => {
  const monthly = plan?.prices?.monthly?.amount
  const annual = plan?.prices?.annual?.amount
  return {
    monthly: isNumeric(monthly) ? { amount: Number(monthly) } : null,
    annual: isNumeric(annual) ? { amount: Number(annual), perMonth: Number(annual) / 12 } : null
  }
}

// API error → array of messages (string | [string] | {message}), like toMessages in PurchaseAddons/addonsModel.js.
export const toMessages = (error) => {
  if (Array.isArray(error)) {
    return error.filter(item => item != null).map(item => typeof item === 'string' ? item : (item?.message ?? String(item)))
  }
  if (typeof error === 'string') return [error]
  if (typeof error?.message === 'string') return [error.message]
  return []
}

// with billing-api#100 a plan change leaves the paid plan active until the new one is paid; the new subscription
// carries `data.plan_change` pending. Only those say whether this request charged anything. Without one (today's API), all of them.
export const requestSubscriptions = (subscriptions) => {
  const list = Array.isArray(subscriptions) ? subscriptions.filter(Boolean) : []
  const changing = list.filter(sub => sub?.data?.plan_change?.status === 'pending')
  return changing.length ? changing : list
}

// (billing-api#103): a plan change by modify keeps the subscription active while the invoice of the change waits for the
// card (or its 3DS); `data.status` says so. Until that invoice is paid nothing was charged and the change is not in service.
const PAYMENT_WAITING = ['requires_payment_method', 'requires_action']
export const awaitingPlanChangePayment = (subscription) =>
  subscription?.data?.plan_change?.status === 'pending' && PAYMENT_WAITING.includes(subscription?.data?.status)

// (billing-api#103): a plan change by modify still waiting for its invoice; the retry route pays that invoice.
export const isPendingModify = (subscription) =>
  subscription?.data?.plan_change?.status === 'pending' && subscription?.data?.plan_change?.kind === 'modify'

// the 409 codes of billing-api#100 the dialog answers with its own text and action.
export const PLAN_CHANGE_MODIFY_UNSUPPORTED = 'plan_change.pending_modify_unsupported'
export const PLAN_CHANGE_PENDING_ATTEMPT = 'plan_change.mixed_interval_pending'
export const PLAN_CHANGE_PAYMENT_PENDING = 'plan_change.payment_pending'

// How many past-due subscriptions there are besides the one being paid (M-BM18).
export const otherPastDueCount = ({ subscriptions, targetId } = {}) =>
  Array.isArray(subscriptions) ? subscriptions.filter(sub => sub?.status === 'past_due' && sub?.id !== targetId).length : 0

// One-shot notice that survives the reload: 'paid' | 'upgraded'. Storage may be missing or throw (private mode).
export const BILLING_NOTICE_KEY = 'odc-billing-result'
const NOTICE_KINDS = ['paid', 'upgraded']

export const rememberBillingResult = (kind, storage = globalThis.sessionStorage) => {
  if (!NOTICE_KINDS.includes(kind)) return
  try {
    storage?.setItem(BILLING_NOTICE_KEY, kind)
  } catch (error) {}
}

// Reads without removing: the shell needs it at start (to skip the automatic reopening, M-BM20) and the notice later.
export const peekBillingResult = (storage = globalThis.sessionStorage) => {
  try {
    const kind = storage?.getItem(BILLING_NOTICE_KEY)
    return NOTICE_KINDS.includes(kind) ? kind : null
  } catch (error) {
    return null
  }
}

// Reads and removes: the notice shows once. Whatever else is under the key is dropped, never shown.
export const takeBillingResult = (storage = globalThis.sessionStorage) => {
  try {
    const kind = storage?.getItem(BILLING_NOTICE_KEY)
    if (kind == null) return null
    storage.removeItem(BILLING_NOTICE_KEY)
    return NOTICE_KINDS.includes(kind) ? kind : null
  } catch (error) {
    return null
  }
}
