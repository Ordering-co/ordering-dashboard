// redesign reviews FB (D4, D9, RV-02, RV-03): the pure data helpers of /intelligence/reviews (no React, no I/O).
// The shapes they read are the ones measured in `orderingv1`: a business has `reviews: { total, quality, delivery,
// service, package, reviews_count, reviews: [...] }`, a user has `qualification` (may be null) and a product has
// `reviews: { total }`. A note of 0 (or text, null, NaN) means «no notes yet», never a note.

const BREAKDOWN_IDS = ['quality', 'delivery', 'service', 'package']

/** The note as a finite number > 0, or `null` when there is none (also for `'0'`, `0`, `null`, `''`, `NaN`). */
export const ratingOf = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export const businessRating = (business) => ratingOf(business?.reviews?.total)

export const userRating = (user) => ratingOf(user?.qualification)

export const productRating = (product) => ratingOf(product?.reviews?.total)

/** How many reviews a business has: its `reviews_count` when it is a number, else the length of the (partial) list, else `null`. */
export const reviewCount = (business) => {
  const reviews = business?.reviews
  if (typeof reviews?.reviews_count === 'number' && Number.isFinite(reviews.reviews_count)) return reviews.reviews_count
  if (Array.isArray(reviews?.reviews)) return reviews.reviews.length
  return null
}

/** The object `K/SatisfactionScores` reads: `{ general, quality, delivery, service, package }` (it hides the empty ones). */
export const businessScores = (reviews) => ({
  general: reviews?.total,
  quality: reviews?.quality,
  delivery: reviews?.delivery,
  service: reviews?.service,
  package: reviews?.package
})

/** The notes of one review, in order, without those that are not a number > 0. */
export const reviewBreakdown = (review) => BREAKDOWN_IDS
  .map(id => ({ id, value: ratingOf(review?.[id]) }))
  .filter(item => item.value !== null)

/** A user review is «liked» when its qualification is 5 (the rule of main). */
export const isLiked = (review) => review?.qualification === 5

const pad = (n) => `${n}`.padStart(2, '0')

const formatYMD = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** The default range of the CSV, as main: from 30 days ago to today, `YYYY-MM-DD` in local time. */
export const defaultCsvRange = (now = new Date()) => {
  const to = new Date(now.getTime())
  const from = new Date(now.getTime())
  from.setDate(from.getDate() - 30)
  return { from: formatYMD(from), to: formatYMD(to) }
}

// Same shape and order as `buildWhere` of ReviewsListing: the extra conditions first, then `from`, then `to`.
const buildWhere = (extraConditions, from, to) => {
  const conditions = [...extraConditions]
  if (from) {
    conditions.push({ attribute: 'created_at', value: { condition: '>=', value: `${from} 00:00:00` } })
  }
  if (to) {
    conditions.push({ attribute: 'created_at', value: { condition: '<=', value: `${to} 23:59:59` } })
  }
  return conditions
}

/**
 * The CSV request of a tab, identical to main (ReviewsListing handleDownload): `{ url, filename }`.
 * `business` downloads the reviews of the businesses (all, or `businessId`); `drivers` the reviews of drivers
 * (all, or `driverId` unless it is `'all'`).
 */
export const reviewsCsvRequest = ({ tab, root, businessId, driverId, from, to } = {}) => {
  const params = new URLSearchParams()
  if (tab === 'business') {
    if (businessId) params.append('business_id', businessId)
    params.append('where', JSON.stringify(buildWhere([], from, to)))
    return {
      url: `${root}/business/business_reviews_delivery.csv?${params.toString()}`,
      filename: `business_reviews_delivery_${from}_${to}.csv`
    }
  }
  if (driverId && driverId !== 'all') params.append('user_id', driverId)
  params.append('where', JSON.stringify(buildWhere([{ attribute: 'type', value: 1 }], from, to)))
  return {
    url: `${root}/users/user_reviews.csv?${params.toString()}`,
    filename: `driver_reviews_${from}_${to}.csv`
  }
}
