/**
 * How a filter's value is written in a pill and in a chip (redesign F6c-2). Pure text: no React, no context.
 * redesign W0-2a (T0-4): promoted from Orders/OrdersFilterGroup, next to `summarizeIds` (FilterPopover.jsx), which forms
 * the value of the chips: two formats on purpose (pill and chip) that belong together.
 */

/**
 * The value of a pill (redesign F6c-2, Q2-15): the name when there is one, the count when there are
 * several. `nameOf(id)` returns the readable name or nothing (the id is the fallback while a list loads).
 */
export const pillValue = (ids, nameOf) => {
  const list = Array.isArray(ids) ? ids : []
  if (list.length === 0) return ''
  if (list.length > 1) return String(list.length)
  return String(nameOf(list[0]) ?? list[0])
}

/**
 * A group name from the API may already start with the field's label («Driver Group: Shipday»): the
 * label is never written twice, so the label is cut from the front of the value.
 */
export const withoutLeadingLabel = (label, value) => {
  const text = String(value ?? '')
  const head = String(label ?? '').trim()
  if (!head || !text.toLocaleLowerCase().startsWith(head.toLocaleLowerCase())) return text
  const rest = text.slice(head.length).replace(/^\s*[:·\-–]?\s*/, '')
  return rest || text
}
