import React from 'react'

// redesign what the /stores/markups route and the Markups section of the store editor (5.13) share, so both lists say the
// same thing: the words of a markup (delivery types, rule types, «Applies to») and the helpers of the list (the foot's template, the
// reason of a failed delete, the reload after a delete). «Eat in» is EAT_IN, the key the route had in `main` (EATING, the one the
// section used, is badly translated).

/** The delivery types a markup can apply to, «All delivery types» first: `[{ value, content }]`. */
export const markupDeliveryTypeOptions = (t) => ([
  { value: 'all', content: t('ALL_DELIVERY_TYPES', 'All delivery types') },
  { value: 'delivery', content: t('DELIVERY', 'Delivery') },
  { value: 'pickup', content: t('PICKUP', 'Pickup') },
  { value: 'eatin', content: t('EAT_IN', 'Eat in') },
  { value: 'curbside', content: t('CURBSIDE', 'Curbside') },
  { value: 'drive_thru', content: t('DRIVE_THRU', 'Drive thru') },
  { value: 'seat_delivery', content: t('SEAT_DELIVERY', 'Seat delivery') },
  { value: 'catering_delivery', content: t('CATERING_DELIVERY', 'Catering delivery') },
  { value: 'catering_pickup', content: t('CATERING_PICKUP', 'Catering pickup') },
  { value: 'reservation', content: t('RESERVATION', 'Reservation') }
])

/** The two kinds of rule: `[{ value, content }]`. */
export const markupTypeOptions = (t) => ([
  { value: 'percentage', content: t('PERCENTAGE', '%') },
  { value: 'fixed', content: t('FIXED', 'Fixed') }
])

/**
 * «Main site · Delivery»: where a markup applies. A site the list does not know is said by its id, translated; a delivery type
 * with no option is said from its key.
 * @param {object} markup
 * @param {{ sites: Array<{ id, name }>, deliveryTypeOptions: Array<{ value, content }>, t: Function }} context
 * @returns {string}
 */
export const markupAppliesTo = (markup, { sites, deliveryTypeOptions, t }) => {
  let site = t('ALL_SITES', 'All sites')
  if (markup?.site_id) {
    const found = (sites || []).find(item => String(item.id) === String(markup.site_id))
    site = found?.name || t('SITE_WITH_ID', 'Site _id_').replace('_id_', () => String(markup.site_id))
  }
  let delivery = t('ALL_DELIVERY_TYPES', 'All delivery types')
  if (markup?.delivery_type) {
    const option = (deliveryTypeOptions || []).find(item => item.value === markup.delivery_type)
    delivery = option?.content || markup.delivery_type.charAt(0).toUpperCase() + markup.delivery_type.slice(1).replace(/_/g, ' ')
  }
  return `${site} · ${delivery}`
}

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11) and keep their direction in RTL
export const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

export const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

// The reason of a failed bulk delete: the controller prefixes each message with «#<id>: », but the notice already says how many
// failed, so the prefix goes.
export const withoutIdPrefix = (message) => (typeof message === 'string' ? message.replace(/^#[^\s:]+:\s*/, '') : message)

// A delete that removed something asks the page again, so the foot («Showing 1–10 of N») and the rows say the same thing: the rows of the
// next pages move up into it. If the delete left the page past the end (the total no longer reaches it, so the page would be empty
// and it is not the first), the one before is asked. Nothing deleted, nothing asked. The foot's own clamp may ask the same last page
// at the same moment: both ask for the same page.
export const reloadAfterDelete = ({ rows, deleted, pagination, setPagination, load }) => {
  if (!deleted || deleted.length === 0) return
  const current = Number(pagination?.currentPage) >= 1 ? Number(pagination.currentPage) : 1
  const size = Number(pagination?.pageSize) >= 1 ? Number(pagination.pageSize) : 10
  const total = Number(pagination?.totalItems)
  let page = current
  if (Number.isFinite(total)) {
    page = Math.min(current, Math.max(1, Math.ceil(Math.max(total - deleted.length, 0) / size)))
  } else if (current > 1 && rows.every(row => deleted.some(id => String(id) === String(row.id)))) {
    page = current - 1 // the total is not known: an emptied page falls back to the previous one
  }
  if (page !== current) setPagination?.(prev => ({ ...prev, currentPage: page }))
  load?.(page, size)
}
