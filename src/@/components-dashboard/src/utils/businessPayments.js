import { monthOf, shiftDay } from './dateRange'

// redesign business-payments FA (D3, D5, D6, D11): the pure pieces of /intelligence/business-payments. No React.
// `main BPR` = ui/src/components/BusinessIntelligence/BusinessPaymentReports/index.js of main.

/**
 * The date-time the API takes as a period boundary (`YYYY-MM-DD HH:mm:00`, local time of the browser).
 * Copied as is from main BPR:155-162 (it is a request value, not something painted).
 */
export const formatDateTimeForApi = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:00`
}

/**
 * Calculate billing period cut-off dates based on method's cycle configuration.
 * Copied as is from main BPR:59-153, newest first. The only difference: `now` is a parameter (default `new Date()`,
 * which is what main read in place) so the calculation can be pinned to a moment.
 */
export const getCutoffDates = (method, count = 12, now = new Date()) => {
  if (!method) return []

  const { cycle, cycle_day: cycleDay, cycle_time: cycleTime } = method
  const [hours, minutes] = (cycleTime || '00:00').split(':').map(Number)
  const periods = []

  if (cycle === 'weekly') {
    const today = new Date(now)
    today.setHours(hours, minutes, 0, 0)

    let diff = today.getDay() - cycleDay
    if (diff < 0) diff += 7

    const latestCutoff = new Date(today)
    latestCutoff.setDate(latestCutoff.getDate() - diff)

    if (latestCutoff > now) {
      latestCutoff.setDate(latestCutoff.getDate() - 7)
    }

    for (let i = 0; i < count; i++) {
      const cutoff = new Date(latestCutoff)
      cutoff.setDate(cutoff.getDate() - (i * 7))

      const periodStart = new Date(cutoff)
      periodStart.setDate(periodStart.getDate() - 7)

      periods.push({
        cutoffDate: new Date(cutoff),
        startDate: new Date(periodStart),
        periodStart: formatDateTimeForApi(periodStart),
        periodEnd: formatDateTimeForApi(cutoff)
      })
    }
  } else if (cycle === 'monthly') {
    let year = now.getFullYear()
    let month = now.getMonth()

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const day = Math.min(cycleDay, daysInMonth)
    const latestCutoff = new Date(year, month, day, hours, minutes, 0, 0)

    if (latestCutoff > now) {
      month--
      if (month < 0) {
        month = 11
        year--
      }
      const prevDaysInMonth = new Date(year, month + 1, 0).getDate()
      const prevDay = Math.min(cycleDay, prevDaysInMonth)
      latestCutoff.setFullYear(year, month, prevDay)
    }

    const curYear = latestCutoff.getFullYear()
    const curMonth = latestCutoff.getMonth()

    for (let i = 0; i < count; i++) {
      const m = curMonth - i
      let y = curYear
      let adjustedMonth = m
      while (adjustedMonth < 0) {
        adjustedMonth += 12
        y--
      }

      const dim = new Date(y, adjustedMonth + 1, 0).getDate()
      const d = Math.min(cycleDay, dim)
      const cutoff = new Date(y, adjustedMonth, d, hours, minutes, 0, 0)

      let prevM = adjustedMonth - 1
      let prevY = y
      if (prevM < 0) {
        prevM = 11
        prevY--
      }
      const prevDim = new Date(prevY, prevM + 1, 0).getDate()
      const prevD = Math.min(cycleDay, prevDim)
      const periodStart = new Date(prevY, prevM, prevD, hours, minutes, 0, 0)

      periods.push({
        cutoffDate: new Date(cutoff),
        startDate: new Date(periodStart),
        periodStart: formatDateTimeForApi(periodStart),
        periodEnd: formatDateTimeForApi(cutoff)
      })
    }
  }

  return periods
}

/**
 * The billing periods of a payment method, newest first (main BPR:218-225): weekly the last 52 (D-19; `main` listed every
 * week since 1 January 2025, BP-M1, so the list grew for ever), monthly the last 12. `key` names a period in the UI and in a download: the gateway and the end of the period, because two weekly
 * methods with the same cycle share every end (review r1 H4: a download of Stripe marked and blamed the row of ACH).
 */
export const billingPeriods = (method, now = new Date()) => {
  if (!method) return []
  const periods = getCutoffDates(method, method.cycle === 'weekly' ? 52 : 12, now)
  return periods.map(period => ({ key: `${method.gateway}|${period.periodEnd}`, ...period }))
}

const sortKey = (value) => (value == null ? '' : String(value).replace('T', ' '))

/** The invoices from the newest to the oldest (BP-06): `period_end` descending, then `id` descending. A copy; `null` is an empty list. */
export const sortInvoicesNewestFirst = (invoices) => {
  if (!Array.isArray(invoices)) return []
  return [...invoices].sort((a, b) => {
    const ea = sortKey(a?.period_end)
    const eb = sortKey(b?.period_end)
    if (ea !== eb) return ea < eb ? 1 : -1
    return (Number(b?.id) || 0) - (Number(a?.id) || 0)
  })
}

/** The family an invoice status belongs to, for the colour and the icon of its badge. */
export const INVOICE_STATUS_FAMILY = Object.freeze({
  pending: 'pending',
  paid: 'done',
  completed: 'done',
  cancelled: 'cancel',
  canceled: 'cancel',
  void: 'cancel'
})

/** `pending` | `done` | `cancel` | `review` (any other status the API may add); `null` without a status. */
export const invoiceStatusFamily = (status) => {
  if (status == null || String(status).trim() === '') return null
  return INVOICE_STATUS_FAMILY[String(status).trim().toLowerCase()] || 'review'
}

export const HISTORY_PRESETS = ['this_month', 'last_month', 'last_3_months', 'this_year']

/**
 * The `{ from, to }` days (`YYYY-MM-DD`) of a payment-history preset. `today` is a `YYYY-MM-DD` day. `null` for a preset that does not exist.
 */
export const historyPresetRange = (preset, today) => {
  const firstOfMonth = monthOf(today)
  switch (preset) {
    case 'this_month':
      return { from: firstOfMonth, to: today }
    case 'last_month':
      return { from: shiftDay(firstOfMonth, -1, 'month'), to: shiftDay(firstOfMonth, -1, 'day') }
    case 'last_3_months':
      return { from: shiftDay(firstOfMonth, -2, 'month'), to: today }
    case 'this_year':
      return { from: shiftDay(firstOfMonth, -(Number(firstOfMonth.slice(5, 7)) - 1), 'month'), to: today }
    default:
      return null
  }
}

/** The file of the payment history PDF (main BPR:342). */
export const paymentHistoryFileName = (businessId, from, to) => `payment_history_${businessId}_${from}_to_${to}.pdf`

/** The file of the payment report CSV of a period (main BPR:383-384). */
export const paymentReportFileName = (gateway, periodEnd) => `payment-report-${gateway}-${String(periodEnd).split(' ')[0]}.csv`

/**
 * redesign business-payments integration (BP-M6): an amount with the project's `parsePrice`, the sign in front of it. `parsePrice` groups the
 * digits of a negative number with its minus sign, so -177.76 came out as «$ -,177.76» (also in `main`, where negative transfers sat at the
 * bottom of the list). The absolute value goes through `parsePrice` and the sign is put before it: «-$ 177.76», the form the payment report
 * already uses for its charges. `null` is 0, as in `main`.
 */
export const formatAmount = (parsePrice, amount) => {
  const value = amount == null ? 0 : parseFloat(amount)
  if (!Number.isFinite(value)) return parsePrice(value)
  return value < 0 ? `-${parsePrice(-value)}` : parsePrice(value)
}
